"""
Year Filter - Filtra candidatos por año.

Asegura que los candidatos tengan exactamente el año esperado.
Crítico para diferenciar generaciones de iPhone (ej: 13 vs 14).
"""

from typing import List

from productos.mapping.rules.base import BaseRule
from productos.mapping.core.types import (
    ExtractedFeatures,
    MatchCandidate,
    MappingContext,
)


class YearFilter(BaseRule):
    """
    Filtra candidatos por año de lanzamiento.

    Solo mantiene candidatos cuyo año coincida exactamente
    con el año extraído de las features.

    Ejemplo:
        Features: year=2021 (iPhone 13)
        Candidatos:
        - iPhone 13 Pro (2021) ✅ mantener
        - iPhone 14 Pro (2022) ❌ eliminar
    """

    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla."""
        return "YearFilter"

    def _should_apply(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> bool:
        """
        Solo aplicar si tenemos año en features.

        Args:
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            True si features.year está disponible
        """
        if not features.year:
            context.debug("YearFilter: No hay año en features, saltando filtro")
            return False

        context.debug(f"YearFilter: Filtrando por año {features.year}")
        return True

    def _filter_candidates(
        self,
        features: ExtractedFeatures,
        candidates: List[MatchCandidate],
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra candidatos por año.

        Args:
            features: Features con año esperado
            candidates: Lista de candidatos
            context: Contexto de mapeo

        Returns:
            Solo candidatos con año correcto
        """
        expected_year = features.year
        filtered = []

        for candidate in candidates:
            # Permitir candidatos con año=0 o None (año no especificado)
            # Estos son considerados como "compatibles con cualquier año"
            if candidate.modelo_anio == expected_year:
                filtered.append(candidate)
                context.debug(
                    f"YearFilter: Mantener {candidate.modelo_descripcion} "
                    f"(año {candidate.modelo_anio})"
                )
            elif candidate.modelo_anio in (0, None):
                filtered.append(candidate)
                context.debug(
                    f"YearFilter: Mantener {candidate.modelo_descripcion} "
                    f"(año no especificado, compatible con {expected_year})"
                )
            else:
                context.debug(
                    f"YearFilter: Eliminar {candidate.modelo_descripcion} "
                    f"(año {candidate.modelo_anio} != {expected_year})"
                )

        return filtered
