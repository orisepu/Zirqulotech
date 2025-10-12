"""
Clase base para Feature Extractors.

Define la interfaz común para todos los extractors
del sistema de mapeo.
"""

from abc import ABC
import re

from productos.mapping.core.interfaces import IFeatureExtractor
from productos.mapping.core.types import (
    LikewizeInput,
    ExtractedFeatures,
    MappingContext,
)


class BaseFeatureExtractor(IFeatureExtractor, ABC):
    """
    Clase base abstracta para feature extractors.

    Provee funcionalidad común de parsing y normalización
    que es compartida por todos los extractors.
    """

    def extract(
        self,
        input_data: LikewizeInput,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Extrae features desde el input de Likewize.

        Args:
            input_data: Datos crudos de Likewize
            context: Contexto de mapeo para logging

        Returns:
            ExtractedFeatures con toda la información extraída
        """
        context.info(f"Extrayendo features con {self.__class__.__name__}")

        # Crear features base
        features = ExtractedFeatures()
        features.original_text = input_data.model_name
        features.brand = input_data.brand_name or "Apple"

        # Template method pattern:
        # Las subclases implementan _do_extract
        features = self._do_extract(input_data, features, context)

        # Calcular confidence score
        features.extraction_confidence = self._calculate_confidence(features)

        context.info(
            f"Extracción completada: device_type={features.device_type}, "
            f"generation={features.generation}, "
            f"variant={features.variant}, "
            f"storage={features.storage_gb}, "
            f"confidence={features.extraction_confidence:.2f}"
        )

        return features

    def _do_extract(
        self,
        input_data: LikewizeInput,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Método template para extracción específica.

        Las subclases deben implementar este método con su
        lógica de extracción específica.

        Args:
            input_data: Input de Likewize
            features: Features a rellenar
            context: Contexto de mapeo

        Returns:
            Features rellenadas
        """
        # Implementación por defecto: retornar sin cambios
        return features

    def _calculate_confidence(self, features: ExtractedFeatures) -> float:
        """
        Calcula score de confianza basado en features extraídas.

        Args:
            features: Features extraídas

        Returns:
            Score entre 0.0 y 1.0
        """
        score = 0.0

        # Peso por cada feature encontrada
        if features.device_type:
            score += 0.3
        if features.generation:
            score += 0.3
        if features.storage_gb:
            score += 0.2
        if features.variant:
            score += 0.1
        if features.year:
            score += 0.1

        return min(score, 1.0)

    def _normalize_text(self, text: str) -> str:
        """
        Normaliza texto para parsing.

        Args:
            text: Texto crudo

        Returns:
            Texto normalizado
        """
        # Normalizar espacios
        text = re.sub(r'\s+', ' ', text)
        # Eliminar espacios alrededor
        text = text.strip()
        return text
