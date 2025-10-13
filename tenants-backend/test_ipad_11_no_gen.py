"""
Debug: iPad Pro 11-inch sin generación - ¿Por qué elige M4?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
from django.db.models import Q
from productos.models.modelos import Modelo

print("\n" + "=" * 80)
print("Debug: iPad Pro 11-inch sin generación")
print("=" * 80 + "\n")

# 1. Ver todos los modelos de iPad Pro 11-inch en BD
print("1. Todos los iPad Pro 11-inch en BD:")
print("-" * 80)

ipads_11 = Modelo.objects.filter(
    Q(descripcion__icontains='iPad Pro') &
    (Q(descripcion__icontains='11') | Q(descripcion__icontains='11,0'))
).order_by('descripcion')

for m in ipads_11:
    print(f"  {m.descripcion} (año: {m.año})")

print(f"\nTotal: {ipads_11.count()} modelos\n")

# 2. Probar mapeo sin generación
print("=" * 80)
print("2. Mapeo de iPad Pro 11-inch sin generación")
print("=" * 80 + "\n")

test_input = 'iPad Pro 11-inch Wi-Fi 1TB'

adapter = V3CompatibilityAdapter()
input_data = {'FullName': test_input, 'MModel': ''}
input_v4 = adapter._dict_to_likewize_input(input_data)
result_obj = adapter._service.map(input_v4)

print(f"Input: {test_input}")
print("-" * 80)

if result_obj.features:
    print(f"Features extraídas:")
    print(f"  device_type: {result_obj.features.device_type}")
    print(f"  variant: {result_obj.features.variant}")
    print(f"  generation: {result_obj.features.generation}")
    print(f"  screen_size: {result_obj.features.screen_size}")
    print(f"  storage_gb: {result_obj.features.storage_gb}")
    print(f"  year: {result_obj.features.year}")
    print(f"  cpu: {result_obj.features.cpu}")

print()

if result_obj.success:
    print(f"✓ Mapeó a: {result_obj.matched_modelo_descripcion}")
    print(f"  Capacidad ID: {result_obj.matched_capacidad_id}")
    print(f"  Confianza: {result_obj.match_score * 100:.1f}%")
    print(f"  Algoritmo: {result_obj.match_strategy}")
else:
    print(f"✗ NO mapeó")

# Ver candidatos considerados
print("\n3. Candidatos considerados (últimos logs):")
print("-" * 80)
for log in result_obj.context.logs[-20:]:
    if 'candidato' in log.message.lower() or 'queryset' in log.message.lower():
        print(f"  [{log.level}] {log.message}")

print("\n" + "=" * 80 + "\n")
