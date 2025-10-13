#!/usr/bin/env python
"""
Test para verificar enriquecimiento de capacidades en MacBook Engine.

Prueba que cuando un MacBook existe en BD pero le falta una capacidad,
el sistema retorne información enriquecida con existing_capacities y missing_capacities.
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'progeek.settings')
django.setup()

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter

# Test cases
test_cases = [
    {
        "name": "Mac Pro M2 Ultra 24-Core CPU 60-Core GPU 4TB (modelo existe, capacidad falta)",
        "input": "MacPro14 8 M2 Ultra 24 Core CPU 60 Core GPU A2787 6/2023 4TB SSD",
        "expected": {
            "needs_capacity_creation": True,
            "has_enrichment": True,
            "model_found": True,
        }
    },
    {
        "name": "MacBook Pro 14\" M4 Max 16-Core CPU 40-Core GPU 4TB (modelo NO existe)",
        "input": "MacBookPro16 6 M4 Max 16 Core CPU 40 Core GPU 14 inch A3185 10/2024 4TB SSD",
        "expected": {
            "needs_capacity_creation": True,
            "has_enrichment": False,  # Modelo NO existe, no hay enriquecimiento del backend
            "model_found": False,
        }
    }
]

adapter = V3CompatibilityAdapter()

print("=" * 80)
print("TEST: Verificar Enriquecimiento de Capacidades para MacBooks")
print("=" * 80)

for test in test_cases:
    print(f"\n{'='*80}")
    print(f"Test: {test['name']}")
    print(f"Input: {test['input']}")
    print(f"{'='*80}")

    # Mapear con v4
    result = adapter.map_likewize_to_capacidad(test['input'])

    # Verificar resultado
    needs_creation = result.get('needs_capacity_creation', False)
    suggested = result.get('suggested_capacity', {})
    model_found = suggested.get('model_found', False)

    existing_caps = suggested.get('existing_capacities', [])
    missing_caps = suggested.get('missing_capacities', [])
    modelo_desc = suggested.get('modelo_descripcion', '')

    has_enrichment = len(existing_caps) > 0 or len(missing_caps) > 0 or bool(modelo_desc)

    # Mostrar resultado
    print(f"\nResultado:")
    print(f"  needs_capacity_creation: {needs_creation}")
    print(f"  model_found: {model_found}")
    print(f"  existing_capacities: {existing_caps}")
    print(f"  missing_capacities: {missing_caps}")
    print(f"  modelo_descripcion: {modelo_desc or 'N/A'}")
    print(f"  has_enrichment: {has_enrichment}")

    # Verificar expectativas
    passed = (
        needs_creation == test['expected']['needs_capacity_creation'] and
        has_enrichment == test['expected']['has_enrichment'] and
        model_found == test['expected']['model_found']
    )

    if passed:
        print(f"\n✅ PASS")
    else:
        print(f"\n❌ FAIL")
        print(f"  Expected: {test['expected']}")
        print(f"  Got: {{needs_capacity_creation: {needs_creation}, has_enrichment: {has_enrichment}, model_found: {model_found}}}")

print(f"\n{'='*80}")
print("Tests completados")
print("=" * 80)
