"""
Test: Diferentes formatos de generación en iPad Pro
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

print("\n" + "=" * 80)
print("Test: Diferentes formatos de generación en iPad Pro")
print("=" * 80 + "\n")

test_cases = [
    # Formato: tamaño + generación
    ('iPad Pro 12.9\'\' 5 Wi-Fi 128GB', 5, 'iPad Pro de 12,9 pulgadas (5.ª generación)'),
    ('iPad Pro 12.9\'\' 6 Cellular 256GB', 6, 'iPad Pro de 12,9 pulgadas (6.ª generación)'),
    ('iPad Pro 11-inch 4 Wi-Fi 512GB', 4, 'iPad Pro de 11 pulgadas (4.ª generación)'),

    # Formato ordinal
    ('iPad Pro de 12,9 pulgadas (5.ª generación) Wi-Fi 256GB', 5, 'iPad Pro de 12,9 pulgadas (5.ª generación)'),
    ('iPad Air (6.ª generación) Wi-Fi 256GB', 6, 'iPad Air'),

    # Sin generación explícita (M4)
    ('iPad Pro 13-inch (M4) Wi-Fi 256GB', None, 'iPad Pro 13-inch (M4)'),
    ('iPad Pro 11-inch (M4) Cellular 512GB', None, 'iPad Pro 11-inch (M4)'),
]

adapter = V3CompatibilityAdapter()
passed = 0
total = len(test_cases)

for test_input, expected_gen, expected_model_part in test_cases:
    input_data = {'FullName': test_input, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    # Verificar generación extraída
    gen_ok = result_obj.features and result_obj.features.generation == expected_gen

    # Verificar que mapeó correctamente
    mapped_ok = result_obj.success and expected_model_part in result_obj.matched_modelo_descripcion

    if gen_ok and mapped_ok:
        passed += 1
        status = "✓ PASS"
    else:
        status = "✗ FAIL"

    print(f"{status} {test_input}")
    print(f"  Generación extraída: {result_obj.features.generation if result_obj.features else 'N/A'} (esperada: {expected_gen})")

    if result_obj.success:
        print(f"  Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
        print(f"  Algoritmo: {result_obj.match_strategy}")
    else:
        print(f"  NO MAPEÓ")

    print()

print("=" * 80)
print(f"Resultado: {passed}/{total} tests pasados ({passed/total*100:.1f}%)")
print("=" * 80 + "\n")
