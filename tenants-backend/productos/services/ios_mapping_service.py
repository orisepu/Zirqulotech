"""
Servicio especializado para mapeo de dispositivos iOS (iPhone/iPad).
Estrategia Name-Based con enriquecimiento desde base de conocimiento.
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
class iOSDeviceInfo:
    """Información extraída de un dispositivo iOS de Likewize."""
    # Datos básicos
    m_model: str
    master_model_name: str
    model_name: str
    full_name: str
    capacity: str
    model_value: int

    # Metadatos extraídos
    device_family: str = ""  # iPhone, iPad
    model_base: str = ""     # iPhone 15, iPad Pro
    model_variant: str = ""  # Pro, Pro Max, Plus, mini, Air
    generation: str = ""     # 15, 13, etc.
    capacity_gb: Optional[int] = None
    capacity_formatted: str = ""  # 128GB, 1TB

    # Enriquecimiento desde base de conocimiento
    inferred_a_number: str = ""
    inferred_year: Optional[int] = None
    inferred_cpu: str = ""
    knowledge_confidence: int = 0

    # Metadatos del proceso
    extraction_confidence: int = 0
    extraction_issues: List[str] = None

    def __post_init__(self):
        if self.extraction_issues is None:
            self.extraction_issues = []


@dataclass
class iOSMappingCandidate:
    """Candidato para mapeo iOS con detalles específicos."""
    capacity_id: int
    model_description: str
    confidence_score: int
    match_reasons: List[str]
    match_type: str  # exact, fuzzy, enriched, fallback
    a_number_match: bool = False
    name_similarity_score: float = 0.0
    capacity_match: bool = False

    def __post_init__(self):
        if not hasattr(self, 'rejection_reasons'):
            self.rejection_reasons = []


class iOSMappingService:
    """
    Servicio especializado para mapeo de dispositivos iOS.
    Usa estrategia Name-Based con enriquecimiento desde base de conocimiento.
    """

    def __init__(self):
        self.min_confidence_threshold = 70
        self.high_confidence_threshold = 90

        # Patrones de extracción para iOS (maneja inconsistencias de Likewize)
        self.capacity_pattern = re.compile(r'\b(\d+(?:\.\d+)?)\s*(TB|GB|Gb|G\s*B)\b', re.I)
        self.generation_pattern = re.compile(r'\b(iPhone|iPad)\s*(\w*)\s*(\d+)\b', re.I)
        self.variant_patterns = {
            'Pro Max': re.compile(r'\bPro\s*Max\b', re.I),
            'Pro': re.compile(r'\bPro\b(?!\s*Max)', re.I),
            'Plus': re.compile(r'\bPlus\b', re.I),
            'mini': re.compile(r'\bmini\b', re.I),
            'Air': re.compile(r'\bAir\b', re.I),
        }

        # Mapeo de nombres normalizados
        self.device_family_patterns = {
            'iPhone': re.compile(r'\biPhone\b', re.I),
            'iPad': re.compile(r'\biPad\b', re.I),
        }

        # Base de conocimiento interna para casos comunes
        self.known_devices = {
            'iPhone 16 Pro Max': {'a_number': 'A3105', 'year': 2024, 'cpu': 'A18 Pro'},
            'iPhone 16 Pro': {'a_number': 'A3101', 'year': 2024, 'cpu': 'A18 Pro'},
            'iPhone 16 Plus': {'a_number': 'A3093', 'year': 2024, 'cpu': 'A18'},
            'iPhone 16': {'a_number': 'A3089', 'year': 2024, 'cpu': 'A18'},
            'iPhone 15 Pro Max': {'a_number': 'A3108', 'year': 2023, 'cpu': 'A17 Pro'},
            'iPhone 15 Pro': {'a_number': 'A3102', 'year': 2023, 'cpu': 'A17 Pro'},
            'iPhone 15 Plus': {'a_number': 'A3094', 'year': 2023, 'cpu': 'A16 Bionic'},
            'iPhone 15': {'a_number': 'A3090', 'year': 2023, 'cpu': 'A16 Bionic'},
            'iPhone 14 Pro Max': {'a_number': 'A2895', 'year': 2022, 'cpu': 'A16 Bionic'},
            'iPhone 14 Pro': {'a_number': 'A2890', 'year': 2022, 'cpu': 'A16 Bionic'},
            'iPhone 14 Plus': {'a_number': 'A2886', 'year': 2022, 'cpu': 'A15 Bionic'},
            'iPhone 14': {'a_number': 'A2881', 'year': 2022, 'cpu': 'A15 Bionic'},
            'iPhone 13 Pro Max': {'a_number': 'A2644', 'year': 2021, 'cpu': 'A15 Bionic'},
            'iPhone 13 Pro': {'a_number': 'A2636', 'year': 2021, 'cpu': 'A15 Bionic'},
            'iPhone 13 mini': {'a_number': 'A2628', 'year': 2021, 'cpu': 'A15 Bionic'},
            'iPhone 13': {'a_number': 'A2633', 'year': 2021, 'cpu': 'A15 Bionic'},
            'iPhone 12 Pro Max': {'a_number': 'A2342', 'year': 2020, 'cpu': 'A14 Bionic'},
            'iPhone 12 Pro': {'a_number': 'A2341', 'year': 2020, 'cpu': 'A14 Bionic'},
            'iPhone 12 mini': {'a_number': 'A2176', 'year': 2020, 'cpu': 'A14 Bionic'},
            'iPhone 12': {'a_number': 'A2172', 'year': 2020, 'cpu': 'A14 Bionic'},
            'iPhone 11 Pro Max': {'a_number': 'A2161', 'year': 2019, 'cpu': 'A13 Bionic'},
            'iPhone 11 Pro': {'a_number': 'A2160', 'year': 2019, 'cpu': 'A13 Bionic'},
            'iPhone 11': {'a_number': 'A2111', 'year': 2019, 'cpu': 'A13 Bionic'},
        }

    def map_ios_device(self, likewize_data: dict, tarea_id: str = "") -> Optional[DeviceMappingV2]:
        """
        Mapea un dispositivo iOS usando estrategia Name-Based.

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

            # 2. Enriquecer con base de conocimiento
            self._enrich_with_knowledge_base(device_info)

            # 3. Crear signature único
            device_signature = self._create_device_signature(device_info)

            # 4. Verificar si ya existe mapeo
            existing_mapping = DeviceMappingV2.objects.filter(
                device_signature=device_signature
            ).first()

            if existing_mapping:
                logger.info(f"Mapeo iOS existente encontrado para {device_signature}")
                return existing_mapping

            # 5. Ejecutar estrategias de mapeo
            mapping_result = self._execute_ios_mapping_strategies(device_info)

            if not mapping_result:
                logger.warning(f"No se pudo mapear dispositivo iOS: {device_info.model_name}")
                return None

            # 6. Crear registro de mapeo V2
            processing_time = int((time.time() - start_time) * 1000)

            mapping_v2 = DeviceMappingV2.objects.create(
                device_signature=device_signature,
                source_data=likewize_data,
                source_type='iphone' if device_info.device_family == 'iPhone' else 'ipad',
                extracted_a_number=device_info.inferred_a_number,
                extracted_model_name=device_info.model_base,
                extracted_cpu=device_info.inferred_cpu,
                extracted_year=device_info.inferred_year,
                extracted_capacity_gb=device_info.capacity_gb,
                mapped_capacity_id=mapping_result.capacity_id,
                confidence_score=mapping_result.confidence_score,
                mapping_algorithm=mapping_result.algorithm_used,
                decision_path=mapping_result.decision_path,
                candidates_considered=mapping_result.candidates_data,
                rejection_reasons=mapping_result.rejection_reasons,
                processing_time_ms=processing_time,
                needs_review=mapping_result.confidence_score < self.min_confidence_threshold
            )

            # 7. Crear log de auditoría
            self._create_ios_audit_log(
                tarea_id=tarea_id,
                device_info=device_info,
                mapping_v2=mapping_v2,
                mapping_result=mapping_result,
                processing_time_ms=processing_time
            )

            logger.info(f"Mapeo iOS exitoso: {device_info.model_base} -> {mapping_result.capacity_id} (confianza: {mapping_result.confidence_score}%)")
            return mapping_v2

        except Exception as e:
            logger.error(f"Error mapeando dispositivo iOS: {str(e)}", exc_info=True)
            return None

    def _extract_device_info(self, data: dict) -> iOSDeviceInfo:
        """Extrae información estructurada de dispositivos iOS."""
        device_info = iOSDeviceInfo(
            m_model=data.get('M_Model', ''),
            master_model_name=data.get('MasterModelName', ''),
            model_name=data.get('ModelName', ''),
            full_name=data.get('FullName', ''),
            capacity=data.get('Capacity', ''),
            model_value=data.get('ModelValue', 0)
        )

        # Extraer familia del dispositivo
        device_info.device_family = self._extract_device_family(device_info)

        # Extraer modelo base y variante
        device_info.model_base, device_info.model_variant, device_info.generation = self._extract_model_details(device_info)

        # Extraer capacidad
        device_info.capacity_gb = self._extract_capacity_gb(device_info)
        device_info.capacity_formatted = self._format_capacity(device_info.capacity_gb)

        # Calcular confianza de extracción
        device_info.extraction_confidence = self._calculate_ios_extraction_confidence(device_info)

        return device_info

    def _extract_device_family(self, device_info: iOSDeviceInfo) -> str:
        """Determina si es iPhone o iPad."""
        sources = [device_info.m_model, device_info.full_name]

        for source in sources:
            if source:
                for family, pattern in self.device_family_patterns.items():
                    if pattern.search(source):
                        return family

        return "iPhone"  # Default fallback

    def _extract_model_details(self, device_info: iOSDeviceInfo) -> Tuple[str, str, str]:
        """Extrae modelo base, variante y generación."""
        # Usar ModelName como fuente primaria para información del dispositivo
        model_source = device_info.model_name or device_info.m_model or device_info.full_name or device_info.master_model_name
        
        # Limpiar el texto del modelo
        clean_model = re.sub(r'\s+', ' ', model_source.strip())
        
        # Extraer familia de dispositivo (iPhone/iPad)
        family = ""
        if 'iphone' in clean_model.lower():
            family = "iPhone"
        elif 'ipad' in clean_model.lower():
            family = "iPad"
            
        # Extraer generación (número después de iPhone/iPad)
        generation = ""
        gen_match = re.search(r'(?:iphone|ipad)\s+(\d+)', clean_model, re.I)
        if gen_match:
            generation = gen_match.group(1)
            
        # Extraer variantes (Pro, Pro Max, Plus, mini, Air, etc.)
        variant = ""
        # Buscar variantes en orden de especificidad
        for pattern, var_name in [
            (r'\bpro\s+max\b', 'Pro Max'),
            (r'\bpro\b', 'Pro'),
            (r'\bplus\b', 'Plus'),
            (r'\bmini\b', 'mini'),
            (r'\bair\b', 'Air'),
            (r'\bxs\s+max\b', 'XS Max'),
            (r'\bxr\b', 'XR'),
            (r'\bxs\b', 'XS')
        ]:
            if re.search(pattern, clean_model, re.I):
                variant = var_name
                break
                
        # Manejar casos especiales como "iPhone SE"
        if 'se' in clean_model.lower() and 'iphone' in clean_model.lower():
            family = "iPhone"
            generation = "SE"
            # Intentar determinar generación del SE
            if '(2nd generation)' in clean_model or '2nd' in clean_model:
                generation = "SE (2nd generation)"
            elif '(3rd generation)' in clean_model or '3rd' in clean_model:
                generation = "SE (3rd generation)"
                
        # Construir modelo base
        if family and generation:
            model_base = f"{family} {generation}"
            if variant:
                model_base += f" {variant}"
        else:
            # Fallback al M_Model o modelo limpio
            model_base = device_info.m_model or clean_model
            
        return model_base.strip(), variant.strip(), generation.strip()

    def _extract_capacity_gb(self, device_info: iOSDeviceInfo) -> Optional[int]:
        """Extrae capacidad de almacenamiento manejando inconsistencias de Likewize."""
        # Primero intentar desde campo Capacity
        capacity_sources = [device_info.capacity, device_info.model_name]

        for source in capacity_sources:
            if source:
                match = self.capacity_pattern.search(source)
                if match:
                    value = float(match.group(1))
                    unit = match.group(2).upper().replace(' ', '')  # Normalizar "G B" -> "GB"

                    if unit in ['TB']:
                        return int(value * 1024)
                    elif unit in ['GB', 'Gb']:  # Manejar "GB" y "Gb"
                        return int(value)

        return None

    def _format_capacity(self, capacity_gb: Optional[int]) -> str:
        """Formatea capacidad para display."""
        if not capacity_gb:
            return ""

        if capacity_gb >= 1024:
            tb_value = capacity_gb / 1024
            if tb_value == int(tb_value):
                return f"{int(tb_value)}TB"
            else:
                return f"{tb_value:.1f}TB"
        else:
            return f"{capacity_gb}GB"

    def _enrich_with_knowledge_base(self, device_info: iOSDeviceInfo):
        """Enriquece información usando base de conocimiento."""
        # Buscar en base de conocimiento interna
        if device_info.model_base in self.known_devices:
            knowledge = self.known_devices[device_info.model_base]
            device_info.inferred_a_number = knowledge['a_number']
            device_info.inferred_year = knowledge['year']
            device_info.inferred_cpu = knowledge['cpu']
            device_info.knowledge_confidence = 95

        # Buscar en base de datos de conocimiento
        else:
            db_knowledge = AppleDeviceKnowledgeBase.objects.filter(
                Q(model_name__iexact=device_info.model_base) |
                Q(likewize_model_names__icontains=device_info.m_model)
            ).first()

            if db_knowledge:
                device_info.inferred_a_number = db_knowledge.a_number
                device_info.inferred_year = db_knowledge.release_date.year
                device_info.inferred_cpu = db_knowledge.cpu_family
                device_info.knowledge_confidence = 90 if db_knowledge.confidence_level == 'verified' else 75

    def _calculate_ios_extraction_confidence(self, device_info: iOSDeviceInfo) -> int:
        """Calcula confianza en extracción iOS."""
        score = 0

        # Familia de dispositivo identificada
        if device_info.device_family in ['iPhone', 'iPad']:
            score += 25

        # Modelo base extraído
        if device_info.model_base:
            score += 25

        # Generación identificada
        if device_info.generation:
            score += 20

        # Capacidad extraída
        if device_info.capacity_gb:
            score += 15

        # Enriquecimiento exitoso
        if device_info.inferred_a_number:
            score += 15

        return min(score, 100)

    def _create_device_signature(self, device_info: iOSDeviceInfo) -> str:
        """Crea signature único para dispositivo iOS."""
        signature_parts = [
            device_info.device_family,
            device_info.model_base,
            device_info.model_variant,
            str(device_info.capacity_gb or 0),
            device_info.inferred_a_number
        ]

        signature_string = "|".join(signature_parts)
        return hashlib.md5(signature_string.encode()).hexdigest()

    def _execute_ios_mapping_strategies(self, device_info: iOSDeviceInfo) -> Optional['iOSMappingResult']:
        """Ejecuta estrategias específicas para iOS."""
        strategies = [
            ("exact_name_capacity", self._map_by_exact_name_capacity),
            ("enriched_a_number", self._map_by_enriched_a_number),
            ("fuzzy_name_match", self._map_by_fuzzy_name_match),
            ("pattern_based", self._map_by_pattern_based),
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
                logger.error(f"Error en estrategia iOS {strategy_name}: {str(e)}")
                decision_path.append({
                    "strategy": strategy_name,
                    "executed_at": timezone.now().isoformat(),
                    "success": False,
                    "error": str(e)
                })

        return None

    def _map_by_exact_name_capacity(self, device_info: iOSDeviceInfo) -> Optional['iOSMappingResult']:
        """Mapeo exacto por nombre + capacidad."""
        # Buscar modelos que coincidan exactamente con el nombre
        modelo_queries = [
            Q(descripcion__iexact=device_info.model_base),
            Q(descripcion__icontains=device_info.model_base),
            Q(descripcion__icontains=device_info.m_model),
        ]

        candidates = []

        for query in modelo_queries:
            modelos = Modelo.objects.filter(query, marca__iexact='Apple')

            for modelo in modelos:
                for capacidad in modelo.capacidades.filter(activo=True):
                    capacity_match = self._ios_capacity_matches(capacidad, device_info.capacity_gb)

                    confidence = 85 if capacity_match else 70

                    # Bonificación por coincidencia exacta de nombre
                    if modelo.descripcion.lower() == device_info.model_base.lower():
                        confidence += 10

                    candidates.append(iOSMappingCandidate(
                        capacity_id=capacidad.id,
                        model_description=modelo.descripcion,
                        confidence_score=confidence,
                        match_type="exact",
                        capacity_match=capacity_match,
                        match_reasons=[
                            f"Nombre exacto: {device_info.model_base}",
                            f"Capacidad: {'✓' if capacity_match else '✗'} {device_info.capacity_formatted}"
                        ]
                    ))

        if candidates:
            best_candidate = max(candidates, key=lambda x: x.confidence_score)
            return iOSMappingResult(
                capacity_id=best_candidate.capacity_id,
                confidence_score=best_candidate.confidence_score,
                algorithm_used="exact_name_capacity",
                candidates=candidates,
                candidates_data=[vars(c) for c in candidates],
                rejection_reasons=[]
            )

        return None

    def _map_by_enriched_a_number(self, device_info: iOSDeviceInfo) -> Optional['iOSMappingResult']:
        """Mapeo usando A-number inferido desde base de conocimiento."""
        if not device_info.inferred_a_number:
            return None

        modelos = Modelo.objects.filter(
            Q(descripcion__icontains=device_info.inferred_a_number) |
            Q(likewize_modelo__icontains=device_info.inferred_a_number),
            marca__iexact='Apple'
        )

        candidates = []
        for modelo in modelos:
            for capacidad in modelo.capacidades.filter(activo=True):
                capacity_match = self._ios_capacity_matches(capacidad, device_info.capacity_gb)

                confidence = 80 + device_info.knowledge_confidence // 10
                if capacity_match:
                    confidence += 10

                candidates.append(iOSMappingCandidate(
                    capacity_id=capacidad.id,
                    model_description=modelo.descripcion,
                    confidence_score=confidence,
                    match_type="enriched",
                    a_number_match=True,
                    capacity_match=capacity_match,
                    match_reasons=[
                        f"A-number inferido: {device_info.inferred_a_number}",
                        f"Confianza conocimiento: {device_info.knowledge_confidence}%",
                        f"Capacidad: {'✓' if capacity_match else '✗'} {device_info.capacity_formatted}"
                    ]
                ))

        if candidates:
            best_candidate = max(candidates, key=lambda x: x.confidence_score)
            return iOSMappingResult(
                capacity_id=best_candidate.capacity_id,
                confidence_score=best_candidate.confidence_score,
                algorithm_used="enriched_a_number",
                candidates=candidates,
                candidates_data=[vars(c) for c in candidates],
                rejection_reasons=[]
            )

        return None

    def _map_by_fuzzy_name_match(self, device_info: iOSDeviceInfo) -> Optional['iOSMappingResult']:
        """Mapeo por similitud difusa de nombres."""
        # Esta es una implementación básica, se puede mejorar con algoritmos más sofisticados
        search_terms = [
            device_info.device_family,
            device_info.generation,
            device_info.model_variant
        ]

        search_terms = [term for term in search_terms if term]

        if not search_terms:
            return None

        candidates = []
        modelos = Modelo.objects.filter(marca__iexact='Apple')

        for modelo in modelos:
            similarity_score = self._calculate_name_similarity(modelo.descripcion, search_terms)

            if similarity_score > 0.6:  # Umbral de similitud
                for capacidad in modelo.capacidades.filter(activo=True):
                    capacity_match = self._ios_capacity_matches(capacidad, device_info.capacity_gb)

                    confidence = int(similarity_score * 70)
                    if capacity_match:
                        confidence += 15

                    candidates.append(iOSMappingCandidate(
                        capacity_id=capacidad.id,
                        model_description=modelo.descripcion,
                        confidence_score=confidence,
                        match_type="fuzzy",
                        name_similarity_score=similarity_score,
                        capacity_match=capacity_match,
                        match_reasons=[
                            f"Similitud nombre: {similarity_score:.2f}",
                            f"Términos: {', '.join(search_terms)}",
                            f"Capacidad: {'✓' if capacity_match else '✗'} {device_info.capacity_formatted}"
                        ]
                    ))

        if candidates:
            best_candidate = max(candidates, key=lambda x: x.confidence_score)
            return iOSMappingResult(
                capacity_id=best_candidate.capacity_id,
                confidence_score=best_candidate.confidence_score,
                algorithm_used="fuzzy_name_match",
                candidates=candidates,
                candidates_data=[vars(c) for c in candidates],
                rejection_reasons=[]
            )

        return None

    def _map_by_pattern_based(self, device_info: iOSDeviceInfo) -> Optional['iOSMappingResult']:
        """Mapeo basado en patrones conocidos."""
        # Implementación futura para patrones específicos
        return None

    def _ios_capacity_matches(self, capacidad_obj, target_gb: Optional[int]) -> bool:
        """Verifica coincidencia de capacidad para iOS manejando formatos inconsistentes."""
        if not target_gb:
            return True

        capacity_str = capacidad_obj.tamaño

        # Patrones más tolerantes para manejar inconsistencias de Likewize
        patterns = [
            r'(\d+(?:\.\d+)?)\s*(TB)',
            r'(\d+)\s*(GB|Gb|G\s*B)'
        ]

        for pattern in patterns:
            match = re.search(pattern, capacity_str, re.I)
            if match:
                value = float(match.group(1))
                unit = match.group(2).upper().replace(' ', '')  # Normalizar espacios

                if unit == 'TB':
                    capacity_gb = int(value * 1024)
                elif unit in ['GB', 'Gb']:  # Ambas variaciones
                    capacity_gb = int(value)
                else:
                    continue

                # Coincidencia exacta o muy cercana
                return abs(capacity_gb - target_gb) <= 16

        return False

    def _calculate_name_similarity(self, model_description: str, search_terms: List[str]) -> float:
        """Calcula similitud entre descripción de modelo y términos de búsqueda."""
        model_lower = model_description.lower()

        matched_terms = 0
        total_terms = len(search_terms)

        for term in search_terms:
            if term.lower() in model_lower:
                matched_terms += 1

        return matched_terms / max(total_terms, 1) if total_terms > 0 else 0.0

    def _create_ios_audit_log(self, tarea_id: str, device_info: iOSDeviceInfo,
                             mapping_v2: DeviceMappingV2, mapping_result: 'iOSMappingResult',
                             processing_time_ms: int):
        """Crea log de auditoría específico para iOS."""
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
                    "device_family": device_info.device_family,
                    "model_base": device_info.model_base,
                    "model_variant": device_info.model_variant,
                    "generation": device_info.generation,
                    "capacity_gb": device_info.capacity_gb,
                    "inferred_a_number": device_info.inferred_a_number,
                    "knowledge_confidence": device_info.knowledge_confidence,
                    "extraction_confidence": device_info.extraction_confidence
                },
                rejected_candidates=mapping_result.rejection_reasons,
                algorithm_chain=mapping_result.decision_path,
                processing_time_ms=processing_time_ms,
                automatic_quality_score=self._calculate_ios_quality_score(mapping_result, device_info),
                needs_review=mapping_result.confidence_score < self.min_confidence_threshold
            )
        except Exception as e:
            logger.error(f"Error creando audit log iOS: {str(e)}")

    def _calculate_ios_quality_score(self, mapping_result: 'iOSMappingResult', device_info: iOSDeviceInfo) -> int:
        """Calcula score de calidad específico para iOS."""
        score = mapping_result.confidence_score

        # Bonificaciones específicas iOS
        if device_info.inferred_a_number:
            score = min(score + 10, 100)

        if device_info.knowledge_confidence > 90:
            score = min(score + 5, 100)

        if device_info.capacity_gb:
            score = min(score + 5, 100)

        return score


@dataclass
class iOSMappingResult:
    """Resultado específico de mapeo iOS."""
    capacity_id: int
    confidence_score: int
    algorithm_used: str
    candidates: List[iOSMappingCandidate]
    candidates_data: List[dict]
    rejection_reasons: List[str]
    decision_path: List[dict] = None

    def __post_init__(self):
        if self.decision_path is None:
            self.decision_path = []