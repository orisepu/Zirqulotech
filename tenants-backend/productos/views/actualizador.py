from decimal import Decimal
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

        # Bajas
        for k, e in E.items():
            if k not in S:
                cap_id = int(k)
                deletes.append({
                    "id": f"D|{k}|{e['precio_neto']}",
                    "capacidad_id": cap_id,
                    "antes": str(e["precio_neto"]),
                    "despues": None,
                    "delta": None,
                    "kind": "DELETE",
                    "tipo": "-",
                    "modelo_norm": "-",
                    "almacenamiento_gb": None,
                })

        # No mapeados (para que los veas en UI)
        no_mapeados = list(
            LikewizeItemStaging.objects
            .filter(tarea=t, capacidad_id__isnull=True)
            .values("tipo", "modelo_norm", "almacenamiento_gb", "precio_b2b")
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

            if ch["kind"] == "INSERT":
                defaults = {"precio_neto": Decimal(ch["despues"]), "canal": "B2B", "fuente": "Likewize"}
                if set_tenant_null:
                    defaults["tenant_schema"] = None
                PrecioB2B.objects.update_or_create(
                    capacidad_id=cap_id,
                    defaults=defaults
                )
                applied["INSERT"] += 1

            elif ch["kind"] == "UPDATE":
                obj = PrecioB2B.objects.get(capacidad_id=cap_id)
                obj.precio_neto = Decimal(ch["despues"])
                if set_tenant_null:
                    setattr(obj, "tenant_schema", None)
                if _has_field(PrecioB2B, "canal"):
                    setattr(obj, "canal", "B2B")
                if _has_field(PrecioB2B, "fuente"):
                    setattr(obj, "fuente", "Likewize")
                obj.save(update_fields=[f for f in ["precio_neto",
                                                    set_tenant_null and "tenant_schema",
                                                    _has_field(PrecioB2B, "canal") and "canal",
                                                    _has_field(PrecioB2B, "fuente") and "fuente"]
                                      if f])
                applied["UPDATE"] += 1

            elif ch["kind"] == "DELETE":
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