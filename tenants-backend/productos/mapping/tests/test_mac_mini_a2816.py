"""
Tests para Mac mini A2816 - Verificar CPU/GPU cores filtering.

Este test verifica que el sistema v4 puede diferenciar correctamente entre:
- Mac mini M2 (10-core CPU, 16-core GPU) - A2816
- Mac mini M2 Pro (12-core CPU, 19-core GPU) - A2816

Ambos comparten el mismo A-number (A2816), por lo que es crítico usar
CPUCoresFilter y GPUCoresFilter para distinguirlos.
"""

import pytest
from productos.mapping.services.device_mapper_service import DeviceMapperService
from productos.mapping.core.types import LikewizeInput, MatchStatus


class TestMacMiniA2816:
    """Tests para Mac mini A2816 mapping."""

    @pytest.fixture
    def mapper_service(self):
        """Fixture que provee el servicio de mapeo."""
        return DeviceMapperService()

    # ===========================
    # Tests: Mac mini M2 base (10-core CPU, 16-core GPU)
    # ===========================

    def test_mac_mini_m2_base_10_core_cpu_16_core_gpu(self, mapper_service):
        """
        Test: Mac mini M2 base con 10-core CPU y 16-core GPU.

        Input de Likewize:
        "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"

        Debe mapear a M2 base (NO M2 Pro).
        """
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
        )

        result = mapper_service.map(input_data)

        # Verificar que el mapeo fue exitoso
        assert result.status == MatchStatus.SUCCESS, \
            f"Mapeo falló: {result.error_message}"

        # Verificar que NO es M2 Pro (12-core CPU)
        assert result.matched_modelo_descripcion is not None
        assert "M2 Pro" not in result.matched_modelo_descripcion, \
            f"Mapeó incorrectamente a M2 Pro: {result.matched_modelo_descripcion}"

        # Verificar que es M2 base
        # El modelo debería contener "M2" pero NO "M2 Pro"
        assert "M2" in result.matched_modelo_descripcion
        assert result.matched_capacidad_tamanio == "512 GB"

        # Verificar que usó v4 system (no traditional_fallback)
        assert result.match_strategy is not None
        # El algoritmo debería ser "generation" o similar, NO "traditional_fallback"
        assert "traditional" not in result.match_strategy.value.lower(), \
            f"Usó traditional fallback en lugar de v4: {result.match_strategy.value}"

        # Verificar confidence score alto (> 85%)
        assert result.match_score > 0.85, \
            f"Confidence score muy bajo: {result.match_score}"

        # Verificar que el contexto tiene logs de CPU/GPU cores
        logs = "\n".join(result.context.logs)
        assert "10" in logs or "cpu_cores" in logs.lower(), \
            "No se detectaron los 10 CPU cores en los logs"
        assert "16" in logs or "gpu_cores" in logs.lower(), \
            "No se detectaron los 16 GPU cores en los logs"

    def test_mac_mini_m2_base_256gb(self, mapper_service):
        """Test: Mac mini M2 base con 256GB."""
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 256GB SSD"
        )

        result = mapper_service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert "M2 Pro" not in result.matched_modelo_descripcion
        assert result.matched_capacidad_tamanio == "256 GB"

    def test_mac_mini_m2_base_1tb(self, mapper_service):
        """Test: Mac mini M2 base con 1TB."""
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 1TB SSD"
        )

        result = mapper_service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert "M2 Pro" not in result.matched_modelo_descripcion
        assert result.matched_capacidad_tamanio == "1 TB"

    # ===========================
    # Tests: Mac mini M2 Pro (12-core CPU, 19-core GPU)
    # ===========================

    def test_mac_mini_m2_pro_12_core_cpu_19_core_gpu(self, mapper_service):
        """
        Test: Mac mini M2 Pro con 12-core CPU y 19-core GPU.

        Input de Likewize:
        "Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 512GB SSD"

        Debe mapear a M2 Pro (NO M2 base).
        """
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 512GB SSD"
        )

        result = mapper_service.map(input_data)

        # Verificar que el mapeo fue exitoso
        assert result.status == MatchStatus.SUCCESS

        # Verificar que SÍ es M2 Pro
        assert "M2 Pro" in result.matched_modelo_descripcion, \
            f"No mapeó a M2 Pro: {result.matched_modelo_descripcion}"

        assert result.matched_capacidad_tamanio == "512 GB"

        # Verificar confidence score alto
        assert result.match_score > 0.85

    def test_mac_mini_m2_pro_256gb(self, mapper_service):
        """Test: Mac mini M2 Pro con 256GB."""
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 256GB SSD"
        )

        result = mapper_service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert "M2 Pro" in result.matched_modelo_descripcion
        assert result.matched_capacidad_tamanio == "256 GB"

    # ===========================
    # Tests: Extracción de features
    # ===========================

    def test_extractor_detects_variant_mini(self, mapper_service):
        """Test: Extractor detecta variante 'mini'."""
        from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
        from productos.mapping.core.types import MappingContext

        extractor = MacBookFeatureExtractor()
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # Verificar que detectó la variante "mini"
        assert features.variant == "mini", \
            f"Variante incorrecta: {features.variant}"

    def test_extractor_detects_cpu_cores(self, mapper_service):
        """Test: Extractor detecta CPU cores correctamente."""
        from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
        from productos.mapping.core.types import MappingContext

        extractor = MacBookFeatureExtractor()
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # Verificar CPU cores
        assert features.cpu_cores == 10, \
            f"CPU cores incorrectos: {features.cpu_cores}"

    def test_extractor_detects_gpu_cores(self, mapper_service):
        """Test: Extractor detecta GPU cores correctamente."""
        from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
        from productos.mapping.core.types import MappingContext

        extractor = MacBookFeatureExtractor()
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # Verificar GPU cores
        assert features.gpu_cores == 16, \
            f"GPU cores incorrectos: {features.gpu_cores}"

    def test_extractor_detects_chip_m2(self, mapper_service):
        """Test: Extractor detecta chip M2."""
        from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
        from productos.mapping.core.types import MappingContext

        extractor = MacBookFeatureExtractor()
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # Verificar chip
        assert features.cpu == "M2", \
            f"Chip incorrecto: {features.cpu}"

    def test_extractor_detects_chip_m2_pro(self, mapper_service):
        """Test: Extractor detecta chip M2 Pro."""
        from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
        from productos.mapping.core.types import MappingContext

        extractor = MacBookFeatureExtractor()
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 Pro 12 Core CPU 19 Core GPU A2816 1/2023 512GB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # Verificar chip con variante Pro
        assert features.cpu == "M2 Pro", \
            f"Chip incorrecto: {features.cpu}"

    # ===========================
    # Tests: Engine can_handle()
    # ===========================

    def test_mac_engine_handles_mac_mini(self):
        """Test: MacEngine puede manejar Mac mini."""
        from productos.mapping.engines.macbook_engine import MacEngine

        engine = MacEngine()
        input_data = LikewizeInput(
            model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
        )

        # Verificar que MacEngine acepta Mac mini
        assert engine.can_handle(input_data) is True, \
            "MacEngine no acepta Mac mini"

    def test_mac_engine_handles_mac_mini_with_space(self):
        """Test: MacEngine acepta 'Mac mini' (con espacio)."""
        from productos.mapping.engines.macbook_engine import MacEngine

        engine = MacEngine()
        input_data = LikewizeInput(
            model_name="Mac mini M2 10 Core CPU 16 Core GPU 512GB SSD"
        )

        assert engine.can_handle(input_data) is True

    # ===========================
    # Tests: Regression - Verificar que no rompe MacBooks
    # ===========================

    def test_macbook_air_still_works(self, mapper_service):
        """Test: MacBook Air sigue funcionando correctamente."""
        input_data = LikewizeInput(
            model_name="MacBookAir15 13 M3 8 Core CPU 10 Core GPU 13 inch A3114 3/2024 512GB SSD"
        )

        result = mapper_service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert "MacBook Air" in result.matched_modelo_descripcion
        assert result.matched_capacidad_tamanio == "512 GB"

    def test_macbook_pro_still_works(self, mapper_service):
        """Test: MacBook Pro sigue funcionando correctamente."""
        input_data = LikewizeInput(
            model_name="MacBookPro15 9 M3 Max 16 Core CPU 40 Core GPU 16 inch A2991 10/2023 1TB SSD"
        )

        result = mapper_service.map(input_data)

        assert result.status == MatchStatus.SUCCESS
        assert "MacBook Pro" in result.matched_modelo_descripcion
        assert result.matched_capacidad_tamanio == "1 TB"
