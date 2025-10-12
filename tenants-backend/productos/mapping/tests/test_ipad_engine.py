"""
Tests para iPadEngine (TDD).

El iPad Engine orquesta el proceso completo de mapeo:
1. Extractor: LikewizeInput → ExtractedFeatures
2. Knowledge Base: Enriquecer con año/CPU
3. Matcher: Buscar candidatos en BD
4. Rules: Filtrar candidatos (ConnectivityFilter, ScreenSizeFilter, etc.)
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
from productos.mapping.engines.ipad_engine import iPadEngine


@pytest.mark.django_db
class TestiPadEngine:
    """Tests para el engine de mapeo de iPad."""

    @pytest.fixture
    def engine(self):
        """Fixture del engine."""
        return iPadEngine()

    # ===========================
    # Fixtures de modelos iPad Pro
    # ===========================

    @pytest.fixture
    def ipad_pro_12_9_m2_model(self):
        """Modelo iPad Pro 12.9\" M2 en BD."""
        return Modelo.objects.create(
            descripcion="iPad Pro 12.9-inch (6th generation)",
            tipo="iPad Pro",
            marca="Apple",
            año=2022,
            procesador="M2"
        )

    @pytest.fixture
    def ipad_pro_12_9_m2_wifi_256gb(self, ipad_pro_12_9_m2_model):
        """Capacidad iPad Pro 12.9\" M2 Wi-Fi 256GB."""
        return Capacidad.objects.create(
            modelo=ipad_pro_12_9_m2_model,
            tamaño="256 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_pro_12_9_m2_cellular_256gb(self, ipad_pro_12_9_m2_model):
        """Capacidad iPad Pro 12.9\" M2 Cellular 256GB."""
        modelo_cellular = Modelo.objects.create(
            descripcion="iPad Pro 12.9-inch (6th generation) Cellular",
            tipo="iPad Pro",
            marca="Apple",
            año=2022,
            procesador="M2"
        )
        return Capacidad.objects.create(
            modelo=modelo_cellular,
            tamaño="256 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_pro_11_m4_model(self):
        """Modelo iPad Pro 11\" M4 en BD."""
        return Modelo.objects.create(
            descripcion="iPad Pro 11-inch M4",
            tipo="iPad Pro",
            marca="Apple",
            año=2024,
            procesador="M4"
        )

    @pytest.fixture
    def ipad_pro_11_m4_wifi_512gb(self, ipad_pro_11_m4_model):
        """Capacidad iPad Pro 11\" M4 Wi-Fi 512GB."""
        return Capacidad.objects.create(
            modelo=ipad_pro_11_m4_model,
            tamaño="512 GB",
            activo=True
        )

    # ===========================
    # Fixtures de modelos iPad Air
    # ===========================

    @pytest.fixture
    def ipad_air_6_m2_model(self):
        """Modelo iPad Air 6 M2 en BD."""
        return Modelo.objects.create(
            descripcion="iPad Air 11-inch (6th generation)",
            tipo="iPad Air",
            marca="Apple",
            año=2024,
            procesador="M2"
        )

    @pytest.fixture
    def ipad_air_6_m2_wifi_128gb(self, ipad_air_6_m2_model):
        """Capacidad iPad Air 6 M2 Wi-Fi 128GB."""
        return Capacidad.objects.create(
            modelo=ipad_air_6_m2_model,
            tamaño="128 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_air_6_m2_wifi_256gb(self, ipad_air_6_m2_model):
        """Capacidad iPad Air 6 M2 Wi-Fi 256GB."""
        return Capacidad.objects.create(
            modelo=ipad_air_6_m2_model,
            tamaño="256 GB",
            activo=True
        )

    # ===========================
    # Fixtures de modelos iPad mini
    # ===========================

    @pytest.fixture
    def ipad_mini_7_model(self):
        """Modelo iPad mini 7 en BD."""
        return Modelo.objects.create(
            descripcion="iPad mini (7th generation)",
            tipo="iPad mini",
            marca="Apple",
            año=2024,
            procesador="A17 Pro"
        )

    @pytest.fixture
    def ipad_mini_7_wifi_128gb(self, ipad_mini_7_model):
        """Capacidad iPad mini 7 Wi-Fi 128GB."""
        return Capacidad.objects.create(
            modelo=ipad_mini_7_model,
            tamaño="128 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_mini_7_cellular_256gb(self, ipad_mini_7_model):
        """Capacidad iPad mini 7 Cellular 256GB."""
        modelo_cellular = Modelo.objects.create(
            descripcion="iPad mini (7th generation) Cellular",
            tipo="iPad mini",
            marca="Apple",
            año=2024,
            procesador="A17 Pro"
        )
        return Capacidad.objects.create(
            modelo=modelo_cellular,
            tamaño="256 GB",
            activo=True
        )

    # ===========================
    # Fixtures de modelos iPad regular
    # ===========================

    @pytest.fixture
    def ipad_10_model(self):
        """Modelo iPad 10 en BD."""
        return Modelo.objects.create(
            descripcion="iPad (10th generation)",
            tipo="iPad",
            marca="Apple",
            año=2022,
            procesador="A14 Bionic"
        )

    @pytest.fixture
    def ipad_10_wifi_64gb(self, ipad_10_model):
        """Capacidad iPad 10 Wi-Fi 64GB."""
        return Capacidad.objects.create(
            modelo=ipad_10_model,
            tamaño="64 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_10_wifi_256gb(self, ipad_10_model):
        """Capacidad iPad 10 Wi-Fi 256GB."""
        return Capacidad.objects.create(
            modelo=ipad_10_model,
            tamaño="256 GB",
            activo=True
        )

    # ===========================
    # Tests de can_handle
    # ===========================

    def test_can_handle_ipad_pro(self, engine):
        """Puede manejar inputs de iPad Pro."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        assert engine.can_handle(input_data) is True

    def test_can_handle_ipad_air(self, engine):
        """Puede manejar inputs de iPad Air."""
        input_data = LikewizeInput(model_name="iPad Air 11-inch (M2) Wi-Fi 128GB")
        assert engine.can_handle(input_data) is True

    def test_can_handle_ipad_mini(self, engine):
        """Puede manejar inputs de iPad mini."""
        input_data = LikewizeInput(model_name="iPad mini 7 Cellular 256GB")
        assert engine.can_handle(input_data) is True

    def test_can_handle_ipad_regular(self, engine):
        """Puede manejar inputs de iPad regular."""
        input_data = LikewizeInput(model_name="iPad 10 Wi-Fi 64GB")
        assert engine.can_handle(input_data) is True

    def test_can_handle_ipad_case_insensitive(self, engine):
        """Puede manejar iPad en minúsculas."""
        input_data = LikewizeInput(model_name="ipad pro 11-inch m4 wi-fi 512gb")
        assert engine.can_handle(input_data) is True

    def test_cannot_handle_iphone(self, engine):
        """No puede manejar iPhone."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        assert engine.can_handle(input_data) is False

    def test_cannot_handle_macbook(self, engine):
        """No puede manejar MacBook."""
        input_data = LikewizeInput(model_name="MacBook Pro 14 M3")
        assert engine.can_handle(input_data) is False

    # ===========================
    # Tests de map (iPad Pro - success cases)
    # ===========================

    def test_map_ipad_pro_12_9_m2_wifi_exact_match(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """Mapea iPad Pro 12.9\" M2 Wi-Fi 256GB correctamente (match exacto)."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        result = engine.map(input_data)

        # Status SUCCESS
        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_pro_12_9_m2_wifi_256gb.id
        assert result.matched_modelo_id == ipad_pro_12_9_m2_wifi_256gb.modelo.id

        # Score alto (match exacto)
        assert result.match_score >= 0.9

        # Features extraídas correctamente
        assert result.features.variant == "Pro"
        assert result.features.screen_size == 12.9
        assert result.features.cpu == "M2"
        assert result.features.has_wifi is True
        assert result.features.has_cellular is False
        assert result.features.storage_gb == 256
        assert result.features.year == 2022  # Enriquecido por KB

    def test_map_ipad_pro_11_m4_wifi(
        self,
        engine,
        ipad_pro_11_m4_wifi_512gb
    ):
        """Mapea iPad Pro 11\" M4 Wi-Fi 512GB correctamente."""
        input_data = LikewizeInput(model_name="iPad Pro 11-inch M4 Wi-Fi 512GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_pro_11_m4_wifi_512gb.id
        assert result.match_score >= 0.9

    # ===========================
    # Tests de filtrado por conectividad
    # ===========================

    def test_map_filters_by_connectivity_wifi(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb,
        ipad_pro_12_9_m2_cellular_256gb
    ):
        """Filtra correctamente por conectividad (Wi-Fi vs Cellular)."""
        # Buscar Wi-Fi
        input_wifi = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        result_wifi = engine.map(input_wifi)

        assert result_wifi.status == MatchStatus.SUCCESS
        assert "Wi-Fi" in result_wifi.matched_modelo_descripcion or "Cellular" not in result_wifi.matched_modelo_descripcion

        # Buscar Cellular
        input_cellular = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Cellular 256GB")
        result_cellular = engine.map(input_cellular)

        assert result_cellular.status == MatchStatus.SUCCESS
        assert "Cellular" in result_cellular.matched_modelo_descripcion

    # ===========================
    # Tests de filtrado por tamaño de pantalla
    # ===========================

    def test_map_filters_by_screen_size(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb,
        ipad_pro_11_m4_wifi_512gb
    ):
        """Filtra correctamente por tamaño de pantalla."""
        # Buscar 12.9"
        input_12_9 = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        result_12_9 = engine.map(input_12_9)

        assert result_12_9.status == MatchStatus.SUCCESS
        assert "12.9" in result_12_9.matched_modelo_descripcion

        # Buscar 11"
        input_11 = LikewizeInput(model_name="iPad Pro 11-inch M4 Wi-Fi 512GB")
        result_11 = engine.map(input_11)

        assert result_11.status == MatchStatus.SUCCESS
        assert "11" in result_11.matched_modelo_descripcion

    # ===========================
    # Tests de map (iPad Air - success cases)
    # ===========================

    def test_map_ipad_air_6_m2_wifi_128gb(
        self,
        engine,
        ipad_air_6_m2_wifi_128gb
    ):
        """Mapea iPad Air 6 M2 Wi-Fi 128GB correctamente."""
        input_data = LikewizeInput(model_name="iPad Air 11-inch (M2) Wi-Fi 128GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_air_6_m2_wifi_128gb.id
        assert result.match_score >= 0.9

        # Features
        assert result.features.variant == "Air"
        assert result.features.cpu == "M2"
        assert result.features.storage_gb == 128
        assert result.features.year == 2024

    def test_map_ipad_air_filters_by_capacity(
        self,
        engine,
        ipad_air_6_m2_wifi_128gb,
        ipad_air_6_m2_wifi_256gb
    ):
        """Filtra correctamente por capacidad (128GB vs 256GB)."""
        # Buscar 128GB
        input_128 = LikewizeInput(model_name="iPad Air 11-inch (M2) Wi-Fi 128GB")
        result_128 = engine.map(input_128)

        assert result_128.status == MatchStatus.SUCCESS
        assert result_128.matched_capacidad_id == ipad_air_6_m2_wifi_128gb.id

        # Buscar 256GB
        input_256 = LikewizeInput(model_name="iPad Air 11-inch (M2) Wi-Fi 256GB")
        result_256 = engine.map(input_256)

        assert result_256.status == MatchStatus.SUCCESS
        assert result_256.matched_capacidad_id == ipad_air_6_m2_wifi_256gb.id

    # ===========================
    # Tests de map (iPad mini - success cases)
    # ===========================

    def test_map_ipad_mini_7_wifi_128gb(
        self,
        engine,
        ipad_mini_7_wifi_128gb
    ):
        """Mapea iPad mini 7 Wi-Fi 128GB correctamente."""
        input_data = LikewizeInput(model_name="iPad mini 7 Wi-Fi 128GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_mini_7_wifi_128gb.id
        assert result.match_score >= 0.9

        # Features
        assert result.features.variant == "mini"
        assert result.features.generation == 7
        assert result.features.storage_gb == 128
        assert result.features.year == 2024

    def test_map_ipad_mini_7_cellular_256gb(
        self,
        engine,
        ipad_mini_7_cellular_256gb
    ):
        """Mapea iPad mini 7 Cellular 256GB correctamente."""
        input_data = LikewizeInput(model_name="iPad mini 7 Cellular 256GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_mini_7_cellular_256gb.id
        assert result.features.has_cellular is True

    # ===========================
    # Tests de map (iPad regular - success cases)
    # ===========================

    def test_map_ipad_10_wifi_64gb(
        self,
        engine,
        ipad_10_wifi_64gb
    ):
        """Mapea iPad 10 Wi-Fi 64GB correctamente."""
        input_data = LikewizeInput(model_name="iPad 10 Wi-Fi 64GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_10_wifi_64gb.id
        assert result.match_score >= 0.9

        # Features
        assert result.features.variant is None  # iPad regular no tiene variante
        assert result.features.generation == 10
        assert result.features.storage_gb == 64
        assert result.features.year == 2022

    def test_map_ipad_10_filters_by_capacity(
        self,
        engine,
        ipad_10_wifi_64gb,
        ipad_10_wifi_256gb
    ):
        """Filtra correctamente por capacidad (64GB vs 256GB)."""
        # Buscar 64GB
        input_64 = LikewizeInput(model_name="iPad 10 Wi-Fi 64GB")
        result_64 = engine.map(input_64)

        assert result_64.status == MatchStatus.SUCCESS
        assert result_64.matched_capacidad_id == ipad_10_wifi_64gb.id

        # Buscar 256GB
        input_256 = LikewizeInput(model_name="iPad 10 Wi-Fi 256GB")
        result_256 = engine.map(input_256)

        assert result_256.status == MatchStatus.SUCCESS
        assert result_256.matched_capacidad_id == ipad_10_wifi_256gb.id

    # ===========================
    # Tests de map (no match cases)
    # ===========================

    def test_map_no_match_when_device_not_in_db(self, engine):
        """No encuentra match cuando el dispositivo no existe en BD."""
        input_data = LikewizeInput(model_name="iPad Pro 15-inch M5 Wi-Fi 1TB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.NO_MATCH
        assert result.matched_capacidad_id is None
        assert result.matched_modelo_id is None
        assert len(result.all_candidates) == 0
        assert "No se encontraron candidatos" in result.error_message

    def test_map_no_match_when_capacity_not_available(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """No encuentra match cuando la capacidad no está disponible."""
        # Buscar una capacidad que no existe (1TB)
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 1TB")
        result = engine.map(input_data)

        # Debería no encontrar match (no hay 1TB para este modelo)
        assert result.status == MatchStatus.NO_MATCH

    def test_map_no_match_when_screen_size_mismatch(
        self,
        engine,
        ipad_pro_11_m4_wifi_512gb
    ):
        """No encuentra match cuando el tamaño de pantalla no coincide."""
        # Buscar 13" cuando solo hay 11" en BD
        input_data = LikewizeInput(model_name="iPad Pro 13-inch M4 Wi-Fi 512GB")
        result = engine.map(input_data)

        # Debería no encontrar match por tamaño
        assert result.status == MatchStatus.NO_MATCH

    # ===========================
    # Tests de context y logging
    # ===========================

    def test_map_includes_context_logs(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """El resultado incluye logs del contexto."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
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
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """El resultado incluye tiempo de ejecución."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        result = engine.map(input_data)

        # Debe tener tiempo de ejecución > 0
        assert result.context.start_time is not None
        assert result.context.end_time is not None
        assert result.context.end_time >= result.context.start_time

    def test_map_includes_all_candidates(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """Incluye todos los candidatos en el resultado."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        # Debe tener al menos 1 candidato (el matched)
        assert len(result.all_candidates) >= 1
        # El primer candidato debe ser el mejor match
        assert result.all_candidates[0].capacidad_id == result.matched_capacidad_id

    # ===========================
    # Tests de edge cases
    # ===========================

    def test_map_handles_extra_whitespace(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """Maneja espacios extra correctamente."""
        input_data = LikewizeInput(model_name="  iPad  Pro  12.9-inch  M2  Wi-Fi  256GB  ")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_pro_12_9_m2_wifi_256gb.id

    def test_map_handles_case_variations(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """Maneja variaciones de mayúsculas/minúsculas."""
        input_data = LikewizeInput(model_name="ipad pro 12.9-inch m2 wi-fi 256gb")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_pro_12_9_m2_wifi_256gb.id

    def test_map_with_spanish_format(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """Maneja formato español (pulgadas, coma decimal)."""
        input_data = LikewizeInput(model_name="iPad Pro 12,9 pulgadas M2 Wi-Fi 256GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.matched_capacidad_id == ipad_pro_12_9_m2_wifi_256gb.id

    def test_map_with_likewize_price(
        self,
        engine,
        ipad_pro_12_9_m2_wifi_256gb
    ):
        """Incluye el precio de Likewize si está disponible."""
        input_data = LikewizeInput(
            model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB",
            device_price=Decimal("600.00")
        )
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        # El input debe tener el precio
        assert result.context.input_data.device_price == Decimal("600.00")

    def test_map_with_ordinal_generation_format(
        self,
        engine,
        ipad_10_wifi_64gb
    ):
        """Maneja formato de generación ordinal."""
        input_data = LikewizeInput(model_name="iPad (10.ª generación) Wi-Fi 64GB")
        result = engine.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert result.features.generation == 10
