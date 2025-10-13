"""
Test completo del mapeo de 512GB para ver dónde se eliminan los candidatos
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device

print("\n" + "=" * 70)
print("Test Mac mini M2 base 512GB - Trace completo")
print("=" * 70 + "\n")

# Caso que debería encontrar match pero no lo hace
input_data = {
    'FullName': 'Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD'
}

result = map_device(input_data, system='v4')

print(f"SUCCESS: {result['success']}")

if result['success']:
    print(f"\n✓ Match encontrado:")
    print(f"  Capacidad ID: {result['capacidad_id']}")
    print(f"  Modelo: {result.get('modelo_descripcion')}")
    print(f"  Capacidad: {result.get('capacidad_tamanio')}")
    print(f"  Strategy: {result.get('strategy')}")
    print(f"  Confidence: {result.get('confidence') * 100:.2f}%")
else:
    print(f"\n✗ No match")
    print(f"  Error: {result.get('error_message')}")
    print(f"  Needs capacity creation: {result.get('needs_capacity_creation')}")

# Imprimir logs del contexto
if result.get('logs_count', 0) > 0:
    print(f"\n{'=' * 70}")
    print("LOGS DEL CONTEXTO:")
    print(f"{'=' * 70}\n")

    # Los logs están en result['context'].logs pero no están en el dict
    # Necesito acceder al objeto original
    from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
    from productos.mapping.core.types import LikewizeInput

    adapter = V3CompatibilityAdapter()
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    for log in result_obj.context.logs:
        print(f"[{log.level}] {log.message}")

print("\n" + "=" * 70 + "\n")
