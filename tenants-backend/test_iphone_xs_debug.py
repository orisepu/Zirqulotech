"""
Debug detallado: Por qué iPhone XS no mapea
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device
from productos.models.modelos import Modelo, Capacidad

print("\n" + "=" * 70)
print("Debug: iPhone XS / XS Max - Por qué no mapea")
print("=" * 70 + "\n")

# 1. Verificar si existen en la BD
print("1. ¿Existen iPhone XS en la BD?")
print("=" * 70 + "\n")

iphone_xs = Modelo.objects.filter(tipo__icontains='iPhone', descripcion__icontains='XS')
print(f"Modelos iPhone XS encontrados: {iphone_xs.count()}")

for modelo in iphone_xs[:5]:
    print(f"\n  Modelo ID: {modelo.id}")
    print(f"    Descripción: {modelo.descripcion}")
    print(f"    Año: {modelo.año}")
    print(f"    Marca: {modelo.marca}")

    capacidades = Capacidad.objects.filter(modelo=modelo, activo=True)
    print(f"    Capacidades: {capacidades.count()}")
    for cap in capacidades[:3]:
        print(f"      - {cap.tamaño}")

# 2. Probar mapeo con detalles
print("\n" + "=" * 70)
print("2. Probar mapeo con trace completo")
print("=" * 70 + "\n")

test_case = {
    'FullName': 'iPhone XS 256GB',
    'MModel': ''
}

print(f"Input: {test_case['FullName']}")
print()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
adapter = V3CompatibilityAdapter()
input_v4 = adapter._dict_to_likewize_input(test_case)
result_obj = adapter._service.map(input_v4)

print("Features extraídas:")
print(f"  device_type: {result_obj.features.device_type}")
print(f"  generation: {result_obj.features.generation}")
print(f"  variant: {result_obj.features.variant}")
print(f"  storage_gb: {result_obj.features.storage_gb}")
print(f"  year: {result_obj.features.year}")
print()

print("TODOS los logs del mapeo:")
print("-" * 70)
for log in result_obj.context.logs:  # TODOS los logs
    print(f"[{log.level}] {log.message}")

print("\n" + "=" * 70)
print("3. ¿Qué engine se usó?")
print("=" * 70 + "\n")

# Verificar si el iPhone engine está registrado
from productos.mapping.services.device_mapper_service import DeviceMapperService
service = DeviceMapperService()

print(f"Engines registrados: {len(service.engines)}")
for engine in service.engines:
    print(f"  - {engine.__class__.__name__}")
    if hasattr(engine, 'can_handle'):
        can_handle = engine.can_handle(input_v4)
        print(f"    ¿Puede manejar 'iPhone XS 256GB'? {can_handle}")

print("\n" + "=" * 70 + "\n")
