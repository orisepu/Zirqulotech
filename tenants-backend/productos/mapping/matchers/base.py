"""
Clase base para Matchers.

Define la interfaz común para todas las estrategias de matching.
"""

from abc import ABC
from typing import List
from django.db.models import QuerySet

from productos.mapping.core.interfaces import IMatcher
from productos.mapping.core.types import (
    ExtractedFeatures,
    MatchCandidate,
    MappingContext,
)
from productos.models.modelos import Modelo, Capacidad


class BaseMatcher(IMatcher, ABC):
    """
    Clase base abstracta para matchers.

    Provee funcionalidad común de búsqueda y scoring
    que es compartida por todos los matchers.
    """

    def find_candidates(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Encuentra candidatos que coincidan con las features.

        Template method pattern:
        1. Obtener queryset base
        2. Filtrar queryset (implementado por subclases)
        3. Convertir a candidatos con scores
        4. Ordenar por score
        5. Retornar

        Args:
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            Lista de candidatos ordenados por score (mejor primero)
        """
        context.debug(f"Buscando candidatos con {self.__class__.__name__}")

        # Template method: las subclases implementan _get_filtered_queryset
        queryset = self._get_filtered_queryset(features, context)

        if not queryset.exists():
            context.info("No se encontraron modelos en el queryset")
            return []

        # Convertir modelos a candidatos
        candidates = self._models_to_candidates(queryset, features, context)

        # Ordenar por score (mejor primero)
        candidates.sort(reverse=True)

        context.info(f"Encontrados {len(candidates)} candidatos")
        return candidates

    def _get_filtered_queryset(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> QuerySet:
        """
        Obtiene el queryset filtrado de modelos.

        Las subclases deben implementar este método con su
        lógica específica de filtrado.

        Args:
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            QuerySet de modelos filtrados
        """
        # Implementación por defecto: retornar vacío
        return Modelo.objects.none()

    def _models_to_candidates(
        self,
        queryset: QuerySet,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Convierte modelos Django a candidatos con scores.

        Args:
            queryset: QuerySet de modelos
            features: Features para calcular scores
            context: Contexto de mapeo

        Returns:
            Lista de candidatos con scores
        """
        candidates = []

        for modelo in queryset:
            # Obtener capacidades activas del modelo
            capacidades = modelo.capacidades.filter(activo=True)

            # Filtrar capacidades por storage si está especificado
            if features.storage_gb:
                capacidades = self._filter_capacidades_by_storage(
                    capacidades,
                    features.storage_gb
                )

            # Crear candidato por cada capacidad
            for capacidad in capacidades:
                score = self.calculate_score(features, modelo)

                candidate = MatchCandidate(
                    capacidad_id=capacidad.id,
                    modelo_id=modelo.id,
                    modelo_descripcion=modelo.descripcion,
                    capacidad_tamanio=capacidad.tamaño,
                    modelo_anio=modelo.año,
                    match_score=score,
                    match_strategy=self._get_match_strategy(),
                    match_details=self._build_match_details(features, modelo)
                )

                candidates.append(candidate)

        return candidates

    def _filter_capacidades_by_storage(
        self,
        capacidades: QuerySet,
        storage_gb: int
    ) -> QuerySet:
        """
        Filtra capacidades por almacenamiento.

        Args:
            capacidades: QuerySet de capacidades
            storage_gb: Almacenamiento buscado en GB

        Returns:
            QuerySet filtrado
        """
        # Generar patrones de búsqueda
        patterns = self._get_storage_patterns(storage_gb)

        # Filtrar por cualquiera de los patrones
        from django.db.models import Q
        query = Q()
        for pattern in patterns:
            query |= Q(tamaño__icontains=pattern)

        return capacidades.filter(query)

    def _get_storage_patterns(self, storage_gb: int) -> List[str]:
        """
        Genera patrones de búsqueda para capacidad.

        Args:
            storage_gb: Almacenamiento en GB

        Returns:
            Lista de patrones (["128GB", "128 GB", "128", ...])
        """
        patterns = []

        # Convertir a TB si >= 1024
        if storage_gb >= 1024:
            tb = storage_gb / 1024
            if tb == int(tb):
                patterns.extend([f"{int(tb)}TB", f"{int(tb)} TB"])
            else:
                patterns.extend([f"{tb}TB", f"{tb} TB"])

        # Siempre agregar GB
        patterns.extend([f"{storage_gb}GB", f"{storage_gb} GB", str(storage_gb)])

        return patterns

    def _build_match_details(
        self,
        features: ExtractedFeatures,
        modelo: Modelo
    ) -> dict:
        """
        Construye metadata del matching.

        Args:
            features: Features extraídas
            modelo: Modelo candidato

        Returns:
            Diccionario con detalles del match
        """
        return {
            'matcher': self.__class__.__name__,
            'features_generation': features.generation,
            'features_year': features.year,
            'features_variant': features.variant,
            'model_year': modelo.año,
            'model_description': modelo.descripcion,
        }

    def _get_match_strategy(self):
        """
        Retorna la estrategia de matching.

        Las subclases pueden override para especificar su estrategia.

        Returns:
            MatchStrategy enum
        """
        from productos.mapping.core.types import MatchStrategy
        return MatchStrategy.FUZZY  # Default
