"""
Connectivity Filter - Filtra por conectividad (Wi-Fi vs Cellular).

Crítico para iPads que tienen dos versiones de cada modelo:
- Wi-Fi only
- Wi-Fi + Cellular

En la BD estos aparecen como modelos separados con "Wi-Fi" o "Cellular" en la descripción.
"""

from typing import List

from productos.mapping.rules.base import BaseRule
from productos.mapping.core.types import MatchCandidate, ExtractedFeatures, MappingContext


class ConnectivityFilter(BaseRule):
    """
    Filtra candidatos por conectividad (Wi-Fi vs Cellular).

    Reglas:
    - Si has_cellular=True: solo aceptar modelos con "Cellular" en descripción
    - Si has_cellular=False: solo aceptar modelos con "Wi-Fi" (y NO "Cellular")
    """

    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla para logging."""
        return "ConnectivityFilter"

    def apply(
        self,
        candidates: List[MatchCandidate],
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra candidatos por conectividad.

        Args:
            candidates: Lista de candidatos
            features: Features con has_wifi y has_cellular
            context: Contexto de mapeo

        Returns:
            Candidatos filtrados
        """
        # Si no tenemos info de conectividad, no filtrar
        if not features.has_wifi and not features.has_cellular:
            context.debug("No hay info de conectividad, saltando filtro")
            return candidates

        filtered = []

        for candidate in candidates:
            desc = candidate.modelo_descripcion.lower()

            # Si buscamos Cellular
            if features.has_cellular:
                if "cellular" in desc or "4g" in desc or "5g" in desc or "lte" in desc:
                    filtered.append(candidate)
                    context.debug(f"✓ {candidate.modelo_descripcion}: Cellular match")
                else:
                    context.debug(f"✗ {candidate.modelo_descripcion}: No es Cellular")

            # Si buscamos solo Wi-Fi (sin Cellular)
            else:
                # Debe tener "wi-fi" o "wifi" Y NO tener "cellular"
                has_wifi_keyword = "wi-fi" in desc or "wifi" in desc
                has_cellular_keyword = "cellular" in desc or "4g" in desc or "5g" in desc

                if has_wifi_keyword and not has_cellular_keyword:
                    filtered.append(candidate)
                    context.debug(f"✓ {candidate.modelo_descripcion}: Wi-Fi only match")
                else:
                    context.debug(f"✗ {candidate.modelo_descripcion}: No es Wi-Fi only")

        context.info(f"ConnectivityFilter: {len(candidates)} → {len(filtered)} candidatos")
        return filtered
