"""
CPU Cores Filter - Filtra por número de CPU cores.

Crítico para MacBooks M-series que tienen múltiples configuraciones con mismo chip:
- M1 Pro: 8 vs 10 CPU cores (ambos con 14 GPU cores)
- M2 Pro: 10 vs 12 CPU cores
- M3 Pro: 11 vs 12 CPU cores

Extrae los CPU cores de la descripción del modelo y los compara con el input.
"""

import re
from typing import List
from productos.mapping.rules.base import BaseRule
from productos.mapping.core.types import MatchCandidate, ExtractedFeatures, MappingContext


class CPUCoresFilter(BaseRule):
    """
    Filtra candidatos por número de CPU cores.

    Solo aplica si:
    1. Tenemos CPU cores en las features extraídas
    2. El candidato menciona CPU cores en su descripción
    """

    def __init__(self):
        """Inicializa el patrón de regex para CPU cores."""
        # Patrón para extraer CPU cores de descripción
        # Ejemplos: "8 Core CPU", "10 Core CPU", "12-Core CPU"
        # Soporta tanto "X Core CPU" como "X-Core CPU"
        self.cpu_cores_pattern = re.compile(r'(\d+)[\s-]+Core\s+CPU', re.I)

    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla para logging."""
        return "CPUCoresFilter"

    def apply(
        self,
        candidates: List[MatchCandidate],
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra candidatos por CPU cores.

        Args:
            candidates: Lista de candidatos
            features: Features con cpu_cores
            context: Contexto de mapeo

        Returns:
            Candidatos filtrados
        """
        # Si no tenemos CPU cores en el input, no filtrar
        if not features.cpu_cores:
            context.debug("No hay CPU cores info, saltando CPU cores filter")
            return candidates

        target_cores = features.cpu_cores
        context.info(f"Filtrando por CPU cores: {target_cores}")

        filtered = []

        for candidate in candidates:
            desc = candidate.modelo_descripcion

            # Extraer CPU cores de la descripción
            match = self.cpu_cores_pattern.search(desc)

            if match:
                candidate_cores = int(match.group(1))

                # Matching exacto de CPU cores
                if candidate_cores == target_cores:
                    filtered.append(candidate)
                    context.debug(f"✓ {desc}: {candidate_cores} CPU cores = {target_cores}")
                else:
                    context.debug(f"✗ {desc}: {candidate_cores} CPU cores ≠ {target_cores}")
            else:
                # Si el candidato no menciona CPU cores, incluirlo (tolerante)
                # Esto permite que funcione con modelos que no especifican CPU cores
                filtered.append(candidate)
                context.debug(f"? {desc}: No menciona CPU cores, incluyendo")

        context.info(f"CPUCoresFilter: {len(candidates)} → {len(filtered)} candidatos")
        return filtered
