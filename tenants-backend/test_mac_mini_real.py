"""
Script simple para probar el mapeo de Mac mini con datos reales.
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'progeek.settings')
django.setup()

from productos.mapping.services.device_mapper_service import DeviceMapperService
from productos.mapping.core.types import LikewizeInput

def test_mac_mini():
    """Prueba el mapeo de Mac mini M2 con 10-core CPU y 16-core GPU."""

    # Input problemático del usuario
    input_str = "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"

    print(f"\n{'='*70}")
    print(f"Testing Mac mini mapping")
    print(f"{'='*70}\n")
    print(f"Input: {input_str}\n")

    # Crear input
    input_data = LikewizeInput(model_name=input_str)

    # Crear servicio y mapear
    service = DeviceMapperService()
    result = service.map(input_data)

    # Mostrar resultado
    print(f"Status: {result.status.value}")
    print(f"Success: {result.success}")

    if result.success:
        print(f"\n✅ MATCH EXITOSO:")
        print(f"   - Capacidad ID: {result.matched_capacidad_id}")
        print(f"   - Modelo: {result.matched_modelo_descripcion}")
        print(f"   - Capacidad: {result.matched_capacidad_tamanio}")
        print(f"   - Confidence: {result.match_score:.2%}")
        print(f"   - Strategy: {result.match_strategy.value if result.match_strategy else 'N/A'}")

        # Verificar que NO es M2 Pro
        if "M2 Pro" in result.matched_modelo_descripcion:
            print(f"\n❌ ERROR: Mapeó incorrectamente a M2 Pro!")
            print(f"   Debería mapear a M2 base (10 CPU cores, 16 GPU cores)")
        else:
            print(f"\n✅ CORRECTO: No mapeó a M2 Pro")
    else:
        print(f"\n❌ NO MATCH:")
        print(f"   - Error: {result.error_message}")
        print(f"   - Error Code: {result.error_code}")

    # Mostrar features extraídas
    if result.features:
        print(f"\nFeatures extraídas:")
        print(f"   - device_type: {result.features.device_type}")
        print(f"   - variant: {result.features.variant}")
        print(f"   - cpu: {result.features.cpu}")
        print(f"   - cpu_cores: {result.features.cpu_cores}")
        print(f"   - gpu_cores: {result.features.gpu_cores}")
        print(f"   - storage_gb: {result.features.storage_gb}")
        print(f"   - year: {result.features.year}")

    # Mostrar logs
    if result.context and result.context.logs:
        print(f"\nLogs del contexto (últimos 10):")
        for log in result.context.logs[-10:]:
            level = log['level'].upper()
            msg = log['message']
            print(f"   [{level}] {msg}")

    print(f"\n{'='*70}\n")

    return result

if __name__ == "__main__":
    result = test_mac_mini()
