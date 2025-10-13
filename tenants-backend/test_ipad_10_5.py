"""
Test: iPad Pro 10.5 pulgadas - Formato "10 5-inch"
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

print("\n" + "=" * 80)
print("Test: iPad Pro 10.5 pulgadas")
print("=" * 80 + "\n")

test_cases = [
    'iPad Pro 10 5-inch Wi-Fi 512GB',
    'iPad Pro 10 5-inch Cellular 256GB',
    'iPad Pro 10 5-inch Cellular 512GB',
    'iPad Pro 10.5-inch Wi-Fi 512GB',  # Formato correcto
    'iPad Pro (10,5 pulgadas) Wi-Fi',   # Formato de BD
]

adapter = V3CompatibilityAdapter()

for test_input in test_cases:
    print(f"Input: {test_input}")
    print("-" * 80)

    input_data = {'FullName': test_input, 'MModel': ''}
    input_v4 = adapter._dict_to_likewize_input(input_data)
    result_obj = adapter._service.map(input_v4)

    if result_obj.features:
        print(f"\nFeatures extraídas:")
        print(f"  device_type: {result_obj.features.device_type}")
        print(f"  variant: {result_obj.features.variant}")
        print(f"  screen_size: {result_obj.features.screen_size}")
        print(f"  has_wifi: {result_obj.features.has_wifi}")
        print(f"  has_cellular: {result_obj.features.has_cellular}")
        print(f"  storage_gb: {result_obj.features.storage_gb}")

    print()

    if result_obj.success:
        print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
        print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
    else:
        print(f"✗ NO mapeó")
        if result_obj.error_message:
            print(f"  Error: {result_obj.error_message}")

        # Mostrar logs útiles
        if result_obj.context:
            print(f"\n  Logs relevantes:")
            for log in result_obj.context.logs:
                if 'screen' in log.message.lower() or 'candidato' in log.message.lower():
                    print(f"    [{log.level}] {log.message}")

    print("\n" + "=" * 80 + "\n")
