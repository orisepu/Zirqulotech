#!/usr/bin/env python
"""
Script de prueba para validar el nuevo filtro de modelos Samsung.
Versión simplificada sin dependencias de Django.
"""

import re

# Lista de modelos excluidos (copiada de likewize_config.py)
EXCLUDED_MODELS = [
    'SM-N971N', 'SM-N976U', 'SM-N9750', 'SM-N975U', 'SM-N975U1', 'SM-N9700', 'SM-N970U', 'SM-N970U1',
    'SM-N981U', 'SM-N9860', 'SM-N986U', 'SM-N985F',
    'SC-01L', 'SCV40', 'SM-N770F DSM',
    'SM-N9600', 'SM-N9608', 'SM-N960N', 'SM-N960U', 'SM-N960U1', 'SM-N960W',
    'SM-G977N', 'SM-G977U',
    'SC-03L', 'SC-04L', 'SC-05L', 'SCV41', 'SCV42',
    'SM-G9730', 'SM-G9738', 'SM-G973C', 'SM-G973U', 'SM-G973U1', 'SM-G973W',
    'SM-G9700', 'SM-G9708', 'SM-G970N', 'SM-G970U', 'SM-G970U1', 'SM-G970W',
    'SM-G9810', 'SM-G981N', 'SM-G981U', 'SM-G981V',
    'SM-G7810', 'SM-G781N', 'SM-G781U', 'SM-G781V', 'SM-G781W',
    'SM-G9860', 'SM-G986N', 'SM-G986U', 'SM-G986U1', 'SM-G986W',
    'SCG03', 'SM-G9880', 'SM-G988N', 'SM-G988Q', 'SM-G988U', 'SM-G988U1', 'SM-G988W',
]

# Patrón regex para detectar variantes regionales no europeas
# Actualizado para incluir: J (Japón), C/E/D (China), SC-/SCV/SCG (códigos japoneses especiales)
NON_EUROPEAN_SAMSUNG_PATTERN = re.compile(
    r'(?:SM-[A-Z]\d+[NUWVQJCED](?:1)?|SC-[A-Z0-9]+|SCV\d+|SCG\d+)\b',
    re.IGNORECASE
)

def should_exclude_item(item, exclude_list):
    """
    Función de prueba que replica la lógica del filtro en actualizar_likewize_v3.py
    """
    m_model = item.get('M_Model', '')
    model_name = item.get('ModelName', '')
    full_name = item.get('FullName', '')

    all_fields = f"{m_model} {model_name} {full_name}"

    # 1. Buscar por lista explícita
    for excluded_code in exclude_list:
        if (excluded_code in m_model or
            excluded_code in model_name or
            excluded_code in full_name):
            return True, 'explicit_list', excluded_code

    # 2. Filtro regex para Samsung
    if NON_EUROPEAN_SAMSUNG_PATTERN.search(all_fields):
        match = NON_EUROPEAN_SAMSUNG_PATTERN.search(all_fields)
        return True, 'regex_pattern', match.group(0).strip()

    return False, None, None

# Datos de prueba simulando respuestas de Likewize
test_items = [
    # Modelos que DEBEN ser excluidos (variantes USA)
    {'M_Model': 'Galaxy Note10 Plus 5G SM-N976U', 'ModelName': 'Galaxy Note10 Plus 5G SM-N976U', 'FullName': '', 'expected': True, 'reason': 'USA variant (U)'},
    {'M_Model': 'Galaxy Note10 Plus SM-N975U', 'ModelName': 'Galaxy Note10 Plus SM-N975U', 'FullName': '', 'expected': True, 'reason': 'USA variant (U)'},
    {'M_Model': 'Galaxy S10 SM-G973U1', 'ModelName': 'Galaxy S10 SM-G973U1', 'FullName': '', 'expected': True, 'reason': 'USA unlocked (U1)'},
    {'M_Model': 'Galaxy Note9 SM-N960U', 'ModelName': 'Galaxy Note9 SM-N960U', 'FullName': '', 'expected': True, 'reason': 'USA variant (U)'},

    # Modelos que DEBEN ser excluidos (variantes Canada)
    {'M_Model': 'Galaxy S10 SM-G973W', 'ModelName': 'Galaxy S10 SM-G973W', 'FullName': '', 'expected': True, 'reason': 'Canada variant (W)'},
    {'M_Model': 'Galaxy Note9 SM-N960W', 'ModelName': 'Galaxy Note9 SM-N960W', 'FullName': '', 'expected': True, 'reason': 'Canada variant (W)'},

    # Modelos que DEBEN ser excluidos (variantes Korea)
    {'M_Model': 'Galaxy Note10 5G SM-N971N', 'ModelName': 'Galaxy Note10 5G SM-N971N', 'FullName': '', 'expected': True, 'reason': 'Korea variant (N)'},
    {'M_Model': 'Galaxy S10 5G SM-G977N', 'ModelName': 'Galaxy S10 5G SM-G977N', 'FullName': '', 'expected': True, 'reason': 'Korea variant (N)'},

    # Modelos que DEBEN ser excluidos (variantes Verizon)
    {'M_Model': 'Galaxy S20 5G UW SM-G981V', 'ModelName': 'Galaxy S20 5G UW SM-G981V', 'FullName': '', 'expected': True, 'reason': 'Verizon variant (V)'},

    # Modelos que DEBEN ser excluidos (variantes China)
    {'M_Model': 'Galaxy S20 Ultra 5G SM-G988Q', 'ModelName': 'Galaxy S20 Ultra 5G SM-G988Q', 'FullName': '', 'expected': True, 'reason': 'China Qualcomm (Q)'},
    {'M_Model': 'Galaxy S10 SM-G973C', 'ModelName': 'Galaxy S10 SM-G973C', 'FullName': '', 'expected': True, 'reason': 'China variant (C)'},

    # Modelos que DEBEN ser excluidos (variantes Japón)
    {'M_Model': 'Galaxy S24 SM-S921J', 'ModelName': 'Galaxy S24 SM-S921J', 'FullName': '', 'expected': True, 'reason': 'Japan variant (J)'},
    {'M_Model': 'Galaxy S24 Ultra SM-S928J', 'ModelName': 'Galaxy S24 Ultra SM-S928J', 'FullName': '', 'expected': True, 'reason': 'Japan Ultra (J)'},
    {'M_Model': 'SC-01L', 'ModelName': 'Galaxy Note9 SC-01L', 'FullName': 'Note9 docomo', 'expected': True, 'reason': 'Japan docomo (SC-01L)'},
    {'M_Model': 'SCV40', 'ModelName': 'Galaxy Note9 SCV40', 'FullName': 'Note9 au', 'expected': True, 'reason': 'Japan au (SCV40)'},
    {'M_Model': 'SCG03', 'ModelName': 'Galaxy S20 5G SCG03', 'FullName': 'S20 au', 'expected': True, 'reason': 'Japan au 5G (SCG03)'},

    # Modelos que NO deben ser excluidos (variantes europeas)
    {'M_Model': 'Galaxy Note10 Plus SM-N975F', 'ModelName': 'Galaxy Note10 Plus SM-N975F', 'FullName': '', 'expected': False, 'reason': 'European variant (F)'},
    {'M_Model': 'Galaxy S10 SM-G973F', 'ModelName': 'Galaxy S10 SM-G973F', 'FullName': '', 'expected': False, 'reason': 'European variant (F)'},
    {'M_Model': 'Galaxy Note10 Lite SM-N770F', 'ModelName': 'Galaxy Note10 Lite SM-N770F', 'FullName': '', 'expected': False, 'reason': 'European Lite variant (F)'},
    {'M_Model': 'Galaxy S20 FE 5G SM-G781B', 'ModelName': 'Galaxy S20 FE 5G SM-G781B', 'FullName': '', 'expected': False, 'reason': 'European variant (B)'},
    {'M_Model': 'Galaxy S21 5G SM-G991B', 'ModelName': 'Galaxy S21 5G SM-G991B', 'FullName': '', 'expected': False, 'reason': 'European variant (B)'},
    {'M_Model': 'Galaxy Z Fold3 5G SM-F926B', 'ModelName': 'Galaxy Z Fold3 5G SM-F926B', 'FullName': '', 'expected': False, 'reason': 'European foldable (B)'},
]

print("="*80)
print("TEST: FILTRO DE MODELOS SAMSUNG NO EUROPEOS")
print("="*80)
print()
print(f"Lista de exclusión configurada: {len(EXCLUDED_MODELS)} modelos")
print()

# Ejecutar pruebas
passed = 0
failed = 0
errors = []

print(f"{'Status':<10} | {'Modelo':<45} | {'Razón':<25} | {'Filtro':<15} | {'Match'}")
print("-" * 120)

for test_item in test_items:
    should_exclude, filter_type, match = should_exclude_item(test_item, EXCLUDED_MODELS)

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

    filter_display = filter_type or 'none'
    match_display = match[:20] if match else '-'

    print(f"{status:<10} | {test_item['M_Model']:<45} | {test_item['reason']:<25} | {filter_display:<15} | {match_display}")

print()
print("="*80)
print(f"RESULTADOS: {passed}/{len(test_items)} tests pasaron ({passed/len(test_items)*100:.1f}%)")
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

print()
if failed == 0:
    print("✅ TODOS LOS TESTS PASARON - El filtro funciona correctamente")
    exit(0)
else:
    print(f"❌ {failed} TESTS FALLARON - Revisar configuración del filtro")
    exit(1)
