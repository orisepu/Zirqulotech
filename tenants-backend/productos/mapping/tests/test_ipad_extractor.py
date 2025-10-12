"""
Tests para iPad Feature Extractor (TDD).

Tests escritos PRIMERO siguiendo TDD:
- RED: Tests fallan (no existe implementación)
- GREEN: Implementar mínimo para que pasen
- REFACTOR: Mejorar código sin romper tests
"""

import pytest

from productos.mapping.core.types import (
    LikewizeInput,
    ExtractedFeatures,
    DeviceType,
    MappingContext,
)
from productos.mapping.extractors.ipad_extractor import iPadFeatureExtractor


class TestiPadFeatureExtractor:
    """Tests para el extractor de features de iPad."""

    @pytest.fixture
    def extractor(self):
        """Fixture del extractor."""
        return iPadFeatureExtractor()

    @pytest.fixture
    def context(self):
        """Fixture del contexto de mapeo."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        return MappingContext(input_data=input_data)

    # ===========================
    # Tests de extracción de variante
    # ===========================

    def test_extract_variant_pro(self, extractor, context):
        """Extrae variante 'Pro' de 'iPad Pro 12.9-inch M2'."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD_PRO
        assert features.variant == "Pro"

    def test_extract_variant_air(self, extractor, context):
        """Extrae variante 'Air' de 'iPad Air 11-inch (M2)'."""
        input_data = LikewizeInput(model_name="iPad Air 11-inch (M2) Wi-Fi 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD_AIR
        assert features.variant == "Air"

    def test_extract_variant_mini(self, extractor, context):
        """Extrae variante 'mini' de 'iPad mini 7'."""
        input_data = LikewizeInput(model_name="iPad mini 7 Cellular 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD_MINI
        assert features.variant == "mini"

    def test_extract_variant_regular(self, extractor, context):
        """iPad regular sin variante."""
        input_data = LikewizeInput(model_name="iPad 10 Wi-Fi 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD
        assert features.variant is None

    # ===========================
    # Tests de extracción de generación
    # ===========================

    def test_extract_generation_ipad_regular_10(self, extractor, context):
        """Extrae generación 10 de 'iPad 10 Wi-Fi 64GB'."""
        input_data = LikewizeInput(model_name="iPad 10 Wi-Fi 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 10

    def test_extract_generation_ipad_mini_7(self, extractor, context):
        """Extrae generación 7 de 'iPad mini 7'."""
        input_data = LikewizeInput(model_name="iPad mini 7 Cellular 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 7

    def test_extract_generation_ordinal_format(self, extractor, context):
        """Extrae generación de formato ordinal '(6.ª generación)'."""
        input_data = LikewizeInput(model_name="iPad Air (6.ª generación) Wi-Fi 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 6

    def test_extract_generation_ordinal_format_variant(self, extractor, context):
        """Extrae generación de formato '(10.ª generación)'."""
        input_data = LikewizeInput(model_name="iPad (10.ª generación) Wi-Fi 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 10

    def test_extract_generation_ipad_pro_no_explicit_gen(self, extractor, context):
        """iPad Pro sin generación explícita (se infiere del chip/año)."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # iPad Pro normalmente no tiene gen explícita
        # La generación se infiere desde el chip en el KB
        assert features.generation is None or features.generation == 6

    # ===========================
    # Tests de extracción de tamaño de pantalla
    # ===========================

    def test_extract_screen_size_12_9_inch(self, extractor, context):
        """Extrae tamaño 12.9\" de 'iPad Pro 12.9-inch'."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.screen_size == 12.9

    def test_extract_screen_size_11_inch(self, extractor, context):
        """Extrae tamaño 11\" de 'iPad Pro 11-inch'."""
        input_data = LikewizeInput(model_name="iPad Pro 11-inch M4 Cellular 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.screen_size == 11.0

    def test_extract_screen_size_13_inch(self, extractor, context):
        """Extrae tamaño 13\" de 'iPad Pro 13-inch'."""
        input_data = LikewizeInput(model_name="iPad Pro 13-inch M4 Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.screen_size == 13.0

    def test_extract_screen_size_spanish_format(self, extractor, context):
        """Extrae tamaño en formato español '11 pulgadas'."""
        input_data = LikewizeInput(model_name="iPad Air 11 pulgadas (M2) Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.screen_size == 11.0

    def test_extract_screen_size_spanish_decimal_format(self, extractor, context):
        """Extrae tamaño en formato español '12,9 pulgadas'."""
        input_data = LikewizeInput(model_name="iPad Pro 12,9 pulgadas M2 Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.screen_size == 12.9

    def test_extract_screen_size_10_5_inch(self, extractor, context):
        """Extrae tamaño 10.5\" de 'iPad Pro 10.5-inch'."""
        input_data = LikewizeInput(model_name="iPad Pro 10.5-inch Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.screen_size == 10.5

    def test_extract_screen_size_9_7_inch(self, extractor, context):
        """Extrae tamaño 9.7\" de 'iPad Pro 9.7-inch'."""
        input_data = LikewizeInput(model_name="iPad Pro 9.7-inch Wi-Fi 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.screen_size == 9.7

    # ===========================
    # Tests de extracción de chip
    # ===========================

    def test_extract_chip_m4(self, extractor, context):
        """Extrae chip M4 de 'iPad Pro M4'."""
        input_data = LikewizeInput(model_name="iPad Pro 11-inch M4 Wi-Fi 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.cpu == "M4"

    def test_extract_chip_m2(self, extractor, context):
        """Extrae chip M2 de 'iPad Air (M2)'."""
        input_data = LikewizeInput(model_name="iPad Air 11-inch (M2) Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.cpu == "M2"

    def test_extract_chip_m1(self, extractor, context):
        """Extrae chip M1 de 'iPad Pro M1'."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch (M1) Cellular 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.cpu == "M1"

    def test_extract_chip_a17_pro(self, extractor, context):
        """Extrae chip A17 Pro de 'iPad mini 7'."""
        input_data = LikewizeInput(model_name="iPad mini 7 A17 Pro Cellular 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.cpu == "A17"  # El extractor debe capturar A17

    def test_extract_chip_a14_bionic(self, extractor, context):
        """Extrae chip A14 Bionic."""
        input_data = LikewizeInput(model_name="iPad A14 Bionic Wi-Fi 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.cpu == "A14"

    def test_extract_chip_a15_bionic(self, extractor, context):
        """Extrae chip A15 Bionic."""
        input_data = LikewizeInput(model_name="iPad mini 6 A15 Bionic Cellular 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.cpu == "A15"

    def test_extract_chip_a12x(self, extractor, context):
        """Extrae chip A12X de iPad Pro."""
        input_data = LikewizeInput(model_name="iPad Pro 11-inch A12X Wi-Fi 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.cpu == "A12X"

    # ===========================
    # Tests de extracción de conectividad
    # ===========================

    def test_extract_connectivity_wifi_only(self, extractor, context):
        """Extrae conectividad Wi-Fi only."""
        input_data = LikewizeInput(model_name="iPad Pro 11-inch M2 Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.has_wifi is True
        assert features.has_cellular is False

    def test_extract_connectivity_cellular(self, extractor, context):
        """Extrae conectividad Cellular."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Cellular 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.has_wifi is True  # Cellular también incluye Wi-Fi
        assert features.has_cellular is True

    def test_extract_connectivity_4g(self, extractor, context):
        """Extrae conectividad 4G como Cellular."""
        input_data = LikewizeInput(model_name="iPad Air 11-inch 4G Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.has_cellular is True

    def test_extract_connectivity_5g(self, extractor, context):
        """Extrae conectividad 5G como Cellular."""
        input_data = LikewizeInput(model_name="iPad mini 7 5G 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.has_cellular is True

    def test_extract_connectivity_lte(self, extractor, context):
        """Extrae conectividad LTE como Cellular."""
        input_data = LikewizeInput(model_name="iPad 10 Wi-Fi + LTE 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.has_cellular is True

    def test_extract_connectivity_default_to_wifi(self, extractor, context):
        """Si no se detecta conectividad, asume Wi-Fi."""
        input_data = LikewizeInput(model_name="iPad 10 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.has_wifi is True
        assert features.has_cellular is False

    # ===========================
    # Tests de extracción de almacenamiento
    # ===========================

    def test_extract_storage_64gb(self, extractor, context):
        """Extrae 64GB de 'iPad 10 Wi-Fi 64GB'."""
        input_data = LikewizeInput(model_name="iPad 10 Wi-Fi 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 64

    def test_extract_storage_128gb(self, extractor, context):
        """Extrae 128GB de 'iPad Air 11-inch 128GB'."""
        input_data = LikewizeInput(model_name="iPad Air 11-inch (M2) Wi-Fi 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 128

    def test_extract_storage_256gb(self, extractor, context):
        """Extrae 256GB de 'iPad Pro 256GB'."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 256

    def test_extract_storage_512gb(self, extractor, context):
        """Extrae 512GB de 'iPad mini 512GB'."""
        input_data = LikewizeInput(model_name="iPad mini 7 Cellular 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 512

    def test_extract_storage_1tb(self, extractor, context):
        """Extrae 1024GB de 'iPad Pro 1TB'."""
        input_data = LikewizeInput(model_name="iPad Pro 11-inch M4 Wi-Fi 1TB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 1024

    def test_extract_storage_2tb(self, extractor, context):
        """Extrae 2048GB de 'iPad Pro 2TB'."""
        input_data = LikewizeInput(model_name="iPad Pro 13-inch M4 Cellular 2TB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 2048

    def test_extract_storage_with_space(self, extractor, context):
        """Extrae capacidad con espacio: '256 GB'."""
        input_data = LikewizeInput(model_name="iPad Air 11-inch 256 GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 256

    # ===========================
    # Tests de casos especiales y edge cases
    # ===========================

    def test_extract_complete_ipad_pro(self, extractor, context):
        """Extracción completa de iPad Pro con todos los atributos."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Cellular 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD_PRO
        assert features.variant == "Pro"
        assert features.screen_size == 12.9
        assert features.cpu == "M2"
        assert features.has_wifi is True
        assert features.has_cellular is True
        assert features.storage_gb == 512

    def test_extract_complete_ipad_air(self, extractor, context):
        """Extracción completa de iPad Air con todos los atributos."""
        input_data = LikewizeInput(model_name="iPad Air 13 pulgadas (M2) Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD_AIR
        assert features.variant == "Air"
        assert features.screen_size == 13.0
        assert features.cpu == "M2"
        assert features.has_wifi is True
        assert features.has_cellular is False
        assert features.storage_gb == 256

    def test_extract_complete_ipad_mini(self, extractor, context):
        """Extracción completa de iPad mini con todos los atributos."""
        input_data = LikewizeInput(model_name="iPad mini 7 Cellular 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD_MINI
        assert features.variant == "mini"
        assert features.generation == 7
        assert features.has_cellular is True
        assert features.storage_gb == 256

    def test_extract_complete_ipad_regular(self, extractor, context):
        """Extracción completa de iPad regular con todos los atributos."""
        input_data = LikewizeInput(model_name="iPad 10 Wi-Fi 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD
        assert features.variant is None
        assert features.generation == 10
        assert features.has_wifi is True
        assert features.has_cellular is False
        assert features.storage_gb == 64

    def test_extract_lowercase_input(self, extractor, context):
        """Maneja entrada en minúsculas."""
        input_data = LikewizeInput(model_name="ipad pro 12.9-inch m2 wi-fi 256gb")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD_PRO
        assert features.variant == "Pro"
        assert features.screen_size == 12.9
        assert features.cpu == "M2"

    def test_extract_with_extra_text(self, extractor, context):
        """Maneja texto extra en el nombre."""
        input_data = LikewizeInput(model_name="Apple iPad Pro 11-inch M4 Wi-Fi Space Gray 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "Pro"
        assert features.screen_size == 11.0
        assert features.cpu == "M4"
        assert features.storage_gb == 512

    def test_extract_confidence_score(self, extractor, context):
        """Verifica que se asigna un score de confianza."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9-inch M2 Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.extraction_confidence > 0.0
        assert features.extraction_confidence <= 1.0

    def test_extract_original_text_stored(self, extractor, context):
        """Verifica que se almacena el texto original."""
        input_data = LikewizeInput(model_name="iPad Pro 11-inch M4 Wi-Fi 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.original_text == "iPad Pro 11-inch M4 Wi-Fi 512GB"

    def test_extract_adds_notes(self, extractor, context):
        """Verifica que se agregan notas de extracción."""
        input_data = LikewizeInput(model_name="iPad Air 11-inch (M2) Wi-Fi 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert len(features.extraction_notes) > 0

    # ===========================
    # Tests de detección de device type
    # ===========================

    def test_detect_device_type_ipad(self, extractor, context):
        """Detecta que es un iPad."""
        input_data = LikewizeInput(model_name="iPad 10 Wi-Fi 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPAD
        assert features.brand == "Apple"

    def test_reject_non_ipad(self, extractor, context):
        """No extrae features de dispositivos que no son iPad."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # El extractor debe retornar features vacías o con device_type != IPAD
        assert (
            features.device_type not in (DeviceType.IPAD, DeviceType.IPAD_PRO, DeviceType.IPAD_AIR, DeviceType.IPAD_MINI)
            or features.device_type is None
        )
