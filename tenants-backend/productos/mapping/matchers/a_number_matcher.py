"""
A-Number Matcher - Estrategia de matching por A-number exacto.

Busca dispositivos en la BD basándose en el A-number (identificador físico de Apple).
Esta es la estrategia MÁS PRECISA para dispositivos Apple cuando el A-number está disponible.

El A-number (ej: A2816, A2337, A1419) identifica el modelo físico exacto del dispositivo.
Sin embargo, algunos A-numbers son ambiguos (ej: A2816 = Mac mini M2 base Y Mac mini M2 Pro),
por lo que SIEMPRE se debe combinar con filtros adicionales (cpu_cores, gpu_cores, etc.)

Scoring:
- A-number exacto: 40%
- Año coincide: 25%
- Tipo de dispositivo: 25%
- Variante coincide: 10%
Total máximo: 100% (pero reducido a 85% para indicar que siempre requiere filtros)

Esta estrategia se ejecuta ANTES de GenerationMatcher para mayor precisión.
"""

from typing import Optional
from django.db.models import Q, QuerySet

from productos.mapping.matchers.base import BaseMatcher
from productos.mapping.core.types import (
    ExtractedFeatures,
    MappingContext,
    MatchStrategy,
)
from productos.models.modelos import Modelo


class ANumberMatcher(BaseMatcher):
    """
    Matcher por A-number exacto.

    Estrategia óptima para:
    - Macs con A-number conocido (MacBook Pro, Mac mini, iMac, etc.)
    - iPhones con A-number extraído del nombre
    - iPads con A-number disponible

    Score components:
    - A-number exacto: +0.40
    - Año coincide: +0.25
    - Tipo de dispositivo: +0.25
    - Variante: +0.10
    Max score: 0.85 (nunca 1.0 porque A-number puede ser ambiguo)
    """

    def _get_filtered_queryset(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> QuerySet:
        """
        Filtra modelos por A-number exacto.

        Args:
            features: Features extraídas (debe tener a_number)
            context: Contexto de mapeo

        Returns:
            QuerySet de modelos con A-number coincidente
        """
        # Validar que tenemos a_number
        if not features.a_number:
            context.debug("No hay a_number, ANumberMatcher no puede ejecutarse")
            return Modelo.objects.none()

        context.info(f"Buscando por A-number: {features.a_number}")

        # Query base: filtrar por A-number en la descripción
        # NOTA: El campo 'a_number' no existe en Modelo, buscamos en descripcion
        queryset = Modelo.objects.filter(descripcion__icontains=features.a_number)

        # Si hay device_type, filtrar también por tipo para mayor precisión
        if features.device_type:
            queryset = queryset.filter(tipo__iexact=features.device_type.value)
            context.debug(f"Filtrando también por tipo: {features.device_type.value}")

        # Filtrar por año si está disponible (para desambiguar generaciones)
        if features.year:
            # Verificar si hay modelos con año configurado
            models_with_year = Modelo.objects.filter(
                descripcion__icontains=features.a_number
            ).exclude(año__in=[0, None]).exists()

            if models_with_year:
                queryset = queryset.filter(año=features.year)
                context.debug(f"Filtrando también por año: {features.year}")
            else:
                context.warning(
                    f"No hay modelos con año configurado para A-number {features.a_number}"
                )

        count = queryset.count()
        context.info(f"ANumberMatcher encontró {count} modelos con A-number {features.a_number}")

        return queryset

    def calculate_score(
        self,
        features: ExtractedFeatures,
        modelo: Modelo
    ) -> float:
        """
        Calcula score de coincidencia por A-number.

        Components:
        - A-number exacto: +0.40 (base)
        - Año coincide: +0.25
        - Tipo de dispositivo: +0.25
        - Variante: +0.10
        Max: 0.85 (nunca 1.0 porque A-number puede requerir desambiguación)

        Args:
            features: Features extraídas
            modelo: Modelo candidato

        Returns:
            Score entre 0.40 y 0.85
        """
        # Base score por A-number exacto
        score = 0.40

        # 1. Tipo de dispositivo coincide (+0.25)
        if features.device_type and modelo.tipo == features.device_type.value:
            score += 0.25

        # 2. Año coincide (+0.25) - CRÍTICO para desambiguar generaciones
        if features.year and modelo.año == features.year:
            score += 0.25

        # 3. Variante coincide (+0.10)
        # Para Macs: variant puede ser "Pro" (MacBook Pro) o chip variant (M2 Pro)
        # Para iPhones: variant puede ser "Pro", "Pro Max", "Plus", etc.
        if features.variant and features.variant.lower() in modelo.descripcion.lower():
            score += 0.10

        # Máximo 0.85 porque A-number puede ser ambiguo (necesita filtros adicionales)
        return min(score, 0.85)

    def _get_match_strategy(self) -> MatchStrategy:
        """Retorna la estrategia de este matcher."""
        return MatchStrategy.A_NUMBER
