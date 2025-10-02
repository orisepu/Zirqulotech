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


# ============== Capacidades estándar por tipo de dispositivo ==============

STANDARD_CAPACITIES = {
    'iMac': [256, 512, 1024, 2048],
    'MacBook Pro': [256, 512, 1024, 2048],
    'MacBook Air': [256, 512, 1024, 2048],
    'MacBook': [256, 512],
    'Mac mini': [256, 512, 1024, 2048],
    'Mac Pro': [512, 1024, 2048, 4096, 8192],
    'Mac Studio': [512, 1024, 2048, 4096, 8192],
    'iPhone': [64, 128, 256, 512, 1024],
    'iPhone 11': [64, 128, 256],
    'iPhone 12': [64, 128, 256, 512],
    'iPhone 13': [128, 256, 512, 1024],
    'iPhone 14': [128, 256, 512, 1024],
    'iPhone 15': [128, 256, 512, 1024],
    'iPhone 15 Pro': [256, 512, 1024],
    'iPhone 15 Pro Max': [256, 512, 1024],
    'iPhone 16': [128, 256, 512, 1024],
    'iPhone 16 Pro': [256, 512, 1024],
    'iPhone 16 Pro Max': [256, 512, 1024],
    'iPad': [64, 256, 512],
    'iPad Pro': [128, 256, 512, 1024, 2048],
    'iPad Air': [64, 256, 512],
    'iPad mini': [64, 256, 512],
}


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
        
        # Check if mapping system is specified
        mapping_system = (request.data.get("mapping_system") or request.query_params.get("mapping_system") or "v1").lower()
        if mapping_system not in ["v1", "v2"]:
            return Response({
                "detail": "El sistema de mapeo debe ser 'v1' o 'v2'.",
                "disponibles": ["v1", "v2"],
            }, status=status.HTTP_400_BAD_REQUEST)

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
                "mapping_system": mapping_system,
            }
        )

        def _runner():
            # ejecuta el management command en este mismo proceso/venv
            call_command('actualizar_likewize', tarea=str(tarea.id), mode=mode, brands=canonical_brands, mapping_system=mapping_system)

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
        S_qs = (
            LikewizeItemStaging.objects
            .filter(tarea=t, capacidad_id__isnull=False)
            .values(
                "capacidad_id",
                "precio_b2b",
                "tipo",
                "modelo_norm",
                "modelo_raw",
                "almacenamiento_gb",
                "marca",
                "likewize_model_code",
            )
        )
        S = {}
        for s in S_qs:
            code = (s.get("likewize_model_code") or "").strip().upper()
            if excluded_codes and code in excluded_codes:
                continue
            k = _key_cap(s["capacidad_id"])
            S[k] = s  # si hubiese duplicados, se pisa; normalmente 1:1

        cap_info_map: dict[int, dict[str, object]] = {}
        CapacidadModel = None
        rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
        rel_name = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
        gb_field = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")

        try:
            CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        except Exception:
            CapacidadModel = None

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

        def ensure_cap_info(ids):
            if not CapacidadModel or not ids:
                return
            missing = [int(cid) for cid in ids if cid and cid not in cap_info_map]
            if not missing:
                return
            qs_cap = (
                CapacidadModel.objects
                .filter(id__in=missing)
                .select_related(rel_field)
                .only(
                    "id",
                    gb_field,
                    f"{rel_field}__{rel_name}",
                    f"{rel_field}__tipo",
                    f"{rel_field}__marca",
                    f"{rel_field}__likewize_modelo",
                )
            )
            if allowed_brands:
                qs_cap = qs_cap.filter(**{f"{rel_field}__marca__in": list(allowed_brands)})
            for cap in qs_cap:
                modelo = getattr(cap, rel_field, None)
                modelo_desc = (getattr(modelo, rel_name, "") if modelo else "") or ""
                cap_info_map[cap.id] = {
                    "tipo": (getattr(modelo, "tipo", "-") or "-") if modelo else "-",
                    "marca": (getattr(modelo, "marca", "-") or "-") if modelo else "-",
                    "modelo_norm": modelo_desc or "-",
                    "modelo_descripcion": modelo_desc,
                    "almacenamiento_gb": _gb_from_text(getattr(cap, gb_field, "") or ""),
                    "cap_text": getattr(cap, gb_field, "") or "",
                    "likewize_modelo": (getattr(modelo, "likewize_modelo", "") or "") if modelo else "",
                }

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
            ensure_cap_info({cap_id})
            info = cap_info_map.get(cap_id) or {}
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
                    "marca": info.get("marca") or s.get("marca"),
                    "nombre_likewize_original": (s.get("modelo_raw") or "").strip() or s.get("modelo_norm") or "",
                    "nombre_normalizado": (info.get("modelo_descripcion") or s.get("modelo_norm") or ""),
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
                        "marca": info.get("marca") or s.get("marca"),
                        "nombre_likewize_original": (s.get("modelo_raw") or "").strip() or s.get("modelo_norm") or "",
                        "nombre_normalizado": (info.get("modelo_descripcion") or s.get("modelo_norm") or ""),
                    })

        # Bajas (enriquece con info de capacidad/modelo si está disponible)
        delete_ids = [int(k) for k in E.keys() if k not in S]
        ensure_cap_info(delete_ids)

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

                # Buscar si existe en staging sin mapear (capacidad_id es null)
                staging_query = LikewizeItemStaging.objects.filter(
                    tarea=t,
                    capacidad_id__isnull=True,
                    tipo=info.get("tipo", "").strip(),
                    modelo_norm=info.get("modelo_norm", "").strip()
                )

                # Filtrar por almacenamiento si está disponible
                almacenamiento = info.get("almacenamiento_gb")
                if almacenamiento:
                    staging_query = staging_query.filter(almacenamiento_gb=almacenamiento)

                staging_item = staging_query.first()

                if staging_item:
                    # Es un UPDATE, no un DELETE - existe en staging pero sin mapear
                    precio_nuevo = Decimal(str(staging_item.precio_b2b))
                    precio_viejo = Decimal(str(e["precio_neto"]))
                    updates.append({
                        "id": f"U|{k}|{precio_viejo}|{precio_nuevo}",
                        "capacidad_id": cap_id,
                        "antes": str(precio_viejo),
                        "despues": str(precio_nuevo),
                        "delta": float(precio_nuevo - precio_viejo),
                        "kind": "UPDATE",
                        "tipo": (info or {}).get("tipo", "-"),
                        "modelo_norm": (info or {}).get("modelo_norm", "-"),
                        "almacenamiento_gb": (info or {}).get("almacenamiento_gb"),
                        "marca": marca_info or "-",
                        "nombre_likewize_original": (staging_item.modelo_raw or "").strip() or staging_item.modelo_norm or "",
                        "nombre_normalizado": (info or {}).get("modelo_descripcion") or (info or {}).get("modelo_norm", "-"),
                    })
                else:
                    # Es realmente un DELETE - no existe en staging
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
                        "nombre_likewize_original": (info or {}).get("likewize_modelo", "") or (info or {}).get("modelo_norm", "-"),
                        "nombre_normalizado": (info or {}).get("modelo_descripcion") or (info or {}).get("modelo_norm", "-"),
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


class ListarTareasLikewizeView(APIView):
    """
    GET /api/precios/likewize/tareas/
    Lista las últimas tareas de actualización Likewize (completadas exitosamente)
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        limit = int(request.query_params.get('limit', 20))

        # Solo tareas SUCCESS
        tareas = (
            TareaActualizacionLikewize.objects
            .filter(estado="SUCCESS")
            .order_by("-finalizado_en", "-iniciado_en", "-creado_en")
            .distinct()[:limit]
        )

        result = []
        for t in tareas:
            # Contar items en staging
            staging_count = LikewizeItemStaging.objects.filter(tarea=t).count()
            mapped_count = LikewizeItemStaging.objects.filter(tarea=t, capacidad_id__isnull=False).count()

            result.append({
                'tarea_id': str(t.id),
                'creado_en': t.creado_en.isoformat() if t.creado_en else None,
                'iniciado_en': t.iniciado_en.isoformat() if t.iniciado_en else None,
                'finalizado_en': t.finalizado_en.isoformat() if t.finalizado_en else None,
                'estado': t.estado,
                'meta': t.meta or {},
                'staging_count': staging_count,
                'mapped_count': mapped_count,
            })

        return Response({
            'tareas': result,
            'total': len(result)
        })


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


class ValidarMapeoLikewizeView(APIView):
    """
    POST /api/precios/likewize/tareas/<uuid:tarea_id>/validar-mapeo/
    Marca staging items como validados por el usuario (mapeo correcto).

    Parámetros:
    - staging_item_ids: Lista de IDs de staging items a validar
    - apply_prices: (opcional, default=true) Si true, aplica automáticamente los precios a PrecioRecompra
    """
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, tarea_id):
        staging_item_ids = request.data.get("staging_item_ids", [])
        if not staging_item_ids:
            return Response({"detail": "staging_item_ids requerido"}, status=400)

        apply_prices = request.data.get("apply_prices", True)  # Por defecto, aplicar precios
        tarea = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)

        # Marcar como validados
        validated_count = 0
        validated_items = []

        for item_id in staging_item_ids:
            try:
                staging_item = LikewizeItemStaging.objects.get(id=item_id, tarea=tarea)
                validated_items.append(staging_item)
                validated_count += 1
            except LikewizeItemStaging.DoesNotExist:
                continue

        # Aplicar precios si está habilitado
        prices_applied = 0
        if apply_prices and validated_items:
            PrecioB2B = _resolve_model_from_setting(
                getattr(settings, "PRECIOS_B2B_MODEL", None),
                "PRECIOS_B2B_MODEL"
            )

            set_tenant_null = _has_field(PrecioB2B, "tenant_schema")
            has_versioning = _has_field(PrecioB2B, "valid_from") and _has_field(PrecioB2B, "valid_to")
            now = timezone.now()

            for staging_item in validated_items:
                # Solo aplicar si está mapeado y tiene precio
                if not staging_item.capacidad_id or not staging_item.precio_b2b:
                    continue

                cap_id = staging_item.capacidad_id
                nuevo_precio = Decimal(str(staging_item.precio_b2b))

                # Base queryset
                qs = PrecioB2B.objects.filter(capacidad_id=cap_id)
                if _has_field(PrecioB2B, "canal"):
                    qs = qs.filter(canal="B2B")
                if _has_field(PrecioB2B, "fuente"):
                    qs = qs.filter(fuente="Likewize")
                if set_tenant_null:
                    qs = qs.filter(tenant_schema__isnull=True)

                # Aplicar precio (con o sin versionado)
                if has_versioning:
                    vigente = qs.filter(valid_to__isnull=True).order_by("-valid_from").first()
                    if vigente and Decimal(vigente.precio_neto) == nuevo_precio:
                        # Ya existe con ese precio, no hacer nada
                        pass
                    else:
                        # Cerrar vigente anterior si existe
                        if vigente:
                            vigente.valid_to = now
                            vigente.save(update_fields=["valid_to"])

                        # Crear nuevo precio vigente
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
                        prices_applied += 1
                else:
                    # Modelo sin versionado: update_or_create
                    defaults = {"precio_neto": nuevo_precio}
                    if _has_field(PrecioB2B, "canal"):
                        defaults["canal"] = "B2B"
                    if _has_field(PrecioB2B, "fuente"):
                        defaults["fuente"] = "Likewize"
                    if set_tenant_null:
                        defaults["tenant_schema"] = None

                    obj, created = PrecioB2B.objects.update_or_create(
                        capacidad_id=cap_id,
                        defaults=defaults
                    )
                    if created or obj.precio_neto != nuevo_precio:
                        prices_applied += 1

        response_data = {
            "success": True,
            "validated_count": validated_count,
            "message": f"{validated_count} mapeos validados correctamente"
        }

        if apply_prices:
            response_data["prices_applied"] = prices_applied
            if prices_applied > 0:
                response_data["message"] = f"{validated_count} mapeos validados y {prices_applied} precios actualizados"

        return Response(response_data, status=200)


class CorregirMapeoLikewizeView(APIView):
    """
    POST /api/precios/likewize/tareas/<uuid:tarea_id>/corregir-mapeo/
    Cambia el mapeo de un staging item a una capacidad diferente.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, tarea_id):
        staging_item_id = request.data.get("staging_item_id")
        new_capacidad_id = request.data.get("new_capacidad_id")
        reason = request.data.get("reason", "Corrección manual")

        if not staging_item_id or not new_capacidad_id:
            return Response({
                "detail": "staging_item_id y new_capacidad_id son requeridos"
            }, status=400)

        tarea = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)

        try:
            staging_item = LikewizeItemStaging.objects.get(id=staging_item_id, tarea=tarea)
        except LikewizeItemStaging.DoesNotExist:
            return Response({"detail": "Staging item no encontrado"}, status=404)

        # Verificar que la nueva capacidad existe
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        try:
            nueva_capacidad = CapacidadModel.objects.get(id=new_capacidad_id)
        except CapacidadModel.DoesNotExist:
            return Response({"detail": "Capacidad no encontrada"}, status=404)

        # Guardar el mapeo anterior
        old_capacidad_id = staging_item.capacidad_id

        # Actualizar el mapeo
        staging_item.capacidad_id = new_capacidad_id
        staging_item.save(update_fields=['capacidad_id'])

        return Response({
            "success": True,
            "staging_item_id": staging_item.id,
            "old_capacidad_id": old_capacidad_id,
            "new_capacidad_id": new_capacidad_id,
            "reason": reason,
            "message": "Mapeo corregido correctamente"
        }, status=200)


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

        # Crear/obtener Capacidades (todas las estándar del tipo)
        cap_qs = CapacidadModel.objects.filter(**{rel_field: modelo})

        # Buscar si ya existe la capacidad específica
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

        # Si no existe la capacidad, crear TODAS las capacidades estándar para este tipo
        if not cap:
            # Obtener capacidades estándar para este tipo de dispositivo
            standard_capacities = STANDARD_CAPACITIES.get(tipo_val, [256, 512, 1024, 2048])

            # Defaults para capacidades nuevas
            cap_defaults = {}
            if hasattr(CapacidadModel, "precio_b2b"):
                cap_defaults["precio_b2b"] = None

            # Crear todas las capacidades estándar
            created_capacities = []
            for gb in standard_capacities:
                capacity_txt = f"{gb // 1024} TB" if gb >= 1024 else f"{gb} GB"

                # Verificar si ya existe esta capacidad
                existing_cap = cap_qs.filter(**{f"{gb_field}__iexact": capacity_txt}).first()
                if existing_cap:
                    if gb == gb_value:
                        cap = existing_cap
                        tamaño_txt = capacity_txt
                    continue

                # Crear nueva capacidad
                new_cap = CapacidadModel.objects.create(
                    **{rel_field: modelo, gb_field: capacity_txt},
                    **cap_defaults
                )
                created_capacities.append(new_cap)

                # Si es la capacidad que necesitamos, guardarla
                if gb == gb_value:
                    cap = new_cap
                    tamaño_txt = capacity_txt

            # Si aún no tenemos cap, crear la específica que necesitamos
            if not cap:
                cap = CapacidadModel.objects.create(
                    **{rel_field: modelo, gb_field: tamaño_txt},
                    **cap_defaults
                )

        s.capacidad_id = cap.id
        fields_to_update.add("capacidad_id")
        if fields_to_update:
            s.save(update_fields=list(fields_to_update))

        # IMPORTANTE: Mapear automáticamente otros items de staging con el mismo modelo
        # que acabamos de crear/actualizar
        auto_mapped_count = 0
        try:
            # Buscar otros items sin mapear de la misma tarea con modelo similar
            unmapped_items = LikewizeItemStaging.objects.filter(
                tarea_id=tarea_id,
                capacidad_id__isnull=True,
                modelo_norm=modelo_nombre
            )

            # Obtener todas las capacidades del modelo recién creado
            all_capacities = CapacidadModel.objects.filter(**{rel_field: modelo})

            for unmapped_item in unmapped_items:
                if not unmapped_item.almacenamiento_gb:
                    continue

                # Formatear capacidad del item
                item_gb = unmapped_item.almacenamiento_gb
                item_capacity_txt = f"{item_gb // 1024} TB" if item_gb >= 1024 else f"{item_gb} GB"

                # Buscar capacidad correspondiente
                matching_cap = all_capacities.filter(**{f"{gb_field}__iexact": item_capacity_txt}).first()

                if matching_cap:
                    unmapped_item.capacidad_id = matching_cap.id
                    unmapped_item.save(update_fields=['capacidad_id'])
                    auto_mapped_count += 1
        except Exception as e:
            # No fallar si el auto-mapeo falla, solo registrar
            pass

        return Response({
            "created": True,
            "modelo_id": getattr(modelo, "id", None),
            "capacidad_id": cap.id,
            "capacidad_text": tamaño_txt,
            "modelo_norm": modelo_nombre,
            "tipo": tipo_val,
            "marca": marca_val,
            "auto_mapped_count": auto_mapped_count,
        }, status=201)


class RemapearTareaLikewizeView(APIView):
    """
    POST /api/precios/likewize/tareas/<uuid:tarea_id>/remapear/
    Remapea automáticamente todos los dispositivos sin mapear de una tarea,
    buscando modelos y capacidades existentes en la BD (NO crea nada nuevo).
    Los dispositivos que no encuentren match quedarán sin mapear para "No Encontrados".
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, tarea_id):
        tarea = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)

        unmapped_items = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=True)
        total_unmapped = unmapped_items.count()

        if total_unmapped == 0:
            return Response({
                "success": True,
                "message": "Tarea ya completamente mapeada",
                "stats": {
                    "total": LikewizeItemStaging.objects.filter(tarea=tarea).count(),
                    "mapped": LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=False).count(),
                    "unmapped": 0,
                    "processed": 0,
                    "failed": 0
                }
            })

        # Obtener modelos configurables
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        rel_field = getattr(settings, 'CAPACIDAD_REL_MODEL_FIELD', 'modelo')
        rel_name = getattr(settings, 'REL_MODELO_NAME_FIELD', 'descripcion')
        gb_field = getattr(settings, 'CAPACIDAD_GB_FIELD', 'tamaño')
        ModeloModel = CapacidadModel._meta.get_field(rel_field).related_model

        created_count = 0
        failed_count = 0

        for item in unmapped_items:
            try:
                modelo_nombre = (item.modelo_norm or "").strip()
                if not modelo_nombre or not item.almacenamiento_gb:
                    failed_count += 1
                    continue

                # SOLO buscar modelo existente (NO crear)
                try:
                    modelo = ModeloModel.objects.get(**{rel_name: modelo_nombre})
                except ModeloModel.DoesNotExist:
                    # No existe el modelo, dejar sin mapear para que vaya a "No Encontrados"
                    failed_count += 1
                    continue

                # Formatear capacidad
                gb = item.almacenamiento_gb
                tamaño_txt = f"{gb // 1024} TB" if gb >= 1024 else f"{gb} GB"

                # SOLO buscar capacidad existente (NO crear)
                try:
                    cap = CapacidadModel.objects.get(**{rel_field: modelo, gb_field: tamaño_txt})
                except CapacidadModel.DoesNotExist:
                    # No existe la capacidad, dejar sin mapear
                    failed_count += 1
                    continue

                # Actualizar staging solo si encontró match
                item.capacidad_id = cap.id
                item.save(update_fields=['capacidad_id'])
                created_count += 1

            except Exception:
                failed_count += 1

        final_mapped = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=False).count()
        final_unmapped = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=True).count()

        return Response({
            "success": final_unmapped == 0,
            "message": f"Remapeo completado: {created_count} dispositivos procesados",
            "stats": {
                "total": LikewizeItemStaging.objects.filter(tarea=tarea).count(),
                "mapped": final_mapped,
                "unmapped": final_unmapped,
                "processed": created_count,
                "failed": failed_count
            }
        }, status=200)


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


class ValidarMapeoLikewizeView(APIView):
    """
    POST /api/precios/likewize/tareas/<uuid:tarea_id>/validar-mapeo/
    Marca staging items como validados por el usuario (mapeo correcto).

    Parámetros:
    - staging_item_ids: Lista de IDs de staging items a validar
    - apply_prices: (opcional, default=true) Si true, aplica automáticamente los precios a PrecioRecompra
    """
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, tarea_id):
        staging_item_ids = request.data.get("staging_item_ids", [])
        if not staging_item_ids:
            return Response({"detail": "staging_item_ids requerido"}, status=400)

        apply_prices = request.data.get("apply_prices", True)  # Por defecto, aplicar precios
        tarea = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)

        # Marcar como validados
        validated_count = 0
        validated_items = []

        for item_id in staging_item_ids:
            try:
                staging_item = LikewizeItemStaging.objects.get(id=item_id, tarea=tarea)
                validated_items.append(staging_item)
                validated_count += 1
            except LikewizeItemStaging.DoesNotExist:
                continue

        # Aplicar precios si está habilitado
        prices_applied = 0
        if apply_prices and validated_items:
            PrecioB2B = _resolve_model_from_setting(
                getattr(settings, "PRECIOS_B2B_MODEL", None),
                "PRECIOS_B2B_MODEL"
            )

            set_tenant_null = _has_field(PrecioB2B, "tenant_schema")
            has_versioning = _has_field(PrecioB2B, "valid_from") and _has_field(PrecioB2B, "valid_to")
            now = timezone.now()

            for staging_item in validated_items:
                # Solo aplicar si está mapeado y tiene precio
                if not staging_item.capacidad_id or not staging_item.precio_b2b:
                    continue

                cap_id = staging_item.capacidad_id
                nuevo_precio = Decimal(str(staging_item.precio_b2b))

                # Base queryset
                qs = PrecioB2B.objects.filter(capacidad_id=cap_id)
                if _has_field(PrecioB2B, "canal"):
                    qs = qs.filter(canal="B2B")
                if _has_field(PrecioB2B, "fuente"):
                    qs = qs.filter(fuente="Likewize")
                if set_tenant_null:
                    qs = qs.filter(tenant_schema__isnull=True)

                # Aplicar precio (con o sin versionado)
                if has_versioning:
                    vigente = qs.filter(valid_to__isnull=True).order_by("-valid_from").first()
                    if vigente and Decimal(vigente.precio_neto) == nuevo_precio:
                        # Ya existe con ese precio, no hacer nada
                        pass
                    else:
                        # Cerrar vigente anterior si existe
                        if vigente:
                            vigente.valid_to = now
                            vigente.save(update_fields=["valid_to"])

                        # Crear nuevo precio vigente
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
                        prices_applied += 1
                else:
                    # Modelo sin versionado: update_or_create
                    defaults = {"precio_neto": nuevo_precio}
                    if _has_field(PrecioB2B, "canal"):
                        defaults["canal"] = "B2B"
                    if _has_field(PrecioB2B, "fuente"):
                        defaults["fuente"] = "Likewize"
                    if set_tenant_null:
                        defaults["tenant_schema"] = None

                    obj, created = PrecioB2B.objects.update_or_create(
                        capacidad_id=cap_id,
                        defaults=defaults
                    )
                    if created or obj.precio_neto != nuevo_precio:
                        prices_applied += 1

        response_data = {
            "success": True,
            "validated_count": validated_count,
            "message": f"{validated_count} mapeos validados correctamente"
        }

        if apply_prices:
            response_data["prices_applied"] = prices_applied
            if prices_applied > 0:
                response_data["message"] = f"{validated_count} mapeos validados y {prices_applied} precios actualizados"

        return Response(response_data, status=200)


class CorregirMapeoLikewizeView(APIView):
    """
    POST /api/precios/likewize/tareas/<uuid:tarea_id>/corregir-mapeo/
    Cambia el mapeo de un staging item a una capacidad diferente.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, tarea_id):
        staging_item_id = request.data.get("staging_item_id")
        new_capacidad_id = request.data.get("new_capacidad_id")
        reason = request.data.get("reason", "Corrección manual")

        if not staging_item_id or not new_capacidad_id:
            return Response({
                "detail": "staging_item_id y new_capacidad_id son requeridos"
            }, status=400)

        tarea = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)

        try:
            staging_item = LikewizeItemStaging.objects.get(id=staging_item_id, tarea=tarea)
        except LikewizeItemStaging.DoesNotExist:
            return Response({"detail": "Staging item no encontrado"}, status=404)

        # Verificar que la nueva capacidad existe
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        try:
            nueva_capacidad = CapacidadModel.objects.get(id=new_capacidad_id)
        except CapacidadModel.DoesNotExist:
            return Response({"detail": "Capacidad no encontrada"}, status=404)

        # Guardar el mapeo anterior
        old_capacidad_id = staging_item.capacidad_id

        # Actualizar el mapeo
        staging_item.capacidad_id = new_capacidad_id
        staging_item.save(update_fields=['capacidad_id'])

        return Response({
            "success": True,
            "staging_item_id": staging_item.id,
            "old_capacidad_id": old_capacidad_id,
            "new_capacidad_id": new_capacidad_id,
            "reason": reason,
            "message": "Mapeo corregido correctamente"
        }, status=200)


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


class ValidarMapeoLikewizeView(APIView):
    """
    POST /api/precios/likewize/tareas/<uuid:tarea_id>/validar-mapeo/
    Marca staging items como validados por el usuario (mapeo correcto).

    Parámetros:
    - staging_item_ids: Lista de IDs de staging items a validar
    - apply_prices: (opcional, default=true) Si true, aplica automáticamente los precios a PrecioRecompra
    """
    permission_classes = [permissions.IsAdminUser]

    @transaction.atomic
    def post(self, request, tarea_id):
        staging_item_ids = request.data.get("staging_item_ids", [])
        if not staging_item_ids:
            return Response({"detail": "staging_item_ids requerido"}, status=400)

        apply_prices = request.data.get("apply_prices", True)  # Por defecto, aplicar precios
        tarea = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)

        # Marcar como validados
        validated_count = 0
        validated_items = []

        for item_id in staging_item_ids:
            try:
                staging_item = LikewizeItemStaging.objects.get(id=item_id, tarea=tarea)
                validated_items.append(staging_item)
                validated_count += 1
            except LikewizeItemStaging.DoesNotExist:
                continue

        # Aplicar precios si está habilitado
        prices_applied = 0
        if apply_prices and validated_items:
            PrecioB2B = _resolve_model_from_setting(
                getattr(settings, "PRECIOS_B2B_MODEL", None),
                "PRECIOS_B2B_MODEL"
            )

            set_tenant_null = _has_field(PrecioB2B, "tenant_schema")
            has_versioning = _has_field(PrecioB2B, "valid_from") and _has_field(PrecioB2B, "valid_to")
            now = timezone.now()

            for staging_item in validated_items:
                # Solo aplicar si está mapeado y tiene precio
                if not staging_item.capacidad_id or not staging_item.precio_b2b:
                    continue

                cap_id = staging_item.capacidad_id
                nuevo_precio = Decimal(str(staging_item.precio_b2b))

                # Base queryset
                qs = PrecioB2B.objects.filter(capacidad_id=cap_id)
                if _has_field(PrecioB2B, "canal"):
                    qs = qs.filter(canal="B2B")
                if _has_field(PrecioB2B, "fuente"):
                    qs = qs.filter(fuente="Likewize")
                if set_tenant_null:
                    qs = qs.filter(tenant_schema__isnull=True)

                # Aplicar precio (con o sin versionado)
                if has_versioning:
                    vigente = qs.filter(valid_to__isnull=True).order_by("-valid_from").first()
                    if vigente and Decimal(vigente.precio_neto) == nuevo_precio:
                        # Ya existe con ese precio, no hacer nada
                        pass
                    else:
                        # Cerrar vigente anterior si existe
                        if vigente:
                            vigente.valid_to = now
                            vigente.save(update_fields=["valid_to"])

                        # Crear nuevo precio vigente
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
                        prices_applied += 1
                else:
                    # Modelo sin versionado: update_or_create
                    defaults = {"precio_neto": nuevo_precio}
                    if _has_field(PrecioB2B, "canal"):
                        defaults["canal"] = "B2B"
                    if _has_field(PrecioB2B, "fuente"):
                        defaults["fuente"] = "Likewize"
                    if set_tenant_null:
                        defaults["tenant_schema"] = None

                    obj, created = PrecioB2B.objects.update_or_create(
                        capacidad_id=cap_id,
                        defaults=defaults
                    )
                    if created or obj.precio_neto != nuevo_precio:
                        prices_applied += 1

        response_data = {
            "success": True,
            "validated_count": validated_count,
            "message": f"{validated_count} mapeos validados correctamente"
        }

        if apply_prices:
            response_data["prices_applied"] = prices_applied
            if prices_applied > 0:
                response_data["message"] = f"{validated_count} mapeos validados y {prices_applied} precios actualizados"

        return Response(response_data, status=200)


class CorregirMapeoLikewizeView(APIView):
    """
    POST /api/precios/likewize/tareas/<uuid:tarea_id>/corregir-mapeo/
    Cambia el mapeo de un staging item a una capacidad diferente.
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, tarea_id):
        staging_item_id = request.data.get("staging_item_id")
        new_capacidad_id = request.data.get("new_capacidad_id")
        reason = request.data.get("reason", "Corrección manual")

        if not staging_item_id or not new_capacidad_id:
            return Response({
                "detail": "staging_item_id y new_capacidad_id son requeridos"
            }, status=400)

        tarea = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)

        try:
            staging_item = LikewizeItemStaging.objects.get(id=staging_item_id, tarea=tarea)
        except LikewizeItemStaging.DoesNotExist:
            return Response({"detail": "Staging item no encontrado"}, status=404)

        # Verificar que la nueva capacidad existe
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        try:
            nueva_capacidad = CapacidadModel.objects.get(id=new_capacidad_id)
        except CapacidadModel.DoesNotExist:
            return Response({"detail": "Capacidad no encontrada"}, status=404)

        # Guardar el mapeo anterior
        old_capacidad_id = staging_item.capacidad_id

        # Actualizar el mapeo
        staging_item.capacidad_id = new_capacidad_id
        staging_item.save(update_fields=['capacidad_id'])

        return Response({
            "success": True,
            "staging_item_id": staging_item.id,
            "old_capacidad_id": old_capacidad_id,
            "new_capacidad_id": new_capacidad_id,
            "reason": reason,
            "message": "Mapeo corregido correctamente"
        }, status=200)


class ValidationItemsLikewizeView(APIView):
    """
    GET /api/precios/likewize/tareas/<uuid:tarea_id>/validation-items/
    Devuelve todos los staging items con metadata para la UI de validación.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id):
        tarea = get_object_or_404(TareaActualizacionLikewize, pk=tarea_id)

        # Obtener todos los staging items
        staging_items = LikewizeItemStaging.objects.filter(tarea=tarea).select_related()

        # Obtener información de capacidades mapeadas
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        rel_field = getattr(settings, 'CAPACIDAD_REL_MODEL_FIELD', 'modelo')
        rel_name = getattr(settings, 'REL_MODELO_NAME_FIELD', 'descripcion')
        gb_field = getattr(settings, 'CAPACIDAD_GB_FIELD', 'tamaño')

        capacidades_ids = [item.capacidad_id for item in staging_items if item.capacidad_id]
        capacidades_map = {}
        mapping_metadata_map = {}

        # Query DeviceMappingV2 for metadata
        from productos.models import DeviceMappingV2
        if capacidades_ids:
            mappings_v2 = DeviceMappingV2.objects.filter(
                mapped_capacity_id__in=capacidades_ids
            ).order_by('-created_at')

            # Build mapping metadata map (latest mapping per capacity)
            for mapping in mappings_v2:
                cap_id = mapping.mapped_capacity_id
                if cap_id not in mapping_metadata_map:
                    mapping_metadata_map[cap_id] = {
                        'confidence_score': mapping.confidence_score,
                        'mapping_algorithm': mapping.mapping_algorithm,
                        'validated_by_user': mapping.validated_by_user,
                        'needs_review': mapping.needs_review
                    }

        # Query prices
        from productos.models import PrecioRecompra
        precios_map = {}
        if capacidades_ids:
            precios = PrecioRecompra.objects.filter(
                capacidad_id__in=capacidades_ids,
                canal='B2B'
            ).values('capacidad_id', 'precio_neto')

            for precio in precios:
                precios_map[precio['capacidad_id']] = float(precio['precio_neto'])

        if capacidades_ids:
            capacidades = (CapacidadModel.objects
                          .filter(id__in=capacidades_ids)
                          .select_related(rel_field))

            for cap in capacidades:
                modelo = getattr(cap, rel_field, None)
                modelo_completo = ''
                if modelo:
                    modelo_desc = getattr(modelo, rel_name, '')
                    almacenamiento = getattr(cap, gb_field, '')
                    # Si almacenamiento ya tiene "GB" o "TB", no añadir otra vez
                    if almacenamiento:
                        almacenamiento_str = str(almacenamiento).strip()
                        if almacenamiento_str.upper().endswith(('GB', 'TB')):
                            modelo_completo = f"{modelo_desc} {almacenamiento_str}"
                        else:
                            modelo_completo = f"{modelo_desc} {almacenamiento_str}GB"
                    else:
                        modelo_completo = modelo_desc

                capacidades_map[cap.id] = {
                    'capacidad_id': cap.id,
                    'modelo_descripcion': getattr(modelo, rel_name, '') if modelo else '',
                    'almacenamiento_text': getattr(cap, gb_field, ''),
                    'modelo_completo': modelo_completo,
                    'precio_actual': precios_map.get(cap.id)
                }

        # Construir lista de items con metadata
        items = []
        for staging_item in staging_items:
            is_mapped = staging_item.capacidad_id is not None

            # Get mapping metadata if available
            metadata = mapping_metadata_map.get(staging_item.capacidad_id, {}) if is_mapped else {}

            item_data = {
                'id': staging_item.id,
                'staging_item_id': staging_item.id,
                'likewize_info': {
                    'modelo_raw': staging_item.modelo_raw or '',
                    'modelo_norm': staging_item.modelo_norm or '',
                    'tipo': staging_item.tipo or '',
                    'marca': staging_item.marca or '',
                    'almacenamiento_gb': staging_item.almacenamiento_gb,
                    'precio_b2b': float(staging_item.precio_b2b) if staging_item.precio_b2b else 0,
                    'likewize_model_code': staging_item.likewize_model_code or '',
                    'a_number': staging_item.a_number or '',
                    'any': staging_item.any,
                    'cpu': staging_item.cpu or ''
                },
                'mapped_info': capacidades_map.get(staging_item.capacidad_id) if is_mapped else None,
                'mapping_metadata': {
                    'confidence_score': metadata.get('confidence_score'),
                    'mapping_algorithm': metadata.get('mapping_algorithm'),
                    'validated_by_user': metadata.get('validated_by_user', False),
                    'needs_review': metadata.get('needs_review', not is_mapped),
                    'is_mapped': is_mapped
                }
            }

            items.append(item_data)

        return Response({
            'items': items,
            'total': len(items),
            'mapped': sum(1 for i in items if i['mapping_metadata']['is_mapped']),
            'unmapped': sum(1 for i in items if not i['mapping_metadata']['is_mapped'])
        }, status=200)
