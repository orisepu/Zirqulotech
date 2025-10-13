"""
Test: iPad Pro con M4 explícito - ¿Debe mapear a M4 o primera gen?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

print("\n" + "=" * 80)
print("Test: iPad Pro con M4 explícito")
print("=" * 80 + "\n")

test_cases = [
    ('iPad Pro 11-inch Wi-Fi 1TB', 'Sin chip explícito → Primera gen'),
    ('iPad Pro 11-inch (M4) Wi-Fi 512GB', 'Con M4 explícito → M4'),
]

adapter = V3CompatibilityAdapter()

for test_input, expected_behavior in test_cases:
    print(f"Input: {test_input}")
    print(f"Comportamiento esperado: {expected_behavior}")
    print("-" * 80)

    input_data = {'FullName': test_input, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"Features extraídas:")
        print(f"  cpu: {result_obj.features.cpu}")
        print(f"  year: {result_obj.features.year}")
        print(f"  screen_size: {result_obj.features.screen_size}")

    print()

    if result_obj.success:
        print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
    else:
        print(f"✗ NO mapeó")

    print("\n" + "=" * 80 + "\n")
