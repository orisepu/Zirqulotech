#!/usr/bin/env python
"""
Test A2179 Intel MacBook Air Mapping - Verifica que NO mapee incorrectamente a A2337 M1.

Expected results:
- A2179 Core i3 1.1 → Debe mapear a Modelo 1413 (Core i3)
- A2179 NO debe mapear a A2337 (M1)
"""

import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.core.types import LikewizeInput, MatchStatus
from productos.mapping.services.device_mapper_service import DeviceMapperService


def test_a2179_intel_mapping():
    """Test que A2179 Intel NO mapee a A2337 M1."""

    service = DeviceMapperService()

    # Test: MacBook Air A2179 Core i3 1.1 (Intel)
    print("=" * 80)
    print("TEST: MacBook Air A2179 Core i3 1.1 (Intel)")
    print("=" * 80)

    input_a2179 = LikewizeInput(
        model_name="MacBookAir9 1 Core i3 1.1 13 inch A2179 3/2020 1TB SSD",
        m_model="",
        full_name="MacBookAir9 1 Core i3 1.1 13 inch A2179 3/2020 1TB SSD",
        capacity="1TB",
        device_price=None,
        brand_name="Apple"
    )

    result_a2179 = service.map(input_a2179)

    print(f"\nStatus: {result_a2179.status.value}")
    print(f"Capacidad ID: {result_a2179.matched_capacidad_id}")
    print(f"Modelo ID: {result_a2179.matched_modelo_id}")
    print(f"Descripción: {result_a2179.matched_modelo_descripcion}")
    print(f"Score: {result_a2179.match_score}")
    print(f"Estrategia: {result_a2179.match_strategy}")

    if result_a2179.features:
        print(f"\nFeatures extraídas:")
        print(f"  - CPU: {result_a2179.features.cpu}")
        print(f"  - A-Number: {result_a2179.features.a_number}")
        print(f"  - Screen: {result_a2179.features.screen_size}\"")
        print(f"  - Storage: {result_a2179.features.storage_gb}GB")
        print(f"  - Year: {result_a2179.features.year}")

    if result_a2179.context:
        print(f"\nLogs del proceso:")
        print(result_a2179.context.get_logs_text())

    # Verificación
    print("\n" + "=" * 80)
    print("VERIFICACIÓN DE RESULTADOS")
    print("=" * 80)

    success = True

    # Verificar que mapeó exitosamente
    if result_a2179.status != MatchStatus.SUCCESS:
        print(f"❌ FALLÓ: No se encontró mapeo para A2179 Intel")
        success = False
    else:
        print(f"✅ Mapeo exitoso para A2179")

    # Verificar que NO es A2337 (M1)
    if result_a2179.matched_modelo_descripcion and "A2337" in result_a2179.matched_modelo_descripcion:
        print(f"❌ ERROR CRÍTICO: A2179 (Intel) mapeó incorrectamente a A2337 (M1)!")
        success = False
    else:
        print(f"✅ A2179 NO mapeó a A2337 (correcto)")

    # Verificar que es Intel
    if result_a2179.matched_modelo_descripcion and "Core i" in result_a2179.matched_modelo_descripcion:
        print(f"✅ Mapeó correctamente a Intel: {result_a2179.matched_modelo_descripcion}")
    else:
        print(f"❌ FALLÓ: No mapeó a un modelo Intel")
        success = False

    # Verificar que es A2179
    if result_a2179.matched_modelo_descripcion and "A2179" in result_a2179.matched_modelo_descripcion:
        print(f"✅ Mapeó correctamente a A2179")
    else:
        print(f"⚠️  WARNING: No contiene A2179 en la descripción (puede ser aceptable)")

    print("=" * 80)
    if success:
        print("🎉 TEST PASSED: A2179 Intel mapea correctamente")
        return 0
    else:
        print("⚠️  TEST FAILED: Problemas con mapeo A2179")
        return 1


if __name__ == "__main__":
    sys.exit(test_a2179_intel_mapping())
