"""
Debug test para MacFeatureExtractor.
"""
import os
import django
import re

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
from productos.mapping.core.types import LikewizeInput, MappingContext

# Probar los patrones directamente
text1 = "Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 4TB SSD"
text2 = "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"

print("\n" + "=" * 70)
print("Test directo de patrones regex")
print("=" * 70 + "\n")

# Test patterns directamente
cpu_pattern = re.compile(r'(\d+)\s+Core\s+CPU', re.I)
gpu_pattern = re.compile(r'(\d+)\s+Core\s+GPU', re.I)

print(f"Text 1: {text1}")
cpu_match = cpu_pattern.search(text1)
gpu_match = gpu_pattern.search(text1)
print(f"  CPU match: {cpu_match.group(1) if cpu_match else 'None'}")
print(f"  GPU match: {gpu_match.group(1) if gpu_match else 'None'}")
print()

print(f"Text 2: {text2}")
cpu_match = cpu_pattern.search(text2)
gpu_match = gpu_pattern.search(text2)
print(f"  CPU match: {cpu_match.group(1) if cpu_match else 'None'}")
print(f"  GPU match: {gpu_match.group(1) if gpu_match else 'None'}")
print()

# Ahora probar el extractor completo
print("\n" + "=" * 70)
print("Test del extractor completo")
print("=" * 70 + "\n")

extractor = MacBookFeatureExtractor()

# Test 1
input1 = LikewizeInput(model_name=text1)
context1 = MappingContext(input_data=input1)
features1 = extractor.extract(input1, context1)

print(f"Text 1: {text1}")
print(f"Features extraídas:")
print(f"  device_type: {features1.device_type}")
print(f"  variant: {features1.variant}")
print(f"  cpu: {features1.cpu}")
print(f"  cpu_cores: {features1.cpu_cores}")
print(f"  gpu_cores: {features1.gpu_cores}")
print(f"  storage_gb: {features1.storage_gb}")
print()

# Test 2
input2 = LikewizeInput(model_name=text2)
context2 = MappingContext(input_data=input2)
features2 = extractor.extract(input2, context2)

print(f"Text 2: {text2}")
print(f"Features extraídas:")
print(f"  device_type: {features2.device_type}")
print(f"  variant: {features2.variant}")
print(f"  cpu: {features2.cpu}")
print(f"  cpu_cores: {features2.cpu_cores}")
print(f"  gpu_cores: {features2.gpu_cores}")
print(f"  storage_gb: {features2.storage_gb}")
print()

# Mostrar logs del context
if context1.logs:
    print("Logs del context 1 (primeros 10):")
    for log in context1.logs[:10]:
        print(f"  [{log.level}] {log.message}")

if context2.logs:
    print("\nLogs del context 2 (primeros 10):")
    for log in context2.logs[:10]:
        print(f"  [{log.level}] {log.message}")

print("\n" + "=" * 70 + "\n")
