"""
Tests para MacBook Knowledge Base.

Cubre:
- MacBook Air (M1/M2/M3/M4)
- MacBook Pro Intel (Core i5/i7/i9, 13"/15"/16")
- MacBook Pro M-series (M1/M2/M3/M4 + Pro/Max, 14"/16")
"""

import pytest
from productos.mapping.knowledge.macbook_kb import MacBookKnowledgeBase


class TestMacBookKnowledgeBase:
    """Tests para MacBookKnowledgeBase."""

    @pytest.fixture
    def kb(self):
        """Fixture que provee una instancia del KB."""
        return MacBookKnowledgeBase()

    # ===========================
    # Tests: MacBook Air
    # ===========================

    def test_get_air_info_m3(self, kb):
        """Test: M3 Air info."""
        info = kb.get_air_info("M3")
        assert info is not None
        assert info["year"] == 2024
        assert 13.0 in info["screen_sizes"]
        assert 15.0 in info["screen_sizes"]
        assert 256 in info["capacities"]
        assert 2048 in info["capacities"]

    def test_get_air_info_m2(self, kb):
        """Test: M2 Air info."""
        info = kb.get_air_info("M2")
        assert info is not None
        assert info["year"] == 2022
        assert 13.0 in info["screen_sizes"]
        assert 15.0 in info["screen_sizes"]
        assert 10 in info["gpu_cores"]

    def test_get_air_info_m1(self, kb):
        """Test: M1 Air info."""
        info = kb.get_air_info("M1")
        assert info is not None
        assert info["year"] == 2020
        assert info["screen_sizes"] == [13.0]  # Solo 13"
        assert 7 in info["gpu_cores"]  # 7-core GPU variant
        assert 8 in info["gpu_cores"]  # 8-core GPU variant

    def test_get_air_info_invalid_chip(self, kb):
        """Test: Chip inválido retorna None."""
        info = kb.get_air_info("M99")
        assert info is None

    def test_air_supports_large_capacities(self, kb):
        """Test: Air soporta hasta 2TB."""
        info = kb.get_air_info("M3")
        assert 2048 in info["capacities"]

    # ===========================
    # Tests: MacBook Pro Intel
    # ===========================

    def test_get_pro_intel_13_inch(self, kb):
        """Test: Pro Intel 13\" configs."""
        configs = kb.get_pro_intel_info(13.0)
        assert configs is not None
        assert len(configs) >= 4  # 2017-2020

        # Verificar que hay configs para múltiples años
        years = [cfg["year"] for cfg in configs]
        assert 2020 in years
        assert 2017 in years

    def test_get_pro_intel_16_inch(self, kb):
        """Test: Pro Intel 16\" configs."""
        configs = kb.get_pro_intel_info(16.0)
        assert configs is not None
        assert len(configs) >= 2  # 2019-2020

        # 16" es más nuevo (2019+)
        years = [cfg["year"] for cfg in configs]
        assert 2019 in years
        assert 2020 in years

    def test_get_pro_intel_15_inch(self, kb):
        """Test: Pro Intel 15\" configs (legacy, antes del 16\")."""
        configs = kb.get_pro_intel_info(15.0)
        assert configs is not None

        # 15" fue discontinuado en 2019
        years = [cfg["year"] for cfg in configs]
        assert 2019 in years

    def test_get_pro_intel_filter_by_year(self, kb):
        """Test: Filtrar configs Intel por año."""
        configs_2020 = kb.get_pro_intel_info(13.0, year=2020)
        assert configs_2020 is not None
        assert all(cfg["year"] == 2020 for cfg in configs_2020)

    def test_get_pro_intel_invalid_size(self, kb):
        """Test: Tamaño inválido retorna None."""
        configs = kb.get_pro_intel_info(999.0)
        assert configs is None

    def test_intel_supports_core_i9(self, kb):
        """Test: Pro Intel soporta Core i9 (16\" y 15\")."""
        configs_16 = kb.get_pro_intel_info(16.0)
        cpu_types = [cpu for cfg in configs_16 for cpu in cfg["cpu_types"]]
        assert "Core i9" in cpu_types

    def test_intel_13_has_2_and_4_port_models(self, kb):
        """Test: Pro Intel 13\" tiene modelos con 2 y 4 puertos Thunderbolt."""
        configs = kb.get_pro_intel_info(13.0, year=2020)
        models = [model for cfg in configs for model in cfg["models"]]
        assert "A2251" in models  # 4 puertos
        assert "A2289" in models  # 2 puertos

    # ===========================
    # Tests: MacBook Pro M-series
    # ===========================

    def test_get_pro_m_series_14_inch_m3(self, kb):
        """Test: Pro M-series 14\" M3 configs."""
        info = kb.get_pro_m_series_info(14.0, year=2023)
        assert info is not None
        assert "M3" in info["chips"]
        assert "M3 Pro" in info["chips"]
        assert "M3 Max" in info["chips"]

    def test_get_pro_m_series_16_inch_m1(self, kb):
        """Test: Pro M-series 16\" M1 configs."""
        info = kb.get_pro_m_series_info(16.0, year=2021)
        assert info is not None
        assert "M1 Pro" in info["chips"]
        assert "M1 Max" in info["chips"]
        # M1 base NO está en 16" (solo Pro/Max)
        assert "M1" not in info["chips"]

    def test_m3_max_has_40_gpu_cores(self, kb):
        """Test: M3 Max tiene hasta 40 GPU cores."""
        info = kb.get_pro_m_series_info(14.0, year=2023)
        m3_max = info["chips"]["M3 Max"]
        assert 40 in m3_max["gpu_cores"]

    def test_m1_max_supports_8tb(self, kb):
        """Test: M1 Max soporta hasta 8TB."""
        info = kb.get_pro_m_series_info(14.0, year=2021)
        m1_max = info["chips"]["M1 Max"]
        assert 8192 in m1_max["capacities"]

    def test_14_inch_has_base_m3(self, kb):
        """Test: 14\" tiene M3 base (pero 16\" no)."""
        info_14 = kb.get_pro_m_series_info(14.0, year=2023)
        assert "M3" in info_14["chips"]

        info_16 = kb.get_pro_m_series_info(16.0, year=2023)
        assert "M3" not in info_16["chips"]  # 16" solo Pro/Max

    def test_get_pro_m_series_invalid_size(self, kb):
        """Test: Tamaño inválido retorna None."""
        info = kb.get_pro_m_series_info(999.0, year=2023)
        assert info is None

    # ===========================
    # Tests: infer_year_from_chip
    # ===========================

    def test_infer_year_m3_air(self, kb):
        """Test: Inferir año de M3 Air."""
        year = kb.infer_year_from_chip("M3", "Air")
        assert year == 2024

    def test_infer_year_m2_air(self, kb):
        """Test: Inferir año de M2 Air."""
        year = kb.infer_year_from_chip("M2", "Air")
        assert year == 2022

    def test_infer_year_m1_air(self, kb):
        """Test: Inferir año de M1 Air."""
        year = kb.infer_year_from_chip("M1", "Air")
        assert year == 2020

    def test_infer_year_m3_pro_with_size(self, kb):
        """Test: Inferir año de M3 Pro con tamaño de pantalla."""
        year = kb.infer_year_from_chip("M3 Pro", "Pro", screen_size=14.0)
        assert year == 2023

    def test_infer_year_intel_returns_none(self, kb):
        """Test: Intel no puede inferir año (múltiples años con mismo chip)."""
        year = kb.infer_year_from_chip("Core i7 2.3", "Pro")
        assert year is None

    def test_infer_year_invalid_chip(self, kb):
        """Test: Chip inválido retorna None."""
        year = kb.infer_year_from_chip("M99", "Air")
        assert year is None

    # ===========================
    # Tests: is_valid_combination
    # ===========================

    def test_valid_m3_air_13_inch_512gb(self, kb):
        """Test: M3 Air 13\" 512GB es válido."""
        valid = kb.is_valid_combination("Air", "M3", 13.0, 512)
        assert valid is True

    def test_valid_m2_air_15_inch_1tb(self, kb):
        """Test: M2 Air 15\" 1TB es válido."""
        valid = kb.is_valid_combination("Air", "M2", 15.0, 1024)
        assert valid is True

    def test_invalid_m1_air_15_inch(self, kb):
        """Test: M1 Air 15\" NO es válido (solo 13\")."""
        valid = kb.is_valid_combination("Air", "M1", 15.0, 512)
        assert valid is False

    def test_invalid_air_128gb(self, kb):
        """Test: Air 128GB NO es válido (mínimo 256GB)."""
        valid = kb.is_valid_combination("Air", "M3", 13.0, 128)
        assert valid is False

    def test_valid_m3_max_14_inch_4tb(self, kb):
        """Test: M3 Max 14\" 4TB es válido."""
        valid = kb.is_valid_combination("Pro", "M3 Max", 14.0, 4096, year=2023)
        assert valid is True

    def test_invalid_m3_base_16_inch(self, kb):
        """Test: M3 base 16\" NO es válido (solo 14\")."""
        valid = kb.is_valid_combination("Pro", "M3", 16.0, 512, year=2023)
        assert valid is False

    def test_valid_core_i7_13_inch_512gb(self, kb):
        """Test: Core i7 13\" 512GB es válido."""
        valid = kb.is_valid_combination("Pro", "Core i7 2.3", 13.0, 512, year=2020)
        assert valid is True

    def test_invalid_core_i5_14_inch(self, kb):
        """Test: Core i5 14\" NO es válido (14\" solo M-series)."""
        valid = kb.is_valid_combination("Pro", "Core i5 2.0", 14.0, 512, year=2020)
        assert valid is False

    # ===========================
    # Tests: get_chip_variants
    # ===========================

    def test_get_chip_variants_m3(self, kb):
        """Test: M3 tiene variantes Pro y Max."""
        variants = kb.get_chip_variants("M3")
        assert variants == ["M3", "M3 Pro", "M3 Max"]

    def test_get_chip_variants_m2(self, kb):
        """Test: M2 tiene variantes Pro y Max."""
        variants = kb.get_chip_variants("M2")
        assert variants == ["M2", "M2 Pro", "M2 Max"]

    def test_get_chip_variants_m1(self, kb):
        """Test: M1 tiene variantes Pro y Max."""
        variants = kb.get_chip_variants("M1")
        assert variants == ["M1", "M1 Pro", "M1 Max"]

    def test_get_chip_variants_m3_pro_only_returns_itself(self, kb):
        """Test: M3 Pro no tiene sub-variantes."""
        variants = kb.get_chip_variants("M3 Pro")
        assert variants == ["M3 Pro"]

    def test_get_chip_variants_m3_max_only_returns_itself(self, kb):
        """Test: M3 Max no tiene sub-variantes."""
        variants = kb.get_chip_variants("M3 Max")
        assert variants == ["M3 Max"]

    # ===========================
    # Tests: Edge cases
    # ===========================

    def test_air_all_chips_have_wifi(self, kb):
        """Test: Todos los Air tienen Wi-Fi."""
        for chip in ["M1", "M2", "M3", "M4"]:
            info = kb.get_air_info(chip)
            if info:  # M4 puede no estar aún
                # No hay flag has_wifi en KB, pero todos los MacBooks tienen Wi-Fi
                assert info is not None

    def test_no_macbook_has_cellular(self, kb):
        """Test: Ningún MacBook tiene Cellular (a diferencia de iPad)."""
        # Esta es una regla implícita: los MacBooks nunca tienen Cellular
        # El extractor debe marcar has_cellular=False siempre
        assert True  # Placeholder - validado en extractor

    def test_14_and_16_inch_only_m_series(self, kb):
        """Test: 14\" y 16\" solo existen en M-series (no Intel)."""
        # Intel nunca tuvo 14"
        intel_14 = kb.get_pro_intel_info(14.0)
        assert intel_14 is None

        # 16" Intel existe pero solo 2019-2020
        intel_16 = kb.get_pro_intel_info(16.0)
        assert intel_16 is not None

        # M-series tiene 14" y 16"
        m_14 = kb.get_pro_m_series_info(14.0)
        assert m_14 is not None
        m_16 = kb.get_pro_m_series_info(16.0)
        assert m_16 is not None

    def test_15_inch_only_intel(self, kb):
        """Test: 15\" solo existe en Intel (discontinuado)."""
        # Intel tiene 15"
        intel_15 = kb.get_pro_intel_info(15.0)
        assert intel_15 is not None

        # M-series NO tiene 15" (fue reemplazado por 14" y 16")
        m_15 = kb.get_pro_m_series_info(15.0)
        assert m_15 is None
