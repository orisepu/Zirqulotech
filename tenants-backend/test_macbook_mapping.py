"""
Test: MacBook M4 Max mapping with CPU/GPU cores
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

print("\n" + "=" * 80)
print("Test: MacBook M4 Max CPU/GPU Core Mapping")
print("=" * 80 + "\n")

test_cases = [
    ('MacBookPro16 6 M4 Max 16 Core CPU 40 Core GPU 14 inch A3185 10/2024 2TB SSD',
     'Input original del usuario'),
    ('MacBook Pro 16" M4 Max 16-Core CPU 40-Core GPU A3186',
     'Configuración 16/40 que existe en BD (16", A3186)'),
    ('MacBook Pro 14" M4 Max 14-Core CPU 32-Core GPU A3185',
     'Configuración 14/32 que existe en BD (14", A3185)'),
]

adapter = V3CompatibilityAdapter()

for test_input, description in test_cases:
    print(f"Test: {description}")
    print(f"Input: {test_input}")
    print("-" * 80)

    input_data = {'FullName': test_input, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"\nFeatures extraídas:")
        print(f"  device_type: {result_obj.features.device_type}")
        print(f"  variant: {result_obj.features.variant}")
        print(f"  cpu: {result_obj.features.cpu}")
        print(f"  screen_size: {result_obj.features.screen_size}")
        print(f"  storage_gb: {result_obj.features.storage_gb}")
        # Ver si hay campos de CPU/GPU cores
        if hasattr(result_obj.features, 'cpu_cores'):
            print(f"  cpu_cores: {result_obj.features.cpu_cores}")
        if hasattr(result_obj.features, 'gpu_cores'):
            print(f"  gpu_cores: {result_obj.features.gpu_cores}")

    print()

    if result_obj.success:
        print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
    else:
        print(f"✗ NO mapeó")
        if result_obj.error_message:
            print(f"  Error: {result_obj.error_message}")

    print("\n" + "=" * 80 + "\n")
