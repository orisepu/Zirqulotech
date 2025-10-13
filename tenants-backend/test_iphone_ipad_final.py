"""
Test final: Verificar mejoras en mapeo de iPhone/iPad
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

print("\n" + "=" * 80)
print("Test Final: iPhone y iPad Mapping con todas las mejoras")
print("=" * 80 + "\n")

test_cases = {
    "iPhone": [
        "iPhone 16 Pro 256GB",
        "iPhone 16 Pro Max 512GB",
        "iPhone 15 Plus 256GB",
        "iPhone 14 Pro 128GB",
        "iPhone 13 mini 128GB",
        "iPhone 12 mini 64GB",
        "iPhone 11 Pro Max 256GB",
        "iPhone SE (2022) 128GB",
    ],
    "iPad": [
        "iPad Pro 13-inch (M4) Wi-Fi 256GB",
        "iPad Pro 13-inch (M4) Cellular 512GB",
        "iPad Pro 12.9'' 5 Wi-Fi 256GB",
        "iPad Pro 11-inch (M4) Wi-Fi 512GB",
        "iPad Pro de 12,9 pulgadas (2.ª generación) Wi-Fi 256GB",
        "iPad Air 11-inch (M2) Wi-Fi 256GB",
        "iPad Air 13-inch (M2) Cellular 512GB",
        "iPad mini 7 Wi-Fi 128GB",
        "iPad 10 Wi-Fi 64GB",
    ]
}

adapter = V3CompatibilityAdapter()
results = {}

for device_type, cases in test_cases.items():
    print(f"{'=' * 80}")
    print(f"{device_type} Tests")
    print(f"{'=' * 80}\n")

    mapped = 0
    total = len(cases)

    for test_input in cases:
        input_data = {'FullName': test_input, 'MModel': ''}
        input_v4 = adapter._dict_to_likewize_input(input_data)
        result_obj = adapter._service.map(input_v4)

        if result_obj.success:
            mapped += 1
            print(f"✓ {test_input}")
            print(f"  → {result_obj.matched_modelo_descripcion}")
            print(f"  → Confidence: {result_obj.match_score * 100:.1f}%")
            print(f"  → Algorithm: {result_obj.match_strategy}")
        else:
            print(f"✗ {test_input}")
            print(f"  → NO MAPEÓ")

        # Mostrar features extraídas
        if result_obj.features:
            features = []
            if result_obj.features.generation:
                features.append(f"gen={result_obj.features.generation}")
            if result_obj.features.variant:
                features.append(f"variant={result_obj.features.variant}")
            if result_obj.features.screen_size:
                features.append(f"screen={result_obj.features.screen_size}\"")
            if result_obj.features.storage_gb:
                features.append(f"storage={result_obj.features.storage_gb}GB")
            if features:
                print(f"  → Features: {', '.join(features)}")

        print()

    success_rate = (mapped / total) * 100
    results[device_type] = (mapped, total, success_rate)

    print(f"{'=' * 80}")
    print(f"{device_type} Summary: {mapped}/{total} ({success_rate:.1f}%)")
    print(f"{'=' * 80}\n\n")

# Resumen final
print("=" * 80)
print("RESUMEN FINAL")
print("=" * 80)
for device_type, (mapped, total, rate) in results.items():
    print(f"{device_type:15} {mapped:3}/{total:3} ({rate:5.1f}%)")

total_mapped = sum(r[0] for r in results.values())
total_cases = sum(r[1] for r in results.values())
overall_rate = (total_mapped / total_cases) * 100
print(f"{'─' * 80}")
print(f"{'TOTAL':15} {total_mapped:3}/{total_cases:3} ({overall_rate:5.1f}%)")
print("=" * 80 + "\n")
