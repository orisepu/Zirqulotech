"""
Test: iPhone mini - Por qué no mapea
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django.db.models import Q
from productos.mapping import map_device
from productos.models.modelos import Modelo, Capacidad

print("\n" + "=" * 70)
print("Investigación: iPhone mini no mapea")
print("=" * 70 + "\n")

# 1. Verificar si existen iPhone mini en la BD
print("1. ¿Existen iPhone mini en la BD?")
print("=" * 70 + "\n")

iphone_mini = Modelo.objects.filter(
    Q(tipo__icontains='iPhone') &
    Q(descripcion__icontains='mini')
)

print(f"Modelos iPhone mini encontrados: {iphone_mini.count()}")

for modelo in iphone_mini:
    print(f"\n  Modelo ID: {modelo.id}")
    print(f"    Descripción: {modelo.descripcion}")
    print(f"    Año: {modelo.año}")
    print(f"    Marca: {modelo.marca}")

    capacidades = Capacidad.objects.filter(modelo=modelo, activo=True)
    print(f"    Capacidades: {capacidades.count()}")
    for cap in capacidades[:5]:
        print(f"      - {cap.tamaño}")

print()

# 2. Probar mapeos de diferentes iPhone mini
print("=" * 70)
print("2. Probar mapeo de iPhone mini")
print("=" * 70 + "\n")

test_cases = [
    {'FullName': 'iPhone 12 mini 128GB', 'MModel': ''},
    {'FullName': 'iPhone 13 mini 256GB', 'MModel': ''},
]

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
adapter = V3CompatibilityAdapter()

for i, test_case in enumerate(test_cases, 1):
    print(f"{i}. {test_case['FullName']}")
    print("-" * 70)

    input_v4 = adapter._dict_to_likewize_input(test_case)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"Features:")
        print(f"  device_type: {result_obj.features.device_type}")
        print(f"  generation: {result_obj.features.generation}")
        print(f"  variant: {result_obj.features.variant}")
        print(f"  storage_gb: {result_obj.features.storage_gb}")
        print(f"  year: {result_obj.features.year}")

    if result_obj.success:
        print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Capacidad: {result_obj.matched_capacidad_tamanio}")
        print(f"  Strategy: {result_obj.match_strategy}")
        print(f"  Confidence: {result_obj.match_score * 100:.1f}%")
        print(f"  Matcher: {result_obj.context.metadata.get('matcher_used', 'N/A')}")

        # Verificar si es correcto (case-insensitive)
        if 'mini' in result_obj.matched_modelo_descripcion.lower():
            print("  ✅ CORRECTO: Mapeó a iPhone mini")
        else:
            print(f"  ❌ ERROR: Mapeó al modelo INCORRECTO (sin 'mini')")
    else:
        print(f"✗ NO mapeó")
        print(f"  Error: {result_obj.error_message}")

    # Logs relevantes
    print("\nLogs relevantes:")
    for log in result_obj.context.logs[-15:]:
        if 'mini' in log.message.lower() or 'variant' in log.message.lower():
            print(f"  [{log.level}] {log.message}")

    print("\n")

print("=" * 70 + "\n")
