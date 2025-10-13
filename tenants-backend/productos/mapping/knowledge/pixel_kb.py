"""
Knowledge Base para Google Pixel.

Contiene información de dominio sobre generaciones de Pixel:
- Año de lanzamiento
- Chipset Tensor (G1, G2, G3, G4)
- Variantes disponibles (Pro, a, Pro XL, Fold)

Esta información es crítica para el mapeo correcto porque Likewize
NO envía el año en el nombre del modelo.
"""

from typing import Optional, Dict, List, Any

from productos.mapping.knowledge.base import BaseKnowledgeBase
from productos.mapping.core.types import ExtractedFeatures, MappingContext, DeviceType


class PixelKnowledgeBase(BaseKnowledgeBase):
    """
    Knowledge Base de Google Pixel con información de todas las generaciones.

    Mapea generaciones a specs completas (año, Tensor chip, variantes).
    Basado en información oficial de Google.
    """

    def __init__(self):
        """Inicializa el KB con datos de todas las generaciones de Pixel."""

        # Mapeo completo: generación → specs
        # Formato: {generación: {year, cpu, variants}}
        self.PIXEL_GENERATIONS: Dict[int, Dict[str, Any]] = {
            9: {
                "year": 2024,
                "cpu": "Google Tensor G4",
                "variants": ["", "Pro", "Pro XL", "Pro Fold"]
            },
            8: {
                "year": 2023,
                "cpu": "Google Tensor G3",
                "variants": ["", "Pro", "a"]
            },
            7: {
                "year": 2022,
                "cpu": "Google Tensor G2",
                "variants": ["", "Pro", "a"]
            },
            6: {
                "year": 2021,
                "cpu": "Google Tensor (G1)",
                "variants": ["", "Pro"]
            },
        }

        # Pixel Fold es un caso especial (sin número de generación explícito)
        self.PIXEL_SPECIAL: Dict[str, Dict[str, Any]] = {
            "Fold": {
                "year": 2023,
                "cpu": "Google Tensor G2",
            }
        }

    def get_year_for_generation(
        self,
        device_type: str,
        generation: int
    ) -> Optional[int]:
        """
        Retorna el año de lanzamiento para una generación de Pixel.

        Args:
            device_type: "Google Pixel", "Pixel", etc.
            generation: Número de generación (6, 7, 8, 9)

        Returns:
            Año de lanzamiento o None si no se encuentra
        """
        gen_data = self.PIXEL_GENERATIONS.get(generation)
        if gen_data:
            return gen_data["year"]
        return None

    def get_cpu_for_generation(
        self,
        generation: Optional[int],
        variant: Optional[str] = None
    ) -> Optional[str]:
        """
        Retorna el chipset Tensor para una generación de Pixel.

        Args:
            generation: Número de generación (6, 7, 8, 9)
            variant: Variante (Pro, a, etc.) - No afecta el chip en Pixel

        Returns:
            Nombre del chipset o None
        """
        # Caso especial: Pixel Fold (sin generación numérica)
        if variant == "Fold":
            return self.PIXEL_SPECIAL["Fold"]["cpu"]

        if generation is None:
            return None

        gen_data = self.PIXEL_GENERATIONS.get(generation)
        if not gen_data:
            return None

        return gen_data.get("cpu")

    def get_available_variants(self, generation: int) -> List[str]:
        """
        Retorna las variantes disponibles para una generación.

        Args:
            generation: Número de generación

        Returns:
            Lista de variantes disponibles (["", "Pro", "a"], etc.)
        """
        gen_data = self.PIXEL_GENERATIONS.get(generation)
        if not gen_data:
            return []

        return gen_data.get("variants", [])

    def is_valid_variant(self, generation: int, variant: str) -> bool:
        """
        Verifica si una variante es válida para una generación.

        Args:
            generation: Número de generación
            variant: Variante a verificar (Pro, a, Pro XL, Fold)

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
        Enriquece features de Pixel con información del KB.

        Agrega:
        - Año de lanzamiento (desde generación)
        - Chipset Tensor (desde generación)

        Args:
            features: Features ya extraídas
            context: Contexto de mapeo

        Returns:
            Features enriquecidas
        """
        # Solo enriquecer Pixels
        if features.device_type != DeviceType.PIXEL:
            context.debug("No es Pixel, saltando enriquecimiento de Pixel KB")
            return features

        # Caso especial: Pixel Fold sin generación numérica
        if features.variant == "Fold" and not features.generation:
            context.info("Pixel Fold detectado (caso especial sin generación numérica)")
            features.year = self.PIXEL_SPECIAL["Fold"]["year"]
            features.cpu = self.PIXEL_SPECIAL["Fold"]["cpu"]
            features.add_note(f"Pixel Fold: año {features.year}, chip {features.cpu} (KB)")
            return features

        # Solo enriquecer si hay generación detectada
        if not features.generation:
            context.warning("No se detectó generación, no se puede enriquecer con KB")
            return features

        # Enriquecer año (solo si no está ya presente)
        if not features.year:
            year = self.get_year_for_generation("Pixel", features.generation)
            if year:
                features.year = year
                features.add_note(f"Año {year} inferido desde generación {features.generation} (KB)")
                context.info(f"Año inferido: {year} (gen {features.generation})")

        # Enriquecer CPU/chipset (solo si no está ya presente)
        if not features.cpu:
            cpu = self.get_cpu_for_generation(features.generation, features.variant)
            if cpu:
                features.cpu = cpu
                features.add_note(f"Chipset {cpu} inferido desde generación {features.generation} (KB)")
                context.info(f"Chipset inferido: {cpu}")

        return features
