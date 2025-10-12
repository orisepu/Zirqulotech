"""
Generation Matcher - Estrategia de matching por generación.

Busca dispositivos en la BD basándose en generación y año.
Esta es la estrategia principal para iPhones modernos (13-17).

Scoring:
- Coincidencia de año: 30%
- Generación en descripción: 30%
- Variante (Pro/Max/Plus): 20%
- Tipo de dispositivo: 20%
"""

import re
from typing import Optional
from django.db.models import Q, QuerySet

from productos.mapping.matchers.base import BaseMatcher
from productos.mapping.core.types import (
    ExtractedFeatures,
    MappingContext,
    MatchStrategy,
)
from productos.models.modelos import Modelo


class GenerationMatcher(BaseMatcher):
    """
    Matcher por generación y año.

    Estrategia óptima para:
    - iPhone 13-17 (con año conocido desde KB)
    - iPad con generación numérica
    - Cualquier dispositivo con generación clara

    Score components:
    - Año coincide: +0.3
    - Generación en descripción: +0.3
    - Variante coincide (Pro/Max/Plus): +0.2
    - Tipo de dispositivo coincide: +0.2
    """

    def _get_filtered_queryset(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> QuerySet:
        """
        Filtra modelos por generación y año.

        Args:
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            QuerySet de modelos filtrados
        """
        # Validar que tenemos device_type
        if not features.device_type:
            context.warning("No hay device_type, no se puede filtrar")
            return Modelo.objects.none()

        # Para iPads, el tipo en BD es siempre "iPad", no "iPad Pro"/"iPad Air"/"iPad mini"
        # La variante está en la descripción
        tipo_para_filtro = features.device_type.value
        if "iPad" in tipo_para_filtro and tipo_para_filtro != "iPad":
            tipo_para_filtro = "iPad"
            context.debug(f"iPad Pro/Air/mini detectado, usando tipo base: {tipo_para_filtro}")

        # Query base: filtrar por tipo de dispositivo
        queryset = Modelo.objects.filter(tipo__iexact=tipo_para_filtro)
        context.debug(f"Filtrando por tipo: {tipo_para_filtro}")

        # Filtrar por año si está disponible (crítico para diferenciar generaciones)
        # NOTA: Incluir modelos con año=0 o None (año no especificado) para
        # compatibilidad con datos legacy
        if features.year:
            models_with_year = Modelo.objects.filter(
                tipo__iexact=features.device_type.value
            ).exclude(año__in=[0, None]).exists()

            if models_with_year:
                # Filtrar: año coincide O año no especificado (0/None)
                queryset = queryset.filter(
                    Q(año=features.year) | Q(año__in=[0, None])
                )
                context.debug(f"Filtrando por año: {features.year} (incluye modelos sin año)")
            else:
                context.warning(
                    f"No hay modelos con año configurado, omitiendo filtro de año. "
                    f"Recomendado: actualizar BD con años correctos"
                )

        # Filtrar por variante si está especificada
        # NOTA: Para MacBooks, NO filtrar por variante aquí. El variant="Pro" se refiere
        # a "MacBook Pro" (vs Air), NO a la variante del chip (M2 Pro vs M2 Max).
        # ChipVariantFilter se encarga de distinguir las variantes de chip.
        is_macbook = "MacBook" in features.device_type.value if features.device_type else False

        if features.variant and not is_macbook:
            queryset = self._filter_by_variant(queryset, features, context)

        context.info(f"Queryset filtrado: {queryset.count()} modelos encontrados")
        return queryset

    def _filter_by_variant(
        self,
        queryset: QuerySet,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> QuerySet:
        """
        Filtra por variante de iPhone.

        Args:
            queryset: QuerySet base
            features: Features con variante
            context: Contexto de mapeo

        Returns:
            QuerySet filtrado por variante
        """
        variant = features.variant

        # Casos especiales: variantes que requieren filtrado específico
        if variant == "Pro Max":
            # Pro Max: debe tener "Pro" y "Max" en la descripción
            queryset = queryset.filter(
                Q(descripcion__icontains="Pro") &
                Q(descripcion__icontains="Max")
            )
            context.debug("Filtrando por variante: Pro Max")

        elif variant == "Pro":
            # Pro: debe tener "Pro" pero NO "Max"
            queryset = queryset.filter(
                descripcion__icontains="Pro"
            ).exclude(
                descripcion__icontains="Max"
            )
            context.debug("Filtrando por variante: Pro")

        elif variant == "Plus":
            queryset = queryset.filter(descripcion__icontains="Plus")
            context.debug("Filtrando por variante: Plus")

        elif variant == "mini":
            queryset = queryset.filter(descripcion__icontains="mini")
            context.debug("Filtrando por variante: mini")

        elif variant in ("XS Max", "XS", "XR", "X"):
            # Variantes especiales de gen 10
            queryset = queryset.filter(descripcion__icontains=variant)
            context.debug(f"Filtrando por variante gen 10: {variant}")

        elif variant == "SE":
            queryset = queryset.filter(descripcion__icontains="SE")
            context.debug("Filtrando por variante: SE")

        else:
            # Si no hay variante específica, filtrar modelos SIN variante
            # (excluir Pro, Max, Plus, mini, SE)
            queryset = queryset.exclude(
                Q(descripcion__icontains="Pro") |
                Q(descripcion__icontains="Plus") |
                Q(descripcion__icontains="mini") |
                Q(descripcion__icontains="SE")
            )
            context.debug("Filtrando: iPhone regular (sin variante)")

        return queryset

    def calculate_score(
        self,
        features: ExtractedFeatures,
        modelo: Modelo
    ) -> float:
        """
        Calcula score de coincidencia.

        Components:
        - Año coincide: +0.3
        - Generación en descripción: +0.3
        - Variante coincide: +0.2
        - Tipo de dispositivo: +0.2

        Args:
            features: Features extraídas
            modelo: Modelo candidato

        Returns:
            Score entre 0.0 y 1.0
        """
        score = 0.0

        # 1. Tipo de dispositivo coincide (+0.2)
        if features.device_type and modelo.tipo == features.device_type.value:
            score += 0.2

        # 2. Año coincide (+0.3) - CRÍTICO
        if features.year and modelo.año == features.year:
            score += 0.3

        # 3. Generación en descripción (+0.3)
        if features.generation:
            if self._generation_in_description(features.generation, modelo.descripcion):
                score += 0.3

        # 4. Variante coincide (+0.2)
        if features.variant:
            if self._variant_matches(features.variant, modelo.descripcion):
                score += 0.2
        else:
            # Si no buscamos variante, penalizar si el modelo tiene variante
            if not self._has_variant(modelo.descripcion):
                score += 0.2

        return min(score, 1.0)

    def _generation_in_description(self, generation: int, descripcion: str) -> bool:
        """
        Verifica si la generación está en la descripción.

        Soporta dos formatos:
        - Número simple: "iPhone 13 Pro" → generation=13
        - Formato ordinal: "iPhone SE (3rd generation)" → generation=3

        Args:
            generation: Número de generación
            descripcion: Descripción del modelo

        Returns:
            True si la generación aparece en la descripción
        """
        # Patrón 1: Número simple con word boundaries
        # Ej: "iPhone 13 Pro" contiene "13"
        simple_pattern = rf'\b{generation}\b'
        if re.search(simple_pattern, descripcion):
            return True

        # Patrón 2: Formato ordinal (1st, 2nd, 3rd, 4th, etc.)
        # Ej: "iPhone SE (3rd generation)" contiene "3rd"
        ordinal_suffix = self._get_ordinal_suffix(generation)
        ordinal_pattern = rf'{generation}{ordinal_suffix}\b'
        return bool(re.search(ordinal_pattern, descripcion, re.IGNORECASE))

    def _get_ordinal_suffix(self, number: int) -> str:
        """
        Obtiene el sufijo ordinal para un número (1st, 2nd, 3rd, 4th, etc.)

        Args:
            number: Número entero

        Returns:
            Sufijo ordinal ("st", "nd", "rd", "th")
        """
        if 11 <= number <= 13:
            return 'th'
        last_digit = number % 10
        if last_digit == 1:
            return 'st'
        elif last_digit == 2:
            return 'nd'
        elif last_digit == 3:
            return 'rd'
        else:
            return 'th'

    def _variant_matches(self, variant: str, descripcion: str) -> bool:
        """
        Verifica si la variante coincide con la descripción.

        Args:
            variant: Variante buscada (Pro, Max, Plus, mini, etc.)
            descripcion: Descripción del modelo

        Returns:
            True si la variante coincide
        """
        # Casos especiales
        if variant == "Pro Max":
            return "Pro" in descripcion and "Max" in descripcion
        elif variant == "Pro":
            return "Pro" in descripcion and "Max" not in descripcion
        else:
            return variant in descripcion

    def _has_variant(self, descripcion: str) -> bool:
        """
        Verifica si la descripción tiene alguna variante.

        Args:
            descripcion: Descripción del modelo

        Returns:
            True si tiene variante (Pro, Max, Plus, mini, SE)
        """
        variants = ["Pro", "Plus", "mini", "SE", "XR", "XS"]
        return any(v in descripcion for v in variants)

    def _get_match_strategy(self) -> MatchStrategy:
        """Retorna la estrategia de este matcher."""
        return MatchStrategy.GENERATION
