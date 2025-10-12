"""
Knowledge Base para iPhone.

Contiene información de dominio sobre generaciones de iPhone:
- Año de lanzamiento
- CPU/chipset
- Variantes disponibles (Pro, Max, Plus, mini)

Esta información es crítica para el mapeo correcto porque Likewize
NO envía el año en el nombre del modelo.
"""

from typing import Optional, Dict, List, Any

from productos.mapping.knowledge.base import BaseKnowledgeBase
from productos.mapping.core.types import ExtractedFeatures, MappingContext, DeviceType


class iPhoneKnowledgeBase(BaseKnowledgeBase):
    """
    Knowledge Base de iPhone con información de todas las generaciones.

    Mapea generaciones a specs completas (año, CPU, variantes).
    Basado en información oficial de Apple.
    """

    def __init__(self):
        """Inicializa el KB con datos de todas las generaciones de iPhone."""

        # Mapeo completo: generación → specs
        # Formato: {generación: {year, cpu, cpu_pro, variants}}
        self.IPHONE_GENERATIONS: Dict[int, Dict[str, Any]] = {
            17: {
                "year": 2025,
                "cpu": "A19 Bionic",           # iPhone 17/17 Plus (proyección)
                "cpu_pro": "A19 Pro",           # iPhone 17 Pro/Pro Max (proyección)
                "variants": ["", "Plus", "Pro", "Pro Max"]
            },
            16: {
                "year": 2024,
                "cpu": "A18 Bionic",           # iPhone 16/16 Plus
                "cpu_pro": "A18 Pro",           # iPhone 16 Pro/Pro Max
                "variants": ["", "Plus", "Pro", "Pro Max"]
            },
            15: {
                "year": 2023,
                "cpu": "A16 Bionic",           # iPhone 15/15 Plus
                "cpu_pro": "A17 Pro",           # iPhone 15 Pro/Pro Max
                "variants": ["", "Plus", "Pro", "Pro Max"]
            },
            14: {
                "year": 2022,
                "cpu": "A15 Bionic",           # iPhone 14/14 Plus
                "cpu_pro": "A16 Bionic",        # iPhone 14 Pro/Pro Max
                "variants": ["", "Plus", "Pro", "Pro Max"]
            },
            13: {
                "year": 2021,
                "cpu": "A15 Bionic",
                "cpu_pro": "A15 Bionic",        # Mismo chip en toda la línea
                "variants": ["", "mini", "Pro", "Pro Max"]
            },
            12: {
                "year": 2020,
                "cpu": "A14 Bionic",
                "cpu_pro": "A14 Bionic",
                "variants": ["", "mini", "Pro", "Pro Max"]
            },
            11: {
                "year": 2019,
                "cpu": "A13 Bionic",
                "cpu_pro": "A13 Bionic",
                "variants": ["", "Pro", "Pro Max"]
            },
            10: {  # iPhone X, XR, XS
                "year": 2017,  # iPhone X lanzado en 2017
                "cpu": "A11 Bionic",
                "cpu_pro": "A12 Bionic",  # XS/XS Max usan A12
                "variants": ["X", "XR", "XS", "XS Max"]  # Variantes especiales
            },
            9: {
                "year": 2016,  # iPhone no lanzado (saltó de 8 a X)
                "cpu": None,
                "cpu_pro": None,
                "variants": []
            },
            8: {
                "year": 2017,
                "cpu": "A11 Bionic",
                "cpu_pro": "A11 Bionic",
                "variants": ["", "Plus"]
            },
            7: {
                "year": 2016,
                "cpu": "A10 Fusion",
                "cpu_pro": "A10 Fusion",
                "variants": ["", "Plus"]
            },
            6: {
                "year": 2014,  # iPhone 6/6 Plus
                "cpu": "A8",
                "cpu_pro": "A8",
                "variants": ["", "Plus"]
            },
        }

        # iPhone SE tiene su propio mapeo (generaciones especiales)
        self.IPHONE_SE_GENERATIONS: Dict[int, Dict[str, Any]] = {
            3: {
                "year": 2022,
                "cpu": "A15 Bionic",
                "variants": ["SE"]
            },
            2: {
                "year": 2020,
                "cpu": "A13 Bionic",
                "variants": ["SE"]
            },
            1: {
                "year": 2016,
                "cpu": "A9",
                "variants": ["SE"]
            },
        }

    def get_year_for_generation(
        self,
        device_type: str,
        generation: int
    ) -> Optional[int]:
        """
        Retorna el año de lanzamiento para una generación de iPhone.

        Args:
            device_type: "iPhone", "iPhone SE", etc.
            generation: Número de generación (13, 15, 16, etc.)

        Returns:
            Año de lanzamiento o None si no se encuentra
        """
        # iPhone SE tiene generaciones especiales
        if "SE" in device_type:
            gen_data = self.IPHONE_SE_GENERATIONS.get(generation)
            if gen_data:
                return gen_data["year"]
            return None

        # iPhone regular
        if "iPhone" in device_type or device_type == "iPhone":
            gen_data = self.IPHONE_GENERATIONS.get(generation)
            if gen_data:
                return gen_data["year"]
            return None

        return None

    def get_cpu_for_generation(
        self,
        generation: int,
        variant: Optional[str] = None
    ) -> Optional[str]:
        """
        Retorna el CPU para una generación de iPhone.

        Args:
            generation: Número de generación
            variant: Variante (Pro, Max, etc.) - afecta CPU en algunas generaciones

        Returns:
            Nombre del CPU o None
        """
        gen_data = self.IPHONE_GENERATIONS.get(generation)
        if not gen_data:
            return None

        # iPhone 14 Pro/Pro Max usa A16, pero 14/14 Plus usa A15
        # iPhone 15 Pro/Pro Max usa A17 Pro, pero 15/15 Plus usa A16
        # iPhone 16 Pro/Pro Max usa A18 Pro, pero 16/16 Plus usa A18
        if variant in ("Pro", "Pro Max") and gen_data.get("cpu_pro"):
            return gen_data["cpu_pro"]

        return gen_data.get("cpu")

    def get_available_variants(self, generation: int) -> List[str]:
        """
        Retorna las variantes disponibles para una generación.

        Args:
            generation: Número de generación

        Returns:
            Lista de variantes disponibles (["", "Pro", "Max"], etc.)
        """
        gen_data = self.IPHONE_GENERATIONS.get(generation)
        if not gen_data:
            return []

        return gen_data.get("variants", [])

    def is_valid_variant(self, generation: int, variant: str) -> bool:
        """
        Verifica si una variante es válida para una generación.

        Args:
            generation: Número de generación
            variant: Variante a verificar (Pro, Max, Plus, mini)

        Returns:
            True si la variante existe en esa generación
        """
        available = self.get_available_variants(generation)
        return variant in available

    def _do_enrich_features(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Enriquece features de iPhone con información del KB.

        Agrega:
        - Año de lanzamiento (desde generación)
        - CPU (desde generación + variante)

        Args:
            features: Features ya extraídas
            context: Contexto de mapeo

        Returns:
            Features enriquecidas
        """
        # Solo enriquecer iPhones
        if features.device_type != DeviceType.IPHONE:
            context.debug("No es iPhone, saltando enriquecimiento de iPhone KB")
            return features

        # Solo enriquecer si hay generación detectada
        if not features.generation:
            context.warning("No se detectó generación, no se puede enriquecer con KB")
            return features

        # Enriquecer año (solo si no está ya presente)
        if not features.year:
            year = self.get_year_for_generation("iPhone", features.generation)
            if year:
                features.year = year
                features.add_note(f"Año {year} inferido desde generación {features.generation} (KB)")
                context.info(f"Año inferido: {year} (gen {features.generation})")

        # Enriquecer CPU (solo si no está ya presente)
        if not features.cpu:
            cpu = self.get_cpu_for_generation(features.generation, features.variant)
            if cpu:
                features.cpu = cpu
                features.add_note(f"CPU {cpu} inferido desde generación {features.generation} (KB)")
                context.info(f"CPU inferido: {cpu}")

        return features
