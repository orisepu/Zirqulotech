"""
Prueba específica para Mac mini A2816 M2 Pro.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device
import json

# El caso problemático del usuario - M2 Pro 12-core/19-core GPU
input_str = "Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 4TB SSD"

print("\n" + "=" * 70)
print("Testing Mac mini A2816 M2 Pro 12-core/19-core GPU")
print("=" * 70 + "\n")
print(f"Input: {input_str}\n")

# Usar modo 'auto' (el que usa actualizar_likewize_v3.py)
result = map_device({'FullName': input_str}, system='auto')

print("Resultado v4:")
print(f"  success: {result.get('success')}")
print(f"  mapping_version: {result.get('mapping_version')}")
print(f"  strategy: {result.get('strategy')}")

if result.get('success'):
    print(f"\n✓ Match exitoso:")
    print(f"  Capacidad ID: {result.get('capacidad_id')}")
    print(f"  Modelo: {result.get('modelo_descripcion')}")
    print(f"  Capacidad: {result.get('capacidad_tamanio')}")
    print(f"  Confidence: {result.get('confidence', 0):.2%}")
else:
    print(f"\n✗ No match")
    print(f"  Error: {result.get('error_message')}")

# Verificar si sugiere crear capacidad
if result.get('needs_capacity_creation'):
    print(f"\n⚠️  V4 SUGIERE CREAR CAPACIDAD:")
    print(f"  v3_skipped: {result.get('v3_skipped')}")
    print(f"  v3_skip_reason: {result.get('v3_skip_reason')}")
    print(f"\n  Suggested capacity:")
    suggestion = result.get('suggested_capacity', {})
    for key, value in suggestion.items():
        print(f"    {key}: {value}")

# Mostrar features extraídas
if result.get('features'):
    print(f"\nFeatures extraídas por v4:")
    features = result['features']
    print(f"  device_type: {features.get('device_type')}")
    print(f"  variant: {features.get('variant')}")
    print(f"  cpu: {features.get('cpu')}")
    print(f"  cpu_cores: {features.get('cpu_cores')}")
    print(f"  gpu_cores: {features.get('gpu_cores')}")
    print(f"  storage_gb: {features.get('storage_gb')}")
    print(f"  year: {features.get('year')}")
    print(f"  a_number: {features.get('a_number')}")

# Mostrar candidatos encontrados
if result.get('all_candidates'):
    print(f"\nCandidatos encontrados por v4:")
    for i, candidate in enumerate(result['all_candidates'][:5], 1):
        print(f"  {i}. {candidate.get('modelo_descripcion')} - {candidate.get('capacidad_tamanio')}")
        print(f"     ID: {candidate.get('capacidad_id')}, Score: {candidate.get('score', 0):.2f}")

print("\n" + "=" * 70 + "\n")

# También probar el otro caso - M2 base 10-core/16-core GPU
print("\n" + "=" * 70)
print("Testing Mac mini A2816 M2 base 10-core/16-core GPU")
print("=" * 70 + "\n")

input_str2 = "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
print(f"Input: {input_str2}\n")

result2 = map_device({'FullName': input_str2}, system='auto')

print("Resultado v4:")
print(f"  success: {result2.get('success')}")

if result2.get('success'):
    print(f"\n✓ Match exitoso:")
    print(f"  Capacidad ID: {result2.get('capacidad_id')}")
    print(f"  Modelo: {result2.get('modelo_descripcion')}")
    print(f"  Capacidad: {result2.get('capacidad_tamanio')}")
    print(f"  Confidence: {result2.get('confidence', 0):.2%}")
else:
    print(f"\n✗ No match")
    if result2.get('needs_capacity_creation'):
        print(f"  ⚠️  Sugiere crear capacidad")

if result2.get('features'):
    print(f"\nFeatures extraídas:")
    features = result2['features']
    print(f"  cpu: {features.get('cpu')}")
    print(f"  cpu_cores: {features.get('cpu_cores')}")
    print(f"  gpu_cores: {features.get('gpu_cores')}")
    print(f"  storage_gb: {features.get('storage_gb')}")

print("\n" + "=" * 70 + "\n")
