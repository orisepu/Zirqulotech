"""
Knowledge Base para iPad.

Contiene información de dominio sobre todas las variantes de iPad:
- iPad regular (generaciones numéricas)
- iPad Air (generaciones por nombre)
- iPad mini (generaciones numéricas)
- iPad Pro (por tamaño de pantalla y chip)

Esta información es crítica porque Likewize NO envía año/CPU completo.
"""

from typing import Optional, Dict, List, Any

from productos.mapping.knowledge.base import BaseKnowledgeBase
from productos.mapping.core.types import ExtractedFeatures, MappingContext, DeviceType


class iPadKnowledgeBase(BaseKnowledgeBase):
    """
    Knowledge Base de iPad con información de todas las variantes.

    Mapea generaciones/tamaños a specs completas (año, CPU, conectividad).
    Basado en información oficial de Apple.
    """

    def __init__(self):
        """Inicializa el KB con datos de todas las generaciones de iPad."""

        # iPad regular (generación numérica simple)
        self.IPAD_REGULAR_GENERATIONS: Dict[int, Dict[str, Any]] = {
            10: {
                "year": 2022,
                "cpu": "A14 Bionic",
                "screen_sizes": [10.9],
                "capacities": [64, 256]
            },
            9: {
                "year": 2021,
                "cpu": "A13 Bionic",
                "screen_sizes": [10.2],
                "capacities": [64, 256]
            },
            8: {
                "year": 2020,
                "cpu": "A12 Bionic",
                "screen_sizes": [10.2],
                "capacities": [32, 128]
            },
            7: {
                "year": 2019,
                "cpu": "A10 Fusion",
                "screen_sizes": [10.2],
                "capacities": [32, 128]
            },
            6: {
                "year": 2018,
                "cpu": "A10 Fusion",
                "screen_sizes": [9.7],
                "capacities": [32, 128]
            },
            5: {
                "year": 2017,
                "cpu": "A9",
                "screen_sizes": [9.7],
                "capacities": [32, 128]
            },
        }

        # iPad Air (generación por nombre)
        self.IPAD_AIR_GENERATIONS: Dict[int, Dict[str, Any]] = {
            6: {
                "year": 2024,
                "cpu": "M2",
                "screen_sizes": [11.0, 13.0],
                "capacities": [128, 256, 512, 1024]
            },
            5: {
                "year": 2022,
                "cpu": "M1",
                "screen_sizes": [10.9],
                "capacities": [64, 256]
            },
            4: {
                "year": 2020,
                "cpu": "A14 Bionic",
                "screen_sizes": [10.9],
                "capacities": [64, 256]
            },
            3: {
                "year": 2019,
                "cpu": "A12 Bionic",
                "screen_sizes": [10.5],
                "capacities": [64, 256]
            },
            2: {
                "year": 2014,
                "cpu": "A8X",
                "screen_sizes": [9.7],
                "capacities": [16, 32, 64, 128]
            },
            1: {
                "year": 2013,
                "cpu": "A7",
                "screen_sizes": [9.7],
                "capacities": [16, 32, 64, 128]
            },
        }

        # iPad mini (generación numérica)
        self.IPAD_MINI_GENERATIONS: Dict[int, Dict[str, Any]] = {
            7: {
                "year": 2024,
                "cpu": "A17 Pro",
                "screen_sizes": [8.3],
                "capacities": [128, 256, 512]
            },
            6: {
                "year": 2021,
                "cpu": "A15 Bionic",
                "screen_sizes": [8.3],
                "capacities": [64, 256]
            },
            5: {
                "year": 2019,
                "cpu": "A12 Bionic",
                "screen_sizes": [7.9],
                "capacities": [64, 256]
            },
            4: {
                "year": 2015,
                "cpu": "A8",
                "screen_sizes": [7.9],
                "capacities": [16, 32, 64, 128]
            },
        }

        # iPad Pro (por tamaño de pantalla + generación/chip)
        # Formato: {tamaño: {año: specs}}
        self.IPAD_PRO_BY_SIZE: Dict[float, Dict[int, Dict[str, Any]]] = {
            13.0: {  # iPad Pro 13" (M4)
                2024: {
                    "cpu": "M4",
                    "capacities": [256, 512, 1024, 2048]
                },
            },
            12.9: {  # iPad Pro 12.9"
                2022: {
                    "cpu": "M2",
                    "generation": 6,
                    "capacities": [128, 256, 512, 1024, 2048]
                },
                2021: {
                    "cpu": "M1",
                    "generation": 5,
                    "capacities": [128, 256, 512, 1024, 2048]
                },
                2020: {
                    "cpu": "A12Z Bionic",
                    "generation": 4,
                    "capacities": [128, 256, 512, 1024]
                },
                2018: {
                    "cpu": "A12X Bionic",
                    "generation": 3,
                    "capacities": [64, 256, 512, 1024]
                },
                2017: {
                    "cpu": "A10X Fusion",
                    "generation": 2,
                    "capacities": [64, 256, 512]
                },
                2015: {
                    "cpu": "A9X",
                    "generation": 1,
                    "capacities": [32, 128]
                },
            },
            11.0: {  # iPad Pro 11"
                2024: {
                    "cpu": "M4",
                    "capacities": [256, 512, 1024, 2048]
                },
                2022: {
                    "cpu": "M2",
                    "generation": 4,
                    "capacities": [128, 256, 512, 1024, 2048]
                },
                2021: {
                    "cpu": "M1",
                    "generation": 3,
                    "capacities": [128, 256, 512, 1024, 2048]
                },
                2020: {
                    "cpu": "A12Z Bionic",
                    "generation": 2,
                    "capacities": [128, 256, 512, 1024]
                },
                2018: {
                    "cpu": "A12X Bionic",
                    "generation": 1,
                    "capacities": [64, 256, 512, 1024]
                },
            },
            10.5: {  # iPad Pro 10.5"
                2017: {
                    "cpu": "A10X Fusion",
                    "capacities": [64, 256, 512]
                },
            },
            9.7: {  # iPad Pro 9.7"
                2016: {
                    "cpu": "A9X",
                    "capacities": [32, 128, 256]
                },
            },
        }

    def get_year_for_ipad_regular(self, generation: int) -> Optional[int]:
        """Retorna año para iPad regular."""
        gen_data = self.IPAD_REGULAR_GENERATIONS.get(generation)
        return gen_data["year"] if gen_data else None

    def get_year_for_ipad_air(self, generation: int) -> Optional[int]:
        """Retorna año para iPad Air."""
        gen_data = self.IPAD_AIR_GENERATIONS.get(generation)
        return gen_data["year"] if gen_data else None

    def get_year_for_ipad_mini(self, generation: int) -> Optional[int]:
        """Retorna año para iPad mini."""
        gen_data = self.IPAD_MINI_GENERATIONS.get(generation)
        return gen_data["year"] if gen_data else None

    def get_year_for_ipad_pro(
        self,
        screen_size: float,
        cpu: Optional[str] = None,
        generation: Optional[int] = None
    ) -> Optional[int]:
        """
        Retorna año para iPad Pro basado en tamaño + CPU o generación.

        Args:
            screen_size: Tamaño de pantalla (9.7, 10.5, 11.0, 12.9, 13.0)
            cpu: CPU detectado (M1, M2, M4, etc.)
            generation: Generación si fue detectada

        Returns:
            Año de lanzamiento o None
        """
        size_data = self.IPAD_PRO_BY_SIZE.get(screen_size)
        if not size_data:
            return None

        # Si tenemos CPU, buscar por CPU
        if cpu:
            for year, specs in size_data.items():
                if specs["cpu"] == cpu:
                    return year

        # Si tenemos generación, buscar por generación
        if generation:
            for year, specs in size_data.items():
                if specs.get("generation") == generation:
                    return year

        # Si solo tenemos tamaño, retornar el año más ANTIGUO (primera generación)
        # Opción conservadora: no asumir el modelo más caro/reciente
        return min(size_data.keys())

    def get_cpu_for_variant(
        self,
        variant: str,
        generation: Optional[int] = None,
        screen_size: Optional[float] = None,
        year: Optional[int] = None
    ) -> Optional[str]:
        """
        Retorna CPU para una variante específica de iPad.

        Args:
            variant: "regular", "Air", "mini", "Pro"
            generation: Generación numérica
            screen_size: Tamaño de pantalla (para Pro)
            year: Año (para Pro)

        Returns:
            Nombre del CPU o None
        """
        if variant == "regular" and generation:
            gen_data = self.IPAD_REGULAR_GENERATIONS.get(generation)
            return gen_data["cpu"] if gen_data else None

        elif variant == "Air" and generation:
            gen_data = self.IPAD_AIR_GENERATIONS.get(generation)
            return gen_data["cpu"] if gen_data else None

        elif variant == "mini" and generation:
            gen_data = self.IPAD_MINI_GENERATIONS.get(generation)
            return gen_data["cpu"] if gen_data else None

        elif variant == "Pro" and screen_size:
            size_data = self.IPAD_PRO_BY_SIZE.get(screen_size)
            if not size_data:
                return None

            # Si tenemos año exacto
            if year and year in size_data:
                return size_data[year]["cpu"]

            # Retornar CPU del modelo más ANTIGUO (primera generación) para ese tamaño
            # Opción conservadora: no asumir el modelo más caro/reciente
            oldest_year = min(size_data.keys())
            return size_data[oldest_year]["cpu"]

        return None

    def get_available_screen_sizes(self, variant: str, generation: Optional[int] = None) -> List[float]:
        """
        Retorna tamaños de pantalla disponibles para una variante/generación.

        Args:
            variant: "regular", "Air", "mini", "Pro"
            generation: Generación (opcional)

        Returns:
            Lista de tamaños en pulgadas
        """
        if variant == "regular" and generation:
            gen_data = self.IPAD_REGULAR_GENERATIONS.get(generation)
            return gen_data["screen_sizes"] if gen_data else []

        elif variant == "Air" and generation:
            gen_data = self.IPAD_AIR_GENERATIONS.get(generation)
            return gen_data["screen_sizes"] if gen_data else []

        elif variant == "mini" and generation:
            gen_data = self.IPAD_MINI_GENERATIONS.get(generation)
            return gen_data["screen_sizes"] if gen_data else []

        elif variant == "Pro":
            return list(self.IPAD_PRO_BY_SIZE.keys())

        return []

    def get_available_capacities(
        self,
        variant: str,
        generation: Optional[int] = None,
        screen_size: Optional[float] = None,
        year: Optional[int] = None
    ) -> List[int]:
        """
        Retorna capacidades disponibles para una variante específica.

        Args:
            variant: "regular", "Air", "mini", "Pro"
            generation: Generación numérica
            screen_size: Tamaño de pantalla (para Pro)
            year: Año (para Pro)

        Returns:
            Lista de capacidades en GB
        """
        if variant == "regular" and generation:
            gen_data = self.IPAD_REGULAR_GENERATIONS.get(generation)
            return gen_data["capacities"] if gen_data else []

        elif variant == "Air" and generation:
            gen_data = self.IPAD_AIR_GENERATIONS.get(generation)
            return gen_data["capacities"] if gen_data else []

        elif variant == "mini" and generation:
            gen_data = self.IPAD_MINI_GENERATIONS.get(generation)
            return gen_data["capacities"] if gen_data else []

        elif variant == "Pro" and screen_size:
            size_data = self.IPAD_PRO_BY_SIZE.get(screen_size)
            if not size_data:
                return []

            # Si tenemos año exacto
            if year and year in size_data:
                return size_data[year]["capacities"]

            # Retornar capacidades del modelo más ANTIGUO (primera generación)
            # Opción conservadora: no asumir el modelo más caro/reciente
            oldest_year = min(size_data.keys())
            return size_data[oldest_year]["capacities"]

        return []

    def _do_enrich_features(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Enriquece features de iPad con información del KB.

        Agrega:
        - Año de lanzamiento
        - CPU
        - Tamaños de pantalla válidos
        - Capacidades válidas

        Args:
            features: Features ya extraídas
            context: Contexto de mapeo

        Returns:
            Features enriquecidas
        """
        # Solo enriquecer iPads
        if features.device_type not in (
            DeviceType.IPAD,
            DeviceType.IPAD_PRO,
            DeviceType.IPAD_AIR,
            DeviceType.IPAD_MINI
        ):
            context.debug("No es iPad, saltando enriquecimiento de iPad KB")
            return features

        # Determinar variante
        variant = self._get_variant_from_device_type(features.device_type)

        # Enriquecer año
        if not features.year:
            year = self._get_year(variant, features)
            if year:
                features.year = year
                features.add_note(f"Año {year} inferido desde {variant} gen {features.generation} (KB)")
                context.info(f"Año inferido: {year}")

        # Enriquecer CPU
        if not features.cpu:
            cpu = self.get_cpu_for_variant(
                variant,
                features.generation,
                features.screen_size,
                features.year
            )
            if cpu:
                features.cpu = cpu
                features.add_note(f"CPU {cpu} inferido (KB)")
                context.info(f"CPU inferido: {cpu}")

        return features

    def _get_variant_from_device_type(self, device_type: DeviceType) -> str:
        """Convierte DeviceType a string de variante."""
        if device_type == DeviceType.IPAD_PRO:
            return "Pro"
        elif device_type == DeviceType.IPAD_AIR:
            return "Air"
        elif device_type == DeviceType.IPAD_MINI:
            return "mini"
        else:
            return "regular"

    def _get_year(self, variant: str, features: ExtractedFeatures) -> Optional[int]:
        """Helper para obtener año según variante."""
        if variant == "regular":
            return self.get_year_for_ipad_regular(features.generation or 0)
        elif variant == "Air":
            return self.get_year_for_ipad_air(features.generation or 0)
        elif variant == "mini":
            return self.get_year_for_ipad_mini(features.generation or 0)
        elif variant == "Pro":
            return self.get_year_for_ipad_pro(
                features.screen_size or 0,
                features.cpu,
                features.generation
            )
        return None
