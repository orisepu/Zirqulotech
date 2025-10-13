"""
Test: iPad screen_size - ¿Se extrae correctamente?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

test_cases = [
    'iPad Pro 13-inch (M4) Cellular 2TB',
    'iPad Pro 11-inch (M4) Wi-Fi 512GB',
    'iPad Pro de 12,9 pulgadas (2.ª generación) Wi-Fi 256GB',
]

adapter = V3CompatibilityAdapter()

print("\n" + "=" * 70)
print("Test: ¿Se extrae screen_size correctamente?")
print("=" * 70 + "\n")

for test in test_cases:
    print(f"Input: {test}")

    input_data = {'FullName': test, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"  screen_size: {result_obj.features.screen_size}")
        print(f"  device_type: {result_obj.features.device_type}")
        print(f"  variant: {result_obj.features.variant}")
        print(f"  storage_gb: {result_obj.features.storage_gb}")

    if result_obj.success:
        print(f"  ✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
    else:
        print(f"  ✗ NO mapeó")

    print()

print("=" * 70 + "\n")
