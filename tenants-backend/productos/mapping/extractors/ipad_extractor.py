"""
iPad Feature Extractor.

Extrae features estructuradas de strings de Likewize para iPads.

Soporta todas las variantes:
- iPad regular: "iPad 10 Wi-Fi 128GB"
- iPad Air: "iPad Air 11-inch (M2) Cellular 512GB"
- iPad mini: "iPad mini 7 Cellular 256GB"
- iPad Pro: "iPad Pro 12.9-inch (M4) Wi-Fi 1TB"

Extrae:
- Variante (Pro, Air, mini, regular)
- Generación numérica
- Tamaño de pantalla (9.7", 10.5", 11", 12.9", 13")
- Chip (M1, M2, M4, A-series)
- Conectividad (Wi-Fi vs Cellular)
- Capacidad de almacenamiento
"""

import re
from typing import Optional

from productos.mapping.extractors.base import BaseFeatureExtractor
from productos.mapping.core.types import ExtractedFeatures, MappingContext, DeviceType
from productos.mapping.knowledge.ipad_kb import iPadKnowledgeBase


class iPadFeatureExtractor(BaseFeatureExtractor):
    """
    Extractor de features para iPads.

    Maneja todas las variantes: Pro, Air, mini, y regular.
    Extrae generación, tamaño de pantalla, chip, conectividad.
    """

    def __init__(self):
        """Inicializa el extractor con patrones regex."""

        # Patrones para variantes
        self.variant_pro_pattern = re.compile(r'ipad\s+pro\b', re.I)
        self.variant_air_pattern = re.compile(r'ipad\s+air\b', re.I)
        self.variant_mini_pattern = re.compile(r'ipad\s+mini\b', re.I)

        # Patrón para generación numérica
        # "iPad 10 Wi-Fi" → generación 10
        # "iPad mini 7" → generación 7
        # "iPad Air 4 Cellular" → generación 4
        # "iPad Pro 5 Wi-Fi" → generación 5
        self.generation_pattern = re.compile(
            r'ipad\s+(?:(?:mini|air|pro)\s+)?(\d+)(?:\s|$)',
            re.I
        )

        # Patrón para generación ordinal
        # "iPad Air (6.ª generación)" → generación 6
        self.generation_ordinal_pattern = re.compile(
            r'\((\d+)\.?[ªº]?\s*generaci[óo]n\)',
            re.I
        )

        # Patrón para generación después del tamaño de pantalla
        # "iPad Pro 12.9'' 5 Wi-Fi" → generación 5
        # "iPad Pro 11-inch 4 Cellular" → generación 4
        self.generation_after_size_pattern = re.compile(
            r'(?:inch|pulgadas|\'\'|")\s+(\d{1,2})(?:\s|$)',
            re.I
        )

        # Patrón para tamaño de pantalla
        # "iPad Pro 12.9-inch" → 12.9
        # "iPad Pro 13-inch" → 13
        # "iPad Pro 12.9''" → 12.9 (comillas dobles simples)
        # "iPad Pro de 12,9 pulgadas" → 12.9 (coma decimal europea)
        # "iPad Pro 11 pulgadas" → 11
        # NUEVO: "iPad Pro 10 5-inch" → 10.5 (formato Likewize con espacio en vez de punto)
        # NUEVO: "iPad Pro 12 9-inch" → 12.9 (formato Likewize con espacio en vez de punto)
        self.screen_size_pattern = re.compile(
            r'(\d+(?:[.,]\d+)?)\s*-?\s*(?:inch|pulgadas|\'\'|")',
            re.I
        )

        # Patrón específico para formato "X Y-inch" (Likewize con espacio en decimal)
        # "10 5-inch" → grupo1=10, grupo2=5 → 10.5
        # "12 9-inch" → grupo1=12, grupo2=9 → 12.9
        self.screen_size_space_decimal_pattern = re.compile(
            r'(\d+)\s+(\d)\s*-?\s*(?:inch|pulgadas)',
            re.I
        )

        # Patrón para chip M-series y A-series
        self.chip_m_pattern = re.compile(r'\(?(M[1-4])\)?', re.I)
        self.chip_a_pattern = re.compile(r'\b(A\d+X?)\b', re.I)

        # Patrón para conectividad
        self.wifi_pattern = re.compile(r'\bWi-?Fi\b', re.I)
        self.cellular_pattern = re.compile(r'\b(?:Cellular|4G|5G|LTE)\b', re.I)

        # Patrón para capacidad
        self.storage_pattern = re.compile(
            r'(\d+(?:\.\d+)?)\s*(?:TB|GB)',
            re.I
        )

    def _do_extract(
        self,
        input_data: 'LikewizeInput',
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Extrae features de iPad.

        Args:
            input_data: LikewizeInput de Likewize
            features: Features base (puede estar vacío)
            context: Contexto de mapeo

        Returns:
            ExtractedFeatures con información del iPad
        """
        # Obtener texto a parsear
        text = input_data.model_name
        context.debug(f"Parseando iPad: '{text}'")

        # Actualizar device_type y brand
        features.device_type = DeviceType.IPAD  # Default, se refinará
        features.brand = "Apple"
        features.original_text = text

        # 1. Detectar variante (Pro, Air, mini, regular)
        variant = self._extract_variant(text, context)
        features.variant = variant

        # Actualizar device_type específico
        features.device_type = self._get_device_type_from_variant(variant)

        # 2. Extraer generación
        generation = self._extract_generation(text, context)
        features.generation = generation

        # 3. Extraer tamaño de pantalla (importante para Pro)
        screen_size = self._extract_screen_size(text, context)
        features.screen_size = screen_size

        # 4. Extraer chip (M1, M2, M4, A-series)
        cpu = self._extract_chip(text, context)
        features.cpu = cpu

        # 5. Extraer conectividad (Wi-Fi vs Cellular)
        has_wifi, has_cellular = self._extract_connectivity(text, context)
        features.has_wifi = has_wifi
        features.has_cellular = has_cellular

        # 6. Extraer capacidad de almacenamiento
        storage_gb = self._extract_storage(text, context)
        features.storage_gb = storage_gb

        # 7. Enriquecer con Knowledge Base
        kb = iPadKnowledgeBase()
        features = kb.enrich_features(features, context)

        return features

    def _extract_variant(self, text: str, context: MappingContext) -> Optional[str]:
        """
        Extrae la variante de iPad.

        Returns:
            "Pro", "Air", "mini", o None (regular)
        """
        # Orden importa: Pro antes que regular, mini antes que regular
        if self.variant_pro_pattern.search(text):
            context.debug("Variante Pro detectada")
            return "Pro"

        if self.variant_air_pattern.search(text):
            context.debug("Variante Air detectada")
            return "Air"

        if self.variant_mini_pattern.search(text):
            context.debug("Variante mini detectada")
            return "mini"

        # Si solo dice "iPad" sin variante, es regular
        if re.search(r'\bipad\b', text, re.I):
            context.debug("iPad regular detectado (sin variante)")
            return None  # Regular no tiene sufijo

        return None

    def _get_device_type_from_variant(self, variant: Optional[str]) -> DeviceType:
        """Convierte variante a DeviceType específico."""
        if variant == "Pro":
            return DeviceType.IPAD_PRO
        elif variant == "Air":
            return DeviceType.IPAD_AIR
        elif variant == "mini":
            return DeviceType.IPAD_MINI
        else:
            return DeviceType.IPAD

    def _extract_generation(self, text: str, context: MappingContext) -> Optional[int]:
        """
        Extrae la generación de iPad.

        Soporta tres formatos:
        - Formato ordinal: "iPad (10.ª generación)" → 10
        - Después del tamaño: "iPad Pro 12.9'' 5 Wi-Fi" → 5
        - Número simple: "iPad 10 Wi-Fi" → 10
        - iPad mini: "iPad mini 7" → 7

        Returns:
            Número de generación o None
        """
        # Patrón 1: Formato ordinal "(6.ª generación)" - más específico
        match_ordinal = self.generation_ordinal_pattern.search(text)
        if match_ordinal:
            gen = int(match_ordinal.group(1))
            context.debug(f"Generación {gen} detectada desde paréntesis ordinal")
            return gen

        # Patrón 2: Generación después del tamaño "12.9'' 5" o "11-inch 4"
        match_after_size = self.generation_after_size_pattern.search(text)
        if match_after_size:
            gen = int(match_after_size.group(1))
            context.debug(f"Generación {gen} detectada después del tamaño de pantalla")
            return gen

        # Patrón 3: Número simple "iPad 10" o "iPad mini 7"
        match_number = self.generation_pattern.search(text)
        if match_number:
            gen = int(match_number.group(1))
            context.debug(f"Generación {gen} detectada desde número")
            return gen

        context.warning("No se detectó generación en el texto")
        return None

    def _extract_screen_size(self, text: str, context: MappingContext) -> Optional[float]:
        """
        Extrae el tamaño de pantalla.

        Crítico para iPad Pro que tiene múltiples tamaños:
        - "iPad Pro 12.9-inch" → 12.9
        - "iPad Pro 11 pulgadas" → 11.0
        - "iPad Air 13 pulgadas" → 13.0
        - "iPad Pro 10 5-inch" → 10.5 (formato Likewize)

        Returns:
            Tamaño en pulgadas o None
        """
        # Intentar patrón de espacio decimal primero (más específico)
        # "10 5-inch" → 10.5
        match_space = self.screen_size_space_decimal_pattern.search(text)
        if match_space:
            whole = int(match_space.group(1))
            decimal = int(match_space.group(2))
            size = float(f"{whole}.{decimal}")
            context.debug(f"Tamaño de pantalla detectado (formato espacio): {size}\"")
            return size

        # Patrón estándar
        match = self.screen_size_pattern.search(text)
        if match:
            # Reemplazar coma por punto para formato decimal correcto
            size_str = match.group(1).replace(',', '.')
            size = float(size_str)
            context.debug(f"Tamaño de pantalla detectado: {size}\"")
            return size

        # Si es Pro pero no encontramos tamaño, advertir
        if "Pro" in text:
            context.warning("iPad Pro sin tamaño de pantalla explícito")

        return None

    def _extract_chip(self, text: str, context: MappingContext) -> Optional[str]:
        """
        Extrae el chip/CPU.

        Busca:
        - M-series: M1, M2, M4
        - A-series: A12, A14, A15, A17, etc.

        Returns:
            Nombre del chip o None
        """
        # Buscar M-series primero (más común en iPads modernos)
        match_m = self.chip_m_pattern.search(text)
        if match_m:
            chip = match_m.group(1).upper()
            context.debug(f"Chip M-series detectado: {chip}")
            return chip

        # Buscar A-series
        match_a = self.chip_a_pattern.search(text)
        if match_a:
            chip = match_a.group(1).upper()
            context.debug(f"Chip A-series detectado: {chip}")
            return chip

        return None

    def _extract_connectivity(self, text: str, context: MappingContext) -> tuple[bool, bool]:
        """
        Extrae información de conectividad.

        Returns:
            (has_wifi, has_cellular)
        """
        has_wifi = bool(self.wifi_pattern.search(text))
        has_cellular = bool(self.cellular_pattern.search(text))

        if has_wifi:
            context.debug("Wi-Fi detectado")
        if has_cellular:
            context.debug("Cellular detectado")

        # Si no detectamos ninguno, asumir Wi-Fi por defecto
        if not has_wifi and not has_cellular:
            context.warning("Conectividad no detectada, asumiendo Wi-Fi")
            has_wifi = True

        return has_wifi, has_cellular

    def _extract_storage(self, text: str, context: MappingContext) -> Optional[int]:
        """
        Extrae la capacidad de almacenamiento.

        Soporta:
        - "256GB" → 256
        - "1TB" → 1024
        - "2TB" → 2048

        Returns:
            Capacidad en GB o None
        """
        match = self.storage_pattern.search(text)
        if not match:
            context.warning("No se detectó capacidad de almacenamiento")
            return None

        value = float(match.group(1))
        unit = match.group(0).upper()

        # Convertir TB a GB
        if "TB" in unit:
            storage_gb = int(value * 1024)
        else:
            storage_gb = int(value)

        context.debug(f"Almacenamiento detectado: {storage_gb} GB")
        return storage_gb
