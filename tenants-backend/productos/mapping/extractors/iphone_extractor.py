"""
Feature Extractor para iPhone.

Extrae información estructurada desde nombres crudos de iPhone
que vienen de Likewize:
- Generación (13, 15, 16, 17, etc.)
- Variantes (Pro, Max, Plus, mini, SE, XR, XS)
- Capacidad de almacenamiento (64GB, 128GB, 256GB, 512GB, 1TB)
"""

import re
from typing import Optional

from productos.mapping.extractors.base import BaseFeatureExtractor
from productos.mapping.core.types import (
    LikewizeInput,
    ExtractedFeatures,
    MappingContext,
    DeviceType,
)


class iPhoneFeatureExtractor(BaseFeatureExtractor):
    """
    Extractor de features para iPhone.

    Maneja todos los casos de iPhone incluyendo:
    - iPhone regular (13, 14, 15, 16, 17)
    - iPhone Pro / Pro Max
    - iPhone Plus
    - iPhone mini
    - iPhone SE (con generaciones especiales)
    - iPhone X / XR / XS / XS Max (variantes especiales gen 10)
    """

    def __init__(self):
        """Inicializa el extractor con patrones regex."""

        # Patrones regex precompilados para eficiencia
        self.device_pattern = re.compile(r'\biphone\b', re.I)
        self.storage_pattern = re.compile(r'(\d+(?:\.\d+)?)\s*(TB|GB)', re.I)

        # Patrón para generación numérica (iPhone 13, iPhone 15, etc.)
        # Evita capturar tamaños de pantalla o capacidades
        self.generation_pattern = re.compile(r'iphone\s+(\d{1,2})(?:\s|$|pro|plus|max)', re.I)

        # Patrones para variantes especiales de gen 10 (X, XR, XS)
        self.variant_x_pattern = re.compile(r'iphone\s+x(?!\s*[rs])', re.I)  # iPhone X (no XR/XS)
        self.variant_xr_pattern = re.compile(r'iphone\s+xr\b', re.I)
        self.variant_xs_max_pattern = re.compile(r'iphone\s+xs\s+max\b', re.I)
        self.variant_xs_pattern = re.compile(r'iphone\s+xs\b', re.I)

        # Patrón para iPhone SE con generación en paréntesis
        # "iPhone SE (3rd generation)", "iPhone SE (2nd generation)"
        self.se_generation_pattern = re.compile(
            r'iphone\s+se.*?\((\d+)(?:st|nd|rd|th)\s+generation\)',
            re.I
        )

        # Patrones para variantes modernas
        self.variant_pro_max_pattern = re.compile(r'\bpro\s+max\b', re.I)
        self.variant_pro_pattern = re.compile(r'\bpro\b', re.I)
        self.variant_plus_pattern = re.compile(r'\bplus\b', re.I)
        self.variant_mini_pattern = re.compile(r'\bmini\b', re.I)
        self.variant_se_pattern = re.compile(r'\bse\b', re.I)

    def _do_extract(
        self,
        input_data: LikewizeInput,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Extrae features específicas de iPhone.

        Args:
            input_data: Input de Likewize
            features: Features a rellenar
            context: Contexto de mapeo

        Returns:
            Features rellenadas
        """
        text = self._normalize_text(input_data.model_name)

        # 1. Verificar que es un iPhone
        if not self._is_iphone(text):
            context.debug("No es un iPhone, saltando extracción")
            return features

        features.device_type = DeviceType.IPHONE
        features.add_note("Device type detectado: iPhone")
        context.info("Device type: iPhone")

        # 2. Extraer variante (PRIMERO porque afecta detección de generación)
        variant = self._extract_variant(text, context)
        if variant:
            features.variant = variant
            features.add_note(f"Variante detectada: {variant}")
            context.info(f"Variante: {variant}")

            # Actualizar flags booleanos
            if "Pro" in variant:
                features.has_pro = True
            if "Max" in variant:
                features.has_max = True
            if "Plus" in variant:
                features.has_plus = True
            if "mini" in variant:
                features.has_mini = True

        # 3. Extraer generación
        generation = self._extract_generation(text, variant, context)
        if generation:
            features.generation = generation
            features.add_note(f"Generación detectada: {generation}")
            context.info(f"Generación: {generation}")

        # 4. Extraer capacidad de almacenamiento
        storage = self._extract_storage(text, context)
        if storage:
            features.storage_gb = storage
            features.add_note(f"Almacenamiento detectado: {storage}GB")
            context.info(f"Almacenamiento: {storage}GB")

        return features

    def _is_iphone(self, text: str) -> bool:
        """
        Verifica si el texto corresponde a un iPhone.

        Args:
            text: Texto normalizado

        Returns:
            True si es iPhone
        """
        return bool(self.device_pattern.search(text))

    def _extract_variant(self, text: str, context: MappingContext) -> Optional[str]:
        """
        Extrae la variante de iPhone.

        Orden de prioridad:
        1. Variantes especiales gen 10 (XS Max, XS, XR, X)
        2. SE (puede tener generación en paréntesis)
        3. Pro Max (debe ir antes que Pro)
        4. Pro
        5. Plus
        6. mini

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Nombre de la variante o None
        """
        # Variantes especiales gen 10 (más específico primero)
        if self.variant_xs_max_pattern.search(text):
            context.debug("Variante XS Max detectada")
            return "XS Max"

        if self.variant_xs_pattern.search(text):
            context.debug("Variante XS detectada")
            return "XS"

        if self.variant_xr_pattern.search(text):
            context.debug("Variante XR detectada")
            return "XR"

        if self.variant_x_pattern.search(text):
            context.debug("Variante X detectada")
            return "X"

        # iPhone SE
        if self.variant_se_pattern.search(text):
            context.debug("Variante SE detectada")
            return "SE"

        # Variantes modernas (orden importa: Pro Max antes que Pro)
        if self.variant_pro_max_pattern.search(text):
            context.debug("Variante Pro Max detectada")
            return "Pro Max"

        if self.variant_pro_pattern.search(text):
            context.debug("Variante Pro detectada")
            return "Pro"

        if self.variant_plus_pattern.search(text):
            context.debug("Variante Plus detectada")
            return "Plus"

        if self.variant_mini_pattern.search(text):
            context.debug("Variante mini detectada")
            return "mini"

        context.debug("No se detectó variante (iPhone regular)")
        return None

    def _extract_generation(
        self,
        text: str,
        variant: Optional[str],
        context: MappingContext
    ) -> Optional[int]:
        """
        Extrae la generación de iPhone.

        Casos especiales:
        - iPhone SE: generación en paréntesis "(3rd generation)"
        - iPhone X, XR, XS: generación 10
        - iPhone regular: número después de "iPhone"

        Args:
            text: Texto normalizado
            variant: Variante ya detectada
            context: Contexto de mapeo

        Returns:
            Número de generación o None
        """
        # Caso 1: iPhone SE con generación en paréntesis
        if variant == "SE":
            match = self.se_generation_pattern.search(text)
            if match:
                gen = int(match.group(1))
                context.debug(f"Generación SE detectada desde paréntesis: {gen}")
                return gen
            # Si no tiene paréntesis, asumir SE gen 1 (2016)
            context.debug("iPhone SE sin generación explícita, asumiendo gen 1")
            return 1

        # Caso 2: Variantes especiales de gen 10
        if variant in ("X", "XR", "XS", "XS Max"):
            context.debug(f"Variante {variant} corresponde a generación 10")
            return 10

        # Caso 3: iPhone regular con número (13, 15, 16, 17, etc.)
        match = self.generation_pattern.search(text)
        if match:
            gen = int(match.group(1))
            # Validar que sea generación razonable (6-20)
            if 6 <= gen <= 20:
                context.debug(f"Generación {gen} detectada desde patrón numérico")
                return gen
            else:
                context.warning(f"Generación {gen} fuera de rango esperado (6-20)")
                return None

        context.warning("No se pudo detectar generación")
        return None

    def _extract_storage(self, text: str, context: MappingContext) -> Optional[int]:
        """
        Extrae capacidad de almacenamiento en GB.

        Soporta formatos:
        - "128GB", "256 GB"
        - "1TB", "1 TB" (convertido a GB)

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Capacidad en GB o None
        """
        match = self.storage_pattern.search(text)
        if not match:
            context.warning("No se detectó capacidad de almacenamiento")
            return None

        try:
            value = float(match.group(1))
            unit = match.group(2).upper()

            # Convertir a GB
            if unit == "TB":
                gb = int(value * 1024)
            else:
                gb = int(value)

            context.debug(f"Almacenamiento detectado: {gb}GB (raw: {value}{unit})")
            return gb

        except (ValueError, AttributeError) as e:
            context.error(f"Error parseando capacidad: {e}")
            return None
