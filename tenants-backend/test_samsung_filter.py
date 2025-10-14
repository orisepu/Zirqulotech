#!/usr/bin/env python
"""
Script de prueba para validar el nuevo filtro de modelos Samsung.

Simula el proceso de filtrado sin hacer llamadas reales a Likewize.
"""

import os
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tenants_backend.settings')
django.setup()

import re
from productos.likewize_config import get_extra_presets

# Patrones regex para detectar variantes regionales no europeas
NON_EUROPEAN_SAMSUNG_PATTERN = re.compile(
    r'SM-[A-Z]\d+[NUWVQ](?:1)?(?:\s|$)',
    re.IGNORECASE
)

def should_exclude_item(item, exclude_list, marca):
    """
    Función de prueba que replica la lógica del filtro en actualizar_likewize_v3.py
    """
    m_model = item.get('M_Model', '')
    model_name = item.get('ModelName', '')
    full_name = item.get('FullName', '')

    all_fields = f"{m_model} {model_name} {full_name}"

    # 1. Buscar por lista explícita
    if exclude_list:
        for excluded_code in exclude_list:
            if (excluded_code in m_model or
                excluded_code in model_name or
                excluded_code in full_name):
                return True, 'explicit_list'

    # 2. Filtro regex para Samsung
    if marca == 'Samsung':
        if NON_EUROPEAN_SAMSUNG_PATTERN.search(all_fields):
            return True, 'regex_pattern'

    return False, None

# Datos de prueba simulando respuestas de Likewize
test_items = [
    # Modelos que DEBEN ser excluidos (variantes USA)
    {'M_Model': 'Galaxy Note10 Plus 5G SM-N976U', 'ModelName': 'Galaxy Note10 Plus 5G SM-N976U', 'FullName': '', 'expected': True, 'reason': 'USA variant'},
    {'M_Model': 'Galaxy Note10 Plus SM-N975U', 'ModelName': 'Galaxy Note10 Plus SM-N975U', 'FullName': '', 'expected': True, 'reason': 'USA variant'},
    {'M_Model': 'Galaxy S10 SM-G973U1', 'ModelName': 'Galaxy S10 SM-G973U1', 'FullName': '', 'expected': True, 'reason': 'USA unlocked'},

    # Modelos que DEBEN ser excluidos (variantes Canada)
    {'M_Model': 'Galaxy S10 SM-G973W', 'ModelName': 'Galaxy S10 SM-G973W', 'FullName': '', 'expected': True, 'reason': 'Canada variant'},

    # Modelos que DEBEN ser excluidos (variantes Korea)
    {'M_Model': 'Galaxy Note10 5G SM-N971N', 'ModelName': 'Galaxy Note10 5G SM-N971N', 'FullName': '', 'expected': True, 'reason': 'Korea variant'},

    # Modelos que NO deben ser excluidos (variantes europeas)
    {'M_Model': 'Galaxy Note10 Plus SM-N975F', 'ModelName': 'Galaxy Note10 Plus SM-N975F', 'FullName': '', 'expected': False, 'reason': 'European variant (F)'},
    {'M_Model': 'Galaxy S10 SM-G973F', 'ModelName': 'Galaxy S10 SM-G973F', 'FullName': '', 'expected': False, 'reason': 'European variant (F)'},
    {'M_Model': 'Galaxy Note10 Lite SM-N770F', 'ModelName': 'Galaxy Note10 Lite SM-N770F', 'FullName': '', 'expected': False, 'reason': 'European Lite variant'},
    {'M_Model': 'Galaxy S20 FE 5G SM-G781B', 'ModelName': 'Galaxy S20 FE 5G SM-G781B', 'FullName': '', 'expected': False, 'reason': 'European variant (B)'},
]

print("="*80)
print("TEST: FILTRO DE MODELOS SAMSUNG NO EUROPEOS")
print("="*80)
print()

# Obtener configuración de Samsung
presets = get_extra_presets()
samsung_preset = next((p for p in presets if p.get('marca') == 'Samsung'), None)

if not samsung_preset:
    print("ERROR: No se encontró preset de Samsung")
    exit(1)

exclude_list = samsung_preset.get('exclude_m_models', [])
print(f"Lista de exclusión configurada: {len(exclude_list)} modelos")
print()

# Ejecutar pruebas
passed = 0
failed = 0
errors = []

for test_item in test_items:
    should_exclude, filter_type = should_exclude_item(test_item, exclude_list, 'Samsung')

    test_passed = (should_exclude == test_item['expected'])

    status = "✅ PASS" if test_passed else "❌ FAIL"

    if test_passed:
        passed += 1
    else:
        failed += 1
        errors.append({
            'item': test_item,
            'expected': test_item['expected'],
            'got': should_exclude,
            'filter_type': filter_type
        })

    print(f"{status} | {test_item['M_Model'][:40]:40} | {test_item['reason']:20} | Filter: {filter_type or 'none'}")

print()
print("="*80)
print(f"RESULTADOS: {passed} passed, {failed} failed")
print("="*80)

if errors:
    print()
    print("ERRORES DETALLADOS:")
    for error in errors:
        print(f"  Modelo: {error['item']['M_Model']}")
        print(f"  Esperado: {'Excluir' if error['expected'] else 'Incluir'}")
        print(f"  Obtenido: {'Excluido' if error['got'] else 'Incluido'}")
        print(f"  Tipo de filtro: {error['filter_type']}")
        print()

if failed == 0:
    print("✅ TODOS LOS TESTS PASARON")
    exit(0)
else:
    print(f"❌ {failed} TESTS FALLARON")
    exit(1)
