"""
Test de sugerencias enriquecidas de capacidades.

Verifica que cuando un modelo existe pero falta una capacidad específica,
el sistema devuelve información completa sobre:
- Capacidades existentes
- Capacidades comunes para el tipo de dispositivo
- Capacidades faltantes
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device

print("\n" + "=" * 80)
print("Test: Sugerencias Enriquecidas de Capacidades")
print("=" * 80 + "\n")

test_cases = [
    {
        "name": "iPad Pro 10.5\" 1TB (capacidad FALTANTE - solo tiene 64/256/512GB)",
        "input": "iPad Pro 10 5-inch Wi-Fi 1TB",
        "expected": {
            "needs_capacity_creation": True,
            "has_enrichment": True,
            "device_type": "iPad Pro"
        }
    },
    {
        "name": "iPad Pro 10.5\" 256GB (capacidad EXISTENTE)",
        "input": "iPad Pro 10 5-inch Wi-Fi 256GB",
        "expected": {
            "needs_capacity_creation": False,
            "success": True
        }
    },
    {
        "name": "MacBook Pro 14\" M4 Max 4TB (capacidad FALTANTE - no tiene 4TB)",
        "input": "MacBook Pro 14\" M4 Max 14-Core CPU 32-Core GPU 4TB A3185",
        "expected": {
            "needs_capacity_creation": True,
            "has_enrichment": True,
            "device_type": "MacBook Pro"
        }
    },
    {
        "name": "iPad Pro 10.5\" Cellular 128GB (capacidad FALTANTE - solo tiene 64/256/512GB)",
        "input": "iPad Pro 10 5-inch Cellular 128GB",
        "expected": {
            "needs_capacity_creation": True,
            "has_enrichment": True,
            "device_type": "iPad Pro"
        }
    },
]

for test_case in test_cases:
    print(f"\n{'='*80}")
    print(f"{test_case['name']}")
    print(f"Input: {test_case['input']}")
    print('-'*80)

    result = map_device({'FullName': test_case['input']}, system='v4')

    if result.get('needs_capacity_creation'):
        sugg = result.get('suggested_capacity', {})

        print(f"✓ Sistema sugiere crear capacidad:")
        print(f"  Capacidad solicitada: {sugg.get('storage_gb')} GB")
        print(f"  Modelo encontrado: {sugg.get('model_found', False)}")

        if sugg.get('modelo_descripcion'):
            print(f"  Modelo: {sugg.get('modelo_descripcion')}")

        # Verificar enriquecimiento
        if 'existing_capacities' in sugg:
            print(f"\n  📦 Capacidades EXISTENTES: {sugg.get('existing_capacities', [])}")
            print(f"  📋 Capacidades COMUNES: {sugg.get('common_capacities', [])}")
            print(f"  ❌ Capacidades FALTANTES: {sugg.get('missing_capacities', [])}")

            # Validación
            storage_requested = sugg.get('storage_gb')
            missing = sugg.get('missing_capacities', [])

            if storage_requested in missing:
                print(f"\n  ✓ CORRECTO: La capacidad solicitada ({storage_requested}GB) está en faltantes")
            else:
                print(f"\n  ⚠️ ADVERTENCIA: La capacidad solicitada ({storage_requested}GB) NO está en faltantes")
        else:
            print(f"\n  ⚠️ NO hay información enriquecida de capacidades")
            if test_case['expected'].get('has_enrichment'):
                print(f"  ❌ ERROR: Se esperaba enriquecimiento pero no se encontró")

    elif result.get('success'):
        print(f"✓ Dispositivo mapeó correctamente:")
        print(f"  Modelo: {result.get('modelo_descripcion')}")
        print(f"  Capacidad: {result.get('capacidad_tamanio')}")
        print(f"  Confianza: {result.get('confidence', 0) * 100:.1f}%")

    else:
        print(f"✗ NO mapeó")
        if result.get('error_message'):
            print(f"  Error: {result.get('error_message')}")

print("\n" + "=" * 80)
print("Test completado")
print("=" * 80 + "\n")
