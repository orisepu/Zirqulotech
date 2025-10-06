"""
Servicio centralizado para mapeo inteligente de dispositivos.
Consolida toda la lógica de mapeo entre datos externos y la base de datos.
"""

import re
import logging
import time
from decimal import Decimal
from typing import Optional, Dict, List, Tuple, Any, NamedTuple
from dataclasses import dataclass
from collections import defaultdict, Counter

from django.apps import apps
from django.conf import settings
from django.db.models import Q, Count
from django.utils import timezone

from ..models import DeviceMapping, MappingMetrics, Modelo, Capacidad


logger = logging.getLogger(__name__)


@dataclass
class DeviceMetadata:
    """Metadatos extraídos de un dispositivo externo."""
    brand: str
    device_type: str
    model_raw: str
    model_normalized: str
    capacity_gb: Optional[int] = None
    a_number: str = ""
    screen_size: Optional[int] = None
    year: Optional[int] = None
    cpu: str = ""
    gpu_cores: Optional[int] = None
    likewize_model_code: str = ""
    likewize_master_model_id: str = ""
    additional_data: Dict[str, Any] = None

    def __post_init__(self):
        if self.additional_data is None:
            self.additional_data = {}


class MappingResult(NamedTuple):
    """Resultado de un mapeo de dispositivo."""
    capacity_id: Optional[int]
    confidence_score: int  # 0-100
    algorithm_used: str  # 'cached', 'exact', 'fuzzy', 'heuristic', 'failed'
    metadata: Dict[str, Any]


class DeviceMappingService:
    """
    Servicio centralizado para mapeo inteligente de dispositivos.
    Implementa un algoritmo en fases con caché persistente.
    """

    def __init__(self):
        # Configuración de scoring por algoritmo
        self.ALGORITHM_WEIGHTS = {
            'cached': {'base_score': 95, 'decay_factor': 0.95},
            'exact': {'base_score': 90, 'min_signals': 2},
            'fuzzy': {'base_score': 70, 'min_score': 40},
            'heuristic': {'base_score': 50, 'min_score': 30},
        }

        # Inicializar extractores por marca
        self._brand_extractors = {
            'apple': AppleMetadataExtractor(),
            'google': GoogleMetadataExtractor(),
            'samsung': SamsungMetadataExtractor(),
        }

        # Configurar modelos dinámicos
        self._setup_models()

    def _setup_models(self):
        """Configura los modelos basado en settings."""
        self.CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        self.REL_FIELD = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
        self.REL_NAME = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
        self.GB_FIELD = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
        self.ModeloClass = self.CapacidadModel._meta.get_field(self.REL_FIELD).related_model

    def map_device(self, metadata: DeviceMetadata, use_cache: bool = True) -> MappingResult:
        """
        Mapea un dispositivo usando el algoritmo en fases.

        Fases:
        1. Caché: Busca mappings previos exitosos
        2. Exacto: Mapeo por códigos exactos con filtros
        3. Fuzzy: Mapeo difuso con scoring ponderado
        4. Heurístico: Reglas específicas para casos edge
        """
        start_time = time.time()

        try:
            # Fase 1: Caché
            if use_cache:
                cached_result = self._try_cached_mapping(metadata)
                if cached_result.capacity_id:
                    self._update_metrics(metadata, time.time() - start_time, "cached", True)
                    return cached_result

            # Fase 2: Mapeo exacto
            exact_result = self._try_exact_mapping(metadata)
            if exact_result.capacity_id:
                self._cache_successful_mapping(metadata, exact_result)
                self._update_metrics(metadata, time.time() - start_time, "exact", True)
                return exact_result

            # Fase 3: Mapeo fuzzy
            fuzzy_result = self._try_fuzzy_mapping(metadata)
            if fuzzy_result.capacity_id and fuzzy_result.confidence_score >= self.ALGORITHM_WEIGHTS['fuzzy']['min_score']:
                self._cache_successful_mapping(metadata, fuzzy_result)
                self._update_metrics(metadata, time.time() - start_time, "fuzzy", True)
                return fuzzy_result

            # Fase 4: Mapeo heurístico
            heuristic_result = self._try_heuristic_mapping(metadata)
            if heuristic_result.capacity_id and heuristic_result.confidence_score >= self.ALGORITHM_WEIGHTS['heuristic']['min_score']:
                self._cache_successful_mapping(metadata, heuristic_result)
                self._update_metrics(metadata, time.time() - start_time, "heuristic", True)
                return heuristic_result

            # Sin mapeo exitoso
            self._update_metrics(metadata, time.time() - start_time, "failed", False)
            return MappingResult(None, 0, "failed", {"reason": "no_mapping_found"})

        except Exception as e:
            logger.exception(f"Error mapeando dispositivo {metadata.model_raw}: {e}")
            self._update_metrics(metadata, time.time() - start_time, "error", False)
            return MappingResult(None, 0, "failed", {"error": str(e)})

    def _try_cached_mapping(self, metadata: DeviceMetadata) -> MappingResult:
        """Intenta encontrar un mapeo en caché."""
        search_criteria = {
            'source_brand__iexact': metadata.brand,
            'source_model_normalized__iexact': metadata.model_normalized,
            'source_capacity_gb': metadata.capacity_gb,
        }

        # Agregar criterios adicionales si están disponibles
        if metadata.a_number:
            search_criteria['a_number'] = metadata.a_number

        cached_mapping = DeviceMapping.find_cached_mapping(**search_criteria)

        if cached_mapping:
            # Calcular score con decay por antigüedad
            days_old = (timezone.now() - cached_mapping.last_confirmed_at).days
            decay_factor = self.ALGORITHM_WEIGHTS['cached']['decay_factor']
            base_score = self.ALGORITHM_WEIGHTS['cached']['base_score']
            confidence = max(50, int(base_score * (decay_factor ** (days_old / 30))))

            # Marcar como confirmado
            cached_mapping.mark_confirmed()

            return MappingResult(
                cached_mapping.mapped_capacity_id,
                confidence,
                "cached",
                {"cached_mapping_id": str(cached_mapping.id), "times_confirmed": cached_mapping.times_confirmed}
            )

        return MappingResult(None, 0, "cached", {"reason": "no_cache_found"})

    def _try_exact_mapping(self, metadata: DeviceMetadata) -> MappingResult:
        """Mapeo exacto basado en códigos específicos y filtros fuertes."""
        candidates = self.ModeloClass.objects.all()
        strong_signals = 0

        # 🔥 ESTRATEGIA A-NUMBER PRIMERO (Macs)
        if metadata.a_number:
            # A-number es único en Apple, ignora tipo/marca
            candidates = candidates.filter(**{f"{self.REL_NAME}__icontains": metadata.a_number})
            strong_signals = 2

            if not candidates.exists():
                return MappingResult(None, 0, "exact", {"reason": "a_number_not_found"})

            # Refinar por GPU cores (ej: 10-core vs 19-core)
            if metadata.gpu_cores and candidates.count() > 1:
                gpu_candidates = candidates.filter(
                    Q(**{f"{self.REL_NAME}__icontains": f"{metadata.gpu_cores}-core"}) |
                    Q(**{f"{self.REL_NAME}__icontains": f"{metadata.gpu_cores} core"})
                )
                if gpu_candidates.exists():
                    candidates = gpu_candidates
                    strong_signals += 1

            # Refinar por CPU (ej: M2 vs M2 Pro)
            if metadata.cpu and candidates.count() > 1:
                cpu_candidates = candidates.filter(
                    Q(procesador__icontains=metadata.cpu) |
                    Q(**{f"{self.REL_NAME}__icontains": metadata.cpu})
                )
                if cpu_candidates.exists():
                    candidates = cpu_candidates
                    strong_signals += 1

        else:
            # SIN A-NUMBER (iPhone, iPad) - Lógica tradicional

            # Filtrar por códigos Likewize
            if metadata.likewize_model_code:
                likewize_candidates = candidates.filter(
                    Q(likewize_modelo__iexact=metadata.likewize_model_code) |
                    Q(likewize_modelo__iendswith=metadata.likewize_model_code)
                )
                if likewize_candidates.exists():
                    candidates = likewize_candidates

            # Filtros de contexto
            if metadata.device_type:
                candidates = candidates.filter(tipo__iexact=metadata.device_type)

            if metadata.brand:
                candidates = candidates.filter(marca__iexact=metadata.brand)

            # Señales adicionales
            if metadata.year:
                year_candidates = candidates.filter(
                    Q(año=metadata.year) | Q(**{f"{self.REL_NAME}__icontains": str(metadata.year)})
                )
                if year_candidates.exists():
                    candidates = year_candidates
                    strong_signals += 1

            if metadata.screen_size:
                size_candidates = candidates.filter(
                    Q(pantalla__icontains=f"{metadata.screen_size} pulgadas") |
                    Q(**{f"{self.REL_NAME}__icontains": f"{metadata.screen_size} pulgadas"})
                )
                if size_candidates.exists():
                    candidates = size_candidates
                    strong_signals += 1

            # Verificar señales mínimas para casos sin A-number
            if strong_signals < self.ALGORITHM_WEIGHTS['exact']['min_signals']:
                return MappingResult(None, 0, "exact", {"reason": "insufficient_signals", "signals": strong_signals})

        # Buscar capacidad exacta (común para ambos caminos)
        if metadata.capacity_gb:
            capacity_id = self._find_capacity_for_models(candidates, metadata.capacity_gb)
            if capacity_id:
                confidence = min(90, 70 + strong_signals * 5)
                return MappingResult(
                    capacity_id,
                    confidence,
                    "exact",
                    {"strong_signals": strong_signals, "candidate_models": candidates.count()}
                )

        return MappingResult(None, 0, "exact", {"reason": "no_capacity_match"})

    def _try_fuzzy_mapping(self, metadata: DeviceMetadata) -> MappingResult:
        """Mapeo difuso usando scoring universal."""
        scorer = UniversalDeviceScorer()

        # Obtener candidatos por familia de dispositivo
        device_family = self._get_device_family(metadata)
        candidates = self._get_candidates_by_family(device_family, metadata)

        if not candidates:
            return MappingResult(None, 0, "fuzzy", {"reason": "no_candidates"})

        # Aplicar scoring a candidatos
        scored_candidates = []
        for candidate in candidates[:100]:  # Limitar para rendimiento
            score = scorer.score_model_match(candidate, metadata)
            if score > 0:
                scored_candidates.append((candidate, score))

        if not scored_candidates:
            return MappingResult(None, 0, "fuzzy", {"reason": "no_positive_scores"})

        # Ordenar por score y buscar capacidad
        scored_candidates.sort(key=lambda x: x[1], reverse=True)

        for candidate, score in scored_candidates[:10]:
            if metadata.capacity_gb:
                capacity_id = self._find_capacity_for_models([candidate], metadata.capacity_gb)
                if capacity_id:
                    # Ajustar confianza basado en score y posición
                    base_confidence = min(75, max(40, score))
                    return MappingResult(
                        capacity_id,
                        base_confidence,
                        "fuzzy",
                        {"fuzzy_score": score, "candidate_position": scored_candidates.index((candidate, score))}
                    )

        return MappingResult(None, 0, "fuzzy", {"reason": "no_capacity_in_top_candidates"})

    def _try_heuristic_mapping(self, metadata: DeviceMetadata) -> MappingResult:
        """Mapeo heurístico para casos especiales."""
        # Usar extractor específico de marca si está disponible
        extractor = self._brand_extractors.get(metadata.brand.lower())
        if extractor:
            heuristic_result = extractor.heuristic_mapping(metadata, self)
            if heuristic_result:
                return heuristic_result

        # Heurísticas genéricas
        return self._generic_heuristic_mapping(metadata)

    def _generic_heuristic_mapping(self, metadata: DeviceMetadata) -> MappingResult:
        """Heurísticas genéricas para casos no cubiertos."""
        # Implementar reglas genéricas básicas
        return MappingResult(None, 0, "heuristic", {"reason": "no_generic_heuristic"})

    def _find_capacity_for_models(self, models, capacity_gb: int) -> Optional[int]:
        """Encuentra una capacidad específica para una lista de modelos."""
        if not capacity_gb:
            return None

        capacity_patterns = self._generate_capacity_patterns(capacity_gb)

        for model in models:
            for pattern in capacity_patterns:
                capacity = self.CapacidadModel.objects.filter(
                    **{f"{self.REL_FIELD}": model, f"{self.GB_FIELD}__icontains": pattern}
                ).first()
                if capacity:
                    return capacity.id
        return None

    def _generate_capacity_patterns(self, gb: int) -> List[str]:
        """Genera patrones de búsqueda para capacidades."""
        patterns = [str(gb), f"{gb}GB", f"{gb} GB"]

        # Patrones TB si aplica
        if gb >= 1024 and gb % 1024 == 0:
            tb = gb // 1024
            patterns.extend([f"{tb}TB", f"{tb} TB"])

        return patterns

    def _get_device_family(self, metadata: DeviceMetadata) -> str:
        """Determina la familia de dispositivo."""
        type_lower = metadata.device_type.lower()

        if "iphone" in type_lower:
            return "iPhone"
        elif "ipad" in type_lower:
            return "iPad"
        elif any(mac in type_lower for mac in ["macbook", "imac", "mac"]):
            return "Mac"
        elif "smartphone" in type_lower:
            return "SmartPhone"

        return metadata.device_type

    def _get_candidates_by_family(self, family: str, metadata: DeviceMetadata):
        """Obtiene candidatos filtrados por familia de dispositivo."""
        candidates = self.ModeloClass.objects.all()

        if family == "iPhone":
            candidates = candidates.filter(tipo="iPhone")
        elif family == "iPad":
            candidates = candidates.filter(tipo="iPad")
        elif family == "Mac":
            mac_types = ["Mac", "MacBook Pro", "MacBook Air", "iMac", "Mac mini", "Mac Studio", "Mac Pro"]
            candidates = candidates.filter(tipo__in=mac_types)
        elif metadata.brand:
            candidates = candidates.filter(marca__iexact=metadata.brand)

        return candidates.select_related()

    def _cache_successful_mapping(self, metadata: DeviceMetadata, result: MappingResult):
        """Almacena un mapeo exitoso en caché."""
        try:
            # Obtener información del modelo mapeado
            capacity = self.CapacidadModel.objects.select_related(self.REL_FIELD).get(id=result.capacity_id)
            modelo = getattr(capacity, self.REL_FIELD)

            # Determinar si necesita revisión
            needs_review = result.confidence_score < 70 or result.algorithm_used in ['heuristic']

            DeviceMapping.objects.update_or_create(
                source="likewize",
                source_brand=metadata.brand,
                source_model_normalized=metadata.model_normalized,
                source_capacity_gb=metadata.capacity_gb,
                a_number=metadata.a_number,
                defaults={
                    'source_type': metadata.device_type,
                    'source_model_raw': metadata.model_raw,
                    'screen_size': metadata.screen_size,
                    'year': metadata.year,
                    'cpu': metadata.cpu,
                    'gpu_cores': metadata.gpu_cores,
                    'likewize_model_code': metadata.likewize_model_code,
                    'likewize_master_model_id': metadata.likewize_master_model_id,
                    'mapped_capacity_id': result.capacity_id,
                    'mapped_model_description': getattr(modelo, self.REL_NAME, ""),
                    'mapped_capacity_size': getattr(capacity, self.GB_FIELD, ""),
                    'confidence_score': result.confidence_score,
                    'mapping_algorithm': result.algorithm_used,
                    'needs_review': needs_review,
                    'is_active': True,
                    'last_confirmed_at': timezone.now(),
                }
            )
        except Exception as e:
            logger.exception(f"Error cacheando mapeo: {e}")

    def _update_metrics(self, metadata: DeviceMetadata, processing_time: float, algorithm: str, success: bool):
        """Actualiza métricas de rendimiento."""
        try:
            today = timezone.now().date()

            metrics, created = MappingMetrics.objects.get_or_create(
                date=today,
                source="likewize",
                brand=metadata.brand,
                device_type=metadata.device_type,
                defaults={
                    'total_processed': 0,
                    'successfully_mapped': 0,
                    'cached_mappings_used': 0,
                    'new_mappings_created': 0,
                    'avg_confidence_score': Decimal("0.00"),
                    'avg_processing_time': Decimal("0.000"),
                }
            )

            # Actualizar contadores
            metrics.total_processed += 1
            if success:
                metrics.successfully_mapped += 1
                if algorithm == "cached":
                    metrics.cached_mappings_used += 1
                else:
                    metrics.new_mappings_created += 1

            # Actualizar tiempo promedio
            current_avg = float(metrics.avg_processing_time or 0)
            new_avg = (current_avg * (metrics.total_processed - 1) + processing_time) / metrics.total_processed
            metrics.avg_processing_time = Decimal(str(round(new_avg, 3)))

            metrics.save()

        except Exception as e:
            logger.exception(f"Error actualizando métricas: {e}")


class UniversalDeviceScorer:
    """Scoring universal para matching de dispositivos."""

    def __init__(self):
        self.SCORE_WEIGHTS = {
            'exact_match': 20,
            'partial_match': 10,
            'a_number': 15,
            'year': 10,
            'screen_size': 8,
            'cpu': 12,
            'gpu_cores': 8,
            'brand': 5,
            'type': 5,
            'specificity': 7,
        }

    def score_model_match(self, modelo, metadata: DeviceMetadata) -> int:
        """Calcula score de matching entre un modelo y metadatos."""
        score = 0
        description = getattr(modelo, "descripcion", "") or ""

        # Matching exacto de texto
        if metadata.model_normalized.lower() in description.lower():
            score += self.SCORE_WEIGHTS['exact_match']
        elif any(word in description.lower() for word in metadata.model_normalized.lower().split()):
            score += self.SCORE_WEIGHTS['partial_match']

        # A-number (muy específico para Apple)
        if metadata.a_number and metadata.a_number in description:
            score += self.SCORE_WEIGHTS['a_number']

        # Año
        if metadata.year and (getattr(modelo, "año", None) == metadata.year or str(metadata.year) in description):
            score += self.SCORE_WEIGHTS['year']

        # Tamaño de pantalla
        if metadata.screen_size:
            if (getattr(modelo, "pantalla", "") and f"{metadata.screen_size}" in getattr(modelo, "pantalla", "") or
                f"{metadata.screen_size} pulgadas" in description.lower()):
                score += self.SCORE_WEIGHTS['screen_size']

        # CPU
        if metadata.cpu:
            model_cpu = getattr(modelo, "procesador", "") or ""
            if metadata.cpu.lower() in model_cpu.lower() or metadata.cpu.lower() in description.lower():
                score += self.SCORE_WEIGHTS['cpu']

        # Marca
        if metadata.brand and getattr(modelo, "marca", "") and metadata.brand.lower() == getattr(modelo, "marca", "").lower():
            score += self.SCORE_WEIGHTS['brand']

        # Tipo
        if metadata.device_type and getattr(modelo, "tipo", "") and metadata.device_type.lower() == getattr(modelo, "tipo", "").lower():
            score += self.SCORE_WEIGHTS['type']

        # Bonus por especificidad (descripciones más largas son más específicas)
        specificity_bonus = min(self.SCORE_WEIGHTS['specificity'], len(description) // 15)
        score += specificity_bonus

        return score


class MetadataExtractor:
    """Clase base para extractores de metadatos por marca."""

    def extract_metadata(self, raw_data: Dict[str, Any]) -> DeviceMetadata:
        """Extrae metadatos de datos en bruto."""
        raise NotImplementedError

    def heuristic_mapping(self, metadata: DeviceMetadata, service: DeviceMappingService) -> Optional[MappingResult]:
        """Reglas heurísticas específicas de marca."""
        return None


class AppleMetadataExtractor(MetadataExtractor):
    """Extractor de metadatos específico para dispositivos Apple."""

    def extract_metadata(self, raw_data: Dict[str, Any]) -> DeviceMetadata:
        # Implementar extracción específica para Apple
        pass

    def heuristic_mapping(self, metadata: DeviceMetadata, service: DeviceMappingService) -> Optional[MappingResult]:
        """Heurísticas específicas para Apple (Mac mini 2023, etc.)."""
        # Implementar lógica específica para casos conocidos de Apple
        return None


class GoogleMetadataExtractor(MetadataExtractor):
    """Extractor de metadatos específico para dispositivos Google."""

    def extract_metadata(self, raw_data: Dict[str, Any]) -> DeviceMetadata:
        # Implementar extracción específica para Google Pixel
        pass


class SamsungMetadataExtractor(MetadataExtractor):
    """Extractor de metadatos específico para dispositivos Samsung."""

    def extract_metadata(self, raw_data: Dict[str, Any]) -> DeviceMetadata:
        # Implementar extracción específica para Samsung
        pass