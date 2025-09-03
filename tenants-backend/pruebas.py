# ===== DIAGNÓSTICO S/E Y MAPEOS =====
# Uso:
#   TAREA=<UUID> python manage.py shell < pruebas.py
# ó:
#   python manage.py shell -c 'exec(open("pruebas.py").read()); audit("<UUID>")'
#
# Si prefieres ejecutarlo fuera del shell, ver nota al final.

import os
from django.apps import apps
from django.conf import settings
from django.utils import timezone
from django.db.models import Q, Count
from productos.models import TareaActualizacionLikewize, LikewizeItemStaging
import re

def _resolve_model(value):
    return value if not isinstance(value, str) else apps.get_model(value)

def _has_field(model, name: str) -> bool:
    return any(getattr(f, "name", None) == name for f in model._meta.get_fields())

PrecioB2B = _resolve_model(getattr(settings, "PRECIOS_B2B_MODEL"))
Capacidad = apps.get_model(settings.CAPACIDAD_MODEL)
_rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
_rel_name  = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
_gb_field  = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
Modelo     = Capacidad._meta.get_field(_rel_field).related_model

def _apply_common_filters(qs):
    """tenant_schema IS NULL, canal='B2B' (si existe), vigentes (si existe valid_to)."""
    M = qs.model
    if _has_field(M, "tenant_schema"):
        qs = qs.filter(tenant_schema__isnull=True)
    if _has_field(M, "canal"):
        qs = qs.filter(canal="B2B")
    if _has_field(M, "valid_to"):
        now = timezone.now()
        qs = qs.filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
    return qs

def _dedup_by_capacidad(qs):
    """Dict {capacidad_id(str): {...}} quedándose con el más reciente por capacidad."""
    fields = {f.name for f in qs.model._meta.get_fields()}
    order_field = "valid_from" if "valid_from" in fields else ("updated_at" if "updated_at" in fields else None)
    qs = qs.filter(capacidad_id__isnull=False)
    qs = qs.order_by("capacidad_id", f"-{order_field}") if order_field else qs.order_by("capacidad_id")
    E = {}
    for e in qs.values("capacidad_id", "precio_neto"):
        k = str(e["capacidad_id"])
        if k not in E:
            E[k] = e
    return E

def audit(tarea_uuid: str):
    t = TareaActualizacionLikewize.objects.get(pk=tarea_uuid)

    print("\n=== 1) STAGING: mapeo ===")
    total   = LikewizeItemStaging.objects.filter(tarea=t).count()
    mapped  = LikewizeItemStaging.objects.filter(tarea=t, capacidad_id__isnull=False).count()
    unmapped= total - mapped
    ratio   = f"{(mapped/total*100):.1f}%" if total else "0%"
    print(f"total={total}  mapped={mapped}  unmapped={unmapped}  map={ratio}")

    print("\n— Por tipo —")
    tipos = (LikewizeItemStaging.objects
             .filter(tarea=t)
             .values_list("tipo", flat=True)
             .distinct())
    for tipo in tipos:
        tot = t.staging.filter(tipo=tipo).count()
        mp  = t.staging.filter(tipo=tipo, capacidad_id__isnull=False).count()
        pct = f"{(mp/tot*100):.1f}%" if tot else "0%"
        print(f"{tipo:6s}  {mp}/{tot} = {pct}")

    print("\n=== 2) OFICIAL (E) con filtros ===")
    base = _apply_common_filters(PrecioB2B.objects.all())
    cnt_all = PrecioB2B.objects.count()
    cnt_flt = base.count()
    distinct_caps = base.values_list("capacidad_id", flat=True).distinct().count()
    print(f"PrecioB2B total={cnt_all}  tras_filtros={cnt_flt}  capacidades_distintas={distinct_caps}")

    E = _dedup_by_capacidad(base)
    print(f"E (dedup por capacidad) = {len(E)}")

    print("\n=== 3) Conjuntos S vs E ===")
    S_caps = set(str(c) for c in t.staging.filter(capacidad_id__isnull=False).values_list("capacidad_id", flat=True))
    E_caps = set(E.keys())
    only_in_S = S_caps - E_caps     # INSERT
    only_in_E = E_caps - S_caps     # DELETE
    both      = S_caps & E_caps     # UPDATE o sin cambio
    print(f"S_caps={len(S_caps)}  E_caps={len(E_caps)}")
    print(f"posibles INSERT={len(only_in_S)}  posibles DELETE={len(only_in_E)}  intersección={len(both)}")

    print("\n=== 4) NO MAPEADOS (sample 20) ===")
    qs = (t.staging
          .filter(capacidad_id__isnull=True)
          .values("tipo","modelo_raw","modelo_norm","almacenamiento_gb","pulgadas","any","a_number")[:20])
    for i, row in enumerate(qs, 1):
        print(f"{i:02d}. {row}")

    print("\n— No mapeados: agregados —")
    nm = t.staging.filter(capacidad_id__isnull=True)
    print("Total no mapeados :", nm.count())
    print("con A-number      :", nm.exclude(a_number="").count())
    print("con pulgadas      :", nm.exclude(pulgadas__isnull=True).count())
    print("con any (año)     :", nm.exclude(any__isnull=True).count())

    print("\n— Top A-number no mapeados (top 20) + modelos que los contienen —")
    top_a = (nm.exclude(a_number="")
               .values("a_number")
               .annotate(n=Count("id"))
               .order_by("-n")[:20])
    for row in top_a:
        a = row["a_number"]
        modelos = Modelo.objects.filter(**{f"{_rel_name}__icontains": a}).count()
        print(f"{a}: staging={row['n']}, modelos={modelos}")

    print("\n— Distribución por pulgadas en STAGING (Mac) —")
    dist_p = (t.staging.filter(tipo="Mac")
              .values("pulgadas").annotate(n=Count("id")).order_by("-n"))
    for d in dist_p:
        print(d)

    print("\n=== 5) Muestra DELETEs (capacidad_id en E pero no en S) ===")
    sample_del = list(only_in_E)[:20]
    print(sample_del)

    print("\n=== 6) Muestra INSERTs (capacidad_id en S pero no en E) ===")
    sample_ins = list(only_in_S)[:20]
    print(sample_ins)

    print("\nListo. Usa estas claves para investigar casos concretos.")
    print("\n=== iPhone solo ===")
    qs_all = LikewizeItemStaging.objects.filter(tarea=t, tipo="iPhone")
    qs_ok  = qs_all.exclude(capacidad_id__isnull=True)
    qs_ko  = qs_all.filter(capacidad_id__isnull=True)
    print(f"iPhone total={qs_all.count()}  mapeados={qs_ok.count()}  faltan={qs_ko.count()}  map={(qs_ok.count()/qs_all.count()*100):.1f}%")
    for r in qs_ko.values("modelo_raw","almacenamiento_gb")[:20]:
        print(" -", r)


# Si se define TAREA en el entorno, ejecuta automáticamente.
_TAREA = os.environ.get("TAREA")
if _TAREA:
    audit(_TAREA)

