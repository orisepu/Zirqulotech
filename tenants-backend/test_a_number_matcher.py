"""
Test ANumberMatcher con Mac mini A2816
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device

# Casos de prueba: Mac mini A2816
test_cases = [
    "Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 8TB SSD",
    "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD",
]

print("\n" + "=" * 70)
print("Test ANumberMatcher con Mac mini A2816")
print("=" * 70 + "\n")

for test_input in test_cases:
    print(f"\nInput: {test_input}")
    print("-" * 70)
    
    result = map_device({'ModelName': test_input}, system='v4')
    
    if result['success']:
        print(f"✓ Match exitoso:")
        print(f"  Capacidad ID: {result['capacidad_id']}")
        print(f"  Modelo: {result.get('modelo_descripcion')}")
        print(f"  Strategy: {result.get('strategy')}")
        print(f"  Confidence: {result.get('confidence') * 100:.2f}%")
        
        # Verificar metadata de features
        if result.get('features'):
            features = result['features']
            print(f"\n  Features extraídas:")
            print(f"    cpu: {features.get('cpu')}")
            print(f"    cpu_cores: {features.get('cpu_cores')}")
            print(f"    gpu_cores: {features.get('gpu_cores')}")
            print(f"    a_number: {features.get('a_number')}")
    else:
        print(f"✗ No match")
        if result.get('needs_capacity_creation'):
            print(f"  ⚠️ Sugiere crear capacidad")
            if result.get('suggested_capacity'):
                sugg = result['suggested_capacity']
                print(f"    cpu: {sugg.get('cpu')}")
                print(f"    cpu_cores: {sugg.get('cpu_cores')}")
                print(f"    gpu_cores: {sugg.get('gpu_cores')}")

print("\n" + "=" * 70 + "\n")
