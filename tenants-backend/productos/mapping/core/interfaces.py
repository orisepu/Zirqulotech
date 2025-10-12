"""
Interfaces (protocolos) para el sistema de mapeo v4.

Define contratos claros para cada componente siguiendo
el principio de Dependency Inversion (SOLID).

Usamos Protocol de typing para interfaces estructurales que permiten
duck typing con type checking.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from django.db.models import QuerySet

from .types import (
    LikewizeInput,
    ExtractedFeatures,
    MatchCandidate,
    MatchResult,
    MappingContext,
)


class IFeatureExtractor(ABC):
    """
    Interfaz para extracción de features desde datos crudos.

    Responsabilidad: Parsear texto crudo y extraer información estructurada.
    """

    @abstractmethod
    def extract(self, input_data: LikewizeInput, context: MappingContext) -> ExtractedFeatures:
        """
        Extrae features estructuradas desde el input crudo.

        Args:
            input_data: Datos crudos de Likewize
            context: Contexto de mapeo para logging

        Returns:
            ExtractedFeatures con toda la información extraída

        Raises:
            FeatureExtractionError si el parsing falla
        """
        pass


class IKnowledgeBase(ABC):
    """
    Interfaz para knowledge bases.

    Responsabilidad: Proveer información de dominio (generación → specs).
    """

    @abstractmethod
    def enrich_features(self, features: ExtractedFeatures, context: MappingContext) -> ExtractedFeatures:
        """
        Enriquece features con información del knowledge base.

        Por ejemplo: iPhone 13 → agregar año 2021, CPU A15 Bionic.

        Args:
            features: Features ya extraídas del texto
            context: Contexto de mapeo para logging

        Returns:
            Features enriquecidas con información del KB
        """
        pass

    @abstractmethod
    def get_year_for_generation(self, device_type: str, generation: int) -> Optional[int]:
        """
        Retorna el año de lanzamiento para una generación específica.

        Args:
            device_type: "iPhone", "iPad", etc.
            generation: Número de generación

        Returns:
            Año de lanzamiento o None si no se encuentra
        """
        pass


class IMatcher(ABC):
    """
    Interfaz para estrategias de matching.

    Responsabilidad: Encontrar candidatos en la BD que coincidan con las features.
    """

    @abstractmethod
    def find_candidates(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Encuentra candidatos que coincidan con las features dadas.

        Args:
            features: Features extraídas y enriquecidas
            context: Contexto de mapeo para logging

        Returns:
            Lista de candidatos ordenados por score (mejor primero)

        Raises:
            MatcherError si la búsqueda falla
        """
        pass

    @abstractmethod
    def calculate_score(self, features: ExtractedFeatures, candidate: Any) -> float:
        """
        Calcula el score de coincidencia para un candidato.

        Args:
            features: Features del input
            candidate: Modelo candidato de la BD

        Returns:
            Score entre 0.0 y 1.0 (1.0 = match perfecto)
        """
        pass


class IRule(ABC):
    """
    Interfaz para reglas de filtrado.

    Responsabilidad: Aplicar reglas de negocio para filtrar candidatos.
    """

    @abstractmethod
    def apply(
        self,
        candidates: List[MatchCandidate],
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Aplica la regla para filtrar candidatos.

        Args:
            candidates: Lista de candidatos a filtrar
            features: Features del input
            context: Contexto de mapeo para logging

        Returns:
            Lista filtrada de candidatos

        Note:
            Las reglas deben ser componibles y aplicarse en cadena.
        """
        pass

    @abstractmethod
    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla para logging."""
        pass


class IMappingEngine(ABC):
    """
    Interfaz para motores de mapeo.

    Responsabilidad: Orquestar el proceso completo de mapeo para un tipo de dispositivo.
    """

    @abstractmethod
    def map(self, input_data: LikewizeInput) -> MatchResult:
        """
        Ejecuta el proceso completo de mapeo.

        Args:
            input_data: Datos crudos de Likewize

        Returns:
            MatchResult con el resultado del mapeo

        Raises:
            MappingError si ocurre un error durante el proceso
        """
        pass

    @abstractmethod
    def can_handle(self, input_data: LikewizeInput) -> bool:
        """
        Verifica si este engine puede manejar el input dado.

        Args:
            input_data: Datos a verificar

        Returns:
            True si el engine puede procesar este input
        """
        pass


class IDeviceMapper(ABC):
    """
    Interfaz para el servicio principal de mapeo (facade).

    Responsabilidad: Coordinar múltiples engines y seleccionar el apropiado.
    """

    @abstractmethod
    def map(self, input_data: LikewizeInput) -> MatchResult:
        """
        Mapea input de Likewize a un modelo/capacidad en la BD.

        Args:
            input_data: Datos crudos de Likewize

        Returns:
            MatchResult con el match encontrado o error

        Raises:
            InvalidInputError si el input es inválido
            NoMatchFoundError si no se encuentra match
        """
        pass

    @abstractmethod
    def register_engine(self, engine: IMappingEngine):
        """
        Registra un engine de mapeo.

        Args:
            engine: Engine a registrar
        """
        pass
