import os
from django.apps import apps
from django.conf import settings
from django.db.models import Q
from productos.models import TareaActualizacionLikewize, LikewizeItemStaging

# ========= Config dinámico de tu proyecto =========
CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
REL_FIELD = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")     # FK en Capacidad -> Modelo
REL_NAME  = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")    # campo legible en Modelo
GB_FIELD  = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")            # texto "512 GB", "1 TB", etc.
Modelo    = CapacidadModel._meta.get_field(REL_FIELD).related_model

FAMILIAS_MAC = {"MacBook Pro", "MacBook Air", "iMac", "Mac mini", "Mac Studio", "Mac Pro"}

# ========= Helpers de formato =========
def nn(x, dash="—"):
    return dash if x in (None, "", 0) else x

def cap_text(cap):
    try:
        return getattr(cap, GB_FIELD) or "¿(sin tamaño)?"
    except Exception:
        return f"id={cap.id}"

def modelo_info(m):
    return f"{getattr(m, REL_NAME, '')} | tipo={getattr(m,'tipo','')} | {nn(getattr(m,'pantalla',None))} | año={nn(getattr(m,'año',None))} | cpu={nn(getattr(m,'procesador',None))}"

# ========= Selección de tarea =========
tarea_id = os.environ.get("TAREA")
if tarea_id:
    tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
else:
    tarea = TareaActualizacionLikewize.objects.order_by("-iniciado_en").first()

print(f"\nTAREA usada: {tarea.id}")

S = LikewizeItemStaging.objects.filter(tarea=tarea)

# ========= A) Muestra de CAZADOS (Likewize -> DB) =========
print("\n=== A) MUESTRA DE CAZADOS (Likewize -> DB) ===")
matched_qs = S.exclude(capacidad_id__isnull=True)

sample = list(matched_qs[:30].values("id","tipo","modelo_raw","modelo_norm","almacenamiento_gb","pulgadas","any","a_number","cpu","capacidad_id"))
cap_ids = [r["capacidad_id"] for r in sample]
cap_map = {c.id: c for c in CapacidadModel.objects.filter(id__in=cap_ids).select_related(REL_FIELD)}

for i, r in enumerate(sample, start=1):
    cap = cap_map.get(r["capacidad_id"])
    mdl = getattr(cap, REL_FIELD) if cap else None
    print(f"{i:02d}. [LIK] {r['tipo']} | {r['modelo_raw']} | {r['almacenamiento_gb']}GB | a#={nn(r['a_number'])} | {nn(r['pulgadas'])}\" | año={nn(r['any'])} | cpu={nn(r['cpu'])}")
    if cap and mdl:
        print(f"    [DB ] {modelo_info(mdl)} | capacidad={cap_text(cap)} (id={cap.id})")
    else:
        print("    [DB ] (¿capacidad/modelo no encontrado?)")

# ========= B) DB NO CAZADOS (capacidades en BD sin entrada Likewize) =========
print("\n=== B) DB NO CAZADOS (capacidad en BD que NO apareció en Likewize) ===")
used_cap_ids = set(S.exclude(capacidad_id__isnull=True).values_list("capacidad_id", flat=True))

# Filtramos sólo familias Apple que nos interesan (iPhone, iPad y todas las Mac)
iphone_ipad_caps = CapacidadModel.objects.filter(**{f"{REL_FIELD}__tipo__in": ["iPhone","iPad"]})
mac_caps = CapacidadModel.objects.filter(**{f"{REL_FIELD}__tipo__in": list(FAMILIAS_MAC)})

db_total_considerado = iphone_ipad_caps.count() + mac_caps.count()
db_no_cazados = (iphone_ipad_caps | mac_caps).exclude(id__in=used_cap_ids).select_related(REL_FIELD)

print(f"Total capacidades BD consideradas: {db_total_considerado}")
print(f"No cazados en BD (sin match desde Likewize): {db_no_cazados.count()}")

db_sample = list(db_no_cazados[:30])
for i, cap in enumerate(db_sample, start=1):
    mdl = getattr(cap, REL_FIELD)
    print(f"{i:02d}. {modelo_info(mdl)} | capacidad={cap_text(cap)} (cap_id={cap.id})")

# Resumen por tipo del modelo
from collections import Counter
tipo_counts = Counter(getattr(getattr(c, REL_FIELD), "tipo", "") for c in db_no_cazados[:1000])
if tipo_counts:
    print("\n— BD no cazados (muestra por tipo, hasta 1000 inspeccionados) —")
    for t, n in tipo_counts.most_common():
        print(f"{t or '¿sin tipo?'} : {n}")

# ========= C) LIKEWIZE NO CAZADOS (staging sin match a DB) =========
print("\n=== C) LIKEWIZE NO CAZADOS (staging sin capacidad_id) ===")
unmatched_qs = S.filter(capacidad_id__isnull=True)
print(f"Total Likewize NO cazados: {unmatched_qs.count()}")

u_sample = list(unmatched_qs[:40].values("tipo","modelo_raw","modelo_norm","almacenamiento_gb","pulgadas","any","a_number","cpu"))
for i, r in enumerate(u_sample, start=1):
    print(f"{i:02d}. {r['tipo']} | {r['modelo_raw']} | {nn(r['almacenamiento_gb'])}GB | a#={nn(r['a_number'])} | {nn(r['pulgadas'])}\" | año={nn(r['any'])} | cpu={nn(r['cpu'])}")

print("\nListo. Si quieres, cambio las cuotas ([:30], [:40]) o añado CSVs.")
res = Capacidad.objects.filter(
    Q(modelo__tipo="Mac mini"),
    Q(modelo__descripcion__icontains="A2686"),
    Q(modelo__descripcion__icontains="M2"),
    Q(tamaño__icontains="256 GB"),
).values_list("id", "tamaño", "modelo__descripcion").first()

print(res or "No encontrado")
