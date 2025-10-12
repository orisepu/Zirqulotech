"""
Tests para iPhone Knowledge Base (TDD).

Tests escritos PRIMERO siguiendo TDD:
- RED: Tests fallan (no existe implementación)
- GREEN: Implementar mínimo para que pasen
- REFACTOR: Mejorar código sin romper tests
"""

import pytest

from productos.mapping.core.types import (
    ExtractedFeatures,
    DeviceType,
    LikewizeInput,
    MappingContext,
)
from productos.mapping.knowledge.iphone_kb import iPhoneKnowledgeBase


class TestiPhoneKnowledgeBase:
    """Tests para el Knowledge Base de iPhone."""

    @pytest.fixture
    def kb(self):
        """Fixture del Knowledge Base."""
        return iPhoneKnowledgeBase()

    @pytest.fixture
    def context(self):
        """Fixture del contexto de mapeo."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        return MappingContext(input_data=input_data)

    # ===========================
    # Tests de get_year_for_generation
    # ===========================

    def test_get_year_iphone_17(self, kb):
        """iPhone 17 será lanzado en 2025."""
        year = kb.get_year_for_generation("iPhone", 17)
        assert year == 2025

    def test_get_year_iphone_16(self, kb):
        """iPhone 16 fue lanzado en 2024."""
        year = kb.get_year_for_generation("iPhone", 16)
        assert year == 2024

    def test_get_year_iphone_15(self, kb):
        """iPhone 15 fue lanzado en 2023."""
        year = kb.get_year_for_generation("iPhone", 15)
        assert year == 2023

    def test_get_year_iphone_14(self, kb):
        """iPhone 14 fue lanzado en 2022."""
        year = kb.get_year_for_generation("iPhone", 14)
        assert year == 2022

    def test_get_year_iphone_13(self, kb):
        """iPhone 13 fue lanzado en 2021."""
        year = kb.get_year_for_generation("iPhone", 13)
        assert year == 2021

    def test_get_year_iphone_12(self, kb):
        """iPhone 12 fue lanzado en 2020."""
        year = kb.get_year_for_generation("iPhone", 12)
        assert year == 2020

    def test_get_year_iphone_11(self, kb):
        """iPhone 11 fue lanzado en 2019."""
        year = kb.get_year_for_generation("iPhone", 11)
        assert year == 2019

    def test_get_year_iphone_x(self, kb):
        """iPhone X (gen 10) fue lanzado en 2017."""
        year = kb.get_year_for_generation("iPhone", 10)
        assert year == 2017

    def test_get_year_iphone_8(self, kb):
        """iPhone 8 fue lanzado en 2017."""
        year = kb.get_year_for_generation("iPhone", 8)
        assert year == 2017

    def test_get_year_iphone_7(self, kb):
        """iPhone 7 fue lanzado en 2016."""
        year = kb.get_year_for_generation("iPhone", 7)
        assert year == 2016

    def test_get_year_iphone_6(self, kb):
        """iPhone 6 fue lanzado en 2014."""
        year = kb.get_year_for_generation("iPhone", 6)
        assert year == 2014

    def test_get_year_unknown_generation(self, kb):
        """Generación desconocida retorna None."""
        year = kb.get_year_for_generation("iPhone", 99)
        assert year is None

    def test_get_year_invalid_device_type(self, kb):
        """Tipo de dispositivo inválido retorna None."""
        year = kb.get_year_for_generation("InvalidDevice", 13)
        assert year is None

    # ===========================
    # Tests de get_cpu_for_generation
    # ===========================

    def test_get_cpu_iphone_16(self, kb):
        """iPhone 16 usa A18 Bionic."""
        cpu = kb.get_cpu_for_generation(16)
        assert cpu == "A18 Bionic"

    def test_get_cpu_iphone_15_pro(self, kb):
        """iPhone 15 Pro usa A17 Pro."""
        cpu = kb.get_cpu_for_generation(15, variant="Pro")
        assert cpu == "A17 Pro"

    def test_get_cpu_iphone_15_regular(self, kb):
        """iPhone 15 regular usa A16 Bionic."""
        cpu = kb.get_cpu_for_generation(15, variant=None)
        assert cpu == "A16 Bionic"

    def test_get_cpu_iphone_13(self, kb):
        """iPhone 13 usa A15 Bionic."""
        cpu = kb.get_cpu_for_generation(13)
        assert cpu == "A15 Bionic"

    def test_get_cpu_iphone_12(self, kb):
        """iPhone 12 usa A14 Bionic."""
        cpu = kb.get_cpu_for_generation(12)
        assert cpu == "A14 Bionic"

    def test_get_cpu_iphone_11(self, kb):
        """iPhone 11 usa A13 Bionic."""
        cpu = kb.get_cpu_for_generation(11)
        assert cpu == "A13 Bionic"

    def test_get_cpu_unknown_generation(self, kb):
        """Generación desconocida retorna None."""
        cpu = kb.get_cpu_for_generation(99)
        assert cpu is None

    # ===========================
    # Tests de get_available_variants
    # ===========================

    def test_get_variants_iphone_16(self, kb):
        """iPhone 16 tiene variantes: regular, Plus, Pro, Pro Max."""
        variants = kb.get_available_variants(16)
        assert "" in variants  # regular (sin variante)
        assert "Plus" in variants
        assert "Pro" in variants
        assert "Pro Max" in variants

    def test_get_variants_iphone_13(self, kb):
        """iPhone 13 tiene variantes: regular, mini, Pro, Pro Max."""
        variants = kb.get_available_variants(13)
        assert "" in variants  # regular
        assert "mini" in variants
        assert "Pro" in variants
        assert "Pro Max" in variants
        assert "Plus" not in variants  # Plus no existe en gen 13

    def test_get_variants_iphone_11(self, kb):
        """iPhone 11 tiene variantes: regular, Pro, Pro Max."""
        variants = kb.get_available_variants(11)
        assert "" in variants
        assert "Pro" in variants
        assert "Pro Max" in variants
        assert "mini" not in variants  # mini no existe en gen 11

    def test_get_variants_iphone_x(self, kb):
        """iPhone X (gen 10) solo tiene variante regular."""
        variants = kb.get_available_variants(10)
        # Solo variante X (sin Pro/Max/Plus)
        assert len(variants) > 0

    # ===========================
    # Tests de enrich_features (integración)
    # ===========================

    def test_enrich_features_iphone_13_pro(self, kb, context):
        """Enriquecer features de iPhone 13 Pro agrega año y CPU."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            variant="Pro",
            storage_gb=128
        )

        enriched = kb.enrich_features(features, context)

        assert enriched.year == 2021
        assert enriched.cpu == "A15 Bionic"
        assert len(enriched.extraction_notes) > 0
        assert any("KB" in note for note in enriched.extraction_notes)

    def test_enrich_features_iphone_15_plus(self, kb, context):
        """Enriquecer features de iPhone 15 Plus."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=15,
            variant="Plus",
            storage_gb=256
        )

        enriched = kb.enrich_features(features, context)

        assert enriched.year == 2023
        assert enriched.cpu == "A16 Bionic"

    def test_enrich_features_iphone_16_pro(self, kb, context):
        """Enriquecer features de iPhone 16 Pro."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=16,
            variant="Pro",
            storage_gb=512
        )

        enriched = kb.enrich_features(features, context)

        assert enriched.year == 2024
        assert enriched.cpu == "A18 Pro"

    def test_enrich_features_no_generation(self, kb, context):
        """Si no hay generación, no se puede enriquecer."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            storage_gb=128
        )

        enriched = kb.enrich_features(features, context)

        # No debe agregar año ni CPU si no hay generación
        assert enriched.year is None
        assert enriched.cpu is None

    def test_enrich_features_already_has_year(self, kb, context):
        """Si ya tiene año, no sobrescribirlo."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2099,  # Año incorrecto ya presente
            storage_gb=128
        )

        enriched = kb.enrich_features(features, context)

        # No debe sobrescribir el año existente
        assert enriched.year == 2099

    def test_enrich_features_non_iphone(self, kb, context):
        """No enriquecer si no es iPhone."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPAD,
            generation=10,
            storage_gb=256
        )

        enriched = kb.enrich_features(features, context)

        # No debe agregar info de iPhone a un iPad
        assert enriched.cpu is None

    # ===========================
    # Tests de validación de variantes
    # ===========================

    def test_is_valid_variant_iphone_13_mini(self, kb):
        """iPhone 13 mini es una variante válida."""
        is_valid = kb.is_valid_variant(13, "mini")
        assert is_valid is True

    def test_is_valid_variant_iphone_13_plus_invalid(self, kb):
        """iPhone 13 Plus NO es una variante válida (no existe)."""
        is_valid = kb.is_valid_variant(13, "Plus")
        assert is_valid is False

    def test_is_valid_variant_iphone_16_plus(self, kb):
        """iPhone 16 Plus es una variante válida."""
        is_valid = kb.is_valid_variant(16, "Plus")
        assert is_valid is True

    def test_is_valid_variant_iphone_16_mini_invalid(self, kb):
        """iPhone 16 mini NO es una variante válida (no existe)."""
        is_valid = kb.is_valid_variant(16, "mini")
        assert is_valid is False

    # ===========================
    # Tests de casos especiales
    # ===========================

    def test_iphone_se_mapping(self, kb):
        """iPhone SE tiene generaciones especiales (2, 3)."""
        # iPhone SE 3rd gen (2022)
        year = kb.get_year_for_generation("iPhone SE", 3)
        assert year == 2022

    def test_iphone_xr_xs_special_variants(self, kb):
        """iPhone XR y XS son variantes especiales de gen 10."""
        # Estos casos se manejan mejor en el extractor,
        # pero el KB debe saber que gen 10 existe
        year = kb.get_year_for_generation("iPhone", 10)
        assert year == 2017
