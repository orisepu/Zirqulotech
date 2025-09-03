from django.apps import apps
from django.conf import settings
from django.db.models import Q, Count
from productos.models import TareaActualizacionLikewize, LikewizeItemStaging

Capacidad = apps.get_model(settings.CAPACIDAD_MODEL)
rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
rel_name  = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
gb_field  = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
Modelo    = Capacidad._meta.get_field(rel_field).related_model

def _patterns_for_capacity(gb: int):
    def fmt(x): 
        s = f"{x:.3f}".rstrip("0").rstrip(".")
        return s or "0"
    pats = {str(gb), f"{gb}GB", f"{gb} GB"}
    tb = gb / 1024.0
    for s in {fmt(tb), fmt(tb).replace(".", ",")}:
        pats.update({f"{s}TB", f"{s} TB"})
    return pats

def brechas(tarea_uuid: str, top=30):
    t = TareaActualizacionLikewize.objects.get(pk=tarea_uuid)
    nm = (t.staging.filter(tipo="Mac", capacidad_id__isnull=True)
          .exclude(a_number=""))

    print(f"No mapeados Mac con A-number: {nm.count()}")

    # Top A-number
    tops = (nm.values("a_number")
              .annotate(n=Count("id"))
              .order_by("-n")[:top])

    rows = list(nm.values("a_number","almacenamiento_gb").order_by("a_number").distinct())

    for item in tops:
      a = item["a_number"]
      # modelos que contienen ese A-number
      modelos_qs = Modelo.objects.filter(**{f"{rel_name}__icontains": a})
      modelos_ct = modelos_qs.count()
      # tamaños pedimos en staging para ese A-number
      tamaños = sorted({r["almacenamiento_gb"] for r in rows if r["a_number"]==a and r["almacenamiento_gb"]})
      # ¿existen capacidades para esos tamaños?
      cap_ok = 0
      cap_missing = []
      for gb in tamaños:
          q = Q()
          for s in _patterns_for_capacity(int(gb)):
              q |= Q(**{f"{gb_field}__icontains": s})
          caps = Capacidad.objects.filter(q, **{f"{rel_field}__in": modelos_qs.values("id")})
          if caps.exists():
              cap_ok += 1
          else:
              cap_missing.append(gb)
      print(f"{a}: staging={item['n']} | modelos={modelos_ct} | tamaños={tamaños} | capacidades_OK={cap_ok} | capacidades_FALTAN={cap_missing}")

