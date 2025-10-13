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

        Soporta variantes específicas por fabricante:

        Apple:
        - "Pro Max": debe tener "Pro" Y "Max"
        - "Pro": debe tener "Pro" pero NO "Max"
        - "Plus", "mini", "SE"
        - Variantes gen 10: "X", "XR", "XS", "XS Max"

        Google Pixel:
        - "Pro XL": debe tener "Pro" Y "XL"
        - "Pro Fold": debe tener "Pro" Y "Fold"
        - "Fold": solo Fold, sin Pro
        - "a": patrón como "7a", "8a"

        Args:
            expected_variant: Variante esperada
            descripcion: Descripción del modelo

        Returns:
            True si la variante coincide
        """
        import re  # Import at function start to avoid UnboundLocalError

        # Comparación case-insensitive
        desc_lower = descripcion.lower()

        # === VARIANTES DE GOOGLE PIXEL ===
        # Detectar si es Pixel por la descripción (más seguro que depender de features)
        is_pixel = "pixel" in desc_lower

        if is_pixel:
            # Pixel-specific: Pro Fold (debe tener ambos)
            if expected_variant == "Pro Fold":
                return "pro" in desc_lower and "fold" in desc_lower

            # Pixel-specific: Pro XL (debe tener ambos)
            elif expected_variant == "Pro XL":
                return "pro" in desc_lower and "xl" in desc_lower

            # Pixel-specific: Pro (debe tener Pro pero NO XL, Fold)
            elif expected_variant == "Pro":
                return ("pro" in desc_lower and
                        "xl" not in desc_lower and
                        "fold" not in desc_lower)

            # Pixel-specific: Fold (sin Pro)
            elif expected_variant == "Fold":
                return "fold" in desc_lower and "pro" not in desc_lower

            # Pixel-specific: a (7a, 8a, etc.)
            elif expected_variant == "a":
                return bool(re.search(r'\d+a', desc_lower))

            # Sin variante: Pixel regular (no debe tener Pro, XL, Fold, a)
            elif not expected_variant:
                return not any(v in desc_lower for v in ["pro", "xl", "fold"]) and not bool(re.search(r'\d+a', desc_lower))

        # === VARIANTES DE APPLE (iPhone, iPad, Mac) ===
        else:
            # Apple: Pro Max (debe tener ambos)
            if expected_variant == "Pro Max":
                return "pro" in desc_lower and "max" in desc_lower

            # Apple: Pro (debe tener Pro pero NO Max)
            elif expected_variant == "Pro":
                return "pro" in desc_lower and "max" not in desc_lower

            # Variantes gen 10 (XS Max es especial)
            elif expected_variant == "XS Max":
                return "xs" in desc_lower and "max" in desc_lower

            elif expected_variant in ("XS", "XR", "X"):
                # XS sin Max, XR, X
                return expected_variant.lower() in desc_lower

            # Otras variantes (Plus, mini, SE)
            elif expected_variant in ("Plus", "mini", "SE"):
                return expected_variant.lower() in desc_lower

        # Caso genérico: Sin variante (regular)
        # Si buscamos regular, NO debe tener variantes
        if not expected_variant:
            return not self._has_any_variant(descripcion)

        # Si llegamos aquí, no coincide
        return False

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
