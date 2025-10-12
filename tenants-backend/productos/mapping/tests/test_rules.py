"""
Tests para Rules (TDD).

Las Rules filtran candidatos devueltos por matchers,
aplicando validaciones de negocio adicionales.

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
    MatchCandidate,
    MappingContext,
    LikewizeInput,
    MatchStrategy,
)
from productos.mapping.rules.year_filter import YearFilter
from productos.mapping.rules.variant_filter import VariantFilter
from productos.mapping.rules.capacity_filter import CapacityFilter


@pytest.mark.django_db
class TestYearFilter:
    """Tests para el filtro de año."""

    @pytest.fixture
    def rule(self):
        """Fixture del rule."""
        return YearFilter()

    @pytest.fixture
    def context(self):
        """Fixture del contexto de mapeo."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        return MappingContext(input_data=input_data)

    @pytest.fixture
    def iphone_13_pro_2021(self):
        """Modelo iPhone 13 Pro con año correcto (2021)."""
        return Modelo.objects.create(
            descripcion="iPhone 13 Pro",
            tipo="iPhone",
            marca="Apple",
            año=2021,
            procesador="A15 Bionic"
        )

    @pytest.fixture
    def iphone_13_pro_2020(self):
        """Modelo iPhone 13 Pro con año incorrecto (2020)."""
        return Modelo.objects.create(
            descripcion="iPhone 13 Pro Wrong Year",
            tipo="iPhone",
            marca="Apple",
            año=2020,  # Año incorrecto
            procesador="A15 Bionic"
        )

    def test_apply_keeps_correct_year(
        self,
        rule,
        context,
        iphone_13_pro_2021
    ):
        """Mantiene candidatos con año correcto."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,  # Buscamos año 2021
            variant="Pro",
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro_2021.id,
            modelo_descripcion=iphone_13_pro_2021.descripcion,
            capacidad_tamanio="128 GB",
            modelo_anio=2021,  # Año correcto
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe mantener el candidato
        assert len(filtered) == 1
        assert filtered[0].modelo_id == iphone_13_pro_2021.id

    def test_apply_removes_wrong_year(
        self,
        rule,
        context,
        iphone_13_pro_2020
    ):
        """Elimina candidatos con año incorrecto."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,  # Buscamos año 2021
            variant="Pro",
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro_2020.id,
            modelo_descripcion=iphone_13_pro_2020.descripcion,
            capacidad_tamanio="128 GB",
            modelo_anio=2020,  # Año INCORRECTO
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe eliminar el candidato
        assert len(filtered) == 0

    def test_apply_no_year_in_features(self, rule, context, iphone_13_pro_2021):
        """Si no hay año en features, no filtra."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=None,  # Sin año especificado
            variant="Pro",
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro_2021.id,
            modelo_descripcion=iphone_13_pro_2021.descripcion,
            capacidad_tamanio="128 GB",
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe mantener el candidato (no filtra sin año en features)
        assert len(filtered) == 1

    def test_apply_multiple_candidates(
        self,
        rule,
        context,
        iphone_13_pro_2021,
        iphone_13_pro_2020
    ):
        """Filtra solo candidatos con año incorrecto."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            storage_gb=128
        )

        candidates = [
            MatchCandidate(
                capacidad_id=1,
                modelo_id=iphone_13_pro_2021.id,
                modelo_descripcion=iphone_13_pro_2021.descripcion,
                capacidad_tamanio="128 GB",
                modelo_anio=2021,
                match_score=0.9,
                match_strategy=MatchStrategy.GENERATION
            ),
            MatchCandidate(
                capacidad_id=2,
                modelo_id=iphone_13_pro_2020.id,
                modelo_descripcion=iphone_13_pro_2020.descripcion,
                capacidad_tamanio="128 GB",
                modelo_anio=2020,
                match_score=0.8,
                match_strategy=MatchStrategy.GENERATION
            )
        ]

        filtered = rule.apply(candidates, features, context)

        # Solo debe mantener el de 2021
        assert len(filtered) == 1
        assert filtered[0].modelo_anio == 2021


@pytest.mark.django_db
class TestVariantFilter:
    """Tests para el filtro de variante."""

    @pytest.fixture
    def rule(self):
        """Fixture del rule."""
        return VariantFilter()

    @pytest.fixture
    def context(self):
        """Fixture del contexto de mapeo."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        return MappingContext(input_data=input_data)

    @pytest.fixture
    def iphone_13_pro(self):
        """iPhone 13 Pro."""
        return Modelo.objects.create(
            descripcion="iPhone 13 Pro",
            tipo="iPhone",
            marca="Apple",
            año=2021
        )

    @pytest.fixture
    def iphone_13_pro_max(self):
        """iPhone 13 Pro Max."""
        return Modelo.objects.create(
            descripcion="iPhone 13 Pro Max",
            tipo="iPhone",
            marca="Apple",
            año=2021
        )

    @pytest.fixture
    def iphone_13(self):
        """iPhone 13 regular."""
        return Modelo.objects.create(
            descripcion="iPhone 13",
            tipo="iPhone",
            marca="Apple",
            año=2021
        )

    def test_apply_keeps_matching_variant(
        self,
        rule,
        context,
        iphone_13_pro
    ):
        """Mantiene candidatos con variante correcta."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",  # Buscamos Pro (sin Max)
            has_pro=True,
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro.id,
            modelo_descripcion="iPhone 13 Pro",
            capacidad_tamanio="128 GB",
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe mantener el candidato
        assert len(filtered) == 1
        assert filtered[0].modelo_descripcion == "iPhone 13 Pro"

    def test_apply_removes_pro_max_when_searching_pro(
        self,
        rule,
        context,
        iphone_13_pro_max
    ):
        """Elimina Pro Max cuando se busca Pro."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",  # Buscamos Pro (SIN Max)
            has_pro=True,
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro_max.id,
            modelo_descripcion="iPhone 13 Pro Max",
            capacidad_tamanio="128 GB",
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe eliminar el Pro Max
        assert len(filtered) == 0

    def test_apply_keeps_pro_max_when_searching_pro_max(
        self,
        rule,
        context,
        iphone_13_pro_max
    ):
        """Mantiene Pro Max cuando se busca Pro Max."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro Max",  # Buscamos Pro Max
            has_pro=True,
            has_max=True,
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro_max.id,
            modelo_descripcion="iPhone 13 Pro Max",
            capacidad_tamanio="128 GB",
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe mantener el Pro Max
        assert len(filtered) == 1

    def test_apply_removes_regular_when_searching_pro(
        self,
        rule,
        context,
        iphone_13
    ):
        """Elimina iPhone regular cuando se busca Pro."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            has_pro=True,
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13.id,
            modelo_descripcion="iPhone 13",
            capacidad_tamanio="128 GB",
            modelo_anio=2021,
            match_score=0.8,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe eliminar el regular
        assert len(filtered) == 0

    def test_apply_removes_variant_when_searching_regular(
        self,
        rule,
        context,
        iphone_13_pro
    ):
        """Elimina variantes cuando se busca modelo regular (variant=None)."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant=None,  # Buscamos REGULAR (sin variantes)
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro.id,
            modelo_descripcion="iPhone 13 Pro",  # Tiene variante "Pro"
            capacidad_tamanio="128 GB",
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe ELIMINAR el Pro cuando buscamos regular
        assert len(filtered) == 0

    def test_apply_keeps_regular_when_searching_regular(
        self,
        rule,
        context,
        iphone_13
    ):
        """Mantiene modelo regular cuando se busca regular (variant=None)."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant=None,  # Buscamos REGULAR
            storage_gb=128
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13.id,
            modelo_descripcion="iPhone 13",  # Regular (sin variante)
            capacidad_tamanio="128 GB",
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe MANTENER el regular
        assert len(filtered) == 1


@pytest.mark.django_db
class TestCapacityFilter:
    """Tests para el filtro de capacidad."""

    @pytest.fixture
    def rule(self):
        """Fixture del rule."""
        return CapacityFilter()

    @pytest.fixture
    def context(self):
        """Fixture del contexto de mapeo."""
        input_data = LikewizeInput(model_name="iPhone 13 Pro 128GB")
        return MappingContext(input_data=input_data)

    @pytest.fixture
    def iphone_13_pro(self):
        """iPhone 13 Pro."""
        return Modelo.objects.create(
            descripcion="iPhone 13 Pro",
            tipo="iPhone",
            marca="Apple",
            año=2021
        )

    def test_apply_keeps_matching_capacity(
        self,
        rule,
        context,
        iphone_13_pro
    ):
        """Mantiene candidatos con capacidad correcta."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            storage_gb=128  # Buscamos 128GB
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro.id,
            modelo_descripcion="iPhone 13 Pro",
            capacidad_tamanio="128 GB",  # Capacidad correcta
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe mantener el candidato
        assert len(filtered) == 1

    def test_apply_removes_wrong_capacity(
        self,
        rule,
        context,
        iphone_13_pro
    ):
        """Elimina candidatos con capacidad incorrecta."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            storage_gb=128  # Buscamos 128GB
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro.id,
            modelo_descripcion="iPhone 13 Pro",
            capacidad_tamanio="256 GB",  # Capacidad INCORRECTA
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe eliminar el candidato
        assert len(filtered) == 0

    def test_apply_supports_different_formats(
        self,
        rule,
        context,
        iphone_13_pro
    ):
        """Soporta diferentes formatos de capacidad."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            storage_gb=128
        )

        # Probar diferentes formatos: "128GB", "128 GB", "128"
        test_cases = ["128GB", "128 GB", "128"]

        for tamanio_format in test_cases:
            candidate = MatchCandidate(
                capacidad_id=1,
                modelo_id=iphone_13_pro.id,
                modelo_descripcion="iPhone 13 Pro",
                capacidad_tamanio=tamanio_format,
                modelo_anio=2021,
                match_score=0.9,
                match_strategy=MatchStrategy.GENERATION
            )

            filtered = rule.apply([candidate], features, context)
            assert len(filtered) == 1, f"Falló con formato: {tamanio_format}"

    def test_apply_supports_tb_conversion(
        self,
        rule,
        context,
        iphone_13_pro
    ):
        """Soporta conversión TB a GB."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            storage_gb=1024  # 1TB en GB
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro.id,
            modelo_descripcion="iPhone 13 Pro",
            capacidad_tamanio="1 TB",  # 1TB
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe reconocer 1TB = 1024GB
        assert len(filtered) == 1

    def test_apply_no_storage_in_features(
        self,
        rule,
        context,
        iphone_13_pro
    ):
        """Si no hay storage en features, no filtra."""
        features = ExtractedFeatures(
            device_type=DeviceType.IPHONE,
            generation=13,
            year=2021,
            variant="Pro",
            storage_gb=None  # Sin storage
        )

        candidate = MatchCandidate(
            capacidad_id=1,
            modelo_id=iphone_13_pro.id,
            modelo_descripcion="iPhone 13 Pro",
            capacidad_tamanio="256 GB",
            modelo_anio=2021,
            match_score=0.9,
            match_strategy=MatchStrategy.GENERATION
        )

        candidates = [candidate]
        filtered = rule.apply(candidates, features, context)

        # Debe mantener el candidato
        assert len(filtered) == 1
