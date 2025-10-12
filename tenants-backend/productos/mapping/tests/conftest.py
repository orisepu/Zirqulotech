"""
Fixtures de pytest para el sistema de mapeo v4.

Define fixtures reutilizables para todos los tests.
Siguiendo best practices de pytest para DRY y mantenibilidad.
"""

import pytest
from decimal import Decimal
from typing import Dict, Any

from productos.mapping.core.types import (
    LikewizeInput,
    ExtractedFeatures,
    MatchCandidate,
    MatchResult,
    MappingContext,
    DeviceType,
    MatchStrategy,
)


# ===========================
# Fixtures de Input Data
# ===========================

@pytest.fixture
def iphone_13_pro_input():
    """Input típico de iPhone 13 Pro 128GB."""
    return LikewizeInput(
        model_name="iPhone 13 Pro 128GB",
        m_model="MLVD3QL/A",
        capacity="128GB",
        device_price=Decimal("750.00"),
        brand_name="Apple"
    )


@pytest.fixture
def iphone_15_plus_input():
    """Input típico de iPhone 15 Plus 256GB."""
    return LikewizeInput(
        model_name="iPhone 15 Plus 256GB",
        m_model="MU123QL/A",
        capacity="256GB",
        device_price=Decimal("950.00"),
        brand_name="Apple"
    )


@pytest.fixture
def iphone_se_3rd_gen_input():
    """Input típico de iPhone SE (3rd generation)."""
    return LikewizeInput(
        model_name="iPhone SE (3rd generation) 64GB",
        m_model="MMYC3QL/A",
        capacity="64GB",
        device_price=Decimal("450.00"),
        brand_name="Apple"
    )


@pytest.fixture
def iphone_xr_input():
    """Input típico de iPhone XR."""
    return LikewizeInput(
        model_name="iPhone XR 128GB",
        m_model="MH7L3QL/A",
        capacity="128GB",
        device_price=Decimal("450.00"),
        brand_name="Apple"
    )


@pytest.fixture
def iphone_11_input():
    """Input típico de iPhone 11."""
    return LikewizeInput(
        model_name="iPhone 11 64GB",
        m_model="MHDH3QL/A",
        capacity="64GB",
        device_price=Decimal("400.00"),
        brand_name="Apple"
    )


@pytest.fixture
def ipad_pro_m2_input():
    """Input típico de iPad Pro M2."""
    return LikewizeInput(
        model_name="iPad Pro 12.9'' (M2) Wi-Fi 256GB",
        m_model="MNXQ3QL/A",
        capacity="256GB",
        device_price=Decimal("1200.00"),
        brand_name="Apple"
    )


# ===========================
# Fixtures de Features
# ===========================

@pytest.fixture
def iphone_13_pro_features():
    """Features extraídas de iPhone 13 Pro 128GB."""
    return ExtractedFeatures(
        device_type=DeviceType.IPHONE,
        brand="Apple",
        generation=13,
        year=2021,
        storage_gb=128,
        variant="Pro",
        has_pro=True,
        cpu="A15 Bionic",
        original_text="iPhone 13 Pro 128GB",
        extraction_confidence=0.95
    )


@pytest.fixture
def iphone_15_plus_features():
    """Features extraídas de iPhone 15 Plus 256GB."""
    return ExtractedFeatures(
        device_type=DeviceType.IPHONE,
        brand="Apple",
        generation=15,
        year=2023,
        storage_gb=256,
        variant="Plus",
        has_plus=True,
        cpu="A16 Bionic",
        original_text="iPhone 15 Plus 256GB",
        extraction_confidence=0.95
    )


# ===========================
# Fixtures de Context
# ===========================

@pytest.fixture
def mapping_context(iphone_13_pro_input):
    """Contexto de mapeo básico."""
    return MappingContext(input_data=iphone_13_pro_input)


# ===========================
# Fixtures de Match Results
# ===========================

@pytest.fixture
def successful_match_result():
    """Resultado de match exitoso."""
    return MatchResult(
        success=True,
        capacidad_id=123,
        modelo_id=45,
        confidence=0.98,
        match_strategy=MatchStrategy.GENERATION,
        candidates_found=1
    )


@pytest.fixture
def failed_match_result():
    """Resultado de match fallido."""
    return MatchResult(
        success=False,
        candidates_found=0,
        error_message="No se encontraron candidatos",
        error_code="NO_CANDIDATES"
    )


# ===========================
# Fixtures de Match Candidates
# ===========================

@pytest.fixture
def match_candidate_iphone_13_pro():
    """Candidato de match para iPhone 13 Pro 128GB."""
    return MatchCandidate(
        capacidad_id=123,
        modelo_id=45,
        modelo_descripcion="iPhone 13 Pro",
        capacidad_tamanio="128 GB",
        modelo_anio=2021,
        match_score=0.98,
        match_strategy=MatchStrategy.GENERATION,
        match_details={
            "generation_match": True,
            "year_match": True,
            "variant_match": True,
            "capacity_match": True
        }
    )


# ===========================
# Helpers
# ===========================

@pytest.fixture
def assert_features_complete():
    """Helper para validar que features estén completas."""
    def _assert(features: ExtractedFeatures, expected_device_type: DeviceType):
        assert features.device_type == expected_device_type
        assert features.generation is not None, "Generation debe estar extraída"
        assert features.storage_gb is not None, "Storage debe estar extraído"
        assert features.extraction_confidence > 0.0
    return _assert


@pytest.fixture
def create_likewize_input():
    """Factory para crear inputs de Likewize con valores custom."""
    def _create(**kwargs) -> LikewizeInput:
        defaults = {
            "model_name": "iPhone 13 Pro 128GB",
            "m_model": "TEST123",
            "brand_name": "Apple"
        }
        return LikewizeInput(**{**defaults, **kwargs})
    return _create


@pytest.fixture
def create_extracted_features():
    """Factory para crear features con valores custom."""
    def _create(**kwargs) -> ExtractedFeatures:
        defaults = {
            "device_type": DeviceType.IPHONE,
            "brand": "Apple",
            "extraction_confidence": 0.8
        }
        features = ExtractedFeatures(**{**defaults, **kwargs})
        return features
    return _create
