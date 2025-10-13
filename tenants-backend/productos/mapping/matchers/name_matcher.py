"""
Name Matcher - Estrategia de matching por nombre exacto del modelo.

Busca dispositivos en la BD basándose en el nombre completo del modelo.
Esta estrategia es útil para modelos nuevos donde la KB aún no tiene información
de año/generación (ej: iPhone 16 Pro, iPhone 15 Plus).

Scoring:
- Nombre completo en descripción: 50%
- Tipo de dispositivo coincide: 20%
- Capacidad coincide: 15%
- Sin otras variantes no deseadas: 15%
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


class NameMatcher(BaseMatcher):
    """
    Matcher por nombre exacto del modelo.

    Estrategia óptima para:
    - Modelos nuevos sin info en KB (iPhone 16 Pro, iPhone 15 Plus)
    - Cuando no hay A-number disponible
    - Cuando el nombre del modelo es muy específico

    Score components:
    - Nombre completo en descripción: +0.50
    - Tipo de dispositivo coincide: +0.20
    - Capacidad NO filtrada: +0.15
    - Sin variantes no deseadas: +0.15

    Max score: 0.80 (nunca 1.0 porque puede haber ambigüedad)
    """

    def _get_filtered_queryset(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> QuerySet:
        """
        Filtra modelos por nombre completo.

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

        # Construir el nombre del modelo a buscar
        model_name = self._build_model_name(features, context)

        if not model_name:
            context.warning("No se pudo construir nombre del modelo")
            return Modelo.objects.none()

        context.info(f"Buscando por nombre: '{model_name}'")

        # Para iPads, el tipo en BD es siempre "iPad", no "iPad Pro"/"iPad Air"/"iPad mini"
        # La variante está en la descripción
        tipo_para_filtro = features.device_type.value
        if "iPad" in tipo_para_filtro and tipo_para_filtro != "iPad":
            tipo_para_filtro = "iPad"
            context.debug(f"iPad Pro/Air/mini detectado, usando tipo base: {tipo_para_filtro}")

        # Para Pixels, el tipo en BD es "SmartPhone", no "Google Pixel" o "Pixel"
        if "Pixel" in tipo_para_filtro or tipo_para_filtro == "Google Pixel":
            tipo_para_filtro = "SmartPhone"
            context.debug(f"Google Pixel detectado, usando tipo: {tipo_para_filtro}")

        # Query base: filtrar por tipo de dispositivo
        queryset = Modelo.objects.filter(tipo__iexact=tipo_para_filtro)

        # Filtrar por nombre del modelo en la descripción
        # Buscar cada palabra del nombre en la descripción
        for word in model_name.split():
            queryset = queryset.filter(descripcion__icontains=word)

        context.debug(f"Queryset con nombre: {queryset.count()} modelos")

        # Si tenemos variante, asegurarnos de que la descripción la incluya
        if features.variant:
            queryset = self._filter_by_variant(queryset, features, context)

        context.info(f"Queryset filtrado: {queryset.count()} modelos encontrados")
        return queryset

    def _build_model_name(
        self,
        features: ExtractedFeatures,
        context: Optional[MappingContext] = None
    ) -> Optional[str]:
        """
        Construye el nombre del modelo a partir de las features.

        Ej: iPhone 16 Pro, iPhone 15 Plus, iPad Pro 12.9

        Args:
            features: Features extraídas
            context: Contexto de mapeo (opcional)

        Returns:
            Nombre del modelo o None si no se puede construir
        """
        parts = []
        variant_already_in_type = False

        # Tipo de dispositivo (iPhone, iPad, iPad Pro, iPad Air, iPad mini, Pixel)
        if features.device_type:
            device_type_str = features.device_type.value

            # Caso especial: Google Pixel → Pixel (en BD están como "Pixel 6", no "Google Pixel 6")
            if "Google Pixel" in device_type_str:
                device_type_str = "Pixel"

            parts.append(device_type_str)

            # Para iPad Pro/Air/mini, el device_type YA incluye la variante
            # No agregar variante si ya está en device_type
            if features.variant:
                variant_already_in_type = features.variant.lower() in device_type_str.lower()

        # Generación (si está disponible)
        if features.generation:
            # Caso especial: Pixel "a" variant (7a, 8a) - combinar generación con "a" sin espacio
            if features.variant == "a":
                parts.append(f"{features.generation}a")
            else:
                parts.append(str(features.generation))

        # Variante (Pro, Max, Plus, mini, etc.)
        # Solo agregar si NO está ya incluida en device_type
        # Saltar "a" porque ya se agregó con la generación arriba
        if features.variant and not variant_already_in_type and features.variant != "a":
            parts.append(features.variant)

        # Si no tenemos suficiente info, retornar None
        if len(parts) < 2:
            return None

        model_name = " ".join(parts)
        if context:
            context.debug(f"Nombre del modelo construido: '{model_name}'")
        return model_name

    def _filter_by_variant(
        self,
        queryset: QuerySet,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> QuerySet:
        """
        Filtra por variante de iPhone/iPad.

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

        # Pixel-specific variants
        elif variant == "Pro Fold":
            # Pro Fold: debe tener "Pro" y "Fold" en la descripción
            queryset = queryset.filter(
                Q(descripcion__icontains="Pro") &
                Q(descripcion__icontains="Fold")
            )
            context.debug("Filtrando por variante: Pro Fold")

        elif variant == "Pro XL":
            # Pro XL: debe tener "Pro" y "XL" en la descripción
            queryset = queryset.filter(
                Q(descripcion__icontains="Pro") &
                Q(descripcion__icontains="XL")
            )
            context.debug("Filtrando por variante: Pro XL")

        elif variant == "Fold":
            # Fold solo (sin Pro)
            queryset = queryset.filter(descripcion__icontains="Fold").exclude(
                descripcion__icontains="Pro"
            )
            context.debug("Filtrando por variante: Fold")

        elif variant == "a":
            # Pixel a (7a, 8a, etc.)
            queryset = queryset.filter(descripcion__iregex=r'\d+a')
            context.debug("Filtrando por variante: a")

        else:
            # Si no hay variante específica, filtrar modelos SIN variante
            # (excluir Pro, Max, Plus, mini, SE)
            queryset = queryset.exclude(
                Q(descripcion__icontains="Pro") |
                Q(descripcion__icontains="Plus") |
                Q(descripcion__icontains="mini") |
                Q(descripcion__icontains="SE")
            )
            context.debug("Filtrando: modelo regular (sin variante)")

        return queryset

    def calculate_score(
        self,
        features: ExtractedFeatures,
        modelo: Modelo
    ) -> float:
        """
        Calcula score de coincidencia.

        Components:
        - Nombre completo en descripción: +0.50
        - Tipo de dispositivo coincide: +0.20
        - Variante coincide: +0.15
        - Sin variantes no deseadas: +0.15
        - Generación ordinal explícita: +0.10 (bonus)

        Args:
            features: Features extraídas
            modelo: Modelo candidato

        Returns:
            Score entre 0.0 y 0.80
        """
        score = 0.0

        # 1. Tipo de dispositivo coincide (+0.20)
        if features.device_type:
            expected_tipo = features.device_type.value
            # Pixel special case: BD tiene "SmartPhone" no "Google Pixel"
            if "Pixel" in expected_tipo:
                expected_tipo = "SmartPhone"

            if modelo.tipo == expected_tipo:
                score += 0.20

        # 2. Nombre del modelo en descripción (+0.50)
        model_name = self._build_model_name(features)
        if model_name:
            # Verificar que todas las palabras del nombre estén en la descripción
            name_words = model_name.split()
            words_found = sum(
                1 for word in name_words
                if word.lower() in modelo.descripcion.lower()
            )
            # Score proporcional a palabras encontradas
            score += 0.50 * (words_found / len(name_words))

        # 3. Variante coincide (+0.15)
        if features.variant:
            if self._variant_matches(features.variant, modelo.descripcion):
                score += 0.15
        else:
            # Si no buscamos variante, verificar que el modelo no tenga variante
            if not self._has_variant(modelo.descripcion):
                score += 0.15

        # 4. Bonus: Generación ordinal explícita (+0.10)
        # Preferir "(4.ª generación)" sobre "M4" cuando features.generation está presente
        if features.generation:
            if self._has_ordinal_generation(features.generation, modelo.descripcion):
                score += 0.10

        return min(score, 0.80)  # Max 80%

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
        elif variant == "Pro XL":
            return "Pro" in descripcion and "XL" in descripcion
        elif variant == "Pro Fold":
            return "Pro" in descripcion and "Fold" in descripcion
        elif variant == "Pro":
            return "Pro" in descripcion and "Max" not in descripcion and "XL" not in descripcion and "Fold" not in descripcion
        elif variant == "Fold":
            return "Fold" in descripcion and "Pro" not in descripcion
        elif variant == "a":
            # Pixel a: verifica patrón como "7a", "8a"
            import re
            return bool(re.search(r'\d+a', descripcion))
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

    def _has_ordinal_generation(self, generation: int, descripcion: str) -> bool:
        """
        Verifica si la descripción tiene generación ordinal explícita.

        Busca: "(4.ª generación)", "(4ª generación)", "(4th generation)", etc.

        Args:
            generation: Número de generación
            descripcion: Descripción del modelo

        Returns:
            True si tiene generación ordinal
        """
        # Patrón español: "(4.ª generación)" o "(4ª generación)"
        pattern_es = rf'\({generation}\.?[ªº]?\s*generaci[óo]n\)'
        if re.search(pattern_es, descripcion, re.IGNORECASE):
            return True

        # Patrón inglés: "(4th generation)"
        ordinal_suffix = self._get_ordinal_suffix(generation)
        pattern_en = rf'\({generation}{ordinal_suffix}\s+generation\)'
        if re.search(pattern_en, descripcion, re.IGNORECASE):
            return True

        return False

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

    def _get_match_strategy(self) -> MatchStrategy:
        """Retorna la estrategia de este matcher."""
        return MatchStrategy.NAME
