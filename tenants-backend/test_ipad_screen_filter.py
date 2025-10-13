"""
Debug: ¿Por qué el ScreenSizeFilter no funciona?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
from productos.models.modelos import Modelo

print("\n" + "=" * 70)
print("Debug: ScreenSizeFilter")
print("=" * 70 + "\n")

# 1. Ver qué tamaños hay en la BD para iPad Pro
print("1. Tamaños de iPad Pro en BD:")
print("-" * 70)

ipads_pro = Modelo.objects.filter(descripcion__icontains='iPad Pro').order_by('descripcion')[:15]
for m in ipads_pro:
    print(f"  {m.descripcion}")

print()

# 2. Probar mapeo detallado
print("=" * 70)
print("2. Mapeo detallado con logs completos")
print("=" * 70 + "\n")

test_cases = [
    'iPad Pro 13-inch (M4) Wi-Fi 256GB',
    'iPad Pro 12.9\'\' 5 Wi-Fi 256GB',
]

adapter = V3CompatibilityAdapter()

for test in test_cases:
    print(f"Input: {test}")
    print("-" * 70)

    input_data = {'FullName': test, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"Features extraídas:")
        print(f"  screen_size: {result_obj.features.screen_size}")
        print(f"  storage_gb: {result_obj.features.storage_gb}")

    if result_obj.success:
        print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
    else:
        print(f"✗ NO mapeó")

    # Ver TODOS los logs de ScreenSizeFilter
    print("\nTODOS los logs de ScreenSizeFilter:")
    in_screen_filter = False
    for log in result_obj.context.logs:
        if 'Filtrando por tamaño de pantalla' in log.message:
            in_screen_filter = True
        if in_screen_filter:
            print(f"  [{log.level}] {log.message}")
        if 'ScreenSizeFilter:' in log.message and '→' in log.message:
            in_screen_filter = False

    print("\n")

print("=" * 70 + "\n")
