"""
Tests para iPhoneEngine (TDD).

El iPhone Engine orquesta el proceso completo de mapeo:
1. Extractor: LikewizeInput → ExtractedFeatures
2. Knowledge Base: Enriquecer con año/CPU
3. Matcher: Buscar candidatos en BD
4. Rules: Filtrar candidatos
5. Resultado: MatchResult

Tests escritos PRIMERO siguiendo TDD:
- RED: Tests fallan (no existe implementación)
- GREEN: Implementar mínimo para que pasen
- REFACTOR: Mejorar código sin romper tests
"""

import pytest
from decimal import Decimal

from productos.models.modelos import Modelo, Capacidad
from productos.mapping.core.types import (
    LikewizeInput,
    MappingContext,
    MatchStatus,
)
from productos.mapping.engines.iphone_engine import iPhoneEngine


@pytest.mark.django_db
class TestiPhoneEngine:
    """Tests para el engine de mapeo de iPhone."""

    @pytest.fixture
    def engine(self):
        """Fixture del engine."""
        return iPhoneEngine()

    @pytest.fixture
    def iphone_13_pro_model(self):
        """Modelo iPhone 13 Pro en BD."""
        return Modelo.objects.create(
            descripcion="iPhone 13 Pro",
            tipo="iPhone",
            marca="Apple",
            año=2021,
            procesador="A15 Bionic"
        )

    @pytest.fixture
    def iphone_13_pro_128gb(self, iphone_13_pro_model):
        """Capacidad iPhone 13 Pro 128GB."""
        return Capacidad.objects.create(
            modelo=iphone_13_pro_model,
            tamaño="128 GB",
            activo=True
        )

    @pytest.fixture
    def iphone_13_pro_256gb(self, iphone_13_pro_model):
        """Capacidad iPhone 13 Pro 256GB."""
        return Capacidad.objects.create(
            modelo=iphone_13_pro_model,
            tamaño="256 GB",
            activo=True
        )

    @pytest.fixture
    def iphone_13_model(self):
        """Modelo iPhone 13 regular en BD."""
        return Modelo.objects.create(
            descripcion="iPhone 13",
            tipo="iPhone",
            marca="Apple",
            año=2021,
            procesador="A15 Bionic"
        )

    @pytest.fixture
    def iphone_13_128gb(self, iphone_13_model):
        """Capacidad iPhone 13 regular 128GB."""
        return Capacidad.objects.create(
            modelo=iphone_13_model,
            tamaño="128 GB",
            activo=True
        )

    # ===========================
    # Tests de can_handle
    # ===========================

    def test_can_handle_iphone(self, engine):
        """Puede manejar inputs de iPhone."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        assert engine.can_handle(input_data) is True

    def test_can_handle_iphone_case_insensitive(self, engine):
        """Puede manejar iPhone en minúsculas."""
        input_data = LikewizeInput(model_name="iphone 13 pro 128gb")
        assert engine.can_handle(input_data) is True

    def test_cannot_handle_ipad(self, engine):
        """No puede manejar iPad."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9 256GB")
        assert engine.can_handle(input_data) is False

    def test_cannot_handle_macbook(self, engine):
        """No puede manejar MacBook."""
        input_data = LikewizeInput(model_name="MacBook Pro 14 M3")
        assert engine.can_handle(input_data) is False

    # ===========================
    # Tests de map (success cases)
    # ===========================

    def test_map_iphone_13_pro_128gb_exact_match(
        self,
        engine,
        iphone_13_pro_128gb
    ):
        """Mapea iPhone 13 Pro 128GB correctamente (match exacto)."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = engine.map(input_data)

        # Status SUCCESS
        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_128gb.id
        assert result.matched_modelo_id == iphone_13_pro_128gb.modelo.id

        # Score alto (match exacto)
        assert result.match_score >= 0.9

        # Features extraídas correctamente
        assert result.features.device_type.value == "iPhone"
        assert result.features.generation == 13
        assert result.features.variant == "Pro"
        assert result.features.storage_gb == 128
        assert result.features.year == 2021  # Enriquecido por KB

    def test_map_iphone_13_pro_256gb(
        self,
        engine,
        iphone_13_pro_256gb
    ):
        """Mapea iPhone 13 Pro 256GB correctamente."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 256GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_256gb.id
        assert result.match_score >= 0.9

    def test_map_filters_by_capacity(
        self,
        engine,
        iphone_13_pro_128gb,
        iphone_13_pro_256gb
    ):
        """Filtra correctamente por capacidad (128GB vs 256GB)."""
        # Buscar 128GB
        input_128 = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result_128 = engine.map(input_128)

        assert result_128.status == MatchStatus.SUCCESS
        assert result_128.matched_capacidad_id == iphone_13_pro_128gb.id

        # Buscar 256GB
        input_256 = LikewizeInput(model_name="iPhone 13 Pro 256GB")
        result_256 = engine.map(input_256)

        assert result_256.status == MatchStatus.SUCCESS
        assert result_256.matched_capacidad_id == iphone_13_pro_256gb.id

    def test_map_filters_by_variant(
        self,
        engine,
        iphone_13_pro_128gb,
        iphone_13_128gb
    ):
        """Filtra correctamente por variante (Pro vs regular)."""
        # Buscar Pro
        input_pro = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result_pro = engine.map(input_pro)

        assert result_pro.status == MatchStatus.SUCCESS
        assert "Pro" in result_pro.matched_modelo_descripcion
        assert result_pro.matched_capacidad_id == iphone_13_pro_128gb.id

        # Buscar regular (sin Pro)
        input_regular = LikewizeInput(model_name="iPhone 13 128GB")
        result_regular = engine.map(input_regular)

        assert result_regular.status == MatchStatus.SUCCESS
        assert "Pro" not in result_regular.matched_modelo_descripcion
        assert result_regular.matched_capacidad_id == iphone_13_128gb.id

    def test_map_includes_all_candidates(
        self,
        engine,
        iphone_13_pro_128gb,
        iphone_13_pro_256gb
    ):
        """Incluye todos los candidatos en el resultado."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        # Debe tener al menos 1 candidato (el matched)
        assert len(result.all_candidates) >= 1
        # El primer candidato debe ser el mejor match
        assert result.all_candidates[0].capacidad_id == result.matched_capacidad_id

    # ===========================
    # Tests de map (no match cases)
    # ===========================

    def test_map_no_match_when_device_not_in_db(self, engine):
        """No encuentra match cuando el dispositivo no existe en BD."""
        input_data = LikewizeInput(model_name="iPhone 99 Pro 128GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.NO_MATCH
        assert result.matched_capacidad_id is None
        assert result.matched_modelo_id is None
        assert len(result.all_candidates) == 0
        assert "No se encontraron candidatos" in result.error_message

    def test_map_no_match_when_capacity_not_available(
        self,
        engine,
        iphone_13_pro_128gb
    ):
        """No encuentra match cuando la capacidad no está disponible."""
        # Buscar una capacidad que no existe (512GB)
        input_data = LikewizeInput(model_name="iPhone 13 Pro 512GB")
        result = engine.map(input_data)

        # Debería no encontrar match (no hay 512GB)
        assert result.status == MatchStatus.NO_MATCH

    # ===========================
    # Tests de context y logging
    # ===========================

    def test_map_includes_context_logs(
        self,
        engine,
        iphone_13_pro_128gb
    ):
        """El resultado incluye logs del contexto."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = engine.map(input_data)

        # Context debe tener logs
        assert len(result.context.logs) > 0

        # Debe tener logs de cada fase
        log_text = " ".join([log.message for log in result.context.logs])
        assert "Extrayendo features" in log_text or "features" in log_text.lower()
        assert "candidatos" in log_text.lower()

    def test_map_includes_execution_time(
        self,
        engine,
        iphone_13_pro_128gb
    ):
        """El resultado incluye tiempo de ejecución."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = engine.map(input_data)

        # Debe tener tiempo de ejecución > 0
        assert result.context.start_time is not None
        assert result.context.end_time is not None
        assert result.context.end_time >= result.context.start_time

    # ===========================
    # Tests de edge cases
    # ===========================

    def test_map_handles_extra_whitespace(
        self,
        engine,
        iphone_13_pro_128gb
    ):
        """Maneja espacios extra correctamente."""
        input_data = LikewizeInput(model_name="  iPhone  13  Pro  128GB  ")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_128gb.id

    def test_map_handles_case_variations(
        self,
        engine,
        iphone_13_pro_128gb
    ):
        """Maneja variaciones de mayúsculas/minúsculas."""
        input_data = LikewizeInput(model_name="iphone 13 pro 128gb")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_128gb.id

    def test_map_with_likewize_price(
        self,
        engine,
        iphone_13_pro_128gb
    ):
        """Incluye el precio de Likewize si está disponible."""
        input_data = LikewizeInput(
            model_name="iPhone 13 Pro 128GB",
            device_price=Decimal("500.00")
        )
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        # El input debe tener el precio
        assert result.context.input_data.device_price == Decimal("500.00")
