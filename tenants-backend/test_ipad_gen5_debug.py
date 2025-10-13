"""
Debug: ¿Por qué iPad Pro 12.9'' 5 no extrae generación?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django.db.models import Q
from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
from productos.models.modelos import Modelo

print("\n" + "=" * 70)
print("Debug: iPad Pro generación 5")
print("=" * 70 + "\n")

# 1. Ver qué modelos de iPad Pro 12.9" generación 5 hay en BD
print("1. iPad Pro 12.9\" generación 5 en BD:")
print("-" * 70)

ipads = Modelo.objects.filter(
    Q(descripcion__icontains='iPad Pro') &
    Q(descripcion__icontains='12,9')
).order_by('descripcion')[:20]

for m in ipads:
    print(f"  {m.descripcion}")

print()

# 2. Probar extracción de features
print("=" * 70)
print("2. Features extraídas")
print("=" * 70 + "\n")

test_cases = [
    'iPad Pro 12.9\'\' 5 Wi-Fi 128GB',
    'iPad Pro de 12,9 pulgadas (5.ª generación) Wi-Fi 256GB',
    'iPad Pro 12.9-inch 5th Gen Wi-Fi 512GB',
]

adapter = V3CompatibilityAdapter()

for test in test_cases:
    print(f"Input: {test}")
    print("-" * 70)

    input_data = {'FullName': test, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"Features extraídas:")
        print(f"  variant: {result_obj.features.variant}")
        print(f"  generation: {result_obj.features.generation}")  # ← El problema está aquí
        print(f"  screen_size: {result_obj.features.screen_size}")
        print(f"  storage_gb: {result_obj.features.storage_gb}")

    if result_obj.success:
        print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
        print(f"  Algoritmo: {result_obj.match_strategy}")
    else:
        print(f"✗ NO mapeó")

    print()

print("=" * 70 + "\n")
