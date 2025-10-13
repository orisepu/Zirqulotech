"""
Script de prueba para verificar el mapeo de Samsung Galaxy con la tarea real.

IMPORTANTE: Solo procesa modelos compatibles con España (F, B).
"""

import os
import django

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "progeek.settings")
django.setup()

from productos.models import LikewizeItemStaging
from productos.mapping.adapters.v3_compatibility import map_device_v4

# ID de la tarea Samsung Galaxy
TAREA_ID = "f57e3c79-3207-43c7-9a27-4c85510bc7e6"

def test_samsung_mapping():
    """Prueba el mapeo de algunos items de Samsung Galaxy."""

    # Obtener algunos items de ejemplo
    items = LikewizeItemStaging.objects.filter(tarea_id=TAREA_ID).order_by('id')[:15]

    print("=" * 80)
    print(f"PRUEBA DE MAPEO SAMSUNG GALAXY")
    print(f"Tarea: {TAREA_ID}")
    print(f"Total items en tarea: {LikewizeItemStaging.objects.filter(tarea_id=TAREA_ID).count()}")
    print("=" * 80)
    print()

    success_count = 0
    fail_count = 0
    region_reject_count = 0

    for item in items:
        print(f"\n{'='*80}")
        print(f"TEST ITEM {item.id}")
        print(f"{'='*80}")
        print(f"Raw: {item.modelo_raw}")
        print(f"Norm: {item.modelo_norm}")
        print(f"Capacidad: {item.almacenamiento_gb}GB" if item.almacenamiento_gb else "Capacidad: N/A")
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
            error_msg = result.get('error_message', '')
            # Detectar si es rechazo por región
            if 'no compatible con España' in error_msg or 'región' in error_msg.lower():
                region_reject_count += 1
                print(f"⛔ RECHAZADO POR REGIÓN (esperado)")
                print(f"   Razón: Modelo no compatible con España")
            else:
                fail_count += 1
                print(f"❌ FALLO")
                print(f"   Error: {error_msg}")

        # Mostrar features extraídas
        if result.get('features'):
            features = result['features']
            print(f"\n   Features extraídas:")
            print(f"     - Device type: {features.get('device_type')}")
            print(f"     - Serie: {features.get('series')}")
            print(f"     - Variante: {features.get('variant')}")
            print(f"     - Año: {features.get('year')}")
            print(f"     - CPU: {features.get('cpu')}")
            print(f"     - Capacidad GB: {features.get('storage_gb')}")
            print(f"     - Model Code: {features.get('model_code')}")

    print(f"\n{'='*80}")
    print(f"RESUMEN")
    print(f"{'='*80}")
    print(f"✅ Exitosos: {success_count}/{len(items)}")
    print(f"⛔ Rechazados por región: {region_reject_count}/{len(items)} (esperado)")
    print(f"❌ Fallidos: {fail_count}/{len(items)}")
    print(f"📊 Tasa de éxito: {(success_count/len(items)*100):.1f}%")
    print(f"📊 Compatible con España: {(success_count/(success_count + region_reject_count)*100 if (success_count + region_reject_count) > 0 else 0):.1f}%")
    print()

if __name__ == "__main__":
    test_samsung_mapping()
