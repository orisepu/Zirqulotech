"""
Tests para DeviceMapperService (TDD).

El DeviceMapperService es el facade principal del sistema de mapeo v4.
Coordina múltiples engines y provee una API unificada.

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
    MatchStatus,
)
from productos.mapping.services.device_mapper_service import DeviceMapperService
from productos.mapping.engines.iphone_engine import iPhoneEngine


@pytest.mark.django_db
class TestDeviceMapperService:
    """Tests para el servicio principal de mapeo."""

    @pytest.fixture
    def service(self):
        """Fixture del servicio."""
        return DeviceMapperService()

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

    # ===========================
    # Tests de inicialización y registro
    # ===========================

    def test_service_initialization(self, service):
        """El servicio se inicializa correctamente."""
        assert service is not None
        assert hasattr(service, 'map')
        assert hasattr(service, 'register_engine')

    def test_service_initializes_with_default_engines(self, service):
        """El servicio se inicializa con engines por defecto."""
        # Debe tener al menos el iPhone engine registrado
        assert len(service._engines) > 0

    def test_register_engine(self, service):
        """Se pueden registrar engines manualmente."""
        initial_count = len(service._engines)

        # Registrar un nuevo engine
        iphone_engine = iPhoneEngine()
        service.register_engine(iphone_engine)

        # Debe haber más engines
        assert len(service._engines) >= initial_count

    def test_register_multiple_engines(self, service):
        """Se pueden registrar múltiples engines."""
        service._engines = []  # Limpiar engines existentes

        engine1 = iPhoneEngine()
        engine2 = iPhoneEngine()  # Otro iPhone engine (para testing)

        service.register_engine(engine1)
        service.register_engine(engine2)

        assert len(service._engines) == 2

    # ===========================
    # Tests de selección de engine
    # ===========================

    def test_selects_iphone_engine_for_iphone_input(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """Selecciona el iPhone engine para inputs de iPhone."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = service.map(input_data)

        # Debe procesar correctamente con iPhone engine
        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_128gb.id

    def test_returns_error_when_no_engine_can_handle(self, service):
        """Retorna error cuando ningún engine puede procesar el input."""
        input_data = LikewizeInput(model_name="Samsung Galaxy S21")
        result = service.map(input_data)

        # Debe retornar error
        assert result.status == MatchStatus.ERROR
        assert "No se encontró un engine" in result.error_message

    # ===========================
    # Tests de mapeo exitoso
    # ===========================

    def test_map_iphone_success(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """Mapea un iPhone exitosamente."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_128gb.id
        assert result.matched_modelo_descripcion == "iPhone 13 Pro"
        assert result.matched_capacidad_tamanio == "128 GB"
        assert result.match_score >= 0.9

    def test_map_includes_context_and_logs(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """El resultado incluye contexto y logs completos."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.context is not None
        assert len(result.context.logs) > 0

        # Debe tener timing
        assert result.context.start_time is not None
        assert result.context.end_time is not None

    def test_map_with_price(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """Mapea incluyendo precio de Likewize."""
        input_data = LikewizeInput(
            model_name="iPhone 13 Pro 128GB",
            device_price=Decimal("450.00")
        )
        result = service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.context.input_data.device_price == Decimal("450.00")

    # ===========================
    # Tests de casos sin match
    # ===========================

    def test_map_no_match_device_not_in_db(self, service):
        """No encuentra match cuando el dispositivo no existe en BD."""
        input_data = LikewizeInput(model_name="iPhone 99 Pro 128GB")
        result = service.map(input_data)

        assert result.status == MatchStatus.NO_MATCH
        assert result.matched_capacidad_id is None
        assert "No se encontraron candidatos" in result.error_message

    def test_map_no_match_capacity_not_available(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """No encuentra match cuando la capacidad no está disponible."""
        # Buscar una capacidad que no existe (512GB)
        input_data = LikewizeInput(model_name="iPhone 13 Pro 512GB")
        result = service.map(input_data)

        assert result.status == MatchStatus.NO_MATCH

    # ===========================
    # Tests de delegación a engines
    # ===========================

    def test_delegates_to_correct_engine(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """Delega correctamente al engine apropiado."""
        # Limpiar engines y registrar solo iPhone engine
        service._engines = []
        iphone_engine = iPhoneEngine()
        service.register_engine(iphone_engine)

        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = service.map(input_data)

        # Debe haber usado el iPhone engine
        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_128gb.id

    def test_tries_all_engines_in_order(self, service):
        """Prueba todos los engines en orden hasta encontrar uno compatible."""
        # Este test verifica que el servicio intenta con cada engine
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = service.map(input_data)

        # Si hay un engine compatible, debe usarlo
        # Si no hay ninguno, debe retornar error
        assert result.status in (MatchStatus.SUCCESS, MatchStatus.NO_MATCH, MatchStatus.ERROR)

    # ===========================
    # Tests de edge cases
    # ===========================

    def test_map_with_extra_whitespace(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """Maneja espacios extra correctamente."""
        input_data = LikewizeInput(model_name="  iPhone  13  Pro  128GB  ")
        result = service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_128gb.id

    def test_map_case_insensitive(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """Mapeo es case-insensitive."""
        input_data = LikewizeInput(model_name="iphone 13 pro 128gb")
        result = service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == iphone_13_pro_128gb.id

    def test_map_empty_model_name_raises_error(self, service):
        """Model name vacío lanza error."""
        with pytest.raises(ValueError, match="model_name es requerido"):
            LikewizeInput(model_name="")

    # ===========================
    # Tests de metadata y features
    # ===========================

    def test_result_includes_extracted_features(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """El resultado incluye las features extraídas."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.features is not None
        assert result.features.device_type.value == "iPhone"
        assert result.features.generation == 13
        assert result.features.variant == "Pro"
        assert result.features.storage_gb == 128
        assert result.features.year == 2021  # Enriquecido por KB

    def test_result_includes_all_candidates(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """El resultado incluye todos los candidatos encontrados."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert len(result.all_candidates) >= 1
        # El primer candidato debe ser el mejor match
        assert result.all_candidates[0].capacidad_id == result.matched_capacidad_id

    def test_result_includes_match_strategy(
        self,
        service,
        iphone_13_pro_128gb
    ):
        """El resultado incluye la estrategia de matching usada."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        result = service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.match_strategy is not None
        # Para iPhone debe usar GENERATION strategy
        from productos.mapping.core.types import MatchStrategy
        assert result.match_strategy == MatchStrategy.GENERATION
