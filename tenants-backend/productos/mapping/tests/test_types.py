"""
Tests para los tipos base del sistema de mapeo v4.

Valida que los DTOs y tipos se comporten correctamente.
"""

import pytest
from decimal import Decimal

from productos.mapping.core.types import (
    LikewizeInput,
    ExtractedFeatures,
    MatchCandidate,
    MatchResult,
    MappingContext,
    DeviceType,
    MatchStrategy,
    MatchStatus,
)
from productos.mapping.core.exceptions import InvalidInputError


class TestLikewizeInput:
    """Tests para LikewizeInput DTO."""

    def test_valid_input_creation(self):
        """Test que se puede crear un input válido."""
        input_data = LikewizeInput(
            model_name="iPhone 13 Pro 128GB",
            m_model="MLVD3QL/A"
        )
        assert input_data.model_name == "iPhone 13 Pro 128GB"
        assert input_data.m_model == "MLVD3QL/A"
        assert input_data.brand_name == "Apple"  # Default

    def test_empty_model_name_raises_error(self):
        """Test que model_name vacío lanza error."""
        with pytest.raises(ValueError, match="model_name es requerido"):
            LikewizeInput(model_name="")

    def test_immutability(self):
        """Test que LikewizeInput es inmutable (frozen)."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro")
        with pytest.raises(Exception):  # FrozenInstanceError en Python 3.10+
            input_data.model_name = "Modified"


class TestExtractedFeatures:
    """Tests para ExtractedFeatures."""

    def test_default_features(self):
        """Test valores por defecto de features."""
        features = ExtractedFeatures()
        assert features.device_type is None
        assert features.generation is None
        assert features.storage_gb is None
        assert features.extraction_confidence == 0.0
        assert len(features.extraction_notes) == 0

    def test_add_note(self):
        """Test agregar notas de extracción."""
        features = ExtractedFeatures()
        features.add_note("Generation detected: 13")
        features.add_note("Year inferred from KB: 2021")

        assert len(features.extraction_notes) == 2
        assert "Generation detected: 13" in features.extraction_notes

    def test_to_dict(self):
        """Test serialización a diccionario."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            storage_gb=128,
            variant="Pro",
            cpu="A15 Bionic",
            extraction_confidence=0.95
        )

        result = features.to_dict()
        assert result["device_type"] == "iPhone"
        assert result["generation"] == 13
        assert result["year"] == 2021
        assert result["storage_gb"] == 128
        assert result["variant"] == "Pro"
        assert result["cpu"] == "A15 Bionic"
        assert result["confidence"] == 0.95


class TestMatchCandidate:
    """Tests para MatchCandidate."""

    def test_candidate_ordering(self):
        """Test que los candidatos se ordenan por score."""
        candidate1 = MatchCandidate(
            capacidad_id=1,
            modelo_id=1,
            modelo_descripcion="iPhone 13",
            capacidad_tamanio="128 GB",
            match_score=0.85
        )
        candidate2 = MatchCandidate(
            capacidad_id=2,
            modelo_id=2,
            modelo_descripcion="iPhone 13 Pro",
            capacidad_tamanio="128 GB",
            match_score=0.95
        )

        candidates = sorted([candidate1, candidate2])

        # El de mayor score debe estar primero
        assert candidates[0].match_score == 0.95
        assert candidates[1].match_score == 0.85


class TestMatchResult:
    """Tests para MatchResult."""

    def test_successful_result(self):
        """Test resultado exitoso."""
        result = MatchResult(
            status=MatchStatus.SUCCESS,
            matched_capacidad_id=123,
            matched_modelo_id=45,
            match_score=0.98,
            match_strategy=MatchStrategy.GENERATION
        )

        assert result.success is True
        assert result.status == MatchStatus.SUCCESS
        assert result.capacidad_id == 123  # Property de compatibilidad
        assert result.matched_capacidad_id == 123
        assert result.match_score == 0.98
        assert result.error_message is None

    def test_failed_result(self):
        """Test resultado fallido."""
        result = MatchResult(
            status=MatchStatus.NO_MATCH,
            error_message="No se encontraron candidatos",
            error_code="NO_CANDIDATES"
        )

        assert result.success is False
        assert result.status == MatchStatus.NO_MATCH
        assert result.capacidad_id is None
        assert "No se encontraron" in result.error_message

    def test_legacy_properties(self):
        """Test propiedades de compatibilidad con código legacy."""
        result = MatchResult(
            status=MatchStatus.SUCCESS,
            matched_capacidad_id=123,
            matched_modelo_id=45
        )

        # Properties de compatibilidad
        assert result.success is True
        assert result.capacidad_id == 123
        assert result.modelo_id == 45

    def test_to_dict(self):
        """Test serialización de resultado."""
        features = ExtractedFeatures(generation=13, year=2021)
        candidate1 = MatchCandidate(
            capacidad_id=123,
            modelo_id=45,
            modelo_descripcion="iPhone 13 Pro",
            capacidad_tamanio="128 GB",
            match_score=0.95
        )
        result = MatchResult(
            status=MatchStatus.SUCCESS,
            matched_capacidad_id=123,
            match_score=0.95,
            match_strategy=MatchStrategy.GENERATION,
            features=features,
            all_candidates=[candidate1]
        )

        result_dict = result.to_dict()
        assert result_dict["status"] == "success"
        assert result_dict["success"] is True
        assert result_dict["matched_capacidad_id"] == 123
        assert result_dict["match_score"] == 0.95
        assert result_dict["match_strategy"] == "generation"
        assert result_dict["candidates_found"] == 1
        assert result_dict["features"]["generation"] == 13


class TestMappingContext:
    """Tests para MappingContext."""

    def test_logging(self):
        """Test que el logging funciona correctamente."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro")
        context = MappingContext(input_data=input_data)

        context.info("Starting extraction")
        context.debug("Found generation: 13")
        context.warning("No A-number found")
        context.error("Match failed")

        assert len(context.logs) == 4
        assert context.logs[0].level == "INFO"
        assert context.logs[1].level == "DEBUG"
        assert context.logs[2].level == "WARNING"
        assert context.logs[3].level == "ERROR"

        # Verificar mensajes
        assert "Starting extraction" in context.logs[0].message
        assert "generation: 13" in context.logs[1].message

    def test_metadata(self):
        """Test almacenar metadata."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro")
        context = MappingContext(input_data=input_data)

        context.set_metadata("extractor_version", "1.0")
        context.set_metadata("extraction_time_ms", 15.5)

        assert context.metadata["extractor_version"] == "1.0"
        assert context.metadata["extraction_time_ms"] == 15.5

    def test_get_logs_text(self):
        """Test obtener logs como texto."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro")
        context = MappingContext(input_data=input_data)

        context.info("Log 1")
        context.info("Log 2")

        logs_text = context.get_logs_text()
        assert "Log 1" in logs_text
        assert "Log 2" in logs_text
        assert "\n" in logs_text  # Logs separados por newline
