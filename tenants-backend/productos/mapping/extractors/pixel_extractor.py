"""
Feature Extractor para Google Pixel.

Extrae información estructurada desde nombres crudos de Pixel
que vienen de Likewize:
- Generación (6, 7, 8, 9)
- Variantes (Pro, a, Pro XL, Pro Fold, Fold)
- Código de modelo (G9S9B, G03Z5, G1MNW, etc.)
- Capacidad de almacenamiento (128GB, 256GB, 512GB, 1TB)
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


class PixelFeatureExtractor(BaseFeatureExtractor):
    """
    Extractor de features para Google Pixel.

    Maneja todos los casos de Pixel incluyendo:
    - Pixel regular (6, 7, 8, 9)
    - Pixel Pro
    - Pixel a (7a, 8a)
    - Pixel Pro XL
    - Pixel Fold / Pro Fold
    """

    def __init__(self):
        """Inicializa el extractor con patrones regex."""

        # Patrones regex precompilados para eficiencia
        self.device_pattern = re.compile(r'\bpixel\b', re.I)
        self.storage_pattern = re.compile(r'(\d+(?:\.\d+)?)\s*(TB|GB)', re.I)

        # Patrón para generación numérica (Pixel 6, Pixel 7, etc.)
        self.generation_pattern = re.compile(r'pixel\s+(\d+)(?:\s|$|pro|a|fold)', re.I)

        # Patrón para código de modelo (alfanumérico tipo G9S9B, G03Z5, G1MNW)
        self.model_code_pattern = re.compile(r'\b(G[A-Z0-9]{4,5})\b', re.I)

        # Patrones para variantes (orden importa: más específico primero)
        self.variant_pro_fold_pattern = re.compile(r'\bpro\s+fold\b', re.I)
        self.variant_pro_xl_pattern = re.compile(r'\bpro\s+xl\b', re.I)
        self.variant_pro_pattern = re.compile(r'\bpro\b', re.I)
        self.variant_fold_pattern = re.compile(r'\bfold\b', re.I)
        self.variant_a_pattern = re.compile(r'pixel\s+\d+a\b', re.I)

    def _do_extract(
        self,
        input_data: LikewizeInput,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Extrae features específicas de Google Pixel.

        Args:
            input_data: Input de Likewize
            features: Features a rellenar
            context: Contexto de mapeo

        Returns:
            Features rellenadas
        """
        text = self._normalize_text(input_data.model_name)

        # 1. Verificar que es un Pixel
        if not self._is_pixel(text):
            context.debug("No es un Google Pixel, saltando extracción")
            return features

        features.device_type = DeviceType.PIXEL
        features.add_note("Device type detectado: Google Pixel")
        context.info("Device type: Google Pixel")

        # 2. Extraer variante (PRIMERO porque afecta detección de generación)
        variant = self._extract_variant(text, context)
        if variant:
            features.variant = variant
            features.add_note(f"Variante detectada: {variant}")
            context.info(f"Variante: {variant}")

            # Actualizar flags booleanos
            if "Pro" in variant:
                features.has_pro = True
            if "Fold" in variant:
                features.has_fold = True

        # 3. Extraer generación
        generation = self._extract_generation(text, context)
        if generation:
            features.generation = generation
            features.add_note(f"Generación detectada: {generation}")
            context.info(f"Generación: {generation}")

        # 4. Extraer código de modelo
        model_code = self._extract_model_code(text, context)
        if model_code:
            features.model_code = model_code
            features.add_note(f"Código de modelo detectado: {model_code}")
            context.info(f"Código de modelo: {model_code}")

        # 5. Extraer capacidad de almacenamiento
        storage = self._extract_storage(text, context)

        # Si no se encontró en model_name, buscar en el campo capacity separado
        if not storage and input_data.capacity:
            storage = self._extract_storage(input_data.capacity, context)
            if storage:
                context.debug(f"Capacidad extraída del campo separado: {storage}GB")

        if storage:
            features.storage_gb = storage
            features.add_note(f"Almacenamiento detectado: {storage}GB")
            context.info(f"Almacenamiento: {storage}GB")

        return features

    def _is_pixel(self, text: str) -> bool:
        """
        Verifica si el texto corresponde a un Google Pixel.

        Args:
            text: Texto normalizado

        Returns:
            True si es Pixel
        """
        return bool(self.device_pattern.search(text))

    def _extract_variant(self, text: str, context: MappingContext) -> Optional[str]:
        """
        Extrae la variante de Pixel.

        Orden de prioridad:
        1. Pro Fold (debe ir antes que Pro y Fold)
        2. Pro XL (debe ir antes que Pro)
        3. Pro
        4. Fold
        5. a (7a, 8a)

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Nombre de la variante o None
        """
        # Pro Fold (más específico primero)
        if self.variant_pro_fold_pattern.search(text):
            context.debug("Variante Pro Fold detectada")
            return "Pro Fold"

        # Pro XL
        if self.variant_pro_xl_pattern.search(text):
            context.debug("Variante Pro XL detectada")
            return "Pro XL"

        # Pro
        if self.variant_pro_pattern.search(text):
            context.debug("Variante Pro detectada")
            return "Pro"

        # Fold
        if self.variant_fold_pattern.search(text):
            context.debug("Variante Fold detectada")
            return "Fold"

        # a (7a, 8a)
        if self.variant_a_pattern.search(text):
            context.debug("Variante 'a' detectada")
            return "a"

        context.debug("No se detectó variante (Pixel regular)")
        return None

    def _extract_generation(
        self,
        text: str,
        context: MappingContext
    ) -> Optional[int]:
        """
        Extrae la generación de Pixel.

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Número de generación o None
        """
        match = self.generation_pattern.search(text)
        if match:
            gen = int(match.group(1))
            # Validar que sea generación razonable (6-9)
            if 6 <= gen <= 20:
                context.debug(f"Generación {gen} detectada")
                return gen
            else:
                context.warning(f"Generación {gen} fuera de rango esperado (6-20)")
                return None

        context.warning("No se pudo detectar generación")
        return None

    def _extract_model_code(
        self,
        text: str,
        context: MappingContext
    ) -> Optional[str]:
        """
        Extrae el código de modelo de Pixel (similar a A-number de Apple).

        Formato: G seguido de 4-5 caracteres alfanuméricos (ej: G9S9B, G03Z5, G1MNW)

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Código de modelo o None
        """
        match = self.model_code_pattern.search(text)
        if match:
            code = match.group(1).upper()
            context.debug(f"Código de modelo detectado: {code}")
            return code

        context.debug("No se detectó código de modelo")
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
