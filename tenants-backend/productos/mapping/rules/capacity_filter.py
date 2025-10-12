"""
Capacity Filter - Filtra candidatos por capacidad de almacenamiento.

Asegura que la capacidad coincida exactamente (128GB, 256GB, 512GB, 1TB, etc.).
Soporta múltiples formatos: "128GB", "128 GB", "128", "1TB", "1 TB".
"""

from typing import List

from productos.mapping.rules.base import BaseRule
from productos.mapping.core.types import (
    ExtractedFeatures,
    MatchCandidate,
    MappingContext,
)


class CapacityFilter(BaseRule):
    """
    Filtra candidatos por capacidad de almacenamiento.

    Soporta formatos:
    - GB: "128GB", "128 GB", "128"
    - TB: "1TB", "1 TB" (convertido a GB)

    Ejemplo:
        Features: storage_gb=128
        Candidatos:
        - iPhone 13 Pro 128GB ✅ mantener
        - iPhone 13 Pro 256GB ❌ eliminar
        - iPhone 13 Pro 128 GB ✅ mantener (diferente formato)
    """

    def get_rule_name(self) -> str:
        """Retorna el nombre de la regla."""
        return "CapacityFilter"

    def _should_apply(
        self,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> bool:
        """
        Solo aplicar si tenemos storage en features.

        Args:
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            True si features.storage_gb está disponible
        """
        if not features.storage_gb:
            context.debug("CapacityFilter: No hay storage en features, saltando filtro")
            return False

        context.debug(f"CapacityFilter: Filtrando por capacidad {features.storage_gb}GB")
        return True

    def _filter_candidates(
        self,
        features: ExtractedFeatures,
        candidates: List[MatchCandidate],
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Filtra candidatos por capacidad.

        Args:
            features: Features con storage esperado
            candidates: Lista de candidatos
            context: Contexto de mapeo

        Returns:
            Solo candidatos con capacidad correcta
        """
        expected_storage_gb = features.storage_gb
        filtered = []

        for candidate in candidates:
            if self._capacity_matches(expected_storage_gb, candidate.capacidad_tamanio):
                filtered.append(candidate)
                context.debug(
                    f"CapacityFilter: Mantener {candidate.modelo_descripcion} "
                    f"{candidate.capacidad_tamanio} ({expected_storage_gb}GB)"
                )
            else:
                context.debug(
                    f"CapacityFilter: Eliminar {candidate.modelo_descripcion} "
                    f"{candidate.capacidad_tamanio} (esperado {expected_storage_gb}GB)"
                )

        return filtered

    def _capacity_matches(self, expected_gb: int, capacity_str: str) -> bool:
        """
        Verifica si la capacidad coincide con el storage esperado.

        Soporta múltiples formatos:
        - "128GB", "128 GB", "128"
        - "1TB", "1 TB" (convertido a 1024GB)

        Args:
            expected_gb: Capacidad esperada en GB
            capacity_str: String de capacidad del candidato

        Returns:
            True si la capacidad coincide
        """
        # Normalizar string a minúsculas y eliminar espacios
        normalized = capacity_str.lower().replace(" ", "")

        # Generar patrones de búsqueda para expected_gb
        patterns = self._get_storage_patterns(expected_gb)

        # Verificar si algún patrón coincide
        for pattern in patterns:
            pattern_normalized = pattern.lower().replace(" ", "")
            if pattern_normalized in normalized:
                return True

        return False

    def _get_storage_patterns(self, storage_gb: int) -> List[str]:
        """
        Genera patrones de búsqueda para capacidad.

        Ejemplos:
        - 128 → ["128GB", "128 GB", "128"]
        - 1024 → ["1TB", "1 TB", "1024GB", "1024 GB", "1024"]

        Args:
            storage_gb: Almacenamiento en GB

        Returns:
            Lista de patrones
        """
        patterns = []

        # Convertir a TB si >= 1024
        if storage_gb >= 1024:
            tb = storage_gb / 1024
            if tb == int(tb):
                # TB entero (1TB, 2TB)
                patterns.extend([f"{int(tb)}TB", f"{int(tb)} TB"])
            else:
                # TB decimal (0.5TB)
                patterns.extend([f"{tb}TB", f"{tb} TB"])

        # Siempre agregar GB
        patterns.extend([f"{storage_gb}GB", f"{storage_gb} GB", str(storage_gb)])

        return patterns
