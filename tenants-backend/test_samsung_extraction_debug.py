#!/usr/bin/env python
"""
Debug script para ver qué features se extraen de los casos problemáticos.
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping.extractors.samsung_extractor import SamsungFeatureExtractor
from productos.mapping.core.types import LikewizeInput, MappingContext

# Test cases
test_cases = [
    {
        'name': 'Galaxy S10 Lite 128GB',
        'input': LikewizeInput(
            model_name='Galaxy S10 Lite SM-G770F 128GB',
            m_model='SM-G770F',
            capacity='128GB',
            brand_name='Samsung',
        )
    },
    {
        'name': 'Galaxy S10e 128GB',
        'input': LikewizeInput(
            model_name='Galaxy S10e SM-G970F 128GB',
            m_model='SM-G970F',
            capacity='128GB',
            brand_name='Samsung',
        )
    },
    {
        'name': 'Galaxy Z Flip 5G (primera gen)',
        'input': LikewizeInput(
            model_name='Galaxy Z Flip 5G SM-F707B 256GB',
            m_model='SM-F707B',
            capacity='256GB',
            brand_name='Samsung',
        )
    }
]

print("=" * 80)
print("DEBUG: EXTRACCIÓN DE FEATURES SAMSUNG")
print("=" * 80)

extractor = SamsungFeatureExtractor()

for test_case in test_cases:
    print(f"\n{'=' * 80}")
    print(f"Test: {test_case['name']}")
    print(f"Input: {test_case['input'].model_name}")
    print(f"{'=' * 80}")

    context = MappingContext(
        input_data=test_case['input']
    )

    try:
        features = extractor.extract(test_case['input'], context)

        print(f"\nFeatures extraídas:")
        print(f"  device_type: {features.device_type}")
        print(f"  series: {features.series}")
        print(f"  variant: {features.variant}")
        print(f"  storage_gb: {features.storage_gb}")
        print(f"  has_5g: {features.has_5g}")
        print(f"  has_dual_sim: {features.has_dual_sim}")
        print(f"  year: {features.year}")
        print(f"  model_code: {features.model_code}")
        print(f"  regional_code: {features.regional_code}")

        # Try to build model name (like NameMatcher does)
        parts = []
        if features.device_type:
            device_type_str = features.device_type.value
            if "Samsung Galaxy" in device_type_str:
                device_type_str = "Galaxy"
            parts.append(device_type_str)

        if features.series:
            parts.append(features.series)

        if features.variant:
            parts.append(features.variant)

        if features.has_5g:
            parts.append("5G")

        model_name = " ".join(parts)
        print(f"\n  Nombre construido: '{model_name}'")

        print(f"\nLog messages:")
        for log_entry in context.logs:
            print(f"  [{log_entry.level}] {log_entry.message}")

    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 80)
print("FIN DEBUG")
print("=" * 80)
