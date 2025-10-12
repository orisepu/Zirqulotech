"""
GPU Cores Filter - Filtra por número de GPU cores.

Crítico para MacBooks M-series que tienen múltiples configuraciones con mismo chip:
- M2 Max: 30 vs 38 GPU cores
- M3 Max: 30 vs 40 GPU cores
- M1 Max: 24 vs 32 GPU cores

Extrae los GPU cores de la descripción del modelo y los compara con el input.
"""

import re
from typing import List
from productos.mapping.rules.base import BaseRule
from productos.mapping.core.types import MatchCandidate, ExtractedFeatures, MappingContext


class GPUCoresFilter(BaseRule):
    """
    Filtra candidatos por número de GPU cores.

    Solo aplica si:
    1. Tenemos GPU cores en las features extraídas
    2. El candidato menciona GPU cores en su descripción
    """

    def __init__(self):
        """Inicializa el patrón de regex para GPU cores."""
        # Patrón para extraer GPU cores de descripción
        # Ejemplos: "30 Core GPU", "38 Core GPU", "40-Core GPU"
        # Soporta tanto "X Core GPU" como "X-Core GPU"
        self.gpu_cores_pattern = re.compile(r'(\d+)[\s-]+Core\s+GPU', re.I)

    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla para logging."""
        return "GPUCoresFilter"

    def apply(
        self,
        candidates: List[MatchCandidate],
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra candidatos por GPU cores.

        Args:
            candidates: Lista de candidatos
            features: Features con gpu_cores
            context: Contexto de mapeo

        Returns:
            Candidatos filtrados
        """
        # Si no tenemos GPU cores en el input, no filtrar
        if not features.gpu_cores:
            context.debug("No hay GPU cores info, saltando GPU cores filter")
            return candidates

        target_cores = features.gpu_cores
        context.info(f"Filtrando por GPU cores: {target_cores}")

        filtered = []

        for candidate in candidates:
            desc = candidate.modelo_descripcion

            # Extraer GPU cores de la descripción
            match = self.gpu_cores_pattern.search(desc)

            if match:
                candidate_cores = int(match.group(1))

                # Matching exacto de GPU cores
                if candidate_cores == target_cores:
                    filtered.append(candidate)
                    context.debug(f"✓ {desc}: {candidate_cores} GPU cores = {target_cores}")
                else:
                    context.debug(f"✗ {desc}: {candidate_cores} GPU cores ≠ {target_cores}")
            else:
                # Si el candidato no menciona GPU cores, incluirlo (tolerante)
                # Esto permite que funcione con modelos que no especifican GPU cores
                filtered.append(candidate)
                context.debug(f"? {desc}: No menciona GPU cores, incluyendo")

        context.info(f"GPUCoresFilter: {len(candidates)} → {len(filtered)} candidatos")
        return filtered
