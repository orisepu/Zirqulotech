"""
Test: Casos específicos reportados por el usuario
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

print("\n" + "=" * 80)
print("Test: Casos Específicos Reportados por el Usuario")
print("=" * 80 + "\n")

test_cases = [
    # Caso 1: Generación después del tamaño
    {
        'input': 'iPad Pro 12.9\'\' 5 Wi-Fi 128GB',
        'expected_model': 'iPad Pro de 12,9 pulgadas (5.ª generación)',
        'expected_gen': 5,
        'issue': 'Generación "5" después del tamaño no se extraía'
    },

    # Caso 2: Sin generación explícita
    {
        'input': 'iPad Pro 11-inch Wi-Fi 1TB',
        'expected_model': None,  # Cualquier iPad Pro 11-inch es válido
        'expected_gen': None,
        'issue': 'Sin generación - debe elegir razonablemente (M4 por KB)'
    },

    # Caso 3: iPad Air con generación
    {
        'input': 'iPad Air 4 Cellular 256GB',
        'expected_model': 'iPad Air (4.ª generación)',
        'expected_gen': 4,
        'issue': 'Mapeaba a generación 3 en lugar de 4'
    },
]

adapter = V3CompatibilityAdapter()
passed = 0
total = len(test_cases)

for i, case in enumerate(test_cases, 1):
    input_text = case['input']
    expected_model = case['expected_model']
    expected_gen = case['expected_gen']
    issue = case['issue']

    input_data = {'FullName': input_text, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    # Verificar generación extraída
    gen_ok = (result_obj.features and
              result_obj.features.generation == expected_gen)

    # Verificar modelo mapeado
    if expected_model:
        model_ok = (result_obj.success and
                    expected_model in result_obj.matched_modelo_descripcion)
    else:
        # Sin modelo esperado específico, solo verificar que mapeó
        model_ok = result_obj.success

    # Resultado
    if gen_ok and model_ok:
        passed += 1
        status = "✓ PASS"
    else:
        status = "✗ FAIL"

    print(f"Caso {i}: {status}")
    print(f"  Input: {input_text}")
    print(f"  Issue: {issue}")
    print()

    print(f"  Generación extraída: {result_obj.features.generation if result_obj.features else 'N/A'}")
    if expected_gen is not None:
        print(f"  Generación esperada: {expected_gen}")
        print(f"  {'✓' if gen_ok else '✗'} Generación correcta")
    print()

    if result_obj.success:
        print(f"  Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
        print(f"  Algoritmo: {result_obj.match_strategy}")
        if expected_model:
            print(f"  {'✓' if model_ok else '✗'} Modelo correcto")
    else:
        print(f"  ✗ NO mapeó")

    print("\n" + "-" * 80 + "\n")

print("=" * 80)
print(f"RESULTADO: {passed}/{total} casos pasados ({passed/total*100:.1f}%)")
print("=" * 80 + "\n")
