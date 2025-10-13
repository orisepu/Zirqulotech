"""
Debug: ¿Por qué iPad no está enriqueciendo sugerencias?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device

print("\n" + "=" * 80)
print("Debug: iPad Pro 10.5\" 1TB")
print("=" * 80 + "\n")

test_input = "iPad Pro 10 5-inch Wi-Fi 1TB"

result = map_device({'FullName': test_input}, system='v4')

print(f"Input: {test_input}\n")
print(f"Success: {result.get('success')}")
print(f"Needs capacity creation: {result.get('needs_capacity_creation')}")
print(f"Model found: {result.get('suggested_capacity', {}).get('model_found')}")

print("\n" + "=" * 80)
print("Features extraídas:")
print("=" * 80)
features = result.get('features', {})
for key, value in features.items():
    print(f"  {key}: {value}")

print("\n" + "=" * 80)
print("Metadata del context:")
print("=" * 80)

# Check if context is in result (should NOT be, it's internal)
if 'context' in result:
    print("⚠️ Context is in result (internal use - should not be here)")

# Get the raw result to see internal structure
from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
adapter = V3CompatibilityAdapter()
input_v4 = adapter._dict_to_likewize_input({'FullName': test_input})
result_obj = adapter._service.map(input_v4)

# Check context metadata
if result_obj.context:
    print(f"Context exists: Yes")
    print(f"Context metadata:")
    for key, value in result_obj.context.metadata.items():
        print(f"  {key}: {value}")
else:
    print("Context does NOT exist")

# Check suggested capacity in final result
if 'suggested_capacity' in result:
    sugg = result['suggested_capacity']
    print("\nSuggested capacity keys:")
    for key in sugg.keys():
        print(f"  - {key}: {sugg[key]}")

    # Check specifically for model_ids
    if 'model_ids' in sugg:
        print(f"\n✓ model_ids found: {sugg['model_ids']}")
    else:
        print(f"\n✗ model_ids NOT in suggested_capacity")
else:
    print("No suggested_capacity in result")

print("\n" + "=" * 80 + "\n")
