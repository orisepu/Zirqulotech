"""
Debug: ¿Qué candidatos quedan después del filtrado?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

print("\n" + "=" * 80)
print("Debug: Candidatos después del filtrado")
print("=" * 80 + "\n")

test_input = 'iPad Pro 11-inch Wi-Fi 1TB'

adapter = V3CompatibilityAdapter()
input_data = {'FullName': test_input, 'MModel': ''}
input_v4 = adapter._dict_to_likewize_input(input_data)
result_obj = adapter._service.map(input_v4)

print(f"Input: {test_input}")
print("-" * 80)

if result_obj.features:
    print(f"\nFeatures extraídas:")
    print(f"  year: {result_obj.features.year}")
    print(f"  cpu: {result_obj.features.cpu}")
    print(f"  screen_size: {result_obj.features.screen_size}")
    print(f"  storage_gb: {result_obj.features.storage_gb}")

print("\n" + "-" * 80)
print("Logs del filtrado:")
print("-" * 80)
for log in result_obj.context.logs:
    if 'candidato' in log.message.lower() or 'quedan' in log.message.lower():
        print(f"  [{log.level}] {log.message}")

print("\n" + "-" * 80)
print("Scores de los candidatos:")
print("-" * 80)
for log in result_obj.context.logs:
    if 'score:' in log.message.lower():
        print(f"  {log.message}")

print("\n" + "=" * 80 + "\n")
