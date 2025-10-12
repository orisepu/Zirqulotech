"""
Clase base para Rules.

Define la interfaz común para todas las reglas de filtrado.
"""

from abc import ABC, abstractmethod
from typing import List

from productos.mapping.core.interfaces import IRule
from productos.mapping.core.types import (
    ExtractedFeatures,
    MatchCandidate,
    MappingContext,
)


class BaseRule(IRule, ABC):
    """
    Clase base abstracta para reglas de filtrado.

    Las reglas filtran candidatos devueltos por matchers,
    aplicando validaciones de negocio adicionales.

    Template method pattern:
    1. Verificar si la regla aplica (_should_apply)
    2. Filtrar candidatos (_filter_candidates)
    3. Log resultados
    """

    def apply(
        self,
        candidates: List[MatchCandidate],
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Aplica la regla de filtrado a los candidatos.

        Args:
            candidates: Lista de candidatos a filtrar
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            Lista filtrada de candidatos
        """
        context.debug(f"Aplicando regla: {self.get_rule_name()}")

        # Si no hay candidatos, retornar vacío
        if not candidates:
            context.debug("No hay candidatos para filtrar")
            return []

        # Verificar si la regla aplica
        if not self._should_apply(features, context):
            context.debug(f"Regla {self.get_rule_name()} no aplica, manteniendo todos los candidatos")
            return candidates

        # Filtrar candidatos
        initial_count = len(candidates)
        filtered = self._filter_candidates(features, candidates, context)
        final_count = len(filtered)

        removed = initial_count - final_count
        if removed > 0:
            context.info(
                f"Regla {self.get_rule_name()}: "
                f"eliminados {removed} candidatos ({final_count} restantes)"
            )
        else:
            context.debug(f"Regla {self.get_rule_name()}: ningún candidato eliminado")

        return filtered

    @abstractmethod
    def get_rule_name(self) -> str:
        """
        Retorna el nombre de la regla para logging.

        Las subclases DEBEN implementar este método.

        Returns:
            Nombre legible de la regla
        """
        pass

    def _should_apply(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> bool:
        """
        Determina si la regla debe aplicarse.

        Las subclases pueden override para implementar
        lógica condicional (ej: solo aplicar si features.year existe).

        Args:
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            True si la regla debe aplicarse
        """
        # Por defecto, siempre aplicar
        return True

    def _filter_candidates(
        self,
        features: ExtractedFeatures,
        candidates: List[MatchCandidate],
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra los candidatos según la lógica de la regla.

        Las subclases DEBEN implementar este método.

        Args:
            features: Features extraídas
            candidates: Lista de candidatos
            context: Contexto de mapeo

        Returns:
            Lista filtrada de candidatos
        """
        # Implementación por defecto: retornar todos sin filtrar
        return candidates
