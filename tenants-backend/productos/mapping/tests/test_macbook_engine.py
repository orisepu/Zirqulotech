"""
Tests para Mac Engine.

Verifica la orquestación del proceso completo de mapeo para todos los Macs.
"""

import pytest
from unittest.mock import Mock, MagicMock
from productos.mapping.engines.macbook_engine import MacEngine
from productos.mapping.core.types import (
    LikewizeInput,
    MappingContext,
    ExtractedFeatures,
    MatchCandidate,
    MatchResult
)


class TestMacEngine:
    """Tests para MacEngine."""

    @pytest.fixture
    def engine(self):
        """Fixture que provee una instancia del engine."""
        return MacEngine()

    # ===========================
    # Tests: can_handle()
    # ===========================

    def test_can_handle_macbook_air(self, engine):
        """Test: Detecta MacBook Air."""
        input_data = LikewizeInput(model_name="MacBookAir15 13 M3 512GB SSD")
        assert engine.can_handle(input_data) is True

    def test_can_handle_macbook_pro(self, engine):
        """Test: Detecta MacBook Pro."""
        input_data = LikewizeInput(model_name="MacBookPro15 9 M3 Max 16 inch")
        assert engine.can_handle(input_data) is True

    def test_can_handle_macbook_case_insensitive(self, engine):
        """Test: Case insensitive."""
        input_data = LikewizeInput(model_name="macbook air 13 inch")
        assert engine.can_handle(input_data) is True

    def test_can_handle_iphone_rejected(self, engine):
        """Test: iPhone es rechazado."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        assert engine.can_handle(input_data) is False

    def test_can_handle_ipad_rejected(self, engine):
        """Test: iPad es rechazado."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9 inch M2")
        assert engine.can_handle(input_data) is False

    # ===========================
    # Tests: get_supported_device_types()
    # ===========================

    def test_get_supported_device_types(self, engine):
        """Test: Retorna todos los tipos de Mac soportados."""
        types = engine.get_supported_device_types()
        assert types == ["MacBook", "Mac mini", "iMac", "Mac Studio", "Mac Pro"]

    # ===========================
    # Tests: _select_best_candidate()
    # ===========================

    def test_select_best_candidate_single(self, engine):
        """Test: Con 1 candidato, retorna ese."""
        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=1,
            modelo_descripcion="MacBook Air (13 pulgadas, 2024) A3113 M3",
            capacidad_descripcion="512 GB",
            score=0.9
        )
        context = MappingContext(input_data=LikewizeInput(model_name="test"))

        best = engine._select_best_candidate([candidate], None, context)
        assert best == candidate

    def test_select_best_candidate_multiple(self, engine):
        """Test: Con múltiples, retorna el de mayor score."""
        candidate1 = MatchCandidate(
            capacidad_id=1,
            modelo_id=1,
            modelo_descripcion="Model 1",
            capacidad_descripcion="512 GB",
            score=0.7
        )
        candidate2 = MatchCandidate(
            capacidad_id=2,
            modelo_id=2,
            modelo_descripcion="Model 2",
            capacidad_descripcion="512 GB",
            score=0.9
        )
        candidate3 = MatchCandidate(
            capacidad_id=3,
            modelo_id=3,
            modelo_descripcion="Model 3",
            capacidad_descripcion="512 GB",
            score=0.6
        )
        context = MappingContext(input_data=LikewizeInput(model_name="test"))

        best = engine._select_best_candidate([candidate1, candidate2, candidate3], None, context)
        assert best == candidate2
        assert best.score == 0.9

    def test_select_best_candidate_empty_list(self, engine):
        """Test: Con lista vacía, retorna None."""
        context = MappingContext(input_data=LikewizeInput(model_name="test"))
        best = engine._select_best_candidate([], None, context)
        assert best is None

    # ===========================
    # Tests: map_device() - Basic Flow
    # ===========================

    def test_map_device_no_variant_detected(self, engine):
        """Test: Sin variante detectada retorna error."""
        input_data = LikewizeInput(model_name="RandomDevice XYZ")
        context = MappingContext(input_data=input_data)

        # Mock extractor para retornar features sin variante
        engine.extractor = Mock()
        engine.extractor.extract = Mock(return_value=ExtractedFeatures(
            device_type="MacBook",
            variant=None,  # Sin variante
            generation=None,
            year=None,
            storage_gb=None,
            has_wifi=True,
            has_cellular=False,
            raw_text="RandomDevice XYZ"
        ))

        result = engine.map_device(input_data, context)

        assert result.success is False
        assert "No se detectó variante de MacBook" in result.error_message

    def test_map_device_no_candidates_from_matcher(self, engine):
        """Test: Matcher no encuentra candidatos."""
        input_data = LikewizeInput(model_name="MacBookAir15 13 M3 512GB SSD")
        context = MappingContext(input_data=input_data)

        # Mock extractor
        engine.extractor = Mock()
        engine.extractor.extract = Mock(return_value=ExtractedFeatures(
            device_type="MacBook",
            variant="Air",
            generation=None,
            year=2024,
            storage_gb=512,
            has_wifi=True,
            has_cellular=False,
            screen_size=13.0,
            cpu="M3",
            raw_text="MacBookAir15 13 M3 512GB SSD"
        ))

        # Mock matcher para retornar lista vacía
        engine.matcher = Mock()
        engine.matcher.find_candidates = Mock(return_value=[])

        result = engine.map_device(input_data, context)

        assert result.success is False
        assert "No se encontraron candidatos en BD" in result.error_message

    def test_map_device_filters_remove_all_candidates(self, engine):
        """Test: Filtros eliminan todos los candidatos."""
        input_data = LikewizeInput(model_name="MacBookAir15 13 M3 512GB SSD")
        context = MappingContext(input_data=input_data)

        # Mock extractor
        engine.extractor = Mock()
        engine.extractor.extract = Mock(return_value=ExtractedFeatures(
            device_type="MacBook",
            variant="Air",
            generation=None,
            year=2024,
            storage_gb=512,
            has_wifi=True,
            has_cellular=False,
            screen_size=13.0,
            cpu="M3",
            raw_text="MacBookAir15 13 M3 512GB SSD"
        ))

        # Mock matcher para retornar candidatos
        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=1,
            modelo_descripcion="MacBook Air M3",
            capacidad_descripcion="512 GB",
            score=0.9
        )
        engine.matcher = Mock()
        engine.matcher.find_candidates = Mock(return_value=[candidate])

        # Mock TODOS los filtros para retornar lista vacía
        for rule in engine.rules:
            rule.apply = Mock(return_value=[])

        result = engine.map_device(input_data, context)

        assert result.success is False
        assert "Filtrado por" in result.error_message

    def test_map_device_successful_match(self, engine):
        """Test: Matching exitoso completo."""
        input_data = LikewizeInput(model_name="MacBookAir15 13 M3 512GB SSD")
        context = MappingContext(input_data=input_data)

        # Mock extractor
        engine.extractor = Mock()
        engine.extractor.extract = Mock(return_value=ExtractedFeatures(
            device_type="MacBook",
            variant="Air",
            generation=None,
            year=2024,
            storage_gb=512,
            has_wifi=True,
            has_cellular=False,
            screen_size=13.0,
            cpu="M3",
            raw_text="MacBookAir15 13 M3 512GB SSD"
        ))

        # Mock matcher
        candidate = MatchCandidate(
            capacidad_id=1234,
            modelo_id=567,
            modelo_descripcion="MacBook Air (13 pulgadas, 2024) A3113 M3",
            capacidad_descripcion="512 GB",
            score=0.95
        )
        engine.matcher = Mock()
        engine.matcher.find_candidates = Mock(return_value=[candidate])

        # Mock filtros para NO eliminar candidatos (pasar through)
        for rule in engine.rules:
            rule.apply = Mock(side_effect=lambda candidates, *args: candidates)

        result = engine.map_device(input_data, context)

        assert result.success is True
        assert result.capacidad_id == 1234
        assert result.modelo_id == 567
        assert result.confidence == 0.95
        assert result.strategy == "generation"
        assert result.metadata["variant"] == "Air"
        assert result.metadata["chip"] == "M3"

    # ===========================
    # Tests: Filter Chain Order
    # ===========================

    def test_filters_applied_in_correct_order(self, engine):
        """Test: Filtros se aplican en el orden correcto."""
        # Verificar que el orden es:
        # 1. ChipVariantFilter
        # 2. CPUCoresFilter
        # 3. GPUCoresFilter
        # 4. ScreenSizeFilter
        # 5. YearFilter
        # 6. CapacityFilter

        filter_names = [rule.get_rule_name() for rule in engine.rules]

        assert len(filter_names) == 6
        assert filter_names[0] == "ChipVariantFilter"
        assert filter_names[1] == "CPUCoresFilter"
        assert filter_names[2] == "GPUCoresFilter"
        assert filter_names[3] == "ScreenSizeFilter"
        assert filter_names[4] == "YearFilter"
        assert filter_names[5] == "CapacityFilter"

    def test_chip_variant_filter_first(self, engine):
        """Test: ChipVariantFilter es el primero (más específico)."""
        first_filter = engine.rules[0]
        assert first_filter.get_rule_name() == "ChipVariantFilter"

    def test_capacity_filter_last(self, engine):
        """Test: CapacityFilter es el último."""
        last_filter = engine.rules[-1]
        assert last_filter.get_rule_name() == "CapacityFilter"

    # ===========================
    # Tests: Integration with Real Components
    # ===========================

    def test_engine_initializes_all_components(self, engine):
        """Test: Engine inicializa todos los componentes."""
        assert engine.extractor is not None
        assert engine.knowledge_base is not None
        assert engine.matcher is not None
        assert len(engine.rules) == 6

    def test_extractor_is_macbook_extractor(self, engine):
        """Test: Extractor es MacBookFeatureExtractor."""
        from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
        assert isinstance(engine.extractor, MacBookFeatureExtractor)

    def test_kb_is_macbook_kb(self, engine):
        """Test: KB es MacBookKnowledgeBase."""
        from productos.mapping.knowledge.macbook_kb import MacBookKnowledgeBase
        assert isinstance(engine.knowledge_base, MacBookKnowledgeBase)

    def test_matcher_is_generation_matcher(self, engine):
        """Test: Matcher es GenerationMatcher (reutilizado)."""
        from productos.mapping.matchers.generation_matcher import GenerationMatcher
        assert isinstance(engine.matcher, GenerationMatcher)

    def test_all_rules_are_base_rule(self, engine):
        """Test: Todos los filtros heredan de BaseRule."""
        from productos.mapping.rules.base import BaseRule
        for rule in engine.rules:
            assert isinstance(rule, BaseRule)
