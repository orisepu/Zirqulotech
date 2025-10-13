"""
Script para probar la sugerencia de crear capacidad para Mac mini A2816.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device
import json

# El caso problemático del usuario
input_str = "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"

print("\n" + "=" * 70)
print("Testing Mac mini A2816 con sistema 'auto'")
print("=" * 70 + "\n")
print(f"Input: {input_str}\n")

# Usar modo 'auto' (el que usa actualizar_likewize_v3.py)
result = map_device({'FullName': input_str}, system='auto')

print("Resultado:")
print(f"  success: {result.get('success')}")
print(f"  mapping_version: {result.get('mapping_version')}")
print(f"  strategy: {result.get('strategy')}")

if result.get('success'):
    print(f"\n✓ Match exitoso:")
    print(f"  Capacidad ID: {result.get('capacidad_id')}")
    print(f"  Modelo: {result.get('modelo_descripcion')}")
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

# Mostrar candidatos encontrados
if result.get('all_candidates'):
    print(f"\nCandidatos encontrados por v4:")
    for i, candidate in enumerate(result['all_candidates'][:3], 1):
        print(f"  {i}. {candidate.get('modelo_descripcion')} - {candidate.get('capacidad_tamanio')}")
        print(f"     ID: {candidate.get('capacidad_id')}, Score: {candidate.get('score', 0):.2f}")

print("\n" + "=" * 70 + "\n")
