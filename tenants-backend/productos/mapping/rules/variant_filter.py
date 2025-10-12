"""
Variant Filter - Filtra candidatos por variante.

Asegura que las variantes coincidan exactamente:
- "Pro" no debe matchear "Pro Max"
- "regular" no debe matchear "Pro"
- etc.
"""

from typing import List

from productos.mapping.rules.base import BaseRule
from productos.mapping.core.types import (
    ExtractedFeatures,
    MatchCandidate,
    MappingContext,
)


class VariantFilter(BaseRule):
    """
    Filtra candidatos por variante exacta.

    Casos críticos:
    - Buscando "Pro" → eliminar "Pro Max"
    - Buscando "Pro Max" → mantener solo "Pro Max"
    - Buscando regular → eliminar Pro/Max/Plus/mini

    Ejemplo:
        Features: variant="Pro" (sin Max)
        Candidatos:
        - iPhone 13 Pro ✅ mantener
        - iPhone 13 Pro Max ❌ eliminar (tiene Max)
        - iPhone 13 ❌ eliminar (falta Pro)
    """

    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla."""
        return "VariantFilter"

    def _should_apply(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> bool:
        """
        Siempre aplicar el filtro de variante.

        Incluso cuando variant es None, necesitamos filtrar para
        excluir modelos con variantes (Pro, Plus, mini, etc.)

        Args:
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            True siempre (el filtro es importante incluso sin variante)
        """
        if features.variant:
            context.debug(f"VariantFilter: Filtrando por variante '{features.variant}'")
        else:
            context.debug("VariantFilter: Filtrando por modelo regular (sin variantes)")

        return True

    def _filter_candidates(
        self,
        features: ExtractedFeatures,
        candidates: List[MatchCandidate],
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra candidatos por variante.

        Args:
            features: Features con variante esperada
            candidates: Lista de candidatos
            context: Contexto de mapeo

        Returns:
            Solo candidatos con variante correcta
        """
        expected_variant = features.variant
        filtered = []

        for candidate in candidates:
            if self._variant_matches(expected_variant, candidate.modelo_descripcion):
                filtered.append(candidate)
                context.debug(
                    f"VariantFilter: Mantener {candidate.modelo_descripcion} "
                    f"(variante '{expected_variant}' coincide)"
                )
            else:
                context.debug(
                    f"VariantFilter: Eliminar {candidate.modelo_descripcion} "
                    f"(variante '{expected_variant}' no coincide)"
                )

        return filtered

    def _variant_matches(self, expected_variant: str, descripcion: str) -> bool:
        """
        Verifica si la variante coincide con la descripción.

        Casos especiales:
        - "Pro Max": debe tener "Pro" Y "Max"
        - "Pro": debe tener "Pro" pero NO "Max"
        - "Plus": debe tener "Plus"
        - "mini": debe tener "mini"
        - "SE": debe tener "SE"
        - Variantes gen 10: "X", "XR", "XS", "XS Max"

        Args:
            expected_variant: Variante esperada
            descripcion: Descripción del modelo

        Returns:
            True si la variante coincide
        """
        # Comparación case-insensitive
        desc_lower = descripcion.lower()

        # Caso 1: Pro Max (debe tener ambos)
        if expected_variant == "Pro Max":
            return "pro" in desc_lower and "max" in desc_lower

        # Caso 2: Pro (debe tener Pro pero NO Max)
        elif expected_variant == "Pro":
            return "pro" in desc_lower and "max" not in desc_lower

        # Caso 3: Variantes gen 10 (XS Max es especial)
        elif expected_variant == "XS Max":
            return "xs" in desc_lower and "max" in desc_lower

        elif expected_variant in ("XS", "XR", "X"):
            # XS sin Max, XR, X
            return expected_variant.lower() in desc_lower

        # Caso 4: Otras variantes (Plus, mini, SE)
        elif expected_variant in ("Plus", "mini", "SE"):
            return expected_variant.lower() in desc_lower

        # Caso 5: Sin variante (regular)
        # Si buscamos regular, NO debe tener variantes
        else:
            return not self._has_any_variant(descripcion)

    def _has_any_variant(self, descripcion: str) -> bool:
        """
        Verifica si la descripción tiene alguna variante.

        Args:
            descripcion: Descripción del modelo

        Returns:
            True si tiene variante
        """
        desc_lower = descripcion.lower()
        variants = ["pro", "plus", "mini", "se", "xr", "xs"]
        return any(v in desc_lower for v in variants)
