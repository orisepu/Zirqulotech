"""
Test: Verificar el mapeo usando la última tarea de Likewize
"""
import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device
from productos.models.actualizarpreciosfuturos import TareaActualizacionLikewize, LikewizeItemStaging

# Obtener la última tarea
ultima_tarea = TareaActualizacionLikewize.objects.order_by('-creado_en').first()

if not ultima_tarea:
    print("\n❌ No hay tareas en la BD")
    exit(1)

print("\n" + "=" * 70)
print(f"Test: Última tarea - {ultima_tarea.id}")
print("=" * 70)
print(f"Fecha: {ultima_tarea.creado_en}")
print(f"Estado: {ultima_tarea.estado}")
print(f"Total modelos: {ultima_tarea.total_modelos or 0}")
print("=" * 70 + "\n")

# Buscar un item de Mac mini M2 Pro A2816 8TB en la tarea
from django.db.models import Q

# Buscar item específico de Mac mini A2816 8TB
item_test = LikewizeItemStaging.objects.filter(
    Q(tarea=ultima_tarea) &
    Q(a_number__iexact='A2816') &
    Q(almacenamiento_gb=8192) &
    Q(modelo_raw__icontains='M2 Pro')
).first()

if not item_test:
    # Si no hay ese específico, buscar cualquier Mac mini A2816 sin mapear
    item_test = LikewizeItemStaging.objects.filter(
        Q(tarea=ultima_tarea) &
        Q(a_number__iexact='A2816') &
        Q(capacidad_id__isnull=True)
    ).first()

if not item_test:
    print("⚠️ No hay items de Mac mini A2816 sin mapear en esta tarea")
    print("Usando datos de ejemplo hardcodeados...\n")
    input_data = {
        'FullName': 'Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 8TB SSD',
        'MModel': 'A2816'
    }
else:
    print(f"✓ Usando item de la tarea:")
    print(f"  modelo_raw: {item_test.modelo_raw}")
    print(f"  a_number: {item_test.a_number}")
    print(f"  storage: {item_test.almacenamiento_gb}GB")
    print()
    input_data = {
        'FullName': item_test.modelo_raw,
        'MModel': item_test.likewize_model_code or item_test.a_number or ''
    }

print("Datos de Likewize:")
print(f"  Nombre Original: {input_data['FullName']}")
print(f"  Código Likewize: {input_data.get('MModel', 'N/A')}")
print()

# Extraer A-number del input ANTES de mapear (lo necesitamos después)
a_number_match = re.search(r'\b(A\d{4})\b', input_data['FullName'])
a_number_input = a_number_match.group(1) if a_number_match else None

result = map_device(input_data, system='v4')

print("Detalles del Mapeo:")
print(f"  success: {result['success']}")
print()

if result['success']:
    print("  ✗ INCORRECTO - No debería mapear a otro A-number")
    print(f"  Modelo: {result.get('modelo_descripcion')}")
    print(f"  Capacidad ID: {result.get('capacidad_id')}")
    print(f"  Algoritmo: {result.get('strategy')}")
    print(f"  Confianza: {result.get('confidence') * 100:.2f}%")
    print()

    # Verificar si mapeó a A2686 (error anterior)
    if 'A2686' in result.get('modelo_descripcion', ''):
        print("  ❌ ERROR CRÍTICO: Mapeó a A2686 (A-number DIFERENTE)")
        print("  Esto es exactamente el problema reportado por el usuario")
    elif 'A2816' in result.get('modelo_descripcion', ''):
        print("  ⚠️ Mapeó a A2816 (correcto A-number pero no debería tener 8TB todavía)")
else:
    print("  ✓ CORRECTO - No match (debe sugerir crear capacidad)")
    print(f"  Error: {result.get('error_message')}")
    print(f"  needs_capacity_creation: {result.get('needs_capacity_creation')}")
    print()

    if result.get('needs_capacity_creation'):
        print("  ✓ Sugerencia de capacidad:")
        sugg = result.get('suggested_capacity', {})
        print(f"    device_type: {sugg.get('device_type')}")
        print(f"    cpu: {sugg.get('cpu')}")
        print(f"    cpu_cores: {sugg.get('cpu_cores')}")
        print(f"    gpu_cores: {sugg.get('gpu_cores')}")
        print(f"    storage_gb: {sugg.get('storage_gb')}")
        print(f"    model_found: {sugg.get('model_found')}")

        if sugg.get('model_ids'):
            print(f"    model_ids: {sugg.get('model_ids')}")
            print()
            print("  📋 Acción recomendada:")
            storage_tb = sugg.get('storage_gb', 0) / 1024 if sugg.get('storage_gb') else 0
            a_num_str = f" {a_number_input}" if a_number_input else ""
            print(f"     Crear capacidad {storage_tb:.0f}TB para los modelos{a_num_str}:")
            for model_id in sugg.get('model_ids', []):
                print(f"     - Modelo ID: {model_id}")

print("\n" + "=" * 70)
print("Análisis del comportamiento:")
print("=" * 70)
print()

if result['success']:
    # Verificar si mapeó al mismo A-number
    modelo_desc = result.get('modelo_descripcion', '')
    a_number_match_result = re.search(r'\b(A\d{4})\b', modelo_desc)
    a_number_result = a_number_match_result.group(1) if a_number_match_result else None

    if a_number_input and a_number_result:
        if a_number_input == a_number_result:
            print(f"  ✓ Mapeó al mismo A-number: {a_number_result}")
        else:
            print(f"  ⚠️ ADVERTENCIA: Mapeó a A-number diferente!")
            print(f"     Input: {a_number_input}")
            print(f"     Mapeado: {a_number_result}")
            print(f"     Esto VIOLA la regla: 'nunca debe ir a otro a-number diferente'")
else:
    print("Comportamiento correcto:")
    print("  ✓ NO mapea cuando el modelo existe pero falta capacidad")
    if a_number_input:
        print(f"  ✓ NO cae a otro A-number diferente del input ({a_number_input})")
    print("  ✓ Sugiere crear capacidad para el modelo correcto")
    print("  ✓ Respeta la regla: 'nunca debe ir a otro a-number diferente'")

print("\n" + "=" * 70 + "\n")
