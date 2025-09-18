from decimal import Decimal
import re
import os
from threading import Thread

from django.apps import apps
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import TareaActualizacionLikewize, LikewizeItemStaging,LikewizeCazadorTarea
from ..serializers import TareaLikewizeSerializer,LikewizeCazadorResultadoSerializer


# ============== helpers ==============

def _resolve_model_from_setting(value, setting_name: str):
    """
    Acepta un string 'app_label.ModelName' o una clase de modelo.
    Devuelve la clase de modelo o lanza ImproperlyConfigured si falla.
    """
    if value is None:
        raise ImproperlyConfigured(f"settings.{setting_name} no está definido")
    if isinstance(value, str):
        model = apps.get_model(value)
        if model is None:
            raise ImproperlyConfigured(f"settings.{setting_name}='{value}' no se pudo resolver")
        return model
    # ya es una clase de modelo
    return value


def _has_field(model, name: str) -> bool:
    return any(getattr(f, "name", None) == name for f in model._meta.get_fields())


def _apply_common_filters(qs):
    """
    Filtros para el conjunto oficial:
    - tenant_schema IS NULL (si existe)
    - canal='B2B' (si existe el campo)
    - vigentes (valid_to nulo o en futuro, si existe)
    """
    M = qs.model

    # tenant_schema IS NULL
    if _has_field(M, "tenant_schema"):
        qs = qs.filter(tenant_schema__isnull=True)

    # canal B2B (si existe)
    if _has_field(M, "canal"):
        qs = qs.filter(canal="B2B")

    # NO filtramos por fuente

    # vigentes (si existe)
    if _has_field(M, "valid_to"):
        now = timezone.now()
        qs = qs.filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))

    return qs

def _apply_common_filters_channel(qs, channel: str):
    M = qs.model
    if _has_field(M, "tenant_schema"):
        qs = qs.filter(tenant_schema__isnull=True)
    if _has_field(M, "canal"):
        qs = qs.filter(canal=channel)
    if _has_field(M, "valid_to"):
        now = timezone.now()
        qs = qs.filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
    return qs


def _key_cap(cap_id: int) -> str:
    return str(cap_id)


# ============== API views ==============

class LanzarActualizacionLikewizeView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        tarea = TareaActualizacionLikewize.objects.create()

        def _runner():
            # ejecuta el management command en este mismo proceso/venv
            call_command('actualizar_likewize', tarea=str(tarea.id))

        Thread(target=_runner, daemon=True).start()
        return Response({"tarea_id": str(tarea.id)}, status=status.HTTP_202_ACCEPTED)


class EstadoTareaLikewizeView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id):
        t = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)
        data = TareaLikewizeSerializer(t).data

        def to_url(path):
            if not path:
                return ""
            rel = os.path.relpath(path, settings.MEDIA_ROOT)
            return request.build_absolute_uri(settings.MEDIA_URL + rel.replace("\\", "/"))

        data["log_url"] = to_url(t.log_path)
        return Response(data)


class DiffLikewizeView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id):
        t = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)
        if t.estado != "SUCCESS":
            return Response({"detail": "La tarea aún no está lista."}, status=409)

        # 1) STAGING (solo los mapeados a capacidad_id)
        S_qs = (LikewizeItemStaging.objects
                .filter(tarea=t, capacidad_id__isnull=False)
                .values("capacidad_id", "precio_b2b", "tipo", "modelo_norm", "almacenamiento_gb"))
        S = {}
        for s in S_qs:
            k = _key_cap(s["capacidad_id"])
            S[k] = s  # si hubiese duplicados, se pisa; normalmente 1:1

        # 2) OFICIAL (PrecioB2B/PrecioRecompra según settings)
        PrecioB2B = _resolve_model_from_setting(getattr(settings, "PRECIOS_B2B_MODEL", None), "PRECIOS_B2B_MODEL")
        base = _apply_common_filters(PrecioB2B.objects.all())

        # Dedup por capacidad_id, cogiendo el más reciente si hay campo temporal
        order_field = "valid_from" if _has_field(PrecioB2B, "valid_from") else (
            "updated_at" if _has_field(PrecioB2B, "updated_at") else None
        )
        iter_qs = base.filter(capacidad_id__isnull=False)
        if order_field:
            iter_qs = iter_qs.order_by("capacidad_id", f"-{order_field}")
        else:
            iter_qs = iter_qs.order_by("capacidad_id")

        E = {}
        for e in iter_qs.values("capacidad_id", "precio_neto", "updated_at"):
            k = _key_cap(e["capacidad_id"])
            if k not in E:
                E[k] = e  # ya están ordenados para que el primero sea el más reciente si procede

        inserts, updates, deletes = [], [], []

        # Altas/Updates
        for k, s in S.items():
            cap_id = int(k)
            precio_nuevo = Decimal(str(s["precio_b2b"]))
            if k not in E:
                inserts.append({
                    "id": f"I|{k}|{precio_nuevo}",
                    "capacidad_id": cap_id,
                    "antes": None,
                    "despues": str(precio_nuevo),
                    "delta": None,
                    "kind": "INSERT",
                    "tipo": s["tipo"],
                    "modelo_norm": s["modelo_norm"],
                    "almacenamiento_gb": s["almacenamiento_gb"],
                })
            else:
                precio_viejo = Decimal(str(E[k]["precio_neto"]))
                if precio_viejo != precio_nuevo:
                    updates.append({
                        "id": f"U|{k}|{precio_viejo}|{precio_nuevo}",
                        "capacidad_id": cap_id,
                        "antes": str(precio_viejo),
                        "despues": str(precio_nuevo),
                        "delta": float(precio_nuevo - precio_viejo),
                        "kind": "UPDATE",
                        "tipo": s["tipo"],
                        "modelo_norm": s["modelo_norm"],
                        "almacenamiento_gb": s["almacenamiento_gb"],
                    })

        # Bajas (enriquece con info de capacidad/modelo si está disponible)
        delete_ids = [int(k) for k in E.keys() if k not in S]
        cap_info_map = {}
        if delete_ids:
            CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
            rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
            rel_name = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
            gb_field = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
            qs_cap = (CapacidadModel.objects
                      .filter(id__in=delete_ids)
                      .select_related(rel_field)
                      .only("id", gb_field, f"{rel_field}__{rel_name}", f"{rel_field}__tipo"))

            def _gb_from_text(txt: str) -> int | None:
                if not txt:
                    return None
                m = re.search(r"(\d+(?:[.,]\d+)?)\s*(TB|GB)\b", txt, flags=re.I)
                if not m:
                    return None
                try:
                    val = float(m.group(1).replace(",", "."))
                except Exception:
                    return None
                unit = m.group(2).upper()
                return int(round(val * 1024)) if unit == "TB" else int(round(val))

            for cap in qs_cap:
                modelo = getattr(cap, rel_field)
                cap_info_map[cap.id] = {
                    "tipo": getattr(modelo, "tipo", "-") or "-",
                    "modelo_norm": getattr(modelo, rel_name, "-") or "-",
                    "almacenamiento_gb": _gb_from_text(getattr(cap, gb_field, "") or ""),
                    "cap_text": getattr(cap, gb_field, "") or "",
                }

        for k, e in E.items():
            if k not in S:
                cap_id = int(k)
                info = cap_info_map.get(cap_id, {})
                deletes.append({
                    "id": f"D|{k}|{e['precio_neto']}",
                    "capacidad_id": cap_id,
                    "antes": str(e["precio_neto"]),
                    "despues": None,
                    "delta": None,
                    "kind": "DELETE",
                    "tipo": info.get("tipo", "-"),
                    "modelo_norm": info.get("modelo_norm", "-"),
                    "almacenamiento_gb": info.get("almacenamiento_gb"),
                })

        # No mapeados (para que los veas en UI)
        no_mapeados = list(
            LikewizeItemStaging.objects
            .filter(tarea=t, capacidad_id__isnull=True)
            .values("id", "tipo", "modelo_norm", "almacenamiento_gb", "precio_b2b")
        )

        return Response({
            "summary": {
                "inserts": len(inserts), "updates": len(updates), "deletes": len(deletes),
                "no_mapeados": len(no_mapeados),
                "total": len(inserts) + len(updates) + len(deletes)
            },
            "changes": inserts + updates + deletes,
            "no_mapeados": no_mapeados,
        })


class AplicarCambiosLikewizeView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, tarea_id):
        ids = set(request.data.get("ids") or [])
        if not ids:
            return Response({"detail": "No hay ids a aplicar."}, status=400)

        # Recalcular diff como fuente de verdad
        resp = DiffLikewizeView().get(request, tarea_id).data
        if "changes" not in resp:
            return Response({"detail": "Tarea no lista."}, status=409)

        PrecioB2B = _resolve_model_from_setting(getattr(settings, "PRECIOS_B2B_MODEL", None), "PRECIOS_B2B_MODEL")
        applied = {"INSERT": 0, "UPDATE": 0, "DELETE": 0}

        # Para setear tenant_schema=None si existe
        set_tenant_null = _has_field(PrecioB2B, "tenant_schema")

        for ch in resp["changes"]:
            if ch["id"] not in ids:
                continue
            cap_id = ch["capacidad_id"]

            has_versioning = _has_field(PrecioB2B, "valid_from") and _has_field(PrecioB2B, "valid_to")
            now = timezone.now()

            # Base queryset por clave
            qs = PrecioB2B.objects.filter(capacidad_id=cap_id)
            if _has_field(PrecioB2B, "canal"):
                qs = qs.filter(canal="B2B")
            if _has_field(PrecioB2B, "fuente"):
                qs = qs.filter(fuente="Likewize")
            if set_tenant_null:
                qs = qs.filter(tenant_schema__isnull=True)

            if ch["kind"] in {"INSERT", "UPDATE"}:
                nuevo_precio = Decimal(ch["despues"])
                if has_versioning:
                    vigente = qs.filter(valid_to__isnull=True).order_by("-valid_from").first()
                    if vigente and Decimal(vigente.precio_neto) == nuevo_precio:
                        # Nada que hacer; ya vigente con ese precio
                        pass
                    else:
                        # Cerrar vigente si existe
                        if vigente:
                            vigente.valid_to = now
                            vigente.save(update_fields=["valid_to"])
                        # Crear nuevo vigente
                        create_kwargs = {
                            "capacidad_id": cap_id,
                            "precio_neto": nuevo_precio,
                            "valid_from": now,
                        }
                        if _has_field(PrecioB2B, "canal"):
                            create_kwargs["canal"] = "B2B"
                        if _has_field(PrecioB2B, "fuente"):
                            create_kwargs["fuente"] = "Likewize"
                        if set_tenant_null:
                            create_kwargs["tenant_schema"] = None
                        PrecioB2B.objects.create(**create_kwargs)
                else:
                    # Modelo sin versionado: update_or_create plano
                    defaults = {"precio_neto": nuevo_precio}
                    if _has_field(PrecioB2B, "canal"):
                        defaults["canal"] = "B2B"
                    if _has_field(PrecioB2B, "fuente"):
                        defaults["fuente"] = "Likewize"
                    if set_tenant_null:
                        defaults["tenant_schema"] = None
                    PrecioB2B.objects.update_or_create(
                        capacidad_id=cap_id,
                        defaults=defaults
                    )
                applied[ch["kind"]] += 1

            elif ch["kind"] == "DELETE":
                if has_versioning:
                    # Cierra el vigente de Likewize en B2B si existe
                    updated = qs.filter(valid_to__isnull=True).update(valid_to=now)
                    # Como borrado lógico por versionado, cuenta como DELETE si había alguno
                    if updated:
                        applied["DELETE"] += 1
                else:
                    PrecioB2B.objects.filter(capacidad_id=cap_id).delete()
                    applied["DELETE"] += 1

        return Response({"applied": applied}, status=200)


class LogTailLikewizeView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id):
        n = int(request.query_params.get("n", 80))
        t = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)
        lines = []
        if t.log_path and os.path.exists(t.log_path):
            with open(t.log_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()[-n:]
        return Response({"lines": [ln.rstrip("\n") for ln in lines]})

class LikewizeCazadorResultadoView(APIView):
    """
    GET /api/likewize/tareas/<uuid>/resultado/
    """
    permission_classes = [permissions.IsAuthenticated]  # Ajusta si quieres permitir lectura pública

    def get(self, request, uuid, *args, **kwargs):
        tarea = get_object_or_404(LikewizeCazadorTarea, id=uuid)
        data = LikewizeCazadorResultadoSerializer(tarea).data
        return Response(data, status=status.HTTP_200_OK)


class UltimaTareaLikewizeView(APIView):
    """
    GET /api/precios/likewize/ultima/
    Devuelve la última tarea creada (preferiblemente exitosa) para reutilizarla en UI.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        # Intenta primero la última tarea SUCCESS con algún mapeado
        with_mapped = (TareaActualizacionLikewize.objects
                        .filter(estado="SUCCESS", staging__capacidad_id__isnull=False)
                        .order_by("-finalizado_en", "-iniciado_en", "-creado_en")
                        .distinct())
        t = with_mapped.first()

        # Si no hay, intenta la última SUCCESS aunque no tenga mapeados
        if not t:
            t = (TareaActualizacionLikewize.objects
                    .filter(estado="SUCCESS")
                    .order_by("-finalizado_en", "-iniciado_en", "-creado_en")
                    .first())

        # Si sigue sin haber, coge la última en general
        if not t:
            t = (TareaActualizacionLikewize.objects
                    .order_by("-finalizado_en", "-iniciado_en", "-creado_en")
                    .first())
        if not t:
            return Response({"detail": "No hay tareas."}, status=status.HTTP_404_NOT_FOUND)

        data = TareaLikewizeSerializer(t).data

        def to_url(path):
            if not path:
                return ""
            rel = os.path.relpath(path, settings.MEDIA_ROOT)
            return request.build_absolute_uri(settings.MEDIA_URL + rel.replace("\\", "/"))

        data["log_url"] = to_url(getattr(t, "log_path", ""))
        return Response({"tarea_id": str(t.id), "tarea": data})


class CrearDesdeNoMapeadoLikewizeView(APIView):
    """
    POST /api/precios/likewize/tareas/<uuid:tarea_id>/crear-capacidad/
    Body: { staging_id: number }
    Crea Modelo y/o Capacidad a partir de una fila de staging no mapeada y
    actualiza esa fila con el nuevo capacidad_id para que aparezca en el diff.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, tarea_id):
        sid = request.data.get("staging_id")
        if not sid:
            return Response({"detail": "staging_id requerido"}, status=400)

        s = get_object_or_404(LikewizeItemStaging, pk=sid, tarea_id=tarea_id)

        # Si ya está mapeado, devolver directamente
        if s.capacidad_id:
            return Response({"capacidad_id": s.capacidad_id, "created": False}, status=200)

        # Resolver modelos configurables
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
        rel_name = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
        gb_field = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
        ModeloModel = CapacidadModel._meta.get_field(rel_field).related_model

        # Buscar o crear Modelo
        filtros = {
            rel_name: (s.modelo_norm or s.modelo_raw or "").strip(),
            "tipo": s.tipo,
        }
        # Campos opcionales si existen
        pantalla_val = f"{s.pulgadas}\"" if getattr(s, "pulgadas", None) else ""
        any_val = getattr(s, "any", None)
        cpu_val = getattr(s, "cpu", "") or ""
        if hasattr(ModeloModel, "pantalla"):
            filtros["pantalla"] = pantalla_val
        if hasattr(ModeloModel, "año"):
            filtros["año"] = any_val
        if hasattr(ModeloModel, "procesador"):
            filtros["procesador"] = cpu_val

        modelo, _ = ModeloModel.objects.get_or_create(**filtros)

        # Crear/obtener Capacidad
        if not s.almacenamiento_gb:
            return Response({"detail": "Fila sin capacidad en GB; no se puede crear Capacidad."}, status=400)
        tamaño_txt = f"{int(s.almacenamiento_gb)} GB"
        cap_defaults = {}
        if hasattr(CapacidadModel, "precio_b2b"):
            cap_defaults["precio_b2b"] = None
        cap, _ = CapacidadModel.objects.get_or_create(**{rel_field: modelo, gb_field: tamaño_txt}, defaults=cap_defaults)

        # Actualizar staging con el nuevo capacidad_id
        s.capacidad_id = cap.id
        s.save(update_fields=["capacidad_id"])

        return Response({
            "created": True,
            "modelo_id": getattr(modelo, "id", None),
            "capacidad_id": cap.id,
            "capacidad_text": tamaño_txt,
        }, status=201)


class LanzarActualizacionB2CView(APIView):
    """
    Crea una tarea y lanza el comando que descarga precios B2C a staging (Swappie).
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        country = request.data.get("country") or request.query_params.get("country") or "ES"
        delay = float(request.data.get("delay") or request.query_params.get("delay") or 0.8)
        jitter = float(request.data.get("jitter") or request.query_params.get("jitter") or 0.4)

        tarea = TareaActualizacionLikewize.objects.create()

        def _runner():
            call_command("actualizar_swappie_b2c", tarea=str(tarea.id), country=country, delay=delay, jitter=jitter)

        Thread(target=_runner, daemon=True).start()
        return Response({"tarea_id": str(tarea.id), "country": country}, status=status.HTTP_202_ACCEPTED)


class DiffB2CView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id):
        t = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)
        if t.estado != "SUCCESS":
            return Response({"detail": "La tarea aún no está lista."}, status=409)

        # 1) STAGING (solo mapeados a capacidad_id) — reutiliza LikewizeItemStaging
        S_qs = (LikewizeItemStaging.objects
                .filter(tarea=t, capacidad_id__isnull=False)
                .values("capacidad_id", "precio_b2b", "tipo", "modelo_norm", "almacenamiento_gb"))
        S = {}
        for s in S_qs:
            k = _key_cap(s["capacidad_id"])
            S[k] = s

        # 2) OFICIAL (PrecioRecompra canal B2C)
        PrecioModel = _resolve_model_from_setting(getattr(settings, "PRECIOS_B2B_MODEL", None), "PRECIOS_B2B_MODEL")
        base = _apply_common_filters_channel(PrecioModel.objects.all(), "B2C")
        # Limita el universo E a iPhone únicamente (Swappie solo iPhone)
        rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
        try:
            base = base.filter(**{f"capacidad__{rel_field}__tipo": "iPhone"})
        except Exception:
            pass

        order_field = "valid_from" if _has_field(PrecioModel, "valid_from") else (
            "updated_at" if _has_field(PrecioModel, "updated_at") else None
        )
        iter_qs = base.filter(capacidad_id__isnull=False)
        if order_field:
            iter_qs = iter_qs.order_by("capacidad_id", f"-{order_field}")
        else:
            iter_qs = iter_qs.order_by("capacidad_id")

        E = {}
        for e in iter_qs.values("capacidad_id", "precio_neto"):
            k = _key_cap(e["capacidad_id"])
            if k not in E:
                E[k] = e

        inserts, updates, deletes = [], [], []

        for k, s in S.items():
            cap_id = int(k)
            precio_nuevo = Decimal(str(s["precio_b2b"]))
            if k not in E:
                inserts.append({
                    "id": f"I|{k}|{precio_nuevo}",
                    "capacidad_id": cap_id,
                    "antes": None,
                    "despues": str(precio_nuevo),
                    "delta": None,
                    "kind": "INSERT",
                    "tipo": s["tipo"],
                    "modelo_norm": s["modelo_norm"],
                    "almacenamiento_gb": s["almacenamiento_gb"],
                })
            else:
                precio_viejo = Decimal(str(E[k]["precio_neto"]))
                if precio_viejo != precio_nuevo:
                    updates.append({
                        "id": f"U|{k}|{precio_viejo}|{precio_nuevo}",
                        "capacidad_id": cap_id,
                        "antes": str(precio_viejo),
                        "despues": str(precio_nuevo),
                        "delta": float(precio_nuevo - precio_viejo),
                        "kind": "UPDATE",
                        "tipo": s["tipo"],
                        "modelo_norm": s["modelo_norm"],
                        "almacenamiento_gb": s["almacenamiento_gb"],
                    })

        # Bajas con detalle de capacidad/modelo
        delete_ids = [int(k) for k in E.keys() if k not in S]
        cap_info_map = {}
        if delete_ids:
            CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
            rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
            rel_name = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
            gb_field = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
            qs_cap = (CapacidadModel.objects
                      .filter(id__in=delete_ids)
                      .select_related(rel_field)
                      .only("id", gb_field, f"{rel_field}__{rel_name}", f"{rel_field}__tipo"))

            def _gb_from_text(txt: str) -> int | None:
                if not txt:
                    return None
                m = re.search(r"(\d+(?:[.,]\d+)?)\s*(TB|GB)\b", txt, flags=re.I)
                if not m:
                    return None
                try:
                    val = float(m.group(1).replace(",", "."))
                except Exception:
                    return None
                unit = m.group(2).upper()
                return int(round(val * 1024)) if unit == "TB" else int(round(val))

            for cap in qs_cap:
                modelo = getattr(cap, rel_field)
                cap_info_map[cap.id] = {
                    "tipo": getattr(modelo, "tipo", "-") or "-",
                    "modelo_norm": getattr(modelo, rel_name, "-") or "-",
                    "almacenamiento_gb": _gb_from_text(getattr(cap, gb_field, "") or ""),
                    "cap_text": getattr(cap, gb_field, "") or "",
                }

        faltan_swappie = []
        for k, e in E.items():
            if k not in S:
                cap_id = int(k)
                info = cap_info_map.get(cap_id, {})
                row = {
                    "id": f"D|{k}|{e['precio_neto']}",
                    "capacidad_id": cap_id,
                    "antes": str(e["precio_neto"]),
                    "despues": None,
                    "delta": None,
                    "kind": "DELETE",
                    "tipo": info.get("tipo", "-"),
                    "modelo_norm": info.get("modelo_norm", "-"),
                    "almacenamiento_gb": info.get("almacenamiento_gb"),
                }
                deletes.append(row)
                # También expón como 'faltan en Swappie'
                faltan_swappie.append({
                    "capacidad_id": cap_id,
                    "tipo": info.get("tipo", "-"),
                    "modelo_norm": info.get("modelo_norm", "-"),
                    "almacenamiento_gb": info.get("almacenamiento_gb"),
                    "cap_text": info.get("cap_text", ""),
                    "precio_actual": str(e.get("precio_neto")),
                })

        no_mapeados = list(
            LikewizeItemStaging.objects
            .filter(tarea=t, capacidad_id__isnull=True)
            .values("id", "tipo", "modelo_norm", "almacenamiento_gb", "precio_b2b")
        )

        return Response({
            "summary": {
                "inserts": len(inserts), "updates": len(updates), "deletes": len(deletes),
                "no_mapeados": len(no_mapeados),
                "total": len(inserts) + len(updates) + len(deletes)
            },
            "changes": inserts + updates + deletes,
            "no_mapeados": no_mapeados,
            "faltan_swappie": faltan_swappie,
        })


class AplicarCambiosB2CView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, tarea_id):
        ids = set(request.data.get("ids") or [])
        if not ids:
            return Response({"detail": "No hay ids a aplicar."}, status=400)

        # Recalcular diff como fuente de verdad
        resp = DiffB2CView().get(request, tarea_id).data
        if "changes" not in resp:
            return Response({"detail": "Tarea no lista."}, status=409)

        PrecioModel = _resolve_model_from_setting(getattr(settings, "PRECIOS_B2B_MODEL", None), "PRECIOS_B2B_MODEL")
        applied = {"INSERT": 0, "UPDATE": 0, "DELETE": 0}

        set_tenant_null = _has_field(PrecioModel, "tenant_schema")
        has_versioning = _has_field(PrecioModel, "valid_from") and _has_field(PrecioModel, "valid_to")
        now = timezone.now()

        for ch in resp["changes"]:
            if ch["id"] not in ids:
                continue
            cap_id = ch["capacidad_id"]

            qs = PrecioModel.objects.filter(capacidad_id=cap_id)
            if _has_field(PrecioModel, "canal"):
                qs = qs.filter(canal="B2C")
            if _has_field(PrecioModel, "fuente"):
                qs = qs.filter(fuente="Swappie")
            if set_tenant_null:
                qs = qs.filter(tenant_schema__isnull=True)

            if ch["kind"] in {"INSERT", "UPDATE"}:
                nuevo_precio = Decimal(ch["despues"])
                if has_versioning:
                    vigente = qs.filter(valid_to__isnull=True).order_by("-valid_from").first()
                    if vigente and Decimal(vigente.precio_neto) == nuevo_precio:
                        pass
                    else:
                        if vigente:
                            vigente.valid_to = now
                            vigente.save(update_fields=["valid_to"])
                        create_kwargs = {
                            "capacidad_id": cap_id,
                            "precio_neto": nuevo_precio,
                            "valid_from": now,
                        }
                        if _has_field(PrecioModel, "canal"):
                            create_kwargs["canal"] = "B2C"
                        if _has_field(PrecioModel, "fuente"):
                            create_kwargs["fuente"] = "Swappie"
                        if set_tenant_null:
                            create_kwargs["tenant_schema"] = None
                        PrecioModel.objects.create(**create_kwargs)
                else:
                    defaults = {"precio_neto": nuevo_precio}
                    if _has_field(PrecioModel, "canal"):
                        defaults["canal"] = "B2C"
                    if _has_field(PrecioModel, "fuente"):
                        defaults["fuente"] = "Swappie"
                    if set_tenant_null:
                        defaults["tenant_schema"] = None
                    PrecioModel.objects.update_or_create(capacidad_id=cap_id, defaults=defaults)
                applied[ch["kind"]] += 1

            elif ch["kind"] == "DELETE":
                if has_versioning:
                    updated = qs.filter(valid_to__isnull=True).update(valid_to=now)
                    if updated:
                        applied["DELETE"] += 1
                else:
                    PrecioModel.objects.filter(capacidad_id=cap_id).delete()
                    applied["DELETE"] += 1

        return Response({"applied": applied}, status=200)


class UltimaTareaB2CView(APIView):
    """
    GET /api/precios/b2c/ultima/
    Devuelve la última tarea B2C (Swappie) creada, priorizando las que tienen mapeados.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        # Identificamos tareas B2C por el log_path que apunta al directorio 'swappie'
        qs_base = TareaActualizacionLikewize.objects.filter(log_path__icontains='/swappie/')

        with_mapped = (qs_base
                        .filter(estado="SUCCESS", staging__capacidad_id__isnull=False)
                        .order_by("-finalizado_en", "-iniciado_en", "-creado_en")
                        .distinct())
        t = with_mapped.first()

        if not t:
            t = (qs_base
                 .filter(estado="SUCCESS")
                 .order_by("-finalizado_en", "-iniciado_en", "-creado_en")
                 .first())
        if not t:
            t = qs_base.order_by("-finalizado_en", "-iniciado_en", "-creado_en").first()
        if not t:
            return Response({"detail": "No hay tareas B2C."}, status=status.HTTP_404_NOT_FOUND)

        data = TareaLikewizeSerializer(t).data

        def to_url(path):
            if not path:
                return ""
            rel = os.path.relpath(path, settings.MEDIA_ROOT)
            return request.build_absolute_uri(settings.MEDIA_URL + rel.replace("\\", "/"))

        data["log_url"] = to_url(getattr(t, "log_path", ""))
        return Response({"tarea_id": str(t.id), "tarea": data})


class LanzarActualizacionBackmarketView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        delay = float(request.data.get("delay") or request.query_params.get("delay") or 0.8)
        jitter = float(request.data.get("jitter") or request.query_params.get("jitter") or 0.4)

        tarea = TareaActualizacionLikewize.objects.create()

        def _runner():
            call_command("actualizar_backmarket_b2c", tarea=str(tarea.id), delay=delay, jitter=jitter)

        Thread(target=_runner, daemon=True).start()
        return Response({"tarea_id": str(tarea.id)}, status=status.HTTP_202_ACCEPTED)


class DiffBackmarketView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id):
        t = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)
        if t.estado != "SUCCESS":
            return Response({"detail": "La tarea aún no está lista."}, status=409)

        # Staging iPhone
        S_qs = (LikewizeItemStaging.objects
                .filter(tarea=t, capacidad_id__isnull=False)
                .values("capacidad_id", "precio_b2b", "tipo", "modelo_norm", "almacenamiento_gb"))
        S = {}
        for s in S_qs:
            S[_key_cap(s["capacidad_id"])] = s

        PrecioModel = _resolve_model_from_setting(getattr(settings, "PRECIOS_B2B_MODEL", None), "PRECIOS_B2B_MODEL")
        base = _apply_common_filters_channel(PrecioModel.objects.all(), "B2C")
        # Limita a iPhone
        rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
        try:
            base = base.filter(**{f"capacidad__{rel_field}__tipo": "iPhone"})
        except Exception:
            pass

        order_field = "valid_from" if _has_field(PrecioModel, "valid_from") else (
            "updated_at" if _has_field(PrecioModel, "updated_at") else None
        )
        iter_qs = base.filter(capacidad_id__isnull=False)
        if order_field:
            iter_qs = iter_qs.order_by("capacidad_id", f"-{order_field}")
        else:
            iter_qs = iter_qs.order_by("capacidad_id")

        E = {}
        for e in iter_qs.values("capacidad_id", "precio_neto"):
            k = _key_cap(e["capacidad_id"])
            if k not in E:
                E[k] = e

        inserts, updates, deletes = [], [], []

        for k, s in S.items():
            cap_id = int(k)
            precio_nuevo = Decimal(str(s["precio_b2b"]))
            if k not in E:
                inserts.append({
                    "id": f"I|{k}|{precio_nuevo}",
                    "capacidad_id": cap_id,
                    "antes": None,
                    "despues": str(precio_nuevo),
                    "delta": None,
                    "kind": "INSERT",
                    "tipo": s["tipo"],
                    "modelo_norm": s["modelo_norm"],
                    "almacenamiento_gb": s["almacenamiento_gb"],
                })
            else:
                precio_viejo = Decimal(str(E[k]["precio_neto"]))
                if precio_viejo != precio_nuevo:
                    updates.append({
                        "id": f"U|{k}|{precio_viejo}|{precio_nuevo}",
                        "capacidad_id": cap_id,
                        "antes": str(precio_viejo),
                        "despues": str(precio_nuevo),
                        "delta": float(precio_nuevo - precio_viejo),
                        "kind": "UPDATE",
                        "tipo": s["tipo"],
                        "modelo_norm": s["modelo_norm"],
                        "almacenamiento_gb": s["almacenamiento_gb"],
                    })

        # Bajas enriquecidas
        delete_ids = [int(k) for k in E.keys() if k not in S]
        cap_info_map = {}
        if delete_ids:
            CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
            rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
            rel_name = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
            gb_field = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
            qs_cap = (CapacidadModel.objects
                      .filter(id__in=delete_ids)
                      .select_related(rel_field)
                      .only("id", gb_field, f"{rel_field}__{rel_name}", f"{rel_field}__tipo"))

            def _gb_from_text(txt: str) -> int | None:
                if not txt:
                    return None
                m = re.search(r"(\d+(?:[.,]\d+)?)\s*(TB|GB)\b", txt, flags=re.I)
                if not m:
                    return None
                try:
                    val = float(m.group(1).replace(",", "."))
                except Exception:
                    return None
                unit = m.group(2).upper()
                return int(round(val * 1024)) if unit == "TB" else int(round(val))

            for cap in qs_cap:
                modelo = getattr(cap, rel_field)
                cap_info_map[cap.id] = {
                    "tipo": getattr(modelo, "tipo", "-") or "-",
                    "modelo_norm": getattr(modelo, rel_name, "-") or "-",
                    "almacenamiento_gb": _gb_from_text(getattr(cap, gb_field, "") or ""),
                }

        for k, e in E.items():
            if k not in S:
                cap_id = int(k)
                info = cap_info_map.get(cap_id, {})
                deletes.append({
                    "id": f"D|{k}|{e['precio_neto']}",
                    "capacidad_id": cap_id,
                    "antes": str(e["precio_neto"]),
                    "despues": None,
                    "delta": None,
                    "kind": "DELETE",
                    "tipo": info.get("tipo", "-"),
                    "modelo_norm": info.get("modelo_norm", "-"),
                    "almacenamiento_gb": info.get("almacenamiento_gb"),
                })

        no_mapeados = list(
            LikewizeItemStaging.objects
            .filter(tarea=t, capacidad_id__isnull=True)
            .values("id", "tipo", "modelo_norm", "almacenamiento_gb", "precio_b2b")
        )

        return Response({
            "summary": {
                "inserts": len(inserts), "updates": len(updates), "deletes": len(deletes),
                "no_mapeados": len(no_mapeados),
                "total": len(inserts) + len(updates) + len(deletes)
            },
            "changes": inserts + updates + deletes,
            "no_mapeados": no_mapeados,
        })


class AplicarCambiosBackmarketView(APIView):
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, tarea_id):
        ids = set(request.data.get("ids") or [])
        if not ids:
            return Response({"detail": "No hay ids a aplicar."}, status=400)

        resp = DiffBackmarketView().get(request, tarea_id).data
        if "changes" not in resp:
            return Response({"detail": "Tarea no lista."}, status=409)

        PrecioModel = _resolve_model_from_setting(getattr(settings, "PRECIOS_B2B_MODEL", None), "PRECIOS_B2B_MODEL")
        applied = {"INSERT": 0, "UPDATE": 0, "DELETE": 0}

        set_tenant_null = _has_field(PrecioModel, "tenant_schema")
        has_versioning = _has_field(PrecioModel, "valid_from") and _has_field(PrecioModel, "valid_to")
        now = timezone.now()

        for ch in resp["changes"]:
            if ch["id"] not in ids:
                continue
            cap_id = ch["capacidad_id"]

            qs = PrecioModel.objects.filter(capacidad_id=cap_id)
            if _has_field(PrecioModel, "canal"):
                qs = qs.filter(canal="B2C")
            if _has_field(PrecioModel, "fuente"):
                qs = qs.filter(fuente="Backmarket")
            if set_tenant_null:
                qs = qs.filter(tenant_schema__isnull=True)

            if ch["kind"] in {"INSERT", "UPDATE"}:
                nuevo_precio = Decimal(ch["despues"])
                if has_versioning:
                    vigente = qs.filter(valid_to__isnull=True).order_by("-valid_from").first()
                    if vigente and Decimal(vigente.precio_neto) == nuevo_precio:
                        pass
                    else:
                        if vigente:
                            vigente.valid_to = now
                            vigente.save(update_fields=["valid_to"])
                        create_kwargs = {
                            "capacidad_id": cap_id,
                            "precio_neto": nuevo_precio,
                            "valid_from": now,
                        }
                        if _has_field(PrecioModel, "canal"):
                            create_kwargs["canal"] = "B2C"
                        if _has_field(PrecioModel, "fuente"):
                            create_kwargs["fuente"] = "Backmarket"
                        if set_tenant_null:
                            create_kwargs["tenant_schema"] = None
                        PrecioModel.objects.create(**create_kwargs)
                else:
                    defaults = {"precio_neto": nuevo_precio}
                    if _has_field(PrecioModel, "canal"):
                        defaults["canal"] = "B2C"
                    if _has_field(PrecioModel, "fuente"):
                        defaults["fuente"] = "Backmarket"
                    if set_tenant_null:
                        defaults["tenant_schema"] = None
                    PrecioModel.objects.update_or_create(capacidad_id=cap_id, defaults=defaults)
                applied[ch["kind"]] += 1

            elif ch["kind"] == "DELETE":
                if has_versioning:
                    updated = qs.filter(valid_to__isnull=True).update(valid_to=now)
                    if updated:
                        applied["DELETE"] += 1
                else:
                    PrecioModel.objects.filter(capacidad_id=cap_id).delete()
                    applied["DELETE"] += 1

        return Response({"applied": applied}, status=200)


class UltimaTareaBackmarketView(APIView):
    """
    GET /api/precios/backmarket/ultima/
    Devuelve la última tarea Back Market creada, priorizando las que tienen mapeados.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        qs_base = TareaActualizacionLikewize.objects.filter(log_path__icontains='/backmarket/')

        with_mapped = (qs_base
                        .filter(estado="SUCCESS", staging__capacidad_id__isnull=False)
                        .order_by("-finalizado_en", "-iniciado_en", "-creado_en")
                        .distinct())
        t = with_mapped.first()

        if not t:
            t = (qs_base
                 .filter(estado="SUCCESS")
                 .order_by("-finalizado_en", "-iniciado_en", "-creado_en")
                 .first())
        if not t:
            t = qs_base.order_by("-finalizado_en", "-iniciado_en", "-creado_en").first()
        if not t:
            return Response({"detail": "No hay tareas Back Market."}, status=status.HTTP_404_NOT_FOUND)

        data = TareaLikewizeSerializer(t).data

        def to_url(path):
            if not path:
                return ""
            rel = os.path.relpath(path, settings.MEDIA_ROOT)
            return request.build_absolute_uri(settings.MEDIA_URL + rel.replace("\\", "/"))

        data["log_url"] = to_url(getattr(t, "log_path", ""))
        return Response({"tarea_id": str(t.id), "tarea": data})
