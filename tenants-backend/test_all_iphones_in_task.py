"""
Ver todos los modelos de iPhone en la tarea y cuántos mapean
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models.actualizarpreciosfuturos import TareaActualizacionLikewize, LikewizeItemStaging
from django.db.models import Count, Q

# Obtener la última tarea
ultima_tarea = TareaActualizacionLikewize.objects.order_by('-creado_en').first()

print("\n" + "=" * 70)
print(f"Análisis de iPhones en tarea: {ultima_tarea.id}")
print("=" * 70 + "\n")

# Agrupar por modelo_norm
iphones_by_model = LikewizeItemStaging.objects.filter(
    tarea=ultima_tarea,
    tipo__icontains='iPhone'
).values('modelo_norm').annotate(
    total=Count('id'),
    mapeados=Count('capacidad_id', filter=Q(capacidad_id__isnull=False))
).order_by('-total')

print(f"{'Modelo':<40} {'Total':<8} {'Mapeados':<10} {'%':<8}")
print("-" * 70)

total_general = 0
mapeados_general = 0

for item in iphones_by_model:
    modelo = item['modelo_norm']
    total = item['total']
    mapeados = item['mapeados']
    pct = (mapeados / total * 100) if total > 0 else 0

    total_general += total
    mapeados_general += mapeados

    status = "✓" if mapeados == total else ("⚠️" if mapeados > 0 else "✗")

    print(f"{status} {modelo:<38} {total:<8} {mapeados:<10} {pct:>6.1f}%")

print("-" * 70)
print(f"{'TOTAL':<40} {total_general:<8} {mapeados_general:<10} {mapeados_general/total_general*100:>6.1f}%")

print("\n" + "=" * 70 + "\n")
