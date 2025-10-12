"""
Tests para GenerationMatcher (TDD).

El GenerationMatcher busca dispositivos en la BD por generación y año,
que es la estrategia principal para iPhones modernos.

Tests escritos PRIMERO siguiendo TDD:
- RED: Tests fallan (no existe implementación)
- GREEN: Implementar mínimo para que pasen
- REFACTOR: Mejorar código sin romper tests
"""

import pytest
from decimal import Decimal

from productos.models.modelos import Modelo, Capacidad
from productos.mapping.core.types import (
    ExtractedFeatures,
    DeviceType,
    LikewizeInput,
    MappingContext,
    MatchStrategy,
)
from productos.mapping.matchers.generation_matcher import GenerationMatcher


@pytest.mark.django_db
class TestGenerationMatcher:
    """Tests para el matcher por generación."""

    @pytest.fixture
    def matcher(self):
        """Fixture del matcher."""
        return GenerationMatcher()

    @pytest.fixture
    def context(self):
        """Fixture del contexto de mapeo."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        return MappingContext(input_data=input_data)

    @pytest.fixture
    def iphone_13_pro_model(self):
        """Fixture de modelo iPhone 13 Pro en BD."""
        return Modelo.objects.create(
            descripcion="iPhone 13 Pro",
            tipo="iPhone",
            marca="Apple",
            año=2021,
            procesador="A15 Bionic"
        )

    @pytest.fixture
    def iphone_13_model(self):
        """Fixture de modelo iPhone 13 regular en BD."""
        return Modelo.objects.create(
            descripcion="iPhone 13",
            tipo="iPhone",
            marca="Apple",
            año=2021,
            procesador="A15 Bionic"
        )

    @pytest.fixture
    def iphone_15_pro_model(self):
        """Fixture de modelo iPhone 15 Pro en BD."""
        return Modelo.objects.create(
            descripcion="iPhone 15 Pro",
            tipo="iPhone",
            marca="Apple",
            año=2023,
            procesador="A17 Pro"
        )

    @pytest.fixture
    def iphone_13_pro_128gb(self, iphone_13_pro_model):
        """Fixture de capacidad iPhone 13 Pro 128GB."""
        return Capacidad.objects.create(
            modelo=iphone_13_pro_model,
            tamaño="128 GB",
            activo=True
        )

    @pytest.fixture
    def iphone_13_pro_256gb(self, iphone_13_pro_model):
        """Fixture de capacidad iPhone 13 Pro 256GB."""
        return Capacidad.objects.create(
            modelo=iphone_13_pro_model,
            tamaño="256 GB",
            activo=True
        )

    @pytest.fixture
    def iphone_13_128gb(self, iphone_13_model):
        """Fixture de capacidad iPhone 13 regular 128GB."""
        return Capacidad.objects.create(
            modelo=iphone_13_model,
            tamaño="128 GB",
            activo=True
        )

    # ===========================
    # Tests de find_candidates
    # ===========================

    def test_find_candidates_iphone_13_pro(
        self,
        matcher,
        context,
        iphone_13_pro_128gb,
        iphone_13_128gb
    ):
        """Encuentra candidatos para iPhone 13 Pro."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            has_pro=True,
            storage_gb=128
        )

        candidates = matcher.find_candidates(features, context)

        # Debe encontrar al menos el iPhone 13 Pro
        assert len(candidates) > 0
        # El primer candidato debe ser iPhone 13 Pro (mejor score)
        assert "iPhone 13 Pro" in candidates[0].modelo_descripcion

    def test_find_candidates_filters_by_year(
        self,
        matcher,
        context,
        iphone_13_pro_model,
        iphone_15_pro_model
    ):
        """Filtra candidatos por año correctamente."""
        Capacidad.objects.create(modelo=iphone_13_pro_model, tamaño="128 GB", activo=True)
        Capacidad.objects.create(modelo=iphone_15_pro_model, tamaño="128 GB", activo=True)

        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,  # Año específico
            variant="Pro",
            storage_gb=128
        )

        candidates = matcher.find_candidates(features, context)

        # Solo debe encontrar iPhone 13 Pro (2021), no iPhone 15 Pro (2023)
        assert len(candidates) >= 1
        for candidate in candidates:
            assert candidate.modelo_anio == 2021

    def test_find_candidates_filters_by_device_type(
        self,
        matcher,
        context,
        iphone_13_pro_128gb
    ):
        """Filtra por tipo de dispositivo."""
        # Crear un iPad Pro para verificar que no lo encuentra
        ipad_model = Modelo.objects.create(
            descripcion="iPad Pro 12.9",
            tipo="iPad Pro",
            marca="Apple",
            año=2021
        )
        Capacidad.objects.create(modelo=ipad_model, tamaño="128 GB", activo=True)

        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            storage_gb=128
        )

        candidates = matcher.find_candidates(features, context)

        # Solo debe encontrar iPhones, no iPads
        for candidate in candidates:
            assert "iPhone" in candidate.modelo_descripcion
            assert "iPad" not in candidate.modelo_descripcion

    def test_find_candidates_matches_capacity(
        self,
        matcher,
        context,
        iphone_13_pro_128gb,
        iphone_13_pro_256gb
    ):
        """Encuentra la capacidad correcta."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            storage_gb=128  # Capacidad específica
        )

        candidates = matcher.find_candidates(features, context)

        # Debe encontrar la capacidad de 128GB
        assert len(candidates) > 0
        # Verificar que al menos un candidato tiene 128GB
        has_128gb = any("128" in c.capacidad_tamanio for c in candidates)
        assert has_128gb

    def test_find_candidates_no_match(self, matcher, context):
        """No encuentra candidatos si no existen en BD."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=99,  # Generación que no existe
            year=2099,
            storage_gb=128
        )

        candidates = matcher.find_candidates(features, context)

        # No debe encontrar candidatos
        assert len(candidates) == 0

    def test_find_candidates_ordered_by_score(
        self,
        matcher,
        context,
        iphone_13_pro_128gb,
        iphone_13_pro_256gb
    ):
        """Los candidatos están ordenados por score (mejor primero)."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",  # Especificamos Pro
            storage_gb=128
        )

        candidates = matcher.find_candidates(features, context)

        # Debe encontrar ambas capacidades del iPhone 13 Pro
        assert len(candidates) >= 1

        # Verificar que están ordenados por score descendente
        if len(candidates) > 1:
            for i in range(len(candidates) - 1):
                assert candidates[i].match_score >= candidates[i + 1].match_score

        # El primer candidato debe ser el Pro (mejor match)
        assert "Pro" in candidates[0].modelo_descripcion

    # ===========================
    # Tests de calculate_score
    # ===========================

    def test_calculate_score_perfect_match(self, matcher, iphone_13_pro_model):
        """Score alto para match perfecto."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            has_pro=True,
            storage_gb=128
        )

        score = matcher.calculate_score(features, iphone_13_pro_model)

        # Score debe ser alto (>0.8) para match perfecto
        assert score > 0.8

    def test_calculate_score_year_mismatch(self, matcher):
        """Score bajo si el año no coincide."""
        modelo = Modelo.objects.create(
            descripcion="iPhone 13 Pro",
            tipo="iPhone",
            año=2020  # Año incorrecto (debería ser 2021)
        )

        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,  # Año correcto
            variant="Pro"
        )

        score = matcher.calculate_score(features, modelo)

        # Score debe ser menor por el año incorrecto
        assert score < 0.8

    def test_calculate_score_variant_mismatch(self, matcher, iphone_13_model):
        """Score menor si la variante no coincide perfectamente."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",  # Buscamos Pro
            has_pro=True
        )

        # iphone_13_model es regular (sin Pro)
        score = matcher.calculate_score(features, iphone_13_model)

        # Score debe ser menor porque no es Pro
        assert score < 0.9

    def test_calculate_score_no_generation(self, matcher, iphone_13_pro_model):
        """Score menor si no hay generación detectada."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=None,  # Sin generación
            year=2021,
            variant="Pro"
        )

        score = matcher.calculate_score(features, iphone_13_pro_model)

        # Score debe ser menor sin generación (pierde 0.3 puntos)
        # Pero aún puede tener: tipo (0.2) + año (0.3) + variante (0.2) = 0.7
        assert score < 0.8  # No llega al máximo por falta de generación

    # ===========================
    # Tests de match_strategy
    # ===========================

    def test_candidates_have_correct_strategy(
        self,
        matcher,
        context,
        iphone_13_pro_128gb
    ):
        """Los candidatos tienen la estrategia correcta."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            storage_gb=128
        )

        candidates = matcher.find_candidates(features, context)

        assert len(candidates) > 0
        # Todos los candidatos deben tener strategy GENERATION
        for candidate in candidates:
            assert candidate.match_strategy == MatchStrategy.GENERATION

    # ===========================
    # Tests de metadata
    # ===========================

    def test_candidates_include_metadata(
        self,
        matcher,
        context,
        iphone_13_pro_128gb
    ):
        """Los candidatos incluyen metadata del matching."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            storage_gb=128
        )

        candidates = matcher.find_candidates(features, context)

        assert len(candidates) > 0
        # Verificar que tienen metadata
        details = candidates[0].match_details
        assert len(details) > 0
        # Verificar campos esperados
        assert 'matcher' in details
        assert 'features_generation' in details or 'features_year' in details
        assert details['matcher'] == 'GenerationMatcher'
