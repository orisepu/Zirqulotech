"""
Debug: iPad Air 4 - ¿Por qué mapea a generación 3?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
from django.db.models import Q
from productos.models.modelos import Modelo

print("\n" + "=" * 80)
print("Debug: iPad Air 4")
print("=" * 80 + "\n")

# 1. Ver todos los modelos de iPad Air en BD
print("1. Todos los iPad Air en BD:")
print("-" * 80)

ipads_air = Modelo.objects.filter(
    descripcion__icontains='iPad Air'
).order_by('descripcion')

for m in ipads_air:
    print(f"  {m.descripcion}")

print(f"\nTotal: {ipads_air.count()} modelos\n")

# 2. Probar extracción de features
print("=" * 80)
print("2. Extracción de features")
print("=" * 80 + "\n")

test_input = 'iPad Air 4 Cellular 256GB'

adapter = V3CompatibilityAdapter()
input_data = {'FullName': test_input, 'MModel': ''}
input_v4 = adapter._dict_to_likewize_input(input_data)
result_obj = adapter._service.map(input_v4)

print(f"Input: {test_input}")
print("-" * 80)

if result_obj.features:
    print(f"Features extraídas:")
    print(f"  device_type: {result_obj.features.device_type}")
    print(f"  variant: {result_obj.features.variant}")
    print(f"  generation: {result_obj.features.generation}")  # ← ¿Extrae 4?
    print(f"  screen_size: {result_obj.features.screen_size}")
    print(f"  storage_gb: {result_obj.features.storage_gb}")

print()

if result_obj.success:
    print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
    print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
    print(f"  Algoritmo: {result_obj.match_strategy}")
else:
    print(f"✗ NO mapeó")

print("\n3. Logs relevantes:")
print("-" * 80)
for log in result_obj.context.logs:
    if 'generación' in log.message.lower() or 'generation' in log.message.lower():
        print(f"  [{log.level}] {log.message}")

print("\n" + "=" * 80 + "\n")
