# inspect_map.py
# Uso:
#   TAREA=<UUID> python manage.py shell < inspect_map.py
# ó:
#   python manage.py shell -c 'exec(open("inspect_map.py").read()); inspect("<UUID>")'

from django.apps import apps
from django.conf import settings
from django.db.models import Q, Count
from django.utils import timezone

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging

# === Resuelve clases y nombres de campos desde settings ===
PrecioB2B = apps.get_model(getattr(settings, "PRECIOS_B2B_MODEL"))
Capacidad = apps.get_model(getattr(settings, "CAPACIDAD_MODEL"))
REL_FIELD = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")     # FK en Capacidad -> Modelo
REL_NAME  = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")    # campo legible en Modelo
GB_FIELD  = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")            # tamaño/capacidad en Capacidad
Modelo    = Capacidad._meta.get_field(REL_FIELD).related_model

def _has_field(model, name: str) -> bool:
    return any(getattr(f, "name", None) == name for f in model._meta.get_fields())

def _apply_common_filters(qs):
    if _has_field(qs.model, "tenant_schema"):
        qs = qs.filter(tenant_schema__isnull=True)
    if _has_field(qs.model, "canal"):
        qs = qs.filter(canal="B2B")
    if _has_field(qs.model, "valid_to"):
        now = timezone.now()
        qs = qs.filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
    return qs

def _fmt_gb_to_text(gb: int) -> str:
    # 1536 -> "1.5 TB"; 1024 -> "1 TB"; 512 -> "512 GB"
    if gb >= 1024 and gb % 1024 == 0:
        return f"{gb//1024} TB"
    if gb > 1024 and gb % 1024 != 0:
        s = f"{gb/1024.0:.1f}".rstrip("0").rstrip(".")
        return f"{s} TB"
    return f"{gb} GB"

def _patterns_for_capacity(gb: int):
    # patrones a buscar en campos texto de capacidad ("tamaño"): GB y TB con coma/punto
    def trim(x):
        s = f"{x:.3f}".rstrip("0").rstrip(".")
        return s or "0"
    pats = {str(gb), f"{gb}GB", f"{gb} GB"}
    tb = gb / 1024.0
    for s in {trim(tb), trim(tb).replace(".", ",")}:
        pats.update({f"{s}TB", f"{s} TB"})
    return pats

def _cap_exists_for_model(model_id: int, gb: int) -> bool:
    # Devuelve si existe una capacidad para ese modelo y tamaño
    # Soporta GB_FIELD texto o numérico.
    try:
        f = Capacidad._meta.get_field(GB_FIELD)
        is_text = f.get_internal_type() in {"CharField", "TextField"}
    except Exception:
        is_text = True
    if is_text:
        q = Q()
        for s in _patterns_for_capacity(int(gb)):
            q |= Q(**{f"{GB_FIELD}__icontains": s})
        qs = Capacidad.objects.filter(q, **{f"{REL_FIELD}_id": model_id})
    else:
        qs = Capacidad.objects.filter(**{GB_FIELD: int(gb), f"{REL_FIELD}_id": model_id})
    return qs.exists()

def _precio_exists_for_cap(cap_id: int) -> bool:
    qs = _apply_common_filters(PrecioB2B.objects.filter(capacidad_id=cap_id))
    return qs.exists()

def _list_caps_for_model(model_id: int):
    return list(Capacidad.objects.filter(**{f"{REL_FIELD}_id": model_id}).values("id", GB_FIELD))

def schema_info():
    print("=== ESQUEMA ===")
    print(f"PrecioB2B: {PrecioB2B._meta.label}")
    print(f"Capacidad : {Capacidad._meta.label}  GB_FIELD='{GB_FIELD}'  REL_FIELD='{REL_FIELD}'")
    print(f"Modelo    : {Modelo._meta.label}   REL_NAME='{REL_NAME}'")
    for M in (PrecioB2B, Capacidad, Modelo):
        print(f"\nCampos de {M._meta.label}:")
        print(", ".join(sorted(f.name for f in M._meta.get_fields())))

def inspect(tarea_uuid: str, top=20, tipo="Mac"):
    schema_info()

    t = TareaActualizacionLikewize.objects.get(pk=tarea_uuid)
    nm = (t.staging
          .filter(tipo=tipo, capacidad_id__isnull=True)
          .exclude(a_number="")
          .exclude(almacenamiento_gb__isnull=True))

    print(f"\n=== NO MAPEADOS {tipo} CON A-NUMBER ===")
    print("total:", nm.count())

    top_a = (nm.values("a_number")
               .annotate(n=Count("id"))
               .order_by("-n")[:top])

    for row in top_a:
        a = row["a_number"]
        sizes = sorted(set(nm.filter(a_number=a).values_list("almacenamiento_gb", flat=True)))
        print(f"\n→ {a}: staging={row['n']}  tamaños={sizes}")
        modelos_qs = Modelo.objects.filter(**{f"{REL_NAME}__icontains": a})
        modelos = list(modelos_qs.values("id", REL_NAME)[:5])
        print(f"   modelos_en_bd={len(modelos_qs)}  (mostrando hasta 5)")
        for m in modelos:
            mid = m["id"]
            nombre = m[REL_NAME]
            caps = _list_caps_for_model(mid)
            caps_txt = [c[GB_FIELD] for c in caps]
            print(f"   - Modelo#{mid}: {nombre}")
            print(f"     capacidades_actuales ({len(caps)}): {caps_txt}")
            faltan = []
            existen = []
            for gb in sizes:
                if _cap_exists_for_model(mid, int(gb)):
                    existen.append(_fmt_gb_to_text(int(gb)))
                else:
                    faltan.append(_fmt_gb_to_text(int(gb)))
            print(f"     existen: {existen}")
            print(f"     FALTAN : {faltan}")
            # ¿hay precios para las capacidades existentes?
            has_prices = []
            for c in caps:
                if _precio_exists_for_cap(c["id"]):
                    has_prices.append(c[GB_FIELD])
            if has_prices:
                print(f"     precios_en_PrecioB2B para capacidades: {has_prices}")
            else:
                print(f"     precios_en_PrecioB2B: ninguno")

# Auto-run si hay envvar TAREA
import os
_T = os.environ.get("TAREA")
if _T:
    inspect(_T, top=20, tipo="Mac")

