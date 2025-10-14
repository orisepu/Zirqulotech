#!/usr/bin/env python
"""
Test script para verificar el fix del mapeo de Samsung.

Prueba 3 casos problemáticos:
1. Galaxy S10 Lite SM-G770F 128GB → Debe mapear a "Galaxy S10 Lite 128 GB" (capacidad_id: 7210)
2. Galaxy S10e SM-G970F 128GB → Debe mapear a "Galaxy S10e 128 GB" (capacidad_id: 7135)
3. Galaxy Z Flip 5G SM-F707B → Debe mapear a "Galaxy Z Flip 5G" (modelo_id: 1520)
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device
from productos.models.modelos import Modelo, Capacidad

# Test cases
test_cases = [
    {
        'name': 'Galaxy S10 Lite 128GB',
        'input': {
            'M_Model': 'Galaxy S10 Lite SM-G770F 128GB',
            'ModelName': 'Galaxy S10 Lite SM-G770F 128GB',
            'FullName': 'Galaxy S10 Lite SM-G770F 128GB',
            'BrandName': 'Samsung',
            'Capacity': '128GB',
        },
        'expected': {
            'modelo_descripcion': 'Galaxy S10 Lite',
            'capacidad_id': 7210,  # Galaxy S10 Lite 128 GB
            'tamaño': '128 GB'
        }
    },
    {
        'name': 'Galaxy S10e 128GB',
        'input': {
            'M_Model': 'Galaxy S10e SM-G970F 128GB',
            'ModelName': 'Galaxy S10e SM-G970F 128GB',
            'FullName': 'Galaxy S10e SM-G970F 128GB',
            'BrandName': 'Samsung',
            'Capacity': '128GB',
        },
        'expected': {
            'modelo_descripcion': 'Galaxy S10e',
            'capacidad_id': 7135,  # Galaxy S10e 128 GB
            'tamaño': '128 GB'
        }
    },
    {
        'name': 'Galaxy Z Flip 5G (primera gen)',
        'input': {
            'M_Model': 'Galaxy Z Flip 5G SM-F707B 256GB',
            'ModelName': 'Galaxy Z Flip 5G SM-F707B 256GB',
            'FullName': 'Galaxy Z Flip 5G SM-F707B 256GB',
            'BrandName': 'Samsung',
            'Capacity': '256GB',
        },
        'expected': {
            'modelo_descripcion': 'Galaxy Z Flip 5G',
            'modelo_id': 1520,
            # No verificamos capacidad específica aquí
        }
    }
]

print("=" * 80)
print("TEST: MAPEO DE SAMSUNG CON FIX DE VARIANTES")
print("=" * 80)
print()

passed = 0
failed = 0
errors = []

for test_case in test_cases:
    print(f"\n{'=' * 80}")
    print(f"Test: {test_case['name']}")
    print(f"{'=' * 80}")

    try:
        # Habilitar logging debug temporalmente
        import logging
        logging.basicConfig(level=logging.DEBUG)

        # Intentar mapear usando v4 system
        result = map_device(
            likewize_data=test_case['input'],
            system='v4'
        )

        print(f"\nInput: {test_case['input']['M_Model']}")
        print(f"\nResultado del mapeo:")

        if result.get('success'):
            print(f"  ✅ Mapeado exitosamente")
            print(f"  Modelo ID: {result.get('modelo_id')}")
            print(f"  Modelo descripción: {result.get('modelo_descripcion')}")
            print(f"  Capacidad ID: {result.get('capacidad_id')}")
            print(f"  Capacidad tamaño: {result.get('capacidad_tamanio', 'N/A')}")
            print(f"  Confidence: {result.get('confidence', 0):.2%}")
            print(f"  Estrategia: {result.get('strategy', 'N/A')}")

            # Verificar expectativas
            test_passed = True

            if 'modelo_descripcion' in test_case['expected']:
                expected_desc = test_case['expected']['modelo_descripcion']
                actual_desc = result.get('modelo_descripcion')
                if actual_desc != expected_desc:
                    test_passed = False
                    print(f"\n  ❌ FAIL: Descripción esperada '{expected_desc}', obtenida '{actual_desc}'")

            if 'capacidad_id' in test_case['expected']:
                expected_cap_id = test_case['expected']['capacidad_id']
                actual_cap_id = result.get('capacidad_id')
                if actual_cap_id != expected_cap_id:
                    test_passed = False
                    print(f"\n  ❌ FAIL: Capacidad ID esperada {expected_cap_id}, obtenida {actual_cap_id}")

            if 'tamaño' in test_case['expected']:
                expected_size = test_case['expected']['tamaño']
                actual_size = result.get('capacidad_tamanio')
                if actual_size != expected_size:
                    test_passed = False
                    print(f"\n  ❌ FAIL: Tamaño esperado '{expected_size}', obtenido '{actual_size}'")

            if 'modelo_id' in test_case['expected']:
                expected_model_id = test_case['expected']['modelo_id']
                actual_model_id = result.get('modelo_id')
                if actual_model_id != expected_model_id:
                    test_passed = False
                    print(f"\n  ❌ FAIL: Modelo ID esperado {expected_model_id}, obtenido {actual_model_id}")

            if test_passed:
                print(f"\n  ✅ TEST PASSED - Mapeo correcto")
                passed += 1
            else:
                failed += 1
                errors.append({
                    'test': test_case['name'],
                    'result': result,
                    'expected': test_case['expected']
                })
        else:
            print(f"  ❌ No se pudo mapear (success=False)")
            print(f"  Razón: {result.get('error_message', 'No especificada')}")
            print(f"  Error code: {result.get('error_code', 'N/A')}")
            failed += 1
            errors.append({
                'test': test_case['name'],
                'result': result,
                'expected': test_case['expected'],
                'reason': result.get('error_message')
            })

    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        failed += 1
        errors.append({
            'test': test_case['name'],
            'error': str(e)
        })

print("\n" + "=" * 80)
print(f"RESULTADOS: {passed}/{len(test_cases)} tests pasaron ({passed/len(test_cases)*100:.1f}%)")
print("=" * 80)

if errors:
    print("\nERRORES DETALLADOS:")
    for error in errors:
        print(f"\n  Test: {error['test']}")
        if 'error' in error:
            print(f"  Error: {error['error']}")
        elif error.get('result', {}).get('success') is False:
            print(f"  Resultado: success=False")
            print(f"  Razón: {error.get('reason', 'No especificada')}")
            print(f"  Esperado: {error['expected']}")
        else:
            print(f"  Esperado: {error['expected']}")
            result = error.get('result', {})
            print(f"  Obtenido:")
            print(f"    Modelo: {result.get('modelo_descripcion')} (ID: {result.get('modelo_id')})")
            print(f"    Capacidad: {result.get('capacidad_tamanio')} (ID: {result.get('capacidad_id')})")

print()
if failed == 0:
    print("✅ TODOS LOS TESTS PASARON - El mapeo funciona correctamente")
    exit(0)
else:
    print(f"❌ {failed} TESTS FALLARON - Revisar configuración del mapeo")
    exit(1)
