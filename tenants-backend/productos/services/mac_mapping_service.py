"""
Servicio especializado para mapeo de dispositivos Mac.
Estrategia A-number First aprovechando la información rica de Likewize Mac.
"""

import re
import logging
import time
import hashlib
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime

from django.db.models import Q
from django.utils import timezone

from ..models import (
    DeviceMappingV2,
    AppleDeviceKnowledgeBase,
    MappingAuditLog,
    Modelo,
    Capacidad
)


logger = logging.getLogger(__name__)


@dataclass
class MacDeviceInfo:
    """Información extraída de un dispositivo Mac de Likewize."""
    # Datos básicos
    m_model: str
    master_model_name: str
    model_name: str
    full_name: str
    capacity: str
    model_value: int

    # Metadatos extraídos
    a_number: str = ""
    device_family: str = ""
    cpu_info: str = ""
    cpu_cores: str = ""
    year: Optional[int] = None
    month: Optional[int] = None
    screen_size: Optional[float] = None
    capacity_gb: Optional[int] = None
    technical_identifier: str = ""  # MacBookPro15,1, Macmini9,1, etc.

    # Metadatos del proceso
    extraction_confidence: int = 0
    extraction_issues: List[str] = None

    def __post_init__(self):
        if self.extraction_issues is None:
            self.extraction_issues = []


@dataclass
class MappingCandidate:
    """Candidato para mapeo con score de confianza."""
    capacity_id: int
    model_description: str
    confidence_score: int
    match_reasons: List[str]
    rejection_reasons: List[str] = None

    def __post_init__(self):
        if self.rejection_reasons is None:
            self.rejection_reasons = []


class MacMappingService:
    """
    Servicio especializado para mapeo de dispositivos Mac.
    Utiliza estrategia A-number First con fallbacks inteligentes.
    """

    def __init__(self):
        self.min_confidence_threshold = 60
        self.high_confidence_threshold = 85

        # Patrones de extracción
        self.a_number_pattern = re.compile(r'\bA(\d{4})\b')
        self.date_pattern = re.compile(r'\b(\d{1,2})/(\d{4})\b')
        self.screen_size_pattern = re.compile(r'\b(\d{1,2}(?:\.\d)?)\s*inch\b', re.I)
        self.cpu_pattern = re.compile(r'(M[1-4](?:\s+(?:Ultra|Max|Pro))?|Core\s+i[3579]|Xeon\s*W)', re.I)
        self.technical_id_pattern = re.compile(r'\b(iMac(?:Pro)?\d+\s*\d+|MacBook(?:Air|Pro)\d+\s*\d+|Macmini\d+\s*\d+|MacPro\d+\s*\d+|Mac\s*Studio\s*\d+\s*\d+)\b', re.I)

        # Mapeo de familias
        self.family_mapping = {
            'imac': 'iMac',
            'imac pro': 'iMac Pro',
            'macbook air': 'MacBook Air',
            'macbook pro': 'MacBook Pro',
            'mac mini': 'Mac mini',
            'mac pro': 'Mac Pro',
            'mac studio': 'Mac Studio'
        }

    def map_mac_device(self, likewize_data: dict, tarea_id: str = "") -> Optional[DeviceMappingV2]:
        """
        Mapea un dispositivo Mac usando estrategia A-number First.

        Args:
            likewize_data: Datos completos de Likewize
            tarea_id: ID de la tarea de actualización

        Returns:
            DeviceMappingV2 object si el mapeo es exitoso, None si falla
        """
        start_time = time.time()

        try:
            # 1. Extraer información del dispositivo
            device_info = self._extract_device_info(likewize_data)

            # 2. Crear signature único
            device_signature = self._create_device_signature(device_info)

            # 3. Verificar si ya existe mapeo para este dispositivo
            existing_mapping = DeviceMappingV2.objects.filter(
                device_signature=device_signature
            ).first()

            if existing_mapping:
                logger.info(f"Mapeo existente encontrado para {device_signature}")
                return existing_mapping

            # 4. Ejecutar estrategias de mapeo en orden de prioridad
            mapping_result = self._execute_mapping_strategies(device_info)

            if not mapping_result:
                logger.warning(f"No se pudo mapear dispositivo: {device_info.model_name}")
                return None

            # 5. Crear registro de mapeo V2
            processing_time = int((time.time() - start_time) * 1000)

            mapping_v2 = DeviceMappingV2.objects.create(
                device_signature=device_signature,
                source_data=likewize_data,
                source_type='mac',
                extracted_a_number=device_info.a_number,
                extracted_model_name=device_info.model_name,
                extracted_cpu=device_info.cpu_info,
                extracted_year=device_info.year,
                extracted_month=device_info.month,
                extracted_capacity_gb=device_info.capacity_gb,
                extracted_screen_size=device_info.screen_size,
                mapped_capacity_id=mapping_result.capacity_id,
                confidence_score=mapping_result.confidence_score,
                mapping_algorithm=mapping_result.algorithm_used,
                decision_path=mapping_result.decision_path,
                candidates_considered=mapping_result.candidates_data,
                rejection_reasons=mapping_result.rejection_reasons,
                processing_time_ms=processing_time,
                needs_review=mapping_result.confidence_score < self.min_confidence_threshold
            )

            # 6. Crear log de auditoría
            self._create_audit_log(
                tarea_id=tarea_id,
                device_info=device_info,
                mapping_v2=mapping_v2,
                mapping_result=mapping_result,
                processing_time_ms=processing_time
            )

            logger.info(f"Mapeo exitoso: {device_info.model_name} -> {mapping_result.capacity_id} (confianza: {mapping_result.confidence_score}%)")
            return mapping_v2

        except Exception as e:
            logger.error(f"Error mapeando dispositivo Mac: {str(e)}", exc_info=True)
            return None

    def _extract_device_info(self, data: dict) -> MacDeviceInfo:
        """Extrae información estructurada de los datos de Likewize."""
        device_info = MacDeviceInfo(
            m_model=data.get('M_Model', ''),
            master_model_name=data.get('MasterModelName', ''),
            model_name=data.get('ModelName', ''),
            full_name=data.get('FullName', ''),
            capacity=data.get('Capacity', ''),
            model_value=data.get('ModelValue', 0)
        )

        # Extraer A-number (prioritario para Mac)
        device_info.a_number = self._extract_a_number(device_info)

        # Extraer familia de dispositivo
        device_info.device_family = self._extract_device_family(device_info)

        # Extraer información de CPU
        device_info.cpu_info = self._extract_cpu_info(device_info)

        # Extraer fecha de lanzamiento
        year, month = self._extract_release_date(device_info)
        device_info.year = year
        device_info.month = month

        # Extraer tamaño de pantalla
        device_info.screen_size = self._extract_screen_size(device_info)

        # Extraer capacidad en GB
        device_info.capacity_gb = self._extract_capacity_gb(device_info)

        # Extraer identificador técnico
        device_info.technical_identifier = self._extract_technical_identifier(device_info)

        # Calcular confianza de extracción
        device_info.extraction_confidence = self._calculate_extraction_confidence(device_info)

        return device_info

    def _extract_a_number(self, device_info: MacDeviceInfo) -> str:
        """Extrae A-number de los datos disponibles."""
        sources = [
            device_info.master_model_name,
            device_info.model_name,
            device_info.full_name
        ]

        for source in sources:
            if source:
                match = self.a_number_pattern.search(source)
                if match:
                    return f"A{match.group(1)}"

        # Fallback: intentar extraer de otros campos
        fallback_sources = [
            device_info.m_model
        ]
        
        for source in fallback_sources:
            if source:
                # Limpiar el source para evitar caracteres extraños
                clean_source = re.sub(r'[^\w\s\-]', ' ', str(source))
                match = self.a_number_pattern.search(clean_source)
                if match:
                    return f"A{match.group(1)}"

        return ""

    def _extract_device_family(self, device_info: MacDeviceInfo) -> str:
        """Determina la familia del dispositivo Mac."""
        # Usar M_Model como fuente primaria
        m_model_lower = (device_info.m_model or "").lower()
        
        # Buscar familia en orden de prioridad
        for key, family in self.family_mapping.items():
            if key in m_model_lower:
                return family

        # Fallback: intentar extraer de MasterModelName
        master_lower = (device_info.master_model_name or "").lower()
        for key, family in self.family_mapping.items():
            # Buscar coincidencias más flexibles
            if key.replace(' ', '') in master_lower.replace(' ', ''):
                return family

        # Fallback: intentar extraer de ModelName o FullName
        model_source = (device_info.model_name or device_info.full_name or "").lower()
        for key, family in self.family_mapping.items():
            if key in model_source:
                return family
                
        # Detectar por patrones específicos en cualquier campo
        all_sources = " ".join([
            device_info.m_model or "",
            device_info.master_model_name or "",
            device_info.model_name or "",
            device_info.full_name or ""
        ]).lower()
        
        for key, family in self.family_mapping.items():
            if key in all_sources:
                return family

        return "Mac"  # Fallback genérico

    def _extract_cpu_info(self, device_info: MacDeviceInfo) -> str:
        """Extrae información detallada de CPU."""
        sources = [device_info.master_model_name, device_info.model_name]

        for source in sources:
            if source:
                # Buscar patrones de CPU
                cpu_match = self.cpu_pattern.search(source)
                if cpu_match:
                    cpu_base = cpu_match.group(1)

                    # Buscar información adicional de cores
                    core_patterns = [
                        r'(\d+)\s*Core\s*CPU\s*(\d+)\s*Core\s*GPU',
                        r'(\d+)\s*Core\s*(\d+\.?\d*)',
                        r'(\d+)\s*Core'
                    ]

                    for pattern in core_patterns:
                        core_match = re.search(pattern, source, re.I)
                        if core_match:
                            if len(core_match.groups()) >= 2:
                                return f"{cpu_base} {core_match.group(1)} Core CPU {core_match.group(2)} Core GPU"
                            else:
                                return f"{cpu_base} {core_match.group(1)} Core"

                    return cpu_base

        return ""

    def _extract_release_date(self, device_info: MacDeviceInfo) -> Tuple[Optional[int], Optional[int]]:
        """Extrae año y mes de lanzamiento."""
        sources = [device_info.master_model_name, device_info.model_name]

        for source in sources:
            if source:
                date_match = self.date_pattern.search(source)
                if date_match:
                    month = int(date_match.group(1))
                    year = int(date_match.group(2))
                    return year, month

        return None, None

    def _extract_screen_size(self, device_info: MacDeviceInfo) -> Optional[float]:
        """Extrae tamaño de pantalla en pulgadas."""
        sources = [device_info.master_model_name, device_info.model_name]

        for source in sources:
            if source:
                screen_match = self.screen_size_pattern.search(source)
                if screen_match:
                    try:
                        return float(screen_match.group(1))
                    except ValueError:
                        continue

        return None

    def _extract_capacity_gb(self, device_info: MacDeviceInfo) -> Optional[int]:
        """Extrae capacidad de almacenamiento en GB."""
        capacity_str = device_info.capacity

        if not capacity_str:
            return None

        # Patrones para capacidad
        patterns = [
            r'(\d+(?:\.\d+)?)\s*TB',
            r'(\d+)\s*GB'
        ]

        for pattern in patterns:
            match = re.search(pattern, capacity_str, re.I)
            if match:
                value = float(match.group(1))
                if 'TB' in pattern:
                    return int(value * 1024)
                else:
                    return int(value)

        return None

    def _extract_technical_identifier(self, device_info: MacDeviceInfo) -> str:
        """Extrae identificador técnico (MacBookPro15,1, etc.)."""
        sources = [device_info.master_model_name, device_info.model_name]

        for source in sources:
            if source:
                tech_match = self.technical_id_pattern.search(source)
                if tech_match:
                    return tech_match.group(1)

        return ""

    def _calculate_extraction_confidence(self, device_info: MacDeviceInfo) -> int:
        """Calcula confianza en la extracción de metadatos."""
        score = 0

        # A-number es crítico para Mac
        if device_info.a_number:
            score += 40

        # Familia de dispositivo
        if device_info.device_family != "Mac":
            score += 20

        # CPU info
        if device_info.cpu_info:
            score += 15

        # Fecha de lanzamiento
        if device_info.year:
            score += 10

        # Capacidad
        if device_info.capacity_gb:
            score += 10

        # Identificador técnico
        if device_info.technical_identifier:
            score += 5

        return min(score, 100)

    def _create_device_signature(self, device_info: MacDeviceInfo) -> str:
        """Crea signature único para el dispositivo."""
        signature_parts = [
            device_info.device_family,
            device_info.a_number,
            device_info.cpu_info,
            str(device_info.capacity_gb or 0),
            str(device_info.year or 0)
        ]

        signature_string = "|".join(signature_parts)
        return hashlib.md5(signature_string.encode()).hexdigest()

    def _execute_mapping_strategies(self, device_info: MacDeviceInfo) -> Optional['MappingResult']:
        """Ejecuta estrategias de mapeo en orden de prioridad."""
        strategies = [
            ("a_number_direct", self._map_by_a_number_direct),
            ("knowledge_base_lookup", self._map_by_knowledge_base),
            ("tech_specs_match", self._map_by_tech_specs),
            ("fuzzy_similarity", self._map_by_fuzzy_similarity),
        ]

        all_candidates = []
        decision_path = []

        for strategy_name, strategy_func in strategies:
            try:
                result = strategy_func(device_info)

                decision_path.append({
                    "strategy": strategy_name,
                    "executed_at": timezone.now().isoformat(),
                    "success": result is not None,
                    "confidence": result.confidence_score if result else 0,
                    "candidates_found": len(result.candidates) if result else 0
                })

                if result and result.confidence_score >= self.min_confidence_threshold:
                    result.decision_path = decision_path
                    return result

                if result:
                    all_candidates.extend(result.candidates)

            except Exception as e:
                logger.error(f"Error en estrategia {strategy_name}: {str(e)}")
                decision_path.append({
                    "strategy": strategy_name,
                    "executed_at": timezone.now().isoformat(),
                    "success": False,
                    "error": str(e)
                })

        # Si ninguna estrategia tuvo éxito con confianza suficiente
        return None

    def _map_by_a_number_direct(self, device_info: MacDeviceInfo) -> Optional['MappingResult']:
        """Mapeo directo por A-number (estrategia principal para Mac)."""
        if not device_info.a_number:
            return None

        # Buscar en base de conocimiento primero
        knowledge_entry = AppleDeviceKnowledgeBase.objects.filter(
            a_number=device_info.a_number
        ).first()

        if knowledge_entry:
            # Buscar capacidades en nuestra BD que coincidan
            modelo_candidates = Modelo.objects.filter(
                Q(descripcion__icontains=knowledge_entry.model_name) |
                Q(likewize_modelo__icontains=device_info.a_number) |
                Q(descripcion__icontains=device_info.a_number)
            )

            capacities = []
            for modelo in modelo_candidates:
                for capacidad in modelo.capacidades.filter(activo=True):
                    if self._capacity_matches(capacidad, device_info.capacity_gb):
                        capacities.append(MappingCandidate(
                            capacity_id=capacidad.id,
                            model_description=modelo.descripcion,
                            confidence_score=95,
                            match_reasons=[
                                f"A-number exacto: {device_info.a_number}",
                                f"Conocimiento base: {knowledge_entry.model_name}",
                                f"Capacidad coincide: {device_info.capacity_gb}GB"
                            ]
                        ))

            if capacities:
                best_candidate = max(capacities, key=lambda x: x.confidence_score)
                return MappingResult(
                    capacity_id=best_candidate.capacity_id,
                    confidence_score=best_candidate.confidence_score,
                    algorithm_used="a_number_direct",
                    candidates=capacities,
                    candidates_data=[vars(c) for c in capacities],
                    rejection_reasons=[]
                )

        # Buscar directamente en BD por A-number
        modelo_candidates = Modelo.objects.filter(
            Q(descripcion__icontains=device_info.a_number) |
            Q(likewize_modelo__icontains=device_info.a_number)
        )

        capacities = []
        for modelo in modelo_candidates:
            for capacidad in modelo.capacidades.filter(activo=True):
                if self._capacity_matches(capacidad, device_info.capacity_gb):
                    capacities.append(MappingCandidate(
                        capacity_id=capacidad.id,
                        model_description=modelo.descripcion,
                        confidence_score=85,
                        match_reasons=[
                            f"A-number en BD: {device_info.a_number}",
                            f"Capacidad coincide: {device_info.capacity_gb}GB"
                        ]
                    ))

        if capacities:
            best_candidate = max(capacities, key=lambda x: x.confidence_score)
            return MappingResult(
                capacity_id=best_candidate.capacity_id,
                confidence_score=best_candidate.confidence_score,
                algorithm_used="a_number_direct",
                candidates=capacities,
                candidates_data=[vars(c) for c in capacities],
                rejection_reasons=[]
            )

        return None

    def _map_by_knowledge_base(self, device_info: MacDeviceInfo) -> Optional['MappingResult']:
        """Mapeo usando base de conocimiento de Apple."""
        # Este método se implementará cuando poblemos la base de conocimiento
        return None

    def _map_by_tech_specs(self, device_info: MacDeviceInfo) -> Optional['MappingResult']:
        """Mapeo por especificaciones técnicas."""
        # Este método mapea por CPU, año, familia, etc.
        return None

    def _map_by_fuzzy_similarity(self, device_info: MacDeviceInfo) -> Optional['MappingResult']:
        """Mapeo por similitud difusa como último recurso."""
        # Este método implementa matching difuso
        return None

    def _capacity_matches(self, capacidad_obj, target_gb: Optional[int]) -> bool:
        """Verifica si una capacidad coincide con el objetivo."""
        if not target_gb:
            return True  # Si no sabemos la capacidad, asumimos que coincide

        # Extraer GB de la descripción de capacidad
        capacity_str = capacidad_obj.tamaño

        patterns = [
            r'(\d+(?:\.\d+)?)\s*TB',
            r'(\d+)\s*GB'
        ]

        for pattern in patterns:
            match = re.search(pattern, capacity_str, re.I)
            if match:
                value = float(match.group(1))
                if 'TB' in pattern:
                    capacity_gb = int(value * 1024)
                else:
                    capacity_gb = int(value)

                # Permitir cierta tolerancia en la comparación
                return abs(capacity_gb - target_gb) <= 64  # 64GB de tolerancia

        return False

    def _create_audit_log(self, tarea_id: str, device_info: MacDeviceInfo,
                         mapping_v2: DeviceMappingV2, mapping_result: 'MappingResult',
                         processing_time_ms: int):
        """Crea registro de auditoría detallado."""
        try:
            MappingAuditLog.objects.create(
                tarea_id=tarea_id,
                device_signature=mapping_v2.device_signature,
                mapping_v2=mapping_v2,
                algorithm_used=mapping_result.algorithm_used,
                confidence_score=mapping_result.confidence_score,
                mapping_result_id=mapping_result.capacity_id,
                available_candidates=mapping_result.candidates_data,
                decision_factors={
                    "a_number_available": bool(device_info.a_number),
                    "extraction_confidence": device_info.extraction_confidence,
                    "device_family": device_info.device_family,
                    "cpu_info": device_info.cpu_info,
                    "capacity_gb": device_info.capacity_gb
                },
                rejected_candidates=mapping_result.rejection_reasons,
                algorithm_chain=mapping_result.decision_path,
                processing_time_ms=processing_time_ms,
                automatic_quality_score=self._calculate_quality_score(mapping_result, device_info),
                needs_review=mapping_result.confidence_score < self.min_confidence_threshold
            )
        except Exception as e:
            logger.error(f"Error creando audit log: {str(e)}")

    def _calculate_quality_score(self, mapping_result: 'MappingResult', device_info: MacDeviceInfo) -> int:
        """Calcula score automático de calidad del mapeo."""
        score = mapping_result.confidence_score

        # Bonificaciones por información rica
        if device_info.a_number:
            score = min(score + 10, 100)

        if device_info.extraction_confidence > 80:
            score = min(score + 5, 100)

        return score


@dataclass
class MappingResult:
    """Resultado de un intento de mapeo."""
    capacity_id: int
    confidence_score: int
    algorithm_used: str
    candidates: List[MappingCandidate]
    candidates_data: List[dict]
    rejection_reasons: List[str]
    decision_path: List[dict] = None

    def __post_init__(self):
        if self.decision_path is None:
            self.decision_path = []