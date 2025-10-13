"""
Test: Verificar que NO cae a GenerationMatcher cuando A-number existe
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device

print("\n" + "=" * 70)
print("Test: NO debe caer a otro A-number si el modelo existe")
print("=" * 70 + "\n")

# Caso del usuario: Mac mini M2 Pro A2816 8TB
# Antes: mapeaba a A2686 (incorrecto)
# Ahora: debe sugerir crear capacidad para A2816

input_data = {
    'FullName': 'Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 8TB SSD'
}

print(f"Input: {input_data['FullName']}")
print("-" * 70)

result = map_device(input_data, system='v4')

print(f"\nResultado:")
print(f"  success: {result['success']}")

if result['success']:
    print(f"  ✗ INCORRECTO - No debería mapear")
    print(f"  Capacidad ID: {result['capacidad_id']}")
    print(f"  Modelo: {result.get('modelo_descripcion')}")

    # Verificar si mapeó a otro A-number
    if 'A2686' in result.get('modelo_descripcion', ''):
        print(f"  ❌ ERROR: Mapeó a A2686 (A-number diferente!)")
    elif 'A2816' in result.get('modelo_descripcion', ''):
        print(f"  ✓ OK: Mapeó a A2816 (mismo A-number)")
else:
    print(f"  ✓ CORRECTO - No match (debe sugerir crear capacidad)")
    print(f"  Error: {result.get('error_message')}")
    print(f"  needs_capacity_creation: {result.get('needs_capacity_creation')}")

    if result.get('needs_capacity_creation'):
        print(f"\n  Sugerencia de capacidad:")
        sugg = result.get('suggested_capacity', {})
        print(f"    device_type: {sugg.get('device_type')}")
        print(f"    cpu: {sugg.get('cpu')}")
        print(f"    cpu_cores: {sugg.get('cpu_cores')}")
        print(f"    gpu_cores: {sugg.get('gpu_cores')}")
        print(f"    storage_gb: {sugg.get('storage_gb')}")
        print(f"    model_found: {sugg.get('model_found')}")

        if sugg.get('model_ids'):
            print(f"    model_ids: {sugg.get('model_ids')} (crear capacidad para estos modelos)")

print("\n" + "=" * 70)
print("Verificación adicional: Revisar logs del contexto")
print("=" * 70 + "\n")

# Ejecutar con logs detallados
from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
from productos.mapping.core.types import LikewizeInput

adapter = V3CompatibilityAdapter()
input_v4 = adapter._dict_to_likewize_input(input_data)
result_obj = adapter._service.map(input_v4)

# Buscar líneas clave en los logs
key_logs = []
for log in result_obj.context.logs:
    msg = log.message
    if any(keyword in msg for keyword in [
        'A-number',
        'A2816',
        'A2686',
        'GenerationMatcher',
        'NO se usará',
        'modelo existe'
    ]):
        key_logs.append(f"[{log.level}] {msg}")

print("Logs relevantes:")
for log in key_logs:
    print(f"  {log}")

print("\n" + "=" * 70 + "\n")
