#!/usr/bin/env python
"""
Test CPU Cores Mapping - Verifica que M1 Pro con diferentes CPU cores mapeen correctamente.

Expected results:
- M1 Pro 8 Core CPU 14 Core GPU → capacidad_id=6625 (Modelo 1374)
- M1 Pro 10 Core CPU 14 Core GPU → capacidad_id=6622 (Modelo 1373)
"""

import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.core.types import LikewizeInput, MatchStatus
from productos.mapping.engines.macbook_engine import MacBookEngine


def test_cpu_cores_mapping():
    """Test que ambos M1 Pro con diferentes CPU cores mapeen correctamente."""

    engine = MacBookEngine()

    # Test 1: M1 Pro 8 Core CPU (debe mapear a 6625)
    print("=" * 80)
    print("TEST 1: M1 Pro 8 Core CPU 14 Core GPU")
    print("=" * 80)

    input_8_core = LikewizeInput(
        model_name="MacBookPro15 3 M1 Pro 8 Core CPU 14 Core GPU 14 inch A2442 10/2021 8TB SSD",
        m_model="",
        full_name="MacBookPro15 3 M1 Pro 8 Core CPU 14 Core GPU 14 inch A2442 10/2021 8TB SSD",
        capacity="8TB",
        device_price=None,
        brand_name="Apple"
    )

    result_8_core = engine.map(input_8_core)

    print(f"Status: {result_8_core.status.value}")
    print(f"Capacidad ID: {result_8_core.matched_capacidad_id}")
    print(f"Modelo ID: {result_8_core.matched_modelo_id}")
    print(f"Descripción: {result_8_core.matched_modelo_descripcion}")
    print(f"Score: {result_8_core.match_score}")
    print(f"Estrategia: {result_8_core.match_strategy}")

    if result_8_core.features:
        print(f"\nFeatures extraídas:")
        print(f"  - CPU: {result_8_core.features.cpu}")
        print(f"  - CPU Cores: {result_8_core.features.cpu_cores}")
        print(f"  - GPU Cores: {result_8_core.features.gpu_cores}")
        print(f"  - Screen: {result_8_core.features.screen_size}\"")
        print(f"  - Storage: {result_8_core.features.storage_gb}GB")

    if result_8_core.context:
        print(f"\nLogs del proceso:")
        print(result_8_core.context.get_logs_text())

    # Test 2: M1 Pro 10 Core CPU (debe mapear a 6622)
    print("\n" + "=" * 80)
    print("TEST 2: M1 Pro 10 Core CPU 14 Core GPU")
    print("=" * 80)

    input_10_core = LikewizeInput(
        model_name="MacBookPro15 3 M1 Pro 10 Core CPU 14 Core GPU 14 inch A2442 10/2021 8TB SSD",
        m_model="",
        full_name="MacBookPro15 3 M1 Pro 10 Core CPU 14 Core GPU 14 inch A2442 10/2021 8TB SSD",
        capacity="8TB",
        device_price=None,
        brand_name="Apple"
    )

    result_10_core = engine.map(input_10_core)

    print(f"Status: {result_10_core.status.value}")
    print(f"Capacidad ID: {result_10_core.matched_capacidad_id}")
    print(f"Modelo ID: {result_10_core.matched_modelo_id}")
    print(f"Descripción: {result_10_core.matched_modelo_descripcion}")
    print(f"Score: {result_10_core.match_score}")
    print(f"Estrategia: {result_10_core.match_strategy}")

    if result_10_core.features:
        print(f"\nFeatures extraídas:")
        print(f"  - CPU: {result_10_core.features.cpu}")
        print(f"  - CPU Cores: {result_10_core.features.cpu_cores}")
        print(f"  - GPU Cores: {result_10_core.features.gpu_cores}")
        print(f"  - Screen: {result_10_core.features.screen_size}\"")
        print(f"  - Storage: {result_10_core.features.storage_gb}GB")

    if result_10_core.context:
        print(f"\nLogs del proceso:")
        print(result_10_core.context.get_logs_text())

    # Verificación de resultados
    print("\n" + "=" * 80)
    print("VERIFICACIÓN DE RESULTADOS")
    print("=" * 80)

    success = True

    # Test 1: 8 Core debe mapear a 6625
    if result_8_core.status == MatchStatus.SUCCESS and result_8_core.matched_capacidad_id == 6625:
        print("✅ TEST 1 PASSED: M1 Pro 8 Core CPU → capacidad_id=6625 (Modelo 1374)")
    else:
        print(f"❌ TEST 1 FAILED: M1 Pro 8 Core CPU → capacidad_id={result_8_core.matched_capacidad_id} (esperado: 6625)")
        success = False

    # Test 2: 10 Core debe mapear a 6622
    if result_10_core.status == MatchStatus.SUCCESS and result_10_core.matched_capacidad_id == 6622:
        print("✅ TEST 2 PASSED: M1 Pro 10 Core CPU → capacidad_id=6622 (Modelo 1373)")
    else:
        print(f"❌ TEST 2 FAILED: M1 Pro 10 Core CPU → capacidad_id={result_10_core.matched_capacidad_id} (esperado: 6622)")
        success = False

    # Verificar que sean diferentes
    if result_8_core.matched_capacidad_id != result_10_core.matched_capacidad_id:
        print("✅ DISTINCTION PASSED: 8 Core y 10 Core mapean a diferentes capacidades")
    else:
        print("❌ DISTINCTION FAILED: 8 Core y 10 Core mapean a la MISMA capacidad")
        success = False

    print("=" * 80)
    if success:
        print("🎉 TODOS LOS TESTS PASARON")
        return 0
    else:
        print("⚠️  ALGUNOS TESTS FALLARON")
        return 1


if __name__ == "__main__":
    sys.exit(test_cpu_cores_mapping())
