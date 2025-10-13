"""
Knowledge Base para Samsung Galaxy.

Contiene información de dominio sobre series de Samsung Galaxy:
- Año de lanzamiento
- Procesador (Exynos para modelos F/B de España)
- Variantes disponibles (Plus, Ultra, FE)

Esta información es crítica para el mapeo correcto porque Likewize
NO envía el año en el nombre del modelo.
"""

from typing import Optional, Dict, List, Any

from productos.mapping.knowledge.base import BaseKnowledgeBase
from productos.mapping.core.types import ExtractedFeatures, MappingContext, DeviceType


class SamsungKnowledgeBase(BaseKnowledgeBase):
    """
    Knowledge Base de Samsung Galaxy con información de todas las series.

    Mapea series a specs completas (año, procesador Exynos, variantes).
    Basado en información oficial de Samsung para modelos Europa (F/B).
    """

    def __init__(self):
        """Inicializa el KB con datos de todas las series de Samsung Galaxy."""

        # Mapeo completo: serie → specs
        # Formato: {serie: {year, cpu, variants}}
        # CPU: Exynos para modelos Europa/UK (F/B)

        # Galaxy S Series
        self.S_SERIES: Dict[str, Dict[str, Any]] = {
            "S25": {
                "year": 2025,
                "cpu": "Exynos 2500",
                "variants": ["", "Plus", "Ultra"]
            },
            "S24": {
                "year": 2024,
                "cpu": "Exynos 2400",
                "variants": ["", "Plus", "Ultra", "FE"]
            },
            "S23": {
                "year": 2023,
                "cpu": "Snapdragon 8 Gen 2",  # S23 usa Snapdragon globalmente
                "variants": ["", "Plus", "Ultra", "FE"]
            },
            "S22": {
                "year": 2022,
                "cpu": "Exynos 2200",
                "variants": ["", "Plus", "Ultra"]
            },
            "S21": {
                "year": 2021,
                "cpu": "Exynos 2100",
                "variants": ["", "Plus", "Ultra", "FE"]
            },
            "S20": {
                "year": 2020,
                "cpu": "Exynos 990",
                "variants": ["", "Plus", "Ultra", "FE"]
            },
            "S10": {
                "year": 2019,
                "cpu": "Exynos 9820",
                "variants": ["", "Plus", "5G"]
            },
        }

        # Galaxy Note Series
        self.NOTE_SERIES: Dict[str, Dict[str, Any]] = {
            "Note20": {
                "year": 2020,
                "cpu": "Exynos 990",
                "variants": ["", "Ultra"]
            },
            "Note10": {
                "year": 2019,
                "cpu": "Exynos 9825",
                "variants": ["", "Plus"]
            },
            "Note9": {
                "year": 2018,
                "cpu": "Exynos 9810",
                "variants": [""]
            },
        }

        # Galaxy Z Fold Series (foldables)
        self.FOLD_SERIES: Dict[str, Dict[str, Any]] = {
            "Z Fold6": {
                "year": 2024,
                "cpu": "Snapdragon 8 Gen 3",
                "variants": [""]
            },
            "Z Fold5": {
                "year": 2023,
                "cpu": "Snapdragon 8 Gen 2",
                "variants": [""]
            },
            "Z Fold4": {
                "year": 2022,
                "cpu": "Snapdragon 8+ Gen 1",
                "variants": [""]
            },
            "Z Fold3": {
                "year": 2021,
                "cpu": "Snapdragon 888",
                "variants": [""]
            },
            "Z Fold2": {
                "year": 2020,
                "cpu": "Snapdragon 865+",
                "variants": [""]
            },
        }

        # Galaxy Z Flip Series (foldables)
        self.FLIP_SERIES: Dict[str, Dict[str, Any]] = {
            "Z Flip5": {
                "year": 2023,
                "cpu": "Snapdragon 8 Gen 2",
                "variants": [""]
            },
            "Z Flip4": {
                "year": 2022,
                "cpu": "Snapdragon 8+ Gen 1",
                "variants": [""]
            },
            "Z Flip3": {
                "year": 2021,
                "cpu": "Snapdragon 888",
                "variants": [""]
            },
        }

        # Combinar todos los datos en un solo diccionario para búsqueda rápida
        self.ALL_SERIES: Dict[str, Dict[str, Any]] = {
            **self.S_SERIES,
            **self.NOTE_SERIES,
            **self.FOLD_SERIES,
            **self.FLIP_SERIES,
        }

    def get_year_for_series(self, series: str) -> Optional[int]:
        """
        Retorna el año de lanzamiento para una serie de Samsung.

        Args:
            series: Serie (S21, Note20, Z Fold5, Z Flip4, etc.)

        Returns:
            Año de lanzamiento o None si no se encuentra
        """
        series_data = self.ALL_SERIES.get(series)
        if series_data:
            return series_data["year"]
        return None

    def get_cpu_for_series(self, series: str, variant: Optional[str] = None) -> Optional[str]:
        """
        Retorna el procesador para una serie de Samsung.

        Para modelos España (F/B), generalmente Exynos en S series,
        y Snapdragon en foldables (Z Fold/Flip) y algunas series especiales.

        Args:
            series: Serie (S21, Note20, Z Fold5, etc.)
            variant: Variante (Plus, Ultra, FE) - No afecta el chip

        Returns:
            Nombre del procesador o None
        """
        series_data = self.ALL_SERIES.get(series)
        if not series_data:
            return None

        return series_data.get("cpu")

    def get_available_variants(self, series: str) -> List[str]:
        """
        Retorna las variantes disponibles para una serie.

        Args:
            series: Serie (S21, Note20, etc.)

        Returns:
            Lista de variantes disponibles (["", "Plus", "Ultra"], etc.)
        """
        series_data = self.ALL_SERIES.get(series)
        if not series_data:
            return []

        return series_data.get("variants", [])

    def is_valid_variant(self, series: str, variant: str) -> bool:
        """
        Verifica si una variante es válida para una serie.

        Args:
            series: Serie (S21, Note20, etc.)
            variant: Variante a verificar (Plus, Ultra, FE)

        Returns:
            True si la variante existe en esa serie
        """
        available = self.get_available_variants(series)
        return variant in available

    def _do_enrich_features(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Enriquece features de Samsung con información del KB.

        Agrega:
        - Año de lanzamiento (desde serie)
        - Procesador (desde serie)

        Args:
            features: Features ya extraídas
            context: Contexto de mapeo

        Returns:
            Features enriquecidas
        """
        # Solo enriquecer Samsung Galaxy
        if features.device_type != DeviceType.SAMSUNG:
            context.debug("No es Samsung Galaxy, saltando enriquecimiento de Samsung KB")
            return features

        # Solo enriquecer si hay serie detectada
        if not features.series:
            context.warning("No se detectó serie, no se puede enriquecer con KB")
            return features

        # Enriquecer año (solo si no está ya presente)
        if not features.year:
            year = self.get_year_for_series(features.series)
            if year:
                features.year = year
                features.add_note(f"Año {year} inferido desde serie {features.series} (KB)")
                context.info(f"Año inferido: {year} (serie {features.series})")

        # Enriquecer CPU/procesador (solo si no está ya presente)
        if not features.cpu:
            cpu = self.get_cpu_for_series(features.series, features.variant)
            if cpu:
                features.cpu = cpu
                features.add_note(f"Procesador {cpu} inferido desde serie {features.series} (KB)")
                context.info(f"Procesador inferido: {cpu}")

        return features
