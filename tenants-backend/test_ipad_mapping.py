"""
Test: iPads - Por qué no mapean
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django.db.models import Q, Count
from productos.mapping import map_device
from productos.models.modelos import Modelo, Capacidad
from productos.models.actualizarpreciosfuturos import TareaActualizacionLikewize, LikewizeItemStaging

print("\n" + "=" * 70)
print("Investigación: iPads no mapean")
print("=" * 70 + "\n")

# 1. Obtener la última tarea
ultima_tarea = TareaActualizacionLikewize.objects.order_by('-creado_en').first()

# 2. Ver cuántos iPads hay en la tarea
print(f"Tarea: {ultima_tarea.id}")
print("=" * 70 + "\n")

ipads_in_task = LikewizeItemStaging.objects.filter(
    tarea=ultima_tarea,
    tipo__icontains='iPad'
)

total_ipads = ipads_in_task.count()
mapped_ipads = ipads_in_task.filter(capacidad_id__isnull=False).count()
unmapped_ipads = total_ipads - mapped_ipads

print(f"Total iPads en tarea: {total_ipads}")
print(f"Mapeados: {mapped_ipads} ({mapped_ipads/total_ipads*100:.1f}%)")
print(f"Sin mapear: {unmapped_ipads} ({unmapped_ipads/total_ipads*100:.1f}%)")
print()

# 3. Agrupar por modelo_norm para ver cuáles fallan
print("=" * 70)
print("iPads por modelo:")
print("=" * 70 + "\n")

ipads_by_model = LikewizeItemStaging.objects.filter(
    tarea=ultima_tarea,
    tipo__icontains='iPad'
).values('modelo_norm').annotate(
    total=Count('id'),
    mapeados=Count('capacidad_id', filter=Q(capacidad_id__isnull=False))
).order_by('-total')

print(f"{'Modelo':<50} {'Total':<8} {'Mapeados':<10} {'%':<8}")
print("-" * 80)

for item in ipads_by_model[:20]:  # Primeros 20
    modelo = item['modelo_norm']
    total = item['total']
    mapeados = item['mapeados']
    pct = (mapeados / total * 100) if total > 0 else 0

    status = "✓" if mapeados == total else ("⚠️" if mapeados > 0 else "✗")

    print(f"{status} {modelo:<48} {total:<8} {mapeados:<10} {pct:>6.1f}%")

print()

# 4. Probar mapeo de algunos iPads sin mapear
print("=" * 70)
print("Probando mapeo de iPads sin mapear:")
print("=" * 70 + "\n")

unmapped_samples = LikewizeItemStaging.objects.filter(
    tarea=ultima_tarea,
    tipo__icontains='iPad',
    capacidad_id__isnull=True
)[:3]

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
adapter = V3CompatibilityAdapter()

for i, item in enumerate(unmapped_samples, 1):
    print(f"{i}. {item.modelo_norm}")
    print("-" * 70)

    input_data = {
        'FullName': item.modelo_raw or item.modelo_norm,
        'MModel': item.likewize_model_code or item.a_number or ''
    }

    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"Features:")
        print(f"  device_type: {result_obj.features.device_type}")
        print(f"  generation: {result_obj.features.generation}")
        print(f"  variant: {result_obj.features.variant}")
        print(f"  storage_gb: {result_obj.features.storage_gb}")
        print(f"  year: {result_obj.features.year}")
        print(f"  a_number: {result_obj.features.a_number}")

    if result_obj.success:
        print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Capacidad: {result_obj.matched_capacidad_tamanio}")
        print(f"  Strategy: {result_obj.match_strategy}")
        print(f"  Confidence: {result_obj.match_score * 100:.1f}%")
        print(f"  Matcher: {result_obj.context.metadata.get('matcher_used', 'N/A')}")
    else:
        print(f"✗ NO mapeó")
        print(f"  Error: {result_obj.error_message}")

        # Ver los últimos logs
        print("\n  Logs relevantes:")
        for log in result_obj.context.logs[-10:]:
            print(f"    [{log.level}] {log.message}")

    print("\n")

print("=" * 70 + "\n")
