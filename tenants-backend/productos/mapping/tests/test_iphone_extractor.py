"""
Tests para iPhone Feature Extractor (TDD).

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
from productos.mapping.extractors.iphone_extractor import iPhoneFeatureExtractor


class TestiPhoneFeatureExtractor:
    """Tests para el extractor de features de iPhone."""

    @pytest.fixture
    def extractor(self):
        """Fixture del extractor."""
        return iPhoneFeatureExtractor()

    @pytest.fixture
    def context(self):
        """Fixture del contexto de mapeo."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        return MappingContext(input_data=input_data)

    # ===========================
    # Tests de extracción de generación
    # ===========================

    def test_extract_generation_iphone_17_pro(self, extractor, context):
        """Extrae generación 17 de 'iPhone 17 Pro 256GB'."""
        input_data = LikewizeInput(model_name="iPhone 17 Pro 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPHONE
        assert features.generation == 17

    def test_extract_generation_iphone_16(self, extractor, context):
        """Extrae generación 16 de 'iPhone 16 128GB'."""
        input_data = LikewizeInput(model_name="iPhone 16 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 16

    def test_extract_generation_iphone_15_plus(self, extractor, context):
        """Extrae generación 15 de 'iPhone 15 Plus 512GB'."""
        input_data = LikewizeInput(model_name="iPhone 15 Plus 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 15

    def test_extract_generation_iphone_13_pro_max(self, extractor, context):
        """Extrae generación 13 de 'iPhone 13 Pro Max 256GB'."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro Max 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 13

    def test_extract_generation_iphone_12_mini(self, extractor, context):
        """Extrae generación 12 de 'iPhone 12 mini 64GB'."""
        input_data = LikewizeInput(model_name="iPhone 12 mini 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 12

    def test_extract_generation_iphone_11(self, extractor, context):
        """Extrae generación 11 de 'iPhone 11 128GB'."""
        input_data = LikewizeInput(model_name="iPhone 11 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 11

    def test_extract_generation_iphone_x(self, extractor, context):
        """Extrae generación 10 de 'iPhone X 256GB'."""
        input_data = LikewizeInput(model_name="iPhone X 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 10
        assert features.variant == "X"

    def test_extract_generation_iphone_8(self, extractor, context):
        """Extrae generación 8 de 'iPhone 8 Plus 128GB'."""
        input_data = LikewizeInput(model_name="iPhone 8 Plus 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 8

    # ===========================
    # Tests de extracción de variantes
    # ===========================

    def test_extract_variant_pro(self, extractor, context):
        """Extrae variante 'Pro' de 'iPhone 15 Pro 128GB'."""
        input_data = LikewizeInput(model_name="iPhone 15 Pro 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "Pro"
        assert features.has_pro is True

    def test_extract_variant_pro_max(self, extractor, context):
        """Extrae variante 'Pro Max' de 'iPhone 14 Pro Max 256GB'."""
        input_data = LikewizeInput(model_name="iPhone 14 Pro Max 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "Pro Max"
        assert features.has_pro is True
        assert features.has_max is True

    def test_extract_variant_plus(self, extractor, context):
        """Extrae variante 'Plus' de 'iPhone 14 Plus 128GB'."""
        input_data = LikewizeInput(model_name="iPhone 14 Plus 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "Plus"
        assert features.has_plus is True

    def test_extract_variant_mini(self, extractor, context):
        """Extrae variante 'mini' de 'iPhone 13 mini 128GB'."""
        input_data = LikewizeInput(model_name="iPhone 13 mini 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "mini"
        assert features.has_mini is True

    def test_extract_variant_xr(self, extractor, context):
        """Extrae variante 'XR' de 'iPhone XR 128GB'."""
        input_data = LikewizeInput(model_name="iPhone XR 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "XR"
        assert features.generation == 10

    def test_extract_variant_xs(self, extractor, context):
        """Extrae variante 'XS' de 'iPhone XS 256GB'."""
        input_data = LikewizeInput(model_name="iPhone XS 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "XS"
        assert features.generation == 10

    def test_extract_variant_xs_max(self, extractor, context):
        """Extrae variante 'XS Max' de 'iPhone XS Max 512GB'."""
        input_data = LikewizeInput(model_name="iPhone XS Max 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "XS Max"
        assert features.has_max is True

    def test_extract_variant_se(self, extractor, context):
        """Extrae variante 'SE' de 'iPhone SE (3rd generation) 64GB'."""
        input_data = LikewizeInput(model_name="iPhone SE (3rd generation) 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "SE"
        assert features.generation == 3

    def test_extract_variant_none(self, extractor, context):
        """iPhone regular sin variante."""
        input_data = LikewizeInput(model_name="iPhone 13 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant is None or features.variant == ""
        assert features.has_pro is False
        assert features.has_max is False
        assert features.has_plus is False

    # ===========================
    # Tests de extracción de capacidad
    # ===========================

    def test_extract_storage_64gb(self, extractor, context):
        """Extrae 64GB de 'iPhone 11 64GB'."""
        input_data = LikewizeInput(model_name="iPhone 11 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 64

    def test_extract_storage_128gb(self, extractor, context):
        """Extrae 128GB de 'iPhone 13 Pro 128GB'."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 128

    def test_extract_storage_256gb(self, extractor, context):
        """Extrae 256GB de 'iPhone 15 Plus 256GB'."""
        input_data = LikewizeInput(model_name="iPhone 15 Plus 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 256

    def test_extract_storage_512gb(self, extractor, context):
        """Extrae 512GB de 'iPhone 14 Pro Max 512GB'."""
        input_data = LikewizeInput(model_name="iPhone 14 Pro Max 512GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 512

    def test_extract_storage_1tb(self, extractor, context):
        """Extrae 1024GB de 'iPhone 15 Pro Max 1TB'."""
        input_data = LikewizeInput(model_name="iPhone 15 Pro Max 1TB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 1024

    def test_extract_storage_with_space(self, extractor, context):
        """Extrae capacidad con espacio: '128 GB'."""
        input_data = LikewizeInput(model_name="iPhone 13 128 GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.storage_gb == 128

    # ===========================
    # Tests de casos especiales
    # ===========================

    def test_extract_iphone_se_3rd_gen(self, extractor, context):
        """iPhone SE (3rd generation) 64GB - caso especial."""
        input_data = LikewizeInput(model_name="iPhone SE (3rd generation) 64GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPHONE
        assert features.variant == "SE"
        assert features.generation == 3
        assert features.storage_gb == 64

    def test_extract_iphone_se_2nd_gen(self, extractor, context):
        """iPhone SE (2nd generation) - caso especial."""
        input_data = LikewizeInput(model_name="iPhone SE (2nd generation) 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.variant == "SE"
        assert features.generation == 2

    def test_extract_lowercase_input(self, extractor, context):
        """Maneja entrada en minúsculas."""
        input_data = LikewizeInput(model_name="iphone 13 pro 128gb")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPHONE
        assert features.generation == 13
        assert features.variant == "Pro"
        assert features.storage_gb == 128

    def test_extract_with_extra_text(self, extractor, context):
        """Maneja texto extra en el nombre."""
        input_data = LikewizeInput(model_name="Apple iPhone 13 Pro 128GB (PRODUCT)RED")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.generation == 13
        assert features.variant == "Pro"
        assert features.storage_gb == 128

    def test_extract_confidence_score(self, extractor, context):
        """Verifica que se asigna un score de confianza."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.extraction_confidence > 0.0
        assert features.extraction_confidence <= 1.0

    def test_extract_original_text_stored(self, extractor, context):
        """Verifica que se almacena el texto original."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.original_text == "iPhone 13 Pro 128GB"

    def test_extract_adds_notes(self, extractor, context):
        """Verifica que se agregan notas de extracción."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert len(features.extraction_notes) > 0

    # ===========================
    # Tests de detección de device type
    # ===========================

    def test_detect_device_type_iphone(self, extractor, context):
        """Detecta que es un iPhone."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == DeviceType.IPHONE
        assert features.brand == "Apple"

    def test_reject_non_iphone(self, extractor, context):
        """No extrae features de dispositivos que no son iPhone."""
        input_data = LikewizeInput(model_name="iPad Pro 12.9 256GB")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # El extractor debe retornar features vacías o con device_type != IPHONE
        assert features.device_type != DeviceType.IPHONE or features.device_type is None
