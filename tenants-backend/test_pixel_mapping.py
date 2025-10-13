"""
Script de prueba para verificar el mapeo de Google Pixel con la tarea real.
"""

import os
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "progeek.settings")
django.setup()

from productos.models import LikewizeItemStaging
from productos.mapping.adapters.v3_compatibility import map_device_v4

# ID de la tarea Google Pixel
TAREA_ID = "26d94e23-8a2a-41a7-86f5-e9a58fa6ce51"

def test_pixel_mapping():
    """Prueba el mapeo de algunos items de Pixel."""

    # Obtener algunos items de ejemplo
    items = LikewizeItemStaging.objects.filter(tarea_id=TAREA_ID).order_by('id')[:10]

    print("=" * 80)
    print(f"PRUEBA DE MAPEO GOOGLE PIXEL")
    print(f"Tarea: {TAREA_ID}")
    print(f"Total items en tarea: {LikewizeItemStaging.objects.filter(tarea_id=TAREA_ID).count()}")
    print("=" * 80)
    print()

    success_count = 0
    fail_count = 0

    for item in items:
        print(f"\n{'='*80}")
        print(f"TEST ITEM {item.id}")
        print(f"{'='*80}")
        print(f"Raw: {item.modelo_raw}")
        print(f"Norm: {item.modelo_norm}")
        print(f"Capacidad: {item.almacenamiento_gb}GB")
        print()

        # Construir dict para v4
        item_dict = {
            'FullName': item.modelo_norm or item.modelo_raw,
            'Capacity': f'{item.almacenamiento_gb}GB' if item.almacenamiento_gb else '',
            'DevicePrice': str(item.precio_b2b) if item.precio_b2b else '0',
            'MModel': item.likewize_model_code or '',
        }

        # Mapear con v4
        result = map_device_v4(item_dict)

        # Mostrar resultado
        if result.get('success'):
            success_count += 1
            print(f"✅ ÉXITO")
            print(f"   Modelo: {result.get('modelo_descripcion')}")
            print(f"   Capacidad ID: {result.get('capacidad_id')}")
            print(f"   Algoritmo: {result.get('mapping_algorithm')}")
            print(f"   Score: {result.get('match_score', 0):.2f}")
        else:
            fail_count += 1
            print(f"❌ FALLO")
            print(f"   Error: {result.get('error_message')}")

        # Mostrar features extraídas
        if result.get('features'):
            features = result['features']
            print(f"\n   Features extraídas:")
            print(f"     - Device type: {features.get('device_type')}")
            print(f"     - Generación: {features.get('generation')}")
            print(f"     - Variante: {features.get('variant')}")
            print(f"     - Año: {features.get('year')}")
            print(f"     - CPU: {features.get('cpu')}")
            print(f"     - Capacidad GB: {features.get('storage_gb')}")

    print(f"\n{'='*80}")
    print(f"RESUMEN")
    print(f"{'='*80}")
    print(f"✅ Exitosos: {success_count}/{len(items)}")
    print(f"❌ Fallidos: {fail_count}/{len(items)}")
    print(f"📊 Tasa de éxito: {(success_count/len(items)*100):.1f}%")
    print()

if __name__ == "__main__":
    test_pixel_mapping()
