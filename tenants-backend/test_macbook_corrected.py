"""
Test: MacBook M4 Max mapping - Verificar que 16/40 mapea correctamente
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

print("\n" + "=" * 80)
print("Test: Input original vs input corregido")
print("=" * 80 + "\n")

test_cases = [
    ('MacBookPro16 6 M4 Max 16 Core CPU 40 Core GPU 14 inch A3185 10/2024 2TB SSD',
     'Input ORIGINAL (contradictorio: 14" con 16/40 cores)'),
    ('MacBookPro16 6 M4 Max 16 Core CPU 40 Core GPU 16 inch A3186 10/2024 2TB SSD',
     'Input CORREGIDO (16" con 16/40 cores, A3186)'),
    ('MacBookPro16 6 M4 Max 16 Core CPU 40 Core GPU 16 inch 10/2024 2TB SSD',
     'Sin A-number (debería inferir por cores)'),
]

adapter = V3CompatibilityAdapter()

for test_input, description in test_cases:
    print(f"{description}")
    print(f"Input: {test_input}")
    print("-" * 80)

    input_data = {'FullName': test_input, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"\nFeatures:")
        print(f"  screen_size: {result_obj.features.screen_size}\"")
        print(f"  cpu_cores: {result_obj.features.cpu_cores}")
        print(f"  gpu_cores: {result_obj.features.gpu_cores}")
        print(f"  a_number: {result_obj.features.a_number}")

    print()

    if result_obj.success:
        print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
    else:
        print(f"✗ NO mapeó")
        if result_obj.error_message:
            print(f"  Error: {result_obj.error_message}")

    print("\n" + "=" * 80 + "\n")
