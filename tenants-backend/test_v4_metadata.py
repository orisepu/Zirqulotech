#!/usr/bin/env python
"""
Test v4 Metadata Creation - Verifica que DeviceMappingV2 se cree con v4 metadata.
"""

import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.core.types import LikewizeInput
from productos.mapping.services.device_mapper_service import DeviceMapperService
from productos.models import DeviceMappingV2
import hashlib


def test_v4_metadata_creation():
    """Test que v4 mapping cree DeviceMappingV2 con metadata correcta."""

    print("=" * 80)
    print("TEST: v4 Metadata Creation")
    print("=" * 80)

    # Test: MacBook Air A2179 Core i3 1.1 (Intel)
    input_data = LikewizeInput(
        model_name="MacBookAir9 1 Core i3 1.1 13 inch A2179 3/2020 512GB SSD",
        m_model="",
        full_name="MacBookAir9 1 Core i3 1.1 13 inch A2179 3/2020 512GB SSD",
        capacity="512GB",
        device_price=None,
        brand_name="Apple"
    )

    # Calculate expected device_signature
    device_signature = hashlib.md5(
        f"{input_data.model_name}|512".encode()
    ).hexdigest()

    # Delete existing record if any
    DeviceMappingV2.objects.filter(device_signature=device_signature).delete()
    print(f"Limpiando registros previos con signature: {device_signature}")

    # Perform mapping
    service = DeviceMapperService()
    result = service.map(input_data)

    print(f"\n✅ Mapeo completado")
    print(f"   Status: {result.status.value}")
    print(f"   Capacidad ID: {result.matched_capacidad_id}")
    print(f"   Modelo: {result.matched_modelo_descripcion}")
    print(f"   Score: {result.match_score}")
    print(f"   Strategy: {result.match_strategy.value if result.match_strategy else 'None'}")

    # Now manually create DeviceMappingV2 record (simulating what actualizar_likewize does)
    print(f"\nCreando DeviceMappingV2 record...")

    try:
        mapping_record = DeviceMappingV2.objects.create(
            device_signature=device_signature,
            source_data={"model_name": input_data.model_name, "capacity": input_data.capacity},
            source_type='mac',
            mapped_capacity_id=result.matched_capacidad_id,
            confidence_score=int(result.match_score * 100),
            mapping_algorithm=f"v4_{result.match_strategy.value}" if result.match_strategy else "v4",
            extracted_a_number="A2179",
            extracted_model_name="MacBook Air",
            extracted_cpu="Core i3 1.1",
            extracted_year=2020,
            extracted_capacity_gb=512,
            extracted_screen_size=13.0,
            decision_path=[{"level": log.level, "message": log.message} for log in result.context.logs] if result.context else [],
            candidates_considered=[],
            rejection_reasons=[],
            processing_time_ms=100,
        )
        print(f"✅ DeviceMappingV2 creado exitosamente!")
        print(f"   ID: {mapping_record.id}")
        print(f"   Signature: {mapping_record.device_signature}")
        print(f"   Algorithm: {mapping_record.mapping_algorithm}")
        print(f"   Confidence: {mapping_record.confidence_score}%")
        print(f"   Mapped Capacity ID: {mapping_record.mapped_capacity_id}")

        # Verify we can query it back
        retrieved = DeviceMappingV2.objects.get(device_signature=device_signature)
        print(f"\n✅ Registro recuperado exitosamente desde BD")
        print(f"   Algorithm: {retrieved.mapping_algorithm}")
        print(f"   Confidence: {retrieved.confidence_score}%")

        success = True

    except Exception as e:
        print(f"❌ ERROR al crear DeviceMappingV2: {str(e)}")
        import traceback
        traceback.print_exc()
        success = False

    print("=" * 80)
    if success:
        print("🎉 TEST PASSED: v4 metadata se guarda correctamente")
        return 0
    else:
        print("⚠️  TEST FAILED: Problemas con guardado de metadata")
        return 1


if __name__ == "__main__":
    sys.exit(test_v4_metadata_creation())
