"""
MacBook Knowledge Base - Reglas de negocio de MacBooks.

Cubre todas las variantes de MacBook:
- MacBook Air: M1/M2/M3/M4 (13" y 15")
- MacBook Pro Intel: Core i5/i7/i9 (13", 15", 16")
- MacBook Pro M-series: M1/M2/M3/M4 + Pro/Max (14", 16")

Este KB es crítico para:
1. Mapear chip → año (M3 → 2023, Core i7 2.3 → 2020)
2. Validar combinaciones (14" solo existe en M-series, no Intel)
3. Inferir specs desde datos parciales
"""

from typing import Dict, List, Any, Optional
from productos.mapping.knowledge.base import BaseKnowledgeBase


class MacBookKnowledgeBase(BaseKnowledgeBase):
    """
    Knowledge Base para MacBooks (Air y Pro).

    Estructura unificada que cubre:
    - MacBook Air (M-series)
    - MacBook Pro Intel (legacy)
    - MacBook Pro M-series (actual)
    """

    def __init__(self):
        """Inicializa mapeos de MacBook Air y Pro."""

        # ===========================
        # MACBOOK AIR (M-series only)
        # ===========================
        # Desde 2020, solo M-series (M1, M2, M3, M4...)
        # Tamaños: 13" (siempre) y 15" (desde 2023)

        self.MACBOOK_AIR_BY_CHIP: Dict[str, Dict[str, Any]] = {
            "M4": {
                "year": 2024,
                "screen_sizes": [13.0, 15.0],
                "capacities": [256, 512, 1024, 2048],
                "cpu_cores": [8, 10],
                "gpu_cores": [8, 10],
            },
            "M3": {
                "year": 2024,
                "screen_sizes": [13.0, 15.0],  # Ambos tamaños
                "capacities": [256, 512, 1024, 2048],
                "cpu_cores": [8],
                "gpu_cores": [8, 10],
            },
            "M2": {
                "year": 2022,
                "screen_sizes": [13.0, 15.0],  # 13" en 2022, 15" en 2023
                "capacities": [256, 512, 1024, 2048],
                "cpu_cores": [8],
                "gpu_cores": [8, 10],
            },
            "M1": {
                "year": 2020,
                "screen_sizes": [13.0],  # Solo 13"
                "capacities": [256, 512, 1024, 2048],
                "cpu_cores": [8],
                "gpu_cores": [7, 8],  # 7-core o 8-core GPU
            },
        }

        # ===========================
        # MACBOOK PRO INTEL (Legacy)
        # ===========================
        # 2017-2020, antes de Apple Silicon
        # Identificados por: Core i5/i7/i9 + velocidad (ej: "Core i7 2.3")

        self.MACBOOK_PRO_INTEL_BY_SIZE: Dict[float, List[Dict[str, Any]]] = {
            # 13" Intel (2017-2020)
            13.0: [
                {
                    "year": 2020,
                    "cpu_types": ["Core i5", "Core i7"],
                    "cpu_speeds": ["1.4", "2.0", "2.3"],
                    "capacities": [256, 512, 1024, 2048, 4096],
                    "models": [
                        "A2251",  # 4 puertos Thunderbolt 3
                        "A2289",  # 2 puertos Thunderbolt 3
                    ],
                },
                {
                    "year": 2019,
                    "cpu_types": ["Core i5", "Core i7"],
                    "cpu_speeds": ["1.4", "2.4", "2.8"],
                    "capacities": [128, 256, 512, 1024, 2048],
                    "models": [
                        "A1989",  # 4 puertos
                        "A2159",  # 2 puertos
                    ],
                },
                {
                    "year": 2018,
                    "cpu_types": ["Core i5", "Core i7"],
                    "cpu_speeds": ["2.3", "2.7"],
                    "capacities": [256, 512, 1024, 2048],
                    "models": ["A1989"],
                },
                {
                    "year": 2017,
                    "cpu_types": ["Core i5", "Core i7"],
                    "cpu_speeds": ["2.3", "3.1", "3.3", "3.5"],
                    "capacities": [128, 256, 512, 1024],
                    "models": [
                        "A1706",  # 4 puertos
                        "A1708",  # 2 puertos (sin Touch Bar)
                    ],
                },
            ],

            # 15" Intel (2017-2019, discontinuado, reemplazado por 16")
            15.0: [
                {
                    "year": 2019,
                    "cpu_types": ["Core i7", "Core i9"],
                    "cpu_speeds": ["2.3", "2.4", "2.6"],
                    "capacities": [256, 512, 1024, 2048, 4096],
                    "models": ["A1990"],
                },
                {
                    "year": 2018,
                    "cpu_types": ["Core i7", "Core i9"],
                    "cpu_speeds": ["2.2", "2.6", "2.9"],
                    "capacities": [256, 512, 1024, 2048, 4096],
                    "models": ["A1990"],
                },
                {
                    "year": 2017,
                    "cpu_types": ["Core i7"],
                    "cpu_speeds": ["2.8", "2.9", "3.1"],
                    "capacities": [256, 512, 1024, 2048],
                    "models": ["A1707"],
                },
            ],

            # 16" Intel (2019-2020, reemplazó al 15")
            16.0: [
                {
                    "year": 2020,
                    "cpu_types": ["Core i7", "Core i9"],
                    "cpu_speeds": ["2.3", "2.4"],
                    "capacities": [512, 1024, 2048, 4096, 8192],
                    "models": ["A2141"],
                },
                {
                    "year": 2019,
                    "cpu_types": ["Core i7", "Core i9"],
                    "cpu_speeds": ["2.3", "2.4", "2.6"],
                    "capacities": [512, 1024, 2048, 4096, 8192],
                    "models": ["A2141"],
                },
            ],
        }

        # ===========================
        # MACBOOK PRO M-SERIES (Actual)
        # ===========================
        # 2021+, Apple Silicon (M1/M2/M3/M4 + Pro/Max variants)
        # 14" y 16" solamente (reemplazaron 13"/15"/16" Intel)

        self.MACBOOK_PRO_M_SERIES_BY_SIZE: Dict[float, Dict[str, Any]] = {
            # 14" M-series (desde 2021)
            14.0: {
                # M4 (2024)
                2024: {
                    "chips": {
                        "M4": {
                            "cpu_cores": [10],
                            "gpu_cores": [10],
                            "capacities": [512, 1024, 2048],
                        },
                        "M4 Pro": {
                            "cpu_cores": [12, 14],
                            "gpu_cores": [16, 20],
                            "capacities": [512, 1024, 2048, 4096],
                        },
                        "M4 Max": {
                            "cpu_cores": [14, 16],
                            "gpu_cores": [32, 40],
                            "capacities": [1024, 2048, 4096, 8192],
                        },
                    },
                    "models": ["A3000"],  # Placeholder, actualizar con modelo real
                },
                # M3 (2023)
                2023: {
                    "chips": {
                        "M3": {
                            "cpu_cores": [8],
                            "gpu_cores": [10],
                            "capacities": [512, 1024],
                        },
                        "M3 Pro": {
                            "cpu_cores": [11, 12],
                            "gpu_cores": [14, 18],
                            "capacities": [512, 1024, 2048, 4096],
                        },
                        "M3 Max": {
                            "cpu_cores": [14, 16],
                            "gpu_cores": [30, 40],
                            "capacities": [1024, 2048, 4096, 8192],
                        },
                    },
                    "models": ["A2992"],
                },
                # M2 (2023)
                2023: {
                    "chips": {
                        "M2": {
                            "cpu_cores": [8],
                            "gpu_cores": [10],
                            "capacities": [256, 512, 1024, 2048],
                        },
                        "M2 Pro": {
                            "cpu_cores": [10, 12],
                            "gpu_cores": [16, 19],
                            "capacities": [512, 1024, 2048, 4096],
                        },
                        "M2 Max": {
                            "cpu_cores": [12],
                            "gpu_cores": [30, 38],
                            "capacities": [512, 1024, 2048, 4096, 8192],
                        },
                    },
                    "models": ["A2779"],
                },
                # M1 (2021)
                2021: {
                    "chips": {
                        "M1 Pro": {
                            "cpu_cores": [8, 10],
                            "gpu_cores": [14, 16],
                            "capacities": [512, 1024, 2048],
                        },
                        "M1 Max": {
                            "cpu_cores": [10],
                            "gpu_cores": [24, 32],
                            "capacities": [512, 1024, 2048, 4096, 8192],
                        },
                    },
                    "models": ["A2442"],
                },
            },

            # 16" M-series (desde 2021)
            16.0: {
                # M4 (2024)
                2024: {
                    "chips": {
                        "M4 Pro": {
                            "cpu_cores": [12, 14],
                            "gpu_cores": [16, 20],
                            "capacities": [512, 1024, 2048, 4096],
                        },
                        "M4 Max": {
                            "cpu_cores": [14, 16],
                            "gpu_cores": [32, 40],
                            "capacities": [1024, 2048, 4096, 8192],
                        },
                    },
                    "models": ["A3001"],  # Placeholder
                },
                # M3 (2023)
                2023: {
                    "chips": {
                        "M3 Pro": {
                            "cpu_cores": [12],
                            "gpu_cores": [18],
                            "capacities": [512, 1024, 2048, 4096],
                        },
                        "M3 Max": {
                            "cpu_cores": [14, 16],
                            "gpu_cores": [30, 40],
                            "capacities": [1024, 2048, 4096, 8192],
                        },
                    },
                    "models": ["A2991"],
                },
                # M2 (2023)
                2023: {
                    "chips": {
                        "M2 Pro": {
                            "cpu_cores": [12],
                            "gpu_cores": [19],
                            "capacities": [512, 1024, 2048, 4096],
                        },
                        "M2 Max": {
                            "cpu_cores": [12],
                            "gpu_cores": [30, 38],
                            "capacities": [512, 1024, 2048, 4096, 8192],
                        },
                    },
                    "models": ["A2780"],
                },
                # M1 (2021)
                2021: {
                    "chips": {
                        "M1 Pro": {
                            "cpu_cores": [10],
                            "gpu_cores": [16],
                            "capacities": [512, 1024, 2048],
                        },
                        "M1 Max": {
                            "cpu_cores": [10],
                            "gpu_cores": [24, 32],
                            "capacities": [512, 1024, 2048, 4096, 8192],
                        },
                    },
                    "models": ["A2485"],
                },
            },
        }

    def get_air_info(self, chip: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene info de un MacBook Air por chip.

        Args:
            chip: Chip M-series (ej: "M3", "M2")

        Returns:
            Dict con year, screen_sizes, capacities, etc. o None
        """
        return self.MACBOOK_AIR_BY_CHIP.get(chip)

    def get_pro_intel_info(self, screen_size: float, year: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """
        Obtiene info de MacBook Pro Intel por tamaño (y opcionalmente año).

        Args:
            screen_size: Tamaño de pantalla (13.0, 15.0, 16.0)
            year: Año opcional para filtrar

        Returns:
            Lista de configs Intel para ese tamaño o None
        """
        size_configs = self.MACBOOK_PRO_INTEL_BY_SIZE.get(screen_size)
        if not size_configs:
            return None

        if year:
            return [cfg for cfg in size_configs if cfg["year"] == year]
        return size_configs

    def get_pro_m_series_info(self, screen_size: float, year: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Obtiene info de MacBook Pro M-series por tamaño y año.

        Args:
            screen_size: Tamaño de pantalla (14.0, 16.0)
            year: Año de lanzamiento

        Returns:
            Dict con chips disponibles para ese tamaño/año o None
        """
        size_configs = self.MACBOOK_PRO_M_SERIES_BY_SIZE.get(screen_size)
        if not size_configs:
            return None

        if year:
            return size_configs.get(year)
        return size_configs

    def infer_year_from_chip(self, chip: str, variant: str, screen_size: Optional[float] = None) -> Optional[int]:
        """
        Infiere el año desde el chip y variante.

        Args:
            chip: Chip base ("M1", "M2", "M3", "Core i7")
            variant: "Air", "Pro", o None
            screen_size: Tamaño de pantalla (opcional, ayuda a desambiguar)

        Returns:
            Año inferido o None
        """
        # MacBook Air
        if variant == "Air":
            air_info = self.get_air_info(chip)
            return air_info["year"] if air_info else None

        # MacBook Pro M-series
        if chip.startswith("M"):
            # Buscar en configs de Pro M-series
            for size, year_configs in self.MACBOOK_PRO_M_SERIES_BY_SIZE.items():
                if screen_size and size != screen_size:
                    continue

                for year, config in year_configs.items():
                    if chip in config.get("chips", {}):
                        return year

        # Intel Pro: más difícil sin más contexto (múltiples años con mismo chip)
        # Retornar None y dejar que el matching use otros criterios
        return None

    def is_valid_combination(
        self,
        variant: str,
        chip: str,
        screen_size: float,
        capacity: int,
        year: Optional[int] = None
    ) -> bool:
        """
        Valida si una combinación de specs es posible.

        Args:
            variant: "Air" o "Pro"
            chip: Chip (ej: "M3", "M3 Pro", "Core i7 2.3")
            screen_size: Tamaño de pantalla
            capacity: Capacidad en GB
            year: Año opcional

        Returns:
            True si es combinación válida
        """
        # MacBook Air
        if variant == "Air":
            air_info = self.get_air_info(chip)
            if not air_info:
                return False

            return (
                screen_size in air_info["screen_sizes"]
                and capacity in air_info["capacities"]
            )

        # MacBook Pro M-series
        if chip.startswith("M"):
            pro_m_info = self.get_pro_m_series_info(screen_size, year)
            if not pro_m_info:
                return False

            chip_info = pro_m_info.get("chips", {}).get(chip)
            if not chip_info:
                return False

            return capacity in chip_info["capacities"]

        # MacBook Pro Intel
        if "Core i" in chip:
            pro_intel_configs = self.get_pro_intel_info(screen_size, year)
            if not pro_intel_configs:
                return False

            # Verificar si alguna config soporta esta capacidad
            for config in pro_intel_configs:
                if capacity in config["capacities"]:
                    return True
            return False

        return False

    def get_chip_variants(self, base_chip: str) -> List[str]:
        """
        Obtiene todas las variantes de un chip base.

        Args:
            base_chip: Chip base (ej: "M3")

        Returns:
            Lista de variantes (ej: ["M3", "M3 Pro", "M3 Max"])
        """
        variants = [base_chip]

        # M-series tiene variantes Pro y Max
        if base_chip.startswith("M") and not base_chip.endswith(("Pro", "Max")):
            variants.extend([f"{base_chip} Pro", f"{base_chip} Max"])

        return variants
