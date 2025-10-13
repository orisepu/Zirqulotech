"""
Test: Verificar que el fallback a GenerationMatcher sigue funcionando
cuando el modelo NO existe (A-number no está en BD)
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device

test_cases = [
    {
        "name": "Caso 1: A-number NO existe → debe usar GenerationMatcher",
        "input": "MacBookAir15 13 M3 8 Core CPU 10 Core GPU 15 inch A9999 3/2024 512GB SSD",
        "expected": "Debe usar GenerationMatcher (A9999 no existe)"
    },
    {
        "name": "Caso 2: A-number existe → NO debe usar GenerationMatcher",
        "input": "Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 8TB SSD",
        "expected": "NO debe usar GenerationMatcher (A2816 existe)"
    },
    {
        "name": "Caso 3: Sin A-number → debe usar GenerationMatcher",
        "input": "MacBook Pro 13 inch M2 8 Core CPU 10 Core GPU 2022 1TB SSD",
        "expected": "Debe usar GenerationMatcher (no hay A-number)"
    },
    {
        "name": "Caso 4: A-number existe y tiene capacidad → debe mapear",
        "input": "Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 512GB SSD",
        "expected": "Debe mapear exitosamente con ANumberMatcher"
    }
]

print("\n" + "=" * 70)
print("Test: Verificar comportamiento de fallback a GenerationMatcher")
print("=" * 70 + "\n")

for test_case in test_cases:
    print(f"{test_case['name']}")
    print(f"Input: {test_case['input']}")
    print(f"Esperado: {test_case['expected']}")
    print("-" * 70)

    result = map_device({'FullName': test_case['input']}, system='v4')

    # Analizar logs para ver qué matcher se usó
    from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
    from productos.mapping.core.types import LikewizeInput

    adapter = V3CompatibilityAdapter()
    input_v4 = adapter._dict_to_likewize_input({'FullName': test_case['input']})
    result_obj = adapter._service.map(input_v4)

    used_generation = False
    used_a_number = False
    skipped_generation = False

    for log in result_obj.context.logs:
        if 'GenerationMatcher será usado' in log.message:
            used_generation = True
        if 'ANumberMatcher será usado' in log.message:
            used_a_number = True
        if 'NO se usará GenerationMatcher' in log.message:
            skipped_generation = True

    print(f"Resultado:")
    print(f"  success: {result['success']}")

    if result['success']:
        print(f"  ✓ Match encontrado")
        print(f"  Matcher usado: {'ANumberMatcher' if used_a_number else 'GenerationMatcher' if used_generation else 'Desconocido'}")
        print(f"  Modelo: {result.get('modelo_descripcion')}")
    else:
        print(f"  ✗ No match")
        if skipped_generation:
            print(f"  ⚠️ GenerationMatcher fue OMITIDO (modelo existe, falta capacidad)")
        elif used_generation:
            print(f"  ℹ️ GenerationMatcher fue usado pero no encontró match")
        else:
            print(f"  ℹ️ No se usó ningún matcher")

    print()

print("=" * 70 + "\n")
