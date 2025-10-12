"""
Chip Variant Filter - Filtra por variante de chip (Pro vs Max) y modelo Intel.

Crítico para MacBooks que tienen múltiples variantes del mismo chip:

M-series (generación + variante):
- M3 (base) vs M3 Pro vs M3 Max
- M2 (base) vs M2 Pro vs M2 Max
- M1 (base) vs M1 Pro vs M1 Max

Intel (modelo + velocidad):
- Core i5 1.4 vs Core i7 2.3 vs Core i9 2.3
- Core i7 2.6 vs Core i9 2.4

Cada variante tiene diferentes specs y precios:
- M3: 8 CPU cores, 10 GPU cores
- M3 Pro: 11-12 CPU cores, 14-18 GPU cores
- M3 Max: 14-16 CPU cores, 30-40 GPU cores

En la BD aparecen como modelos separados con "Pro" o "Max" en la descripción.
"""

import re
from typing import List
from productos.mapping.rules.base import BaseRule
from productos.mapping.core.types import MatchCandidate, ExtractedFeatures, MappingContext


class ChipVariantFilter(BaseRule):
    """
    Filtra candidatos por variante de chip (base vs Pro vs Max) o modelo Intel.

    Reglas M-series:
    - Si buscamos "M3 Pro": solo aceptar modelos con "M3 Pro" en descripción
    - Si buscamos "M3 Max": solo aceptar modelos con "M3 Max" en descripción
    - Si buscamos "M3" (base): solo aceptar modelos con "M3" pero SIN "Pro" ni "Max"

    Reglas Intel:
    - Si buscamos "Core i9 2.3": solo aceptar modelos con i9 Y velocidad 2.3
    - Si buscamos "Core i7 2.6": solo aceptar modelos con i7 Y velocidad 2.6
    - Matching exacto tanto en modelo (i5/i7/i9) como en velocidad
    """

    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla para logging."""
        return "ChipVariantFilter"

    def apply(
        self,
        candidates: List[MatchCandidate],
        features: ExtractedFeatures,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra candidatos por chip (M-series: generación + variante, Intel: modelo + velocidad).

        Args:
            candidates: Lista de candidatos
            features: Features con cpu (chip completo)
            context: Contexto de mapeo

        Returns:
            Candidatos filtrados por matching exacto de chip
        """
        # Si no tenemos chip, no filtrar
        if not features.cpu:
            context.debug("No hay chip info, saltando chip variant filter")
            return candidates

        chip = features.cpu.strip()
        context.info(f"Filtrando por chip: {chip}")

        # Extraer generación/modelo y variante/velocidad del target
        target_generation, target_variant = self._parse_chip(chip)
        context.debug(f"Target: generación/modelo={target_generation}, variant/velocidad={target_variant}")

        # Si no es M-series ni Intel, no filtrar
        if target_generation is None:
            context.debug("No es M-series ni Intel, saltando filtro")
            return candidates

        filtered = []

        for candidate in candidates:
            desc = candidate.modelo_descripcion
            candidate_generation, candidate_variant = self._parse_chip(desc)

            # Matching completo: generación Y variante
            generation_match = (target_generation == candidate_generation)
            variant_match = (target_variant == candidate_variant)

            if generation_match and variant_match:
                filtered.append(candidate)
                context.debug(
                    f"✓ {desc}: {candidate_generation} {candidate_variant} "
                    f"= {target_generation} {target_variant}"
                )
            else:
                context.debug(
                    f"✗ {desc}: {candidate_generation} {candidate_variant} "
                    f"≠ {target_generation} {target_variant}"
                )

        context.info(f"ChipVariantFilter: {len(candidates)} → {len(filtered)} candidatos")
        return filtered

    def _parse_chip(self, text: str) -> tuple[str | None, str | None]:
        """
        Extrae generación/modelo y variante del chip desde un texto.

        Args:
            text: Texto (chip o descripción del modelo)

        Returns:
            (generación/modelo, variante/velocidad) tupla
            Ejemplos M-series:
            - "M3 Max" → ("M3", "Max")
            - "M2 Pro" → ("M2", "Pro")
            - "M1" → ("M1", "base")
            Ejemplos Intel Core:
            - "Core i9 2.3" → ("i9", "2.3")
            - "Core i7 2.6" → ("i7", "2.6")
            Ejemplos Intel Xeon:
            - "Intel Xeon W 14 Core 2.5" → ("Xeon", "14-2.5")
            - "iMac Pro (2017) A1862 Intel Xeon W 14 Core 2.5" → ("Xeon", "14-2.5")
        """
        text_lower = text.lower()

        # 1. Detectar Intel Xeon PRIMERO (más específico)
        # Patrón: "intel xeon w 14 core 2.5", "xeon w 18 core 2.3"
        xeon_match = re.search(r'(?:intel\s+)?xeon(?:\s+w)?\s+(\d+)\s+core\s+(\d+\.\d+)', text_lower)
        if xeon_match:
            cores = xeon_match.group(1)  # "14", "18", "10"
            speed = xeon_match.group(2)  # "2.5", "2.3", "3.0"
            # Retornar como "Xeon" y "cores-speed" para matching
            return "Xeon", f"{cores}-{speed}"

        # 2. Detectar Intel Core i3/i5/i7/i9 + velocidad
        # Patrón: "core i3 1.1", "core i9 2.3", "core i7 2.6", etc.
        intel_match = re.search(r'core\s+i([3579])\s+(\d+\.\d+)', text_lower)
        if intel_match:
            model = f"i{intel_match.group(1)}"  # "i3", "i5", "i7", "i9"
            speed = intel_match.group(2)        # "1.1", "2.3", "2.6", "1.4"
            return model, speed

        # 3. Detectar generación M-series
        generation = None
        for i in [1, 2, 3, 4]:
            if f"m{i}" in text_lower:
                generation = f"M{i}"
                break

        # Si no es M-series ni Intel, retornar None
        if generation is None:
            return None, None

        # 4. Detectar variante M-series - IMPORTANTE: buscar Max ANTES de Pro
        # porque "MacBook Pro ... M2 Max" contiene ambos "Pro" y "Max"
        variant = "base"  # Default

        # Buscar específicamente "M{X} Max" o "M{X} Pro" después de la generación
        # Esto evita confusión con "MacBook Pro" en el nombre del producto
        if f"{generation.lower()} max" in text_lower:
            variant = "Max"
        elif f"{generation.lower()} pro" in text_lower:
            variant = "Pro"

        return generation, variant

    def _get_chip_variant(self, text: str) -> str | None:
        """
        Determina la variante del chip desde un texto (DEPRECATED - usar _parse_chip).

        Args:
            text: Texto (chip o descripción del modelo)

        Returns:
            "Pro", "Max", "base", o None si no es M-series
        """
        _, variant = self._parse_chip(text)
        return variant
