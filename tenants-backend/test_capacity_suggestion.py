"""
Test sugerencia de crear capacidad cuando modelo existe pero falta capacidad
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device

# Casos de prueba
test_cases = [
    {
        "name": "Mac mini M2 Pro 8TB (debería mapear)",
        "input": "Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 8TB SSD"
    },
    {
        "name": "Mac mini M2 base 8TB (modelo existe pero NO tiene 8TB)",
        "input": "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 8TB SSD"
    },
    {
        "name": "Mac mini M2 base 512GB (modelo existe Y tiene 512GB)",
        "input": "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
    },
]

print("\n" + "=" * 70)
print("Test Sugerencia de Crear Capacidad")
print("=" * 70)

for test_case in test_cases:
    print(f"\n{test_case['name']}")
    print(f"Input: {test_case['input']}")
    print("-" * 70)
    
    # Usar 'FullName' que es el campo estándar
    result = map_device({'FullName': test_case['input']}, system='v4')
    
    if result['success']:
        print(f"✓ Match exitoso:")
        print(f"  Capacidad ID: {result['capacidad_id']}")
        print(f"  Modelo: {result.get('modelo_descripcion')}")
        print(f"  Strategy: {result.get('strategy')}")
        print(f"  Confidence: {result.get('confidence') * 100:.2f}%")
    else:
        print(f"✗ No match")
        if result.get('needs_capacity_creation'):
            print(f"  ⚠️ NEEDS CAPACITY CREATION: True")
            if result.get('suggested_capacity'):
                sugg = result['suggested_capacity']
                print(f"  Suggested capacity:")
                print(f"    device_type: {sugg.get('device_type')}")
                print(f"    cpu: {sugg.get('cpu')}")
                print(f"    cpu_cores: {sugg.get('cpu_cores')}")
                print(f"    gpu_cores: {sugg.get('gpu_cores')}")
                print(f"    storage_gb: {sugg.get('storage_gb')}")
                print(f"    model_found: {sugg.get('model_found', False)}")
                if sugg.get('model_ids'):
                    print(f"    model_ids: {sugg.get('model_ids')}")
        else:
            print(f"  Error: {result.get('error_message')}")

print("\n" + "=" * 70 + "\n")
