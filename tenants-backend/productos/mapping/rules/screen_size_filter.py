"""
Screen Size Filter - Filtra por tamaño de pantalla.

Crítico para iPad Pro que viene en múltiples tamaños:
- 9.7" (2016)
- 10.5" (2017)
- 11" (2018-2024)
- 12.9" (2015-2024)
- 13" (2024, reemplaza 12.9")

También útil para iPad Air con tamaños de 11" y 13" (gen 6, 2024).
"""

import re
from typing import List

from productos.mapping.rules.base import BaseRule
from productos.mapping.core.types import MatchCandidate, ExtractedFeatures, MappingContext


class ScreenSizeFilter(BaseRule):
    """
    Filtra candidatos por tamaño de pantalla.

    Busca el tamaño en la descripción del modelo:
    - "iPad Pro (12,9 pulgadas)" → 12.9"
    - "iPad Pro 11-inch" → 11"
    - "iPad Air 13 pulgadas" → 13"

    Usa matching flexible para variaciones: "12,9", "12.9", "12.9-inch", etc.
    """

    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla para logging."""
        return "ScreenSizeFilter"

    def __init__(self):
        """Inicializa con patrones de matching."""
        # Patrones para diferentes formatos de tamaño
        self.size_patterns = [
            # "12,9 pulgadas" o "de 12,9 pulgadas" (español con coma)
            re.compile(r'(?:de\s+)?(\d+),(\d+)\s*pulgadas', re.I),
            # "12.9 pulgadas" o "de 12.9 pulgadas" (español con punto)
            re.compile(r'(?:de\s+)?(\d+)\.(\d+)\s*pulgadas', re.I),
            # "12.9-inch" (inglés con guión)
            re.compile(r'(\d+)\.(\d+)-inch', re.I),
            # "12.9 inch" (inglés sin guión)
            re.compile(r'(\d+)\.(\d+)\s*inch', re.I),
            # "12.9''" (con comillas dobles simples)
            re.compile(r'(\d+)\.(\d+)\'\'', re.I),
            # "12.9\"" (con comillas)
            re.compile(r'(\d+)\.(\d+)"', re.I),
            # "11 pulgadas" o "de 11 pulgadas" (entero)
            re.compile(r'(?:de\s+)?(\d+)\s*pulgadas', re.I),
            # "11-inch" (entero)
            re.compile(r'(\d+)-inch', re.I),
            # "11 inch" (entero)
            re.compile(r'(\d+)\s*inch', re.I),
            # "11''" (entero con comillas dobles simples)
            re.compile(r'(\d+)\'\'', re.I),
            # "11\"" (entero con comillas)
            re.compile(r'(\d+)"', re.I),
        ]

    def apply(
        self,
        candidates: List[MatchCandidate],
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra candidatos por tamaño de pantalla.

        Args:
            candidates: Lista de candidatos
            features: Features con screen_size
            context: Contexto de mapeo

        Returns:
            Candidatos filtrados
        """
        # Si no tenemos tamaño de pantalla, no filtrar
        if not features.screen_size:
            context.debug("No hay screen_size, saltando filtro")
            return candidates

        target_size = features.screen_size
        context.info(f"Filtrando por tamaño de pantalla: {target_size}\"")

        filtered = []

        for candidate in candidates:
            desc = candidate.modelo_descripcion

            # Extraer tamaño de la descripción del candidato
            candidate_size = self._extract_size_from_description(desc)

            if candidate_size:
                # Matching exacto sin tolerancia
                # Diferentes tamaños son modelos distintos (12.9" ≠ 13.0")
                if candidate_size == target_size:
                    filtered.append(candidate)
                    context.debug(f"✓ {desc}: tamaño {candidate_size}\" match con {target_size}\"")
                else:
                    context.debug(f"✗ {desc}: tamaño {candidate_size}\" no match con {target_size}\" (diff: {abs(candidate_size - target_size):.1f}\")")
            else:
                # Si no encontramos tamaño en la descripción:
                # - Para iPads: EXCLUIR (el tamaño es crítico y siempre está en la descripción)
                # - Para iMacs/MacBooks: INCLUIR (el tamaño puede no estar en la descripción)
                device_type_str = str(features.device_type.value if features.device_type else "")
                is_ipad = "iPad" in device_type_str

                if is_ipad:
                    context.debug(f"✗ {desc}: iPad sin tamaño extraíble, excluyendo")
                else:
                    # iMac/MacBook: permitir si no tiene tamaño en descripción
                    filtered.append(candidate)
                    context.debug(f"✓ {desc}: iMac/MacBook sin tamaño en descripción, incluyendo")

        context.info(f"ScreenSizeFilter: {len(candidates)} → {len(filtered)} candidatos")
        return filtered

    def _extract_size_from_description(self, description: str) -> float | None:
        """
        Extrae el tamaño de pantalla de una descripción.

        Args:
            description: Descripción del modelo

        Returns:
            Tamaño en pulgadas o None
        """
        for pattern in self.size_patterns:
            match = pattern.search(description)
            if match:
                groups = match.groups()

                # Si tiene decimal (grupo 1 + grupo 2)
                if len(groups) == 2:
                    whole = groups[0]
                    decimal = groups[1]
                    return float(f"{whole}.{decimal}")

                # Si es entero (solo grupo 1)
                elif len(groups) == 1:
                    return float(groups[0])

        return None
