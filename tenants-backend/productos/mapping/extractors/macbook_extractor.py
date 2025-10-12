"""
Mac Feature Extractor - Extrae features de strings Likewize para todos los Macs.

Soporta:
1. MacBook Air: "MacBookAir15 13 M3 8 Core CPU 10 Core GPU 15 inch A3114 3/2024 2TB SSD"
2. MacBook Pro: "MacBookPro15 9 M3 Max 16 Core CPU 40 Core GPU 16 inch A2991 10/2023 8TB SSD"
3. Mac mini: "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"
4. iMac: "iMac21 2 M3 8 Core CPU 10 Core GPU 24 inch A2438 10/2023 512GB SSD"
5. Mac Studio: "MacStudio M2 Max 12 Core CPU 30 Core GPU A2615 6/2022 1TB SSD"
6. Mac Pro: "MacPro2023 M2 Ultra 24 Core CPU 76 Core GPU A2615 6/2023 2TB SSD"

Extrae:
- Variante (Air/Pro/mini/iMac/Studio/Mac Pro)
- Chip (M1/M2/M3/M4 + Pro/Max/Ultra o Core i5/i7/i9 + velocidad)
- CPU cores (8, 10, 12, 14, 16, 24) ← CRÍTICO para Mac mini M2 vs M2 Pro
- GPU cores (7, 8, 10, 14, 16, 19, 24, 30, 32, 38, 40, 76) ← CRÍTICO para diferenciar configs
- Tamaño de pantalla (13", 14", 15", 16", 21.5", 24", 27" - solo para laptops/iMac)
- Storage (256GB - 8TB)
- A-number (A2337, A2816, A2615, etc.)
- Fecha (mes/año)
"""

import re
from typing import Optional
from productos.mapping.extractors.base import BaseFeatureExtractor
from productos.mapping.core.types import ExtractedFeatures, LikewizeInput, MappingContext, DeviceType
from productos.mapping.knowledge.macbook_kb import MacBookKnowledgeBase


class MacBookFeatureExtractor(BaseFeatureExtractor):
    """
    Extractor de features para MacBooks.

    Maneja Air, Pro Intel y Pro M-series con un solo extractor.
    """

    def __init__(self):
        """Inicializa patrones de regex para parsing."""

        # Variante detection
        self.variant_air_pattern = re.compile(r'MacBookAir', re.I)
        self.variant_pro_pattern = re.compile(r'MacBookPro', re.I)

        # M-series chip patterns (M1, M2, M3, M4 + Pro/Max variants)
        # Ejemplos: "M3", "M3 Pro", "M3 Max", "M1 Pro"
        self.m_chip_pattern = re.compile(
            r'\b(M[1-4])(?:\s+(Pro|Max))?\b',
            re.I
        )

        # Intel chip patterns
        # 1. Core i3/i5/i7/i9 + velocidad: "Core i3 1.1", "Core i7 2.3"
        self.intel_chip_pattern = re.compile(
            r'Core\s+i([3579])\s+(\d+\.\d+)',
            re.I
        )
        # 2. Intel Xeon + cores + velocidad: "14 Core 2.5", "18 Core 2.3"
        # Este patrón detecta el formato usado en iMac Pro
        self.intel_xeon_pattern = re.compile(
            r'(\d+)\s+Core\s+(\d+\.\d+)',
            re.I
        )

        # CPU cores pattern: "8 Core CPU", "16 Core CPU", "16-Core CPU"
        # Soporta ambos formatos: con espacio y con guion
        self.cpu_cores_pattern = re.compile(
            r'(\d+)[\s-]+Core\s+CPU',
            re.I
        )

        # GPU cores pattern: "10 Core GPU", "40 Core GPU", "40-Core GPU"
        # Soporta ambos formatos: con espacio y con guion
        self.gpu_cores_pattern = re.compile(
            r'(\d+)[\s-]+Core\s+GPU',
            re.I
        )

        # Screen size pattern: "13 inch", "14 inch", "15 inch", "16 inch"
        # También soporta formatos alternativos: "13-inch", "13\""
        self.screen_size_pattern = re.compile(
            r'(\d+)(?:\.\d+)?\s*(?:inch|pulgadas|")',
            re.I
        )

        # Storage capacity: "256GB SSD", "1TB SSD", "3TB Fusion Drive", "2TB HDD"
        # Soporta: SSD, Fusion Drive, HDD, o sin tipo especificado
        self.storage_pattern = re.compile(
            r'(\d+)\s*(TB|GB)(?:\s+(?:SSD|Fusion\s+Drive|HDD|SSD\s+Drive))?',
            re.I
        )

        # A-number: "A2337", "A2991", "A2141"
        self.a_number_pattern = re.compile(
            r'\b(A\d{4})\b',
            re.I
        )

        # Date: "3/2024", "5/2020", "10/2023"
        self.date_pattern = re.compile(
            r'(\d{1,2})/(\d{4})'
        )

        # Knowledge Base para enriquecimiento
        self.kb = MacBookKnowledgeBase()

    def extract(
        self,
        input_data: LikewizeInput,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Extrae features de un string de Likewize.

        Args:
            input_data: Input de Likewize con FullName
            context: Contexto de mapeo

        Returns:
            ExtractedFeatures con todas las features extraídas
        """
        text = input_data.model_name.strip()
        context.debug(f"Extrayendo features de Mac: {text}")

        # 1. Extraer variante (Air vs Pro)
        variant = self._extract_variant(text, context)

        # 2. Extraer chip (M-series o Intel)
        chip, chip_variant = self._extract_chip(text, context)

        # 3. Extraer cores (CPU y GPU)
        cpu_cores = self._extract_cpu_cores(text, context)
        gpu_cores = self._extract_gpu_cores(text, context)

        # 4. Extraer tamaño de pantalla
        screen_size = self._extract_screen_size(text, context)

        # 5. Extraer capacidad de almacenamiento
        storage = self._extract_storage(text, context)

        # 6. Extraer A-number
        a_number = self._extract_a_number(text, context)

        # 7. Extraer fecha (mes/año)
        month, year = self._extract_date(text, context)

        # 8. Enriquecer con Knowledge Base
        # Si no tenemos año, inferir desde chip
        if not year and chip:
            year = self.kb.infer_year_from_chip(chip, variant, screen_size)
            if year:
                context.debug(f"Año inferido desde chip {chip}: {year}")

        # 9. Construir full chip string (para Intel: incluye velocidad)
        full_chip = self._build_full_chip_string(chip, chip_variant, text)

        # 10. Determinar DeviceType específico
        if variant == "Air":
            device_type = DeviceType.MACBOOK_AIR
        elif variant == "Pro":
            device_type = DeviceType.MACBOOK_PRO
        elif variant == "mini":
            device_type = DeviceType.MAC_MINI
        elif variant == "iMac":
            device_type = DeviceType.IMAC
        elif variant == "Studio":
            device_type = DeviceType.MAC_STUDIO
        elif variant == "Mac Pro":
            device_type = DeviceType.MAC_PRO
        else:
            device_type = None  # Fallback si no se detectó variante

        # 11. Crear ExtractedFeatures
        features = ExtractedFeatures(
            device_type=device_type,
            variant=variant,
            generation=None,  # MacBooks no usan "generation" como iPhones
            year=year,
            storage_gb=storage,
            has_wifi=True,  # Todos los MacBooks tienen Wi-Fi
            has_cellular=False,  # Ningún MacBook tiene Cellular
            screen_size=screen_size,
            cpu=full_chip,  # Chip completo (ej: "M3 Pro", "Core i7 2.3")
            cpu_cores=cpu_cores,  # CPU cores (8, 10, 12, 14, 16)
            gpu_cores=gpu_cores,  # GPU cores (30, 38, 40, etc.)
            a_number=a_number,  # A-number (A2816, A2337, etc.)
            original_text=text
        )

        context.info(
            f"Features extraídas: variant={variant}, chip={full_chip}, "
            f"screen={screen_size}\", storage={storage}GB, year={year}"
        )

        return features

    def _extract_variant(self, text: str, context: MappingContext) -> Optional[str]:
        """
        Extrae variante: Air, Pro, mini, iMac, Studio, Mac Pro.

        Orden de detección (más específico primero):
        1. MacBook Air → "Air"
        2. MacBook Pro → "Pro"
        3. Mac mini → "mini"
        4. Mac Studio → "Studio"
        5. Mac Pro → "Mac Pro" (desktop)
        6. iMac → "iMac"
        """
        text_lower = text.lower()

        # MacBook variants (más específicos primero)
        if self.variant_air_pattern.search(text) or "macbook air" in text_lower:
            context.debug("Variante detectada: Air")
            return "Air"
        elif self.variant_pro_pattern.search(text) or "macbook pro" in text_lower:
            context.debug("Variante detectada: Pro (laptop)")
            return "Pro"

        # Desktop Macs (iMac ANTES de Mac Pro para evitar confusión con iMacPro)
        elif "imac" in text_lower:
            context.debug("Variante detectada: iMac")
            return "iMac"
        elif "macmini" in text_lower or "mac mini" in text_lower:
            context.debug("Variante detectada: mini")
            return "mini"
        elif "macstudio" in text_lower or "mac studio" in text_lower:
            context.debug("Variante detectada: Studio")
            return "Studio"
        elif "macpro" in text_lower or "mac pro" in text_lower:
            context.debug("Variante detectada: Mac Pro (desktop)")
            return "Mac Pro"

        context.warning("No se detectó variante (Air/Pro/mini/iMac/Studio/Mac Pro)")
        return None

    def _extract_chip(self, text: str, context: MappingContext) -> tuple[Optional[str], Optional[str]]:
        """
        Extrae chip y variante.

        Returns:
            (chip_base, chip_variant)
            Ejemplos:
            - ("M3", "Pro") → full = "M3 Pro"
            - ("M2", None) → full = "M2"
            - ("Core i7", "2.3") → full = "Core i7 2.3"
            - ("Intel Xeon W", "14 Core 2.5") → full = "Intel Xeon W 14 Core 2.5"
        """
        # Intentar M-series primero
        m_match = self.m_chip_pattern.search(text)
        if m_match:
            chip_base = m_match.group(1)  # "M1", "M2", "M3", "M4"
            chip_variant = m_match.group(2)  # "Pro", "Max" o None
            context.debug(f"Chip M-series detectado: {chip_base} {chip_variant or ''}")
            return chip_base, chip_variant

        # Intentar Intel Core i3/i5/i7/i9
        intel_match = self.intel_chip_pattern.search(text)
        if intel_match:
            core_type = f"Core i{intel_match.group(1)}"  # "Core i5", "Core i7", "Core i9"
            speed = intel_match.group(2)  # "2.3", "2.6", "1.4"
            context.debug(f"Chip Intel detectado: {core_type} {speed}")
            return core_type, speed

        # Intentar Intel Xeon (formato: "14 Core 2.5")
        xeon_match = self.intel_xeon_pattern.search(text)
        if xeon_match:
            cores = xeon_match.group(1)  # "14", "18", "10"
            speed = xeon_match.group(2)  # "2.5", "2.3", "3.0"
            # Retornar como "Intel Xeon W" para indicar que es Xeon
            # El chip_variant contendrá "cores speed" que se usará para matching
            context.debug(f"Chip Intel Xeon detectado: {cores} Core {speed}")
            return "Intel Xeon W", f"{cores} Core {speed}"

        context.warning("No se detectó chip (ni M-series ni Intel)")
        return None, None

    def _extract_cpu_cores(self, text: str, context: MappingContext) -> Optional[int]:
        """
        Extrae número de cores CPU.

        Soporta:
        - "8 Core CPU", "16 Core CPU" (M-series)
        - "14 Core 2.5", "18 Core 2.3" (Intel Xeon)
        """
        # Intentar patrón estándar primero: "X Core CPU"
        match = self.cpu_cores_pattern.search(text)
        if match:
            cores = int(match.group(1))
            context.debug(f"CPU cores detectados: {cores}")
            return cores

        # Intentar patrón Intel Xeon: "X Core Y.Z"
        xeon_match = self.intel_xeon_pattern.search(text)
        if xeon_match:
            cores = int(xeon_match.group(1))
            context.debug(f"CPU cores detectados (Intel Xeon): {cores}")
            return cores

        return None

    def _extract_gpu_cores(self, text: str, context: MappingContext) -> Optional[int]:
        """Extrae número de cores GPU."""
        match = self.gpu_cores_pattern.search(text)
        if match:
            cores = int(match.group(1))
            context.debug(f"GPU cores detectados: {cores}")
            return cores
        return None

    def _extract_screen_size(self, text: str, context: MappingContext) -> Optional[float]:
        """
        Extrae tamaño de pantalla.

        Returns:
            Tamaño en pulgadas como float (13.0, 14.0, 15.0, 16.0)
        """
        match = self.screen_size_pattern.search(text)
        if match:
            size = float(match.group(1))
            context.debug(f"Tamaño de pantalla detectado: {size}\"")
            return size

        context.warning("No se detectó tamaño de pantalla")
        return None

    def _extract_storage(self, text: str, context: MappingContext) -> Optional[int]:
        """
        Extrae capacidad de almacenamiento en GB.

        Returns:
            Capacidad en GB (256, 512, 1024, 2048, etc.)
        """
        match = self.storage_pattern.search(text)
        if match:
            value = int(match.group(1))
            unit = match.group(2).upper()

            # Convertir TB a GB
            storage_gb = value * 1024 if unit == "TB" else value
            context.debug(f"Storage detectado: {storage_gb}GB ({value}{unit})")
            return storage_gb

        context.warning("No se detectó capacidad de almacenamiento")
        return None

    def _extract_a_number(self, text: str, context: MappingContext) -> Optional[str]:
        """
        Extrae A-number (modelo de Apple).

        Returns:
            A-number (ej: "A2337", "A2991")
        """
        match = self.a_number_pattern.search(text)
        if match:
            a_number = match.group(1).upper()
            context.debug(f"A-number detectado: {a_number}")
            return a_number

        context.warning("No se detectó A-number")
        return None

    def _extract_date(self, text: str, context: MappingContext) -> tuple[Optional[int], Optional[int]]:
        """
        Extrae fecha (mes y año).

        Returns:
            (mes, año) como tupla de ints o (None, None)
        """
        match = self.date_pattern.search(text)
        if match:
            month = int(match.group(1))
            year = int(match.group(2))
            context.debug(f"Fecha detectada: {month}/{year}")
            return month, year

        context.warning("No se detectó fecha")
        return None, None

    def _build_full_chip_string(
        self,
        chip_base: Optional[str],
        chip_variant: Optional[str],
        text: str
    ) -> Optional[str]:
        """
        Construye el string completo del chip.

        Args:
            chip_base: Base del chip ("M3", "Core i7", "Intel Xeon W")
            chip_variant: Variante ("Pro", "Max", "2.3", "14 Core 2.5")
            text: Texto original (para re-extraer Intel completo)

        Returns:
            Chip completo
            Ejemplos:
            - "M3 Pro"
            - "Core i7 2.3"
            - "Intel Xeon W 14 Core 2.5"
        """
        if not chip_base:
            return None

        # M-series: combinar base + variante
        if chip_base.startswith("M"):
            if chip_variant:
                return f"{chip_base} {chip_variant}"
            return chip_base

        # Intel Core iX: base + velocidad
        if chip_base.startswith("Core i"):
            if chip_variant:  # chip_variant contiene la velocidad
                return f"{chip_base} {chip_variant}"
            return chip_base

        # Intel Xeon: base + cores + velocidad
        if chip_base.startswith("Intel Xeon"):
            if chip_variant:  # chip_variant contiene "X Core Y.Z"
                return f"{chip_base} {chip_variant}"
            return chip_base

        return chip_base
