"""
Test: ¿Se extraen los cores de CPU/GPU de MacBook?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
from django.db.models import Q
from productos.models.modelos import Modelo

print("\n" + "=" * 80)
print("Test: Extracción de CPU/GPU cores en MacBook")
print("=" * 80 + "\n")

# 1. Ver modelos con A3185 en BD
print("1. Modelos con A-Number A3185 en BD:")
print("-" * 80)

modelos = Modelo.objects.filter(a_number='A3185').order_by('descripcion')
for m in modelos:
    print(f"  {m.descripcion}")
    # Ver si hay campos de CPU/GPU cores
    if hasattr(m, 'cpu_cores'):
        print(f"    CPU cores: {m.cpu_cores}")
    if hasattr(m, 'gpu_cores'):
        print(f"    GPU cores: {m.gpu_cores}")

print(f"\nTotal: {modelos.count()} modelos\n")

# 2. Probar extracción
print("=" * 80)
print("2. Features extraídas del input")
print("=" * 80 + "\n")

test_cases = [
    'MacBookPro16 6 M4 Max 16 Core CPU 40 Core GPU 14 inch A3185 10/2024 2TB SSD',
    'MacBook Pro 14" M4 Max 14-Core CPU 32-Core GPU A3185',
]

adapter = V3CompatibilityAdapter()

for test_input in test_cases:
    print(f"Input: {test_input}")
    print("-" * 80)

    input_data = {'FullName': test_input, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"Features extraídas:")
        print(f"  a_number: {result_obj.features.a_number}")
        print(f"  cpu: {result_obj.features.cpu}")
        # ¿Hay campos para CPU/GPU cores?
        if hasattr(result_obj.features, 'cpu_cores'):
            print(f"  cpu_cores: {result_obj.features.cpu_cores}")
        if hasattr(result_obj.features, 'gpu_cores'):
            print(f"  gpu_cores: {result_obj.features.gpu_cores}")

    if result_obj.success:
        print(f"\n✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
    else:
        print(f"\n✗ NO mapeó")

    print("\n")

print("=" * 80 + "\n")
