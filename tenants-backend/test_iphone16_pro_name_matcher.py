"""
Test: iPhone 16 Pro debe usar NameMatcher (no GenerationMatcher)

iPhone 16 Pro 256GB estaba mapeando a iPhone 11 Pro con GenerationMatcher.
Ahora debe usar NameMatcher para encontrar el modelo correcto.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django.db.models import Q
from productos.mapping import map_device
from productos.models.modelos import Modelo

print("\n" + "=" * 70)
print("Test: iPhone 16 Pro debe usar NameMatcher")
print("=" * 70 + "\n")

# 1. Verificar si existe iPhone 16 Pro en la BD
print("1. ¿Existe iPhone 16 Pro en la BD?")
print("=" * 70 + "\n")

iphone_16_pro = Modelo.objects.filter(
    Q(tipo__icontains='iPhone') &
    Q(descripcion__icontains='16') &
    Q(descripcion__icontains='Pro')
).exclude(descripcion__icontains='Max')

print(f"Modelos iPhone 16 Pro encontrados: {iphone_16_pro.count()}")

if iphone_16_pro.exists():
    for modelo in iphone_16_pro[:5]:
        print(f"  - {modelo.descripcion} (ID: {modelo.id}, Año: {modelo.año})")
else:
    print("  ⚠️  iPhone 16 Pro NO existe en la BD")
    print("     Creando modelo de prueba...")

    # Crear modelo de prueba
    from productos.models.modelos import Modelo, Capacidad

    # Verificar si ya existe
    modelo, created = Modelo.objects.get_or_create(
        descripcion="iPhone 16 Pro",
        tipo="iPhone",
        defaults={
            'marca': 'Apple',
            'año': 2024,
            'activo': True
        }
    )

    if created:
        print(f"  ✓ Modelo creado: {modelo.descripcion} (ID: {modelo.id})")

        # Crear capacidades
        capacidades = [128, 256, 512, 1024]
        for gb in capacidades:
            cap, cap_created = Capacidad.objects.get_or_create(
                modelo=modelo,
                tamaño=f"{gb} GB",
                defaults={
                    'activo': True,
                    'almacenamiento_GB': gb
                }
            )
            if cap_created:
                print(f"    - Capacidad creada: {gb} GB")
    else:
        print(f"  ℹ️  Modelo ya existe: {modelo.descripcion} (ID: {modelo.id})")

print()

# 2. Probar mapeo con detalles completos
print("=" * 70)
print("2. Probar mapeo con trace completo")
print("=" * 70 + "\n")

test_case = {
    'FullName': 'iPhone 16 Pro 256GB',
    'MModel': ''
}

print(f"Input: {test_case['FullName']}")
print()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
adapter = V3CompatibilityAdapter()
input_v4 = adapter._dict_to_likewize_input(test_case)
result_obj = adapter._service.map(input_v4)

if result_obj.features:
    print("Features extraídas:")
    print(f"  device_type: {result_obj.features.device_type}")
    print(f"  generation: {result_obj.features.generation}")
    print(f"  variant: {result_obj.features.variant}")
    print(f"  storage_gb: {result_obj.features.storage_gb}")
    print(f"  year: {result_obj.features.year}")
    print(f"  a_number: {result_obj.features.a_number}")
    print()
else:
    print("⚠️  Features is None - Error durante extracción")
    print()

print("Resultado del mapeo:")
print("-" * 70)
if result_obj.success:
    print(f"✓ ÉXITO - Mapeó a: {result_obj.matched_modelo_descripcion}")
    print(f"  Capacidad: {result_obj.matched_capacidad_tamanio}")
    print(f"  Strategy: {result_obj.match_strategy}")
    print(f"  Confidence: {result_obj.match_score * 100:.1f}%")
    print(f"  Matcher usado: {result_obj.context.metadata.get('matcher_used', 'N/A')}")

    # Verificación: ¿Es el correcto?
    if '16 Pro' in result_obj.matched_modelo_descripcion and '256' in result_obj.matched_capacidad_tamanio:
        print("\n  ✅ CORRECTO: Mapeó a iPhone 16 Pro 256GB")
    else:
        print(f"\n  ❌ ERROR: Mapeó al modelo INCORRECTO")
        print(f"     Esperado: iPhone 16 Pro 256GB")
        print(f"     Obtenido: {result_obj.matched_modelo_descripcion} {result_obj.matched_capacidad_tamanio}")

    # Verificación: ¿Usó NameMatcher?
    matcher = result_obj.context.metadata.get('matcher_used', 'N/A')
    if matcher == 'NameMatcher':
        print(f"  ✅ Usó NameMatcher (correcto)")
    else:
        print(f"  ⚠️  Usó {matcher} en lugar de NameMatcher")

else:
    print(f"✗ NO mapeó")
    print(f"  Error: {result_obj.error_message}")

print()

# 3. Ver todos los logs del mapeo
print("=" * 70)
print("3. Logs del proceso de mapeo")
print("=" * 70 + "\n")

for log in result_obj.context.logs[-20:]:  # Últimos 20 logs
    print(f"[{log.level}] {log.message}")

print("\n" + "=" * 70 + "\n")
