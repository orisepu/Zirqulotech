"""
Tests para iPad Knowledge Base (TDD).

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
from productos.mapping.knowledge.ipad_kb import iPadKnowledgeBase


class TestiPadKnowledgeBase:
    """Tests para el Knowledge Base de iPad."""

    @pytest.fixture
    def kb(self):
        """Fixture del Knowledge Base."""
        return iPadKnowledgeBase()

    @pytest.fixture
    def context(self):
        """Fixture del contexto de mapeo."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        return MappingContext(input_data=input_data)

    # ===========================
    # Tests de get_year_for_ipad_regular
    # ===========================

    def test_get_year_ipad_regular_gen_10(self, kb):
        """iPad 10 fue lanzado en 2022."""
        year = kb.get_year_for_ipad_regular(10)
        assert year == 2022

    def test_get_year_ipad_regular_gen_9(self, kb):
        """iPad 9 fue lanzado en 2021."""
        year = kb.get_year_for_ipad_regular(9)
        assert year == 2021

    def test_get_year_ipad_regular_gen_8(self, kb):
        """iPad 8 fue lanzado en 2020."""
        year = kb.get_year_for_ipad_regular(8)
        assert year == 2020

    def test_get_year_ipad_regular_gen_7(self, kb):
        """iPad 7 fue lanzado en 2019."""
        year = kb.get_year_for_ipad_regular(7)
        assert year == 2019

    def test_get_year_ipad_regular_gen_6(self, kb):
        """iPad 6 fue lanzado en 2018."""
        year = kb.get_year_for_ipad_regular(6)
        assert year == 2018

    def test_get_year_ipad_regular_gen_5(self, kb):
        """iPad 5 fue lanzado en 2017."""
        year = kb.get_year_for_ipad_regular(5)
        assert year == 2017

    def test_get_year_ipad_regular_unknown_generation(self, kb):
        """Generación desconocida retorna None."""
        year = kb.get_year_for_ipad_regular(99)
        assert year is None

    # ===========================
    # Tests de get_year_for_ipad_air
    # ===========================

    def test_get_year_ipad_air_gen_6(self, kb):
        """iPad Air 6 fue lanzado en 2024."""
        year = kb.get_year_for_ipad_air(6)
        assert year == 2024

    def test_get_year_ipad_air_gen_5(self, kb):
        """iPad Air 5 fue lanzado en 2022."""
        year = kb.get_year_for_ipad_air(5)
        assert year == 2022

    def test_get_year_ipad_air_gen_4(self, kb):
        """iPad Air 4 fue lanzado en 2020."""
        year = kb.get_year_for_ipad_air(4)
        assert year == 2020

    def test_get_year_ipad_air_gen_3(self, kb):
        """iPad Air 3 fue lanzado en 2019."""
        year = kb.get_year_for_ipad_air(3)
        assert year == 2019

    def test_get_year_ipad_air_gen_2(self, kb):
        """iPad Air 2 fue lanzado en 2014."""
        year = kb.get_year_for_ipad_air(2)
        assert year == 2014

    def test_get_year_ipad_air_gen_1(self, kb):
        """iPad Air 1 fue lanzado en 2013."""
        year = kb.get_year_for_ipad_air(1)
        assert year == 2013

    def test_get_year_ipad_air_unknown_generation(self, kb):
        """Generación desconocida retorna None."""
        year = kb.get_year_for_ipad_air(99)
        assert year is None

    # ===========================
    # Tests de get_year_for_ipad_mini
    # ===========================

    def test_get_year_ipad_mini_gen_7(self, kb):
        """iPad mini 7 fue lanzado en 2024."""
        year = kb.get_year_for_ipad_mini(7)
        assert year == 2024

    def test_get_year_ipad_mini_gen_6(self, kb):
        """iPad mini 6 fue lanzado en 2021."""
        year = kb.get_year_for_ipad_mini(6)
        assert year == 2021

    def test_get_year_ipad_mini_gen_5(self, kb):
        """iPad mini 5 fue lanzado en 2019."""
        year = kb.get_year_for_ipad_mini(5)
        assert year == 2019

    def test_get_year_ipad_mini_gen_4(self, kb):
        """iPad mini 4 fue lanzado en 2015."""
        year = kb.get_year_for_ipad_mini(4)
        assert year == 2015

    def test_get_year_ipad_mini_unknown_generation(self, kb):
        """Generación desconocida retorna None."""
        year = kb.get_year_for_ipad_mini(99)
        assert year is None

    # ===========================
    # Tests de get_year_for_ipad_pro (por tamaño)
    # ===========================

    def test_get_year_ipad_pro_13_inch_m4(self, kb):
        """iPad Pro 13\" M4 fue lanzado en 2024."""
        year = kb.get_year_for_ipad_pro(13.0, cpu="M4")
        assert year == 2024

    def test_get_year_ipad_pro_12_9_inch_m2(self, kb):
        """iPad Pro 12.9\" M2 fue lanzado en 2022."""
        year = kb.get_year_for_ipad_pro(12.9, cpu="M2")
        assert year == 2022

    def test_get_year_ipad_pro_12_9_inch_m1(self, kb):
        """iPad Pro 12.9\" M1 fue lanzado en 2021."""
        year = kb.get_year_for_ipad_pro(12.9, cpu="M1")
        assert year == 2021

    def test_get_year_ipad_pro_12_9_inch_a12z(self, kb):
        """iPad Pro 12.9\" A12Z fue lanzado en 2020."""
        year = kb.get_year_for_ipad_pro(12.9, cpu="A12Z Bionic")
        assert year == 2020

    def test_get_year_ipad_pro_11_inch_m4(self, kb):
        """iPad Pro 11\" M4 fue lanzado en 2024."""
        year = kb.get_year_for_ipad_pro(11.0, cpu="M4")
        assert year == 2024

    def test_get_year_ipad_pro_11_inch_m2(self, kb):
        """iPad Pro 11\" M2 fue lanzado en 2022."""
        year = kb.get_year_for_ipad_pro(11.0, cpu="M2")
        assert year == 2022

    def test_get_year_ipad_pro_11_inch_m1(self, kb):
        """iPad Pro 11\" M1 fue lanzado en 2021."""
        year = kb.get_year_for_ipad_pro(11.0, cpu="M1")
        assert year == 2021

    def test_get_year_ipad_pro_10_5_inch(self, kb):
        """iPad Pro 10.5\" fue lanzado en 2017."""
        year = kb.get_year_for_ipad_pro(10.5, cpu="A10X Fusion")
        assert year == 2017

    def test_get_year_ipad_pro_9_7_inch(self, kb):
        """iPad Pro 9.7\" fue lanzado en 2016."""
        year = kb.get_year_for_ipad_pro(9.7, cpu="A9X")
        assert year == 2016

    def test_get_year_ipad_pro_unknown_size(self, kb):
        """Tamaño desconocido retorna None."""
        year = kb.get_year_for_ipad_pro(15.0, cpu="M2")
        assert year is None

    def test_get_year_ipad_pro_no_cpu_returns_latest(self, kb):
        """Sin CPU, retorna el año más reciente para ese tamaño."""
        year = kb.get_year_for_ipad_pro(12.9)
        assert year == 2022  # El año más reciente para 12.9"

    # ===========================
    # Tests de get_cpu_for_variant
    # ===========================

    def test_get_cpu_ipad_regular_gen_10(self, kb):
        """iPad 10 usa A14 Bionic."""
        cpu = kb.get_cpu_for_variant("regular", generation=10)
        assert cpu == "A14 Bionic"

    def test_get_cpu_ipad_regular_gen_9(self, kb):
        """iPad 9 usa A13 Bionic."""
        cpu = kb.get_cpu_for_variant("regular", generation=9)
        assert cpu == "A13 Bionic"

    def test_get_cpu_ipad_air_gen_6(self, kb):
        """iPad Air 6 usa M2."""
        cpu = kb.get_cpu_for_variant("Air", generation=6)
        assert cpu == "M2"

    def test_get_cpu_ipad_air_gen_5(self, kb):
        """iPad Air 5 usa M1."""
        cpu = kb.get_cpu_for_variant("Air", generation=5)
        assert cpu == "M1"

    def test_get_cpu_ipad_air_gen_4(self, kb):
        """iPad Air 4 usa A14 Bionic."""
        cpu = kb.get_cpu_for_variant("Air", generation=4)
        assert cpu == "A14 Bionic"

    def test_get_cpu_ipad_mini_gen_7(self, kb):
        """iPad mini 7 usa A17 Pro."""
        cpu = kb.get_cpu_for_variant("mini", generation=7)
        assert cpu == "A17 Pro"

    def test_get_cpu_ipad_mini_gen_6(self, kb):
        """iPad mini 6 usa A15 Bionic."""
        cpu = kb.get_cpu_for_variant("mini", generation=6)
        assert cpu == "A15 Bionic"

    def test_get_cpu_ipad_pro_11_inch_latest(self, kb):
        """iPad Pro 11\" sin año retorna CPU del más reciente."""
        cpu = kb.get_cpu_for_variant("Pro", screen_size=11.0)
        assert cpu == "M4"  # El más reciente para 11"

    def test_get_cpu_ipad_pro_12_9_inch_2021(self, kb):
        """iPad Pro 12.9\" 2021 usa M1."""
        cpu = kb.get_cpu_for_variant("Pro", screen_size=12.9, year=2021)
        assert cpu == "M1"

    def test_get_cpu_unknown_variant(self, kb):
        """Variante desconocida retorna None."""
        cpu = kb.get_cpu_for_variant("Unknown", generation=10)
        assert cpu is None

    # ===========================
    # Tests de get_available_screen_sizes
    # ===========================

    def test_get_screen_sizes_ipad_regular_gen_10(self, kb):
        """iPad 10 tiene tamaño 10.9\"."""
        sizes = kb.get_available_screen_sizes("regular", generation=10)
        assert 10.9 in sizes

    def test_get_screen_sizes_ipad_air_gen_6(self, kb):
        """iPad Air 6 tiene tamaños 11\" y 13\"."""
        sizes = kb.get_available_screen_sizes("Air", generation=6)
        assert 11.0 in sizes
        assert 13.0 in sizes

    def test_get_screen_sizes_ipad_mini_gen_7(self, kb):
        """iPad mini 7 tiene tamaño 8.3\"."""
        sizes = kb.get_available_screen_sizes("mini", generation=7)
        assert 8.3 in sizes

    def test_get_screen_sizes_ipad_pro_all(self, kb):
        """iPad Pro tiene múltiples tamaños disponibles."""
        sizes = kb.get_available_screen_sizes("Pro")
        assert 9.7 in sizes
        assert 10.5 in sizes
        assert 11.0 in sizes
        assert 12.9 in sizes
        assert 13.0 in sizes

    # ===========================
    # Tests de get_available_capacities
    # ===========================

    def test_get_capacities_ipad_regular_gen_10(self, kb):
        """iPad 10 viene en 64GB y 256GB."""
        capacities = kb.get_available_capacities("regular", generation=10)
        assert 64 in capacities
        assert 256 in capacities

    def test_get_capacities_ipad_air_gen_6(self, kb):
        """iPad Air 6 viene en 128GB, 256GB, 512GB, 1TB."""
        capacities = kb.get_available_capacities("Air", generation=6)
        assert 128 in capacities
        assert 256 in capacities
        assert 512 in capacities
        assert 1024 in capacities

    def test_get_capacities_ipad_mini_gen_7(self, kb):
        """iPad mini 7 viene en 128GB, 256GB, 512GB."""
        capacities = kb.get_available_capacities("mini", generation=7)
        assert 128 in capacities
        assert 256 in capacities
        assert 512 in capacities

    def test_get_capacities_ipad_pro_11_inch_2024(self, kb):
        """iPad Pro 11\" M4 (2024) tiene capacidades hasta 2TB."""
        capacities = kb.get_available_capacities("Pro", screen_size=11.0, year=2024)
        assert 256 in capacities
        assert 512 in capacities
        assert 1024 in capacities
        assert 2048 in capacities

    # ===========================
    # Tests de enrich_features (integración)
    # ===========================

    def test_enrich_features_ipad_regular_gen_10(self, kb, context):
        """Enriquecer features de iPad 10 agrega año y CPU."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPAD,
            generation=10,
            storage_gb=256
        )

        enriched = kb.enrich_features(features, context)

        assert enriched.year == 2022
        assert enriched.cpu == "A14 Bionic"
        assert len(enriched.extraction_notes) > 0
        assert any("KB" in note for note in enriched.extraction_notes)

    def test_enrich_features_ipad_air_gen_6(self, kb, context):
        """Enriquecer features de iPad Air 6 agrega año y CPU."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPAD_AIR,
            variant="Air",
            generation=6,
            screen_size=13.0,
            storage_gb=512
        )

        enriched = kb.enrich_features(features, context)

        assert enriched.year == 2024
        assert enriched.cpu == "M2"

    def test_enrich_features_ipad_mini_gen_7(self, kb, context):
        """Enriquecer features de iPad mini 7."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPAD_MINI,
            variant="mini",
            generation=7,
            screen_size=8.3,
            storage_gb=256
        )

        enriched = kb.enrich_features(features, context)

        assert enriched.year == 2024
        assert enriched.cpu == "A17 Pro"

    def test_enrich_features_ipad_pro_12_9_m2(self, kb, context):
        """Enriquecer features de iPad Pro 12.9\" M2."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPAD_PRO,
            variant="Pro",
            screen_size=12.9,
            cpu="M2",
            storage_gb=256
        )

        enriched = kb.enrich_features(features, context)

        assert enriched.year == 2022

    def test_enrich_features_no_generation(self, kb, context):
        """Si no hay generación (iPad Pro), puede enriquecer por CPU."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPAD_PRO,
            variant="Pro",
            screen_size=11.0,
            cpu="M4",
            storage_gb=512
        )

        enriched = kb.enrich_features(features, context)

        # Debe inferir año desde CPU + tamaño
        assert enriched.year == 2024

    def test_enrich_features_already_has_year(self, kb, context):
        """Si ya tiene año, no sobrescribirlo."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPAD,
            generation=10,
            year=2099,  # Año incorrecto ya presente
            storage_gb=64
        )

        enriched = kb.enrich_features(features, context)

        # No debe sobrescribir el año existente
        assert enriched.year == 2099

    def test_enrich_features_non_ipad(self, kb, context):
        """No enriquecer si no es iPad."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            storage_gb=128
        )

        enriched = kb.enrich_features(features, context)

        # No debe agregar info de iPad a un iPhone
        # (el CPU ya podría estar del iPhone KB)
        assert enriched.device_type == DeviceType.IPHONE
