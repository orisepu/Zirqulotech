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
from ..likewize_config import get_apple_presets, get_extra_presets, list_unique_brands
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


def _format_storage_label(gb_value):
    if gb_value is None:
        return ""
    try:
        gb_int = int(gb_value)
    except (TypeError, ValueError):
        return ""
    if gb_int >= 1024 and gb_int % 1024 == 0:
        tb = gb_int / 1024
        tb_str = ("%g" % tb).rstrip("0").rstrip(".") if isinstance(tb, float) else str(tb)
        return f"{tb_str}TB"
    return f"{gb_int} GB"


def _parse_storage_to_gb(text):
    if not text:
        return None
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*(TB|T|GB|G)\b", str(text), flags=re.IGNORECASE)
    if not match:
        return None
    try:
        amount = float(match.group(1).replace(",", "."))
    except ValueError:
        return None
    unit = match.group(2).upper()
    if unit.startswith("T"):
        return int(round(amount * 1024))
    return int(round(amount))


def _coerce_int_or_none(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None


def _key_cap(cap_id: int) -> str:
    return str(cap_id)


# ============== API views ==============

class LikewizePresetsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        apple_brands = list_unique_brands(get_apple_presets())
        extra_brands = list_unique_brands(get_extra_presets())
        return Response({
            "apple": apple_brands,
            "others": extra_brands,
        })


class LanzarActualizacionLikewizeView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        mode = (request.data.get("mode") or request.query_params.get("mode") or "apple").lower()

        body_brands = request.data.get("brands")
        query_brands = request.query_params.getlist("brands") if hasattr(request.query_params, "getlist") else []

        collected: list[str] = []
        if isinstance(body_brands, str):
            collected.append(body_brands)
        elif isinstance(body_brands, (list, tuple, set)):
            collected.extend(body_brands)
        collected.extend(query_brands)

        cleaned_brands: list[str] = []
        seen_lower: set[str] = set()
        for item in collected:
            if not isinstance(item, str):
                continue
            val = item.strip()
            if not val:
                continue
            key = val.lower()
            if key in seen_lower:
                continue
            seen_lower.add(key)
            cleaned_brands.append(val)

        if mode == "apple":
            available = list_unique_brands(get_apple_presets())
        else:
            available = list_unique_brands(get_extra_presets())

        lookup = {opt.lower(): opt for opt in available}

        if mode == "apple" and not cleaned_brands:
            cleaned_brands = available

        canonical_brands: list[str] = []
        invalid: list[str] = []
        for brand in cleaned_brands:
            canonical = lookup.get(brand.lower())
            if not canonical:
                invalid.append(brand)
            elif canonical not in canonical_brands:
                canonical_brands.append(canonical)

        if invalid:
            return Response({
                "detail": "Las siguientes marcas no están disponibles para este modo.",
                "invalid": invalid,
                "disponibles": available,
            }, status=status.HTTP_400_BAD_REQUEST)

        if mode != "apple" and not canonical_brands:
            return Response({
                "detail": "Selecciona al menos una marca para sincronizar.",
                "disponibles": available,
            }, status=status.HTTP_400_BAD_REQUEST)

        tarea = TareaActualizacionLikewize.objects.create(
            meta={
                "mode": mode,
                "brands": canonical_brands,
            }
        )

        def _runner():
            # ejecuta el management command en este mismo proceso/venv
            call_command('actualizar_likewize', tarea=str(tarea.id), mode=mode, brands=canonical_brands)

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

        allowed_brands = {
            (b or "").strip()
            for b in LikewizeItemStaging.objects
            .filter(tarea=t)
            .values_list("marca", flat=True)
            if (b or "").strip()
        }
        if not allowed_brands:
            meta = getattr(t, "meta", {}) or {}
            meta_brands = meta.get("brands") if isinstance(meta, dict) else None
            if meta_brands:
                allowed_brands = {
                    (b or "").strip()
                    for b in meta_brands
                    if isinstance(b, str) and (b or "").strip()
                }
        allowed_brands = {b for b in allowed_brands if b}
        allowed_brands_lower = {b.lower() for b in allowed_brands}

        meta = getattr(t, "meta", {}) or {}
        meta_mode = (meta.get("mode") or "apple").lower()
        meta_brands = {
            (item or "").strip()
            for item in (meta.get("brands") or [])
            if isinstance(item, str) and (item or "").strip()
        }
        if not meta_brands and allowed_brands:
            meta_brands = allowed_brands
        if meta_mode not in {"apple", "others"} and any(b.lower() != "apple" for b in allowed_brands_lower):
            meta_mode = "others"
        if meta_mode == "apple" and any(b.lower() not in {"apple", ""} for b in allowed_brands_lower):
            meta_mode = "others"
        preset_source = get_extra_presets() if meta_mode == "others" else get_apple_presets()
        excluded_codes = {
            (code or "").strip().upper()
            for preset in preset_source
            if (not meta_brands or (preset.get("marca") or "").strip() in meta_brands)
            for code in (preset.get("exclude_m_models") or [])
            if (code or "").strip()
        }

        # 1) STAGING (solo los mapeados a capacidad_id)
        S_qs = (LikewizeItemStaging.objects
                .filter(tarea=t, capacidad_id__isnull=False)
                .values("capacidad_id", "precio_b2b", "tipo", "modelo_norm", "almacenamiento_gb", "marca", "likewize_model_code"))
        S = {}
        for s in S_qs:
            code = (s.get("likewize_model_code") or "").strip().upper()
            if excluded_codes and code in excluded_codes:
                continue
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
                    "marca": s.get("marca"),
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
                        "marca": s.get("marca"),
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
                      .only("id", gb_field, f"{rel_field}__{rel_name}", f"{rel_field}__tipo", f"{rel_field}__marca", f"{rel_field}__likewize_modelo"))
            if allowed_brands:
                qs_cap = qs_cap.filter(**{f"{rel_field}__marca__in": list(allowed_brands)})

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
                    "marca": getattr(modelo, "marca", "-") or "-",
                    "modelo_norm": getattr(modelo, rel_name, "-") or "-",
                    "almacenamiento_gb": _gb_from_text(getattr(cap, gb_field, "") or ""),
                    "cap_text": getattr(cap, gb_field, "") or "",
                    "likewize_modelo": getattr(modelo, "likewize_modelo", "") or "",
                }

        for k, e in E.items():
            if k not in S:
                cap_id = int(k)
                info = cap_info_map.get(cap_id)
                if allowed_brands_lower and info is None:
                    continue
                marca_info = (info.get("marca") if info else "-")
                marca_clean = (marca_info or "").strip()
                if allowed_brands_lower and (not marca_clean or marca_clean.lower() not in allowed_brands_lower):
                    continue
                likewize_code_model = (info or {}).get("likewize_modelo", "").strip().upper()
                likewize_code_suffix = likewize_code_model.split()[-1] if likewize_code_model else ""
                if excluded_codes and (
                    (likewize_code_model and likewize_code_model in excluded_codes) or
                    (likewize_code_suffix and likewize_code_suffix in excluded_codes)
                ):
                    continue
                deletes.append({
                    "id": f"D|{k}|{e['precio_neto']}",
                    "capacidad_id": cap_id,
                    "antes": str(e["precio_neto"]),
                    "despues": None,
                    "delta": None,
                    "kind": "DELETE",
                    "tipo": (info or {}).get("tipo", "-"),
                    "marca": marca_info or "-",
                    "modelo_norm": (info or {}).get("modelo_norm", "-"),
                    "almacenamiento_gb": (info or {}).get("almacenamiento_gb"),
                })

        # No mapeados (para que los veas en UI)
        no_mapeados = list(
            LikewizeItemStaging.objects
            .filter(tarea=t, capacidad_id__isnull=True)
            .values("id", "tipo", "modelo_norm", "almacenamiento_gb", "precio_b2b", "marca", "likewize_model_code")
        )

        if excluded_codes:
            no_mapeados = [row for row in no_mapeados if (row.get("likewize_model_code") or "").strip().upper() not in excluded_codes]

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

        override_tipo = (request.data.get("tipo") or "").strip()
        override_marca = (request.data.get("marca") or "").strip()
        override_modelo = (request.data.get("modelo") or request.data.get("modelo_norm") or "").strip()
        override_cap_text = (request.data.get("capacidad") or request.data.get("capacidad_text") or "").strip()
        override_gb = _coerce_int_or_none(request.data.get("almacenamiento_gb"))
        override_likewize_code = (request.data.get("likewize_model_code") or request.data.get("m_model") or "").strip().upper()

        fields_to_update = set()

        tipo_val = override_tipo or (s.tipo or "").strip()
        if not tipo_val:
            return Response({"detail": "No se pudo determinar el tipo del modelo."}, status=400)
        if tipo_val != s.tipo:
            s.tipo = tipo_val
            fields_to_update.add("tipo")

        marca_val = override_marca or "Apple"
        modelo_nombre = override_modelo or (s.modelo_norm or s.modelo_raw or "").strip()
        if not modelo_nombre:
            return Response({"detail": "No se pudo determinar el nombre del modelo."}, status=400)
        if modelo_nombre != (s.modelo_norm or "").strip():
            s.modelo_norm = modelo_nombre
            fields_to_update.add("modelo_norm")

        gb_value = override_gb if override_gb is not None else s.almacenamiento_gb
        if override_cap_text:
            parsed_gb = _parse_storage_to_gb(override_cap_text)
            if parsed_gb is not None:
                gb_value = parsed_gb

        if gb_value is None:
            return Response({"detail": "Fila sin capacidad en GB; no se puede crear Capacidad."}, status=400)

        try:
            gb_value = int(gb_value)
        except (TypeError, ValueError):
            return Response({"detail": "Capacidad inválida."}, status=400)

        if gb_value != s.almacenamiento_gb:
            s.almacenamiento_gb = gb_value
            fields_to_update.add("almacenamiento_gb")

        likewize_code_val = override_likewize_code or (s.likewize_model_code or "").strip().upper()
        if likewize_code_val != (s.likewize_model_code or "").strip().upper():
            s.likewize_model_code = likewize_code_val
            fields_to_update.add("likewize_model_code")

        tamaño_txt = override_cap_text or _format_storage_label(gb_value)
        if not tamaño_txt:
            tamaño_txt = f"{gb_value} GB"

        # Resolver modelos configurables
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
        rel_name = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
        gb_field = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
        ModeloModel = CapacidadModel._meta.get_field(rel_field).related_model

        # Buscar o crear Modelo
        filtros = {
            rel_name: modelo_nombre,
            "tipo": tipo_val,
            "marca": marca_val,
        }
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

        modelo_update_fields = []
        if hasattr(modelo, "likewize_modelo"):
            target_code = (likewize_code_val or s.modelo_raw or "").strip()
            if target_code and (modelo.likewize_modelo or "") != target_code:
                modelo.likewize_modelo = target_code
                modelo_update_fields.append("likewize_modelo")
        if modelo_update_fields:
            modelo.save(update_fields=modelo_update_fields)

        # Crear/obtener Capacidad
        cap_qs = CapacidadModel.objects.filter(**{rel_field: modelo})
        cap = cap_qs.filter(**{f"{gb_field}__iexact": tamaño_txt}).first()
        if not cap:
            for existing in cap_qs:
                try:
                    existing_txt = getattr(existing, gb_field, "") or ""
                except AttributeError:
                    existing_txt = ""
                existing_gb = _parse_storage_to_gb(existing_txt)
                if existing_gb == gb_value:
                    cap = existing
                    tamaño_txt = existing_txt or tamaño_txt
                    break

        if not cap:
            cap_defaults = {}
            if hasattr(CapacidadModel, "precio_b2b"):
                cap_defaults["precio_b2b"] = None
            cap = CapacidadModel.objects.create(**{rel_field: modelo, gb_field: tamaño_txt}, **cap_defaults)

        s.capacidad_id = cap.id
        fields_to_update.add("capacidad_id")
        if fields_to_update:
            s.save(update_fields=list(fields_to_update))

        return Response({
            "created": True,
            "modelo_id": getattr(modelo, "id", None),
            "capacidad_id": cap.id,
            "capacidad_text": tamaño_txt,
            "modelo_norm": modelo_nombre,
            "tipo": tipo_val,
            "marca": marca_val,
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
                .values("capacidad_id", "precio_b2b", "tipo", "modelo_norm", "almacenamiento_gb", "marca"))
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
                    "marca": s.get("marca"),
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
                        "marca": s.get("marca"),
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
                      .only("id", gb_field, f"{rel_field}__{rel_name}", f"{rel_field}__tipo", f"{rel_field}__marca"))

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
                    "marca": getattr(modelo, "marca", "-") or "-",
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
                    "marca": info.get("marca", "-"),
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
            .values("id", "tipo", "modelo_norm", "almacenamiento_gb", "precio_b2b", "marca")
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
                .values("capacidad_id", "precio_b2b", "tipo", "modelo_norm", "almacenamiento_gb", "marca"))
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
                    "marca": s.get("marca"),
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
                        "marca": s.get("marca"),
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
                      .only("id", gb_field, f"{rel_field}__{rel_name}", f"{rel_field}__tipo", f"{rel_field}__marca"))

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
                    "marca": getattr(modelo, "marca", "-") or "-",
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
                    "marca": info.get("marca", "-"),
                    "modelo_norm": info.get("modelo_norm", "-"),
                    "almacenamiento_gb": info.get("almacenamiento_gb"),
                })

        no_mapeados = list(
            LikewizeItemStaging.objects
            .filter(tarea=t, capacidad_id__isnull=True)
            .values("id", "tipo", "modelo_norm", "almacenamiento_gb", "precio_b2b", "marca")
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
