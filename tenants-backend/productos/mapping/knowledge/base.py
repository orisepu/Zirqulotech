"""
Clase base para Knowledge Bases.

Define la interfaz común para todos los knowledge bases
del sistema de mapeo.
"""

from abc import ABC
from typing import Optional

from productos.mapping.core.interfaces import IKnowledgeBase
from productos.mapping.core.types import ExtractedFeatures, MappingContext


class BaseKnowledgeBase(IKnowledgeBase, ABC):
    """
    Clase base abstracta para knowledge bases.

    Provee funcionalidad común y estructura para todos
    los knowledge bases específicos de dispositivos.
    """

    def enrich_features(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Enriquece features con información del knowledge base.

        Esta implementación base delega a métodos específicos
        que deben ser implementados por las subclases.

        Args:
            features: Features ya extraídas
            context: Contexto de mapeo para logging

        Returns:
            Features enriquecidas
        """
        context.debug(f"Enriqueciendo features con {self.__class__.__name__}")

        # Template method pattern:
        # Las subclases implementan _do_enrich_features
        return self._do_enrich_features(features, context)

    def _do_enrich_features(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Método template para enriquecer features.

        Las subclases deben implementar este método con su
        lógica específica de enriquecimiento.

        Args:
            features: Features a enriquecer
            context: Contexto de mapeo

        Returns:
            Features enriquecidas
        """
        # Implementación por defecto: retornar sin cambios
        return features

    def get_year_for_generation(
        self,
        device_type: str,
        generation: int
    ) -> Optional[int]:
        """
        Retorna el año de lanzamiento para una generación.

        Args:
            device_type: Tipo de dispositivo
            generation: Número de generación

        Returns:
            Año de lanzamiento o None
        """
        # Implementación por defecto
        return None
