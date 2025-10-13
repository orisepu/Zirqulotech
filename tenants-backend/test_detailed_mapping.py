"""
Test detallado con logs de contexto
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.core.types import LikewizeInput, MappingContext
from productos.mapping.engines.macbook_engine import MacEngine

test_input = "Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 8TB SSD"

print("\n" + "=" * 70)
print(f"Test detallado: {test_input}")
print("=" * 70 + "\n")

# Crear input
likewize_input = LikewizeInput(model_name=test_input)

# Crear engine
engine = MacEngine()

# Mapear
result = engine.map(likewize_input)

print(f"Status: {result.status}")
print(f"Success: {result.success}")

if result.success:
    print(f"Capacidad ID: {result.matched_capacidad_id}")
    print(f"Modelo: {result.matched_modelo_descripcion}")
    print(f"Strategy: {result.match_strategy}")
    print(f"Score: {result.match_score}")
else:
    print(f"Error: {result.error_message}")

# Mostrar features
if result.features:
    print(f"\nFeatures extraídas:")
    print(f"  device_type: {result.features.device_type}")
    print(f"  variant: {result.features.variant}")
    print(f"  cpu: {result.features.cpu}")
    print(f"  cpu_cores: {result.features.cpu_cores}")
    print(f"  gpu_cores: {result.features.gpu_cores}")
    print(f"  a_number: {result.features.a_number}")
    print(f"  year: {result.features.year}")
    print(f"  storage_gb: {result.features.storage_gb}")

# Mostrar logs
if result.context:
    print(f"\nLogs del contexto:")
    print("-" * 70)
    print(result.context.get_logs_text())

print("\n" + "=" * 70 + "\n")
