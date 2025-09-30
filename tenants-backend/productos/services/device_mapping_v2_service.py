"""
Servicio coordinador para el sistema de mapeo V2.
Decide qué estrategia usar según el tipo de dispositivo y coordina todo el proceso.
"""

import logging
import time
from typing import Optional, Dict, List, Any, Union
from datetime import datetime

from django.db.models import Count, Q, Avg
from django.utils import timezone

from ..models import (
    DeviceMappingV2,
    AppleDeviceKnowledgeBase,
    MappingAuditLog,
    MappingSessionReport,
    Modelo,
    Capacidad
)
from .mac_mapping_service import MacMappingService
from .ios_mapping_service import iOSMappingService


logger = logging.getLogger(__name__)


class DeviceMappingV2Service:
    """
    Servicio coordinador para mapeo de dispositivos V2.
    Determina estrategia óptima por tipo de dispositivo y coordina todo el proceso.
    """

    def __init__(self):
        # Inicializar servicios especializados
        self.mac_service = MacMappingService()
        self.ios_service = iOSMappingService()

        # Configuración global
        self.min_confidence_threshold = 60
        self.auto_review_threshold = 40

        # Métricas de sesión
        self.session_stats = {
            'total_processed': 0,
            'successful_mappings': 0,
            'failed_mappings': 0,
            'high_confidence': 0,
            'medium_confidence': 0,
            'low_confidence': 0,
            'by_type': {},
            'by_algorithm': {},
            'processing_times': []
        }

    def map_device_batch(self, likewize_devices: List[dict], tarea_id: str) -> Dict[str, Any]:
        """
        Mapea un lote completo de dispositivos desde Likewize.

        Args:
            likewize_devices: Lista de dispositivos de Likewize
            tarea_id: ID de la tarea de actualización

        Returns:
            Diccionario con estadísticas completas del procesamiento
        """
        start_time = time.time()

        logger.info(f"Iniciando mapeo V2 para tarea {tarea_id} con {len(likewize_devices)} dispositivos")

        # Resetear estadísticas de sesión
        self._reset_session_stats()

        # Procesar cada dispositivo
        results = []
        for idx, device_data in enumerate(likewize_devices):
            try:
                result = self.map_single_device(device_data, tarea_id)
                results.append(result)

                # Actualizar estadísticas
                self._update_session_stats(result, device_data)

                # Log de progreso cada 50 dispositivos
                if (idx + 1) % 50 == 0:
                    logger.info(f"Procesados {idx + 1}/{len(likewize_devices)} dispositivos")

            except Exception as e:
                logger.error(f"Error procesando dispositivo {idx}: {str(e)}")
                self.session_stats['failed_mappings'] += 1

        total_time = time.time() - start_time

        # Generar reporte de sesión
        session_report = self._generate_session_report(tarea_id, total_time)

        logger.info(f"Mapeo V2 completado en {total_time:.2f}s: {self.session_stats['successful_mappings']}/{len(likewize_devices)} exitosos")

        return {
            'success': True,
            'total_devices': len(likewize_devices),
            'successful_mappings': self.session_stats['successful_mappings'],
            'failed_mappings': self.session_stats['failed_mappings'],
            'processing_time_seconds': total_time,
            'session_report': session_report,
            'statistics': self.session_stats
        }

    def map_single_device(self, device_data: dict, tarea_id: str = "") -> Optional[DeviceMappingV2]:
        """
        Mapea un único dispositivo determinando automáticamente la estrategia.

        Args:
            device_data: Datos del dispositivo de Likewize
            tarea_id: ID de la tarea

        Returns:
            DeviceMappingV2 object o None si falla
        """
        try:
            # 1. Determinar tipo de dispositivo
            device_type = self._determine_device_type(device_data)

            # 2. Aplicar servicio especializado
            if device_type == 'mac':
                return self.mac_service.map_mac_device(device_data, tarea_id)
            elif device_type in ['iphone', 'ipad']:
                return self.ios_service.map_ios_device(device_data, tarea_id)
            else:
                logger.warning(f"Tipo de dispositivo no soportado: {device_type}")
                return None

        except Exception as e:
            logger.error(f"Error mapeando dispositivo: {str(e)}")
            return None

    def _determine_device_type(self, device_data: dict) -> str:
        """
        Determina el tipo de dispositivo Apple basado en los datos de Likewize.

        Args:
            device_data: Datos de Likewize

        Returns:
            Tipo de dispositivo: 'mac', 'iphone', 'ipad', 'watch', 'other'
        """
        # Obtener campos relevantes
        product_category = device_data.get('ProductCategoryName', '').lower()
        m_model = device_data.get('M_Model', '').lower()
        master_model = device_data.get('MasterModelName', '').lower()

        # Detección por categoría de producto (más confiable)
        if product_category == 'mac':
            return 'mac'
        elif product_category == 'iphone':
            return 'iphone'
        elif product_category == 'ipad':
            return 'ipad'

        # Detección por modelo si categoría no es clara
        mac_indicators = ['imac', 'macbook', 'mac mini', 'mac pro', 'mac studio']
        iphone_indicators = ['iphone']
        ipad_indicators = ['ipad']

        # Verificar en M_Model
        for indicator in mac_indicators:
            if indicator in m_model:
                return 'mac'

        for indicator in iphone_indicators:
            if indicator in m_model:
                return 'iphone'

        for indicator in ipad_indicators:
            if indicator in m_model:
                return 'ipad'

        # Verificar en MasterModelName (más detallado)
        if any(indicator in master_model for indicator in mac_indicators):
            return 'mac'
        elif 'iphone' in master_model:
            return 'iphone'
        elif 'ipad' in master_model:
            return 'ipad'

        # Fallback: si es Apple pero no identificado
        brand = device_data.get('BrandName', '').lower()
        if 'apple' in brand:
            # Heurística: si tiene A-number probablemente es Mac
            if 'A' in master_model and any(char.isdigit() for char in master_model):
                return 'mac'
            else:
                return 'iphone'  # Default para dispositivos Apple no identificados

        return 'other'

    def _reset_session_stats(self):
        """Resetea estadísticas de sesión."""
        self.session_stats = {
            'total_processed': 0,
            'successful_mappings': 0,
            'failed_mappings': 0,
            'high_confidence': 0,  # >= 85
            'medium_confidence': 0,  # 60-84
            'low_confidence': 0,  # < 60
            'by_type': {},
            'by_algorithm': {},
            'processing_times': []
        }

    def _update_session_stats(self, mapping_result: Optional[DeviceMappingV2], device_data: dict):
        """Actualiza estadísticas de sesión."""
        self.session_stats['total_processed'] += 1

        if mapping_result:
            self.session_stats['successful_mappings'] += 1

            # Clasificar por confianza
            confidence = mapping_result.confidence_score
            if confidence >= 85:
                self.session_stats['high_confidence'] += 1
            elif confidence >= 60:
                self.session_stats['medium_confidence'] += 1
            else:
                self.session_stats['low_confidence'] += 1

            # Estadísticas por tipo
            device_type = mapping_result.source_type
            if device_type not in self.session_stats['by_type']:
                self.session_stats['by_type'][device_type] = {
                    'total': 0, 'successful': 0, 'avg_confidence': 0, 'confidences': []
                }

            type_stats = self.session_stats['by_type'][device_type]
            type_stats['total'] += 1
            type_stats['successful'] += 1
            type_stats['confidences'].append(confidence)
            type_stats['avg_confidence'] = sum(type_stats['confidences']) / len(type_stats['confidences'])

            # Estadísticas por algoritmo
            algorithm = mapping_result.mapping_algorithm
            if algorithm not in self.session_stats['by_algorithm']:
                self.session_stats['by_algorithm'][algorithm] = 0
            self.session_stats['by_algorithm'][algorithm] += 1

            # Tiempo de procesamiento
            self.session_stats['processing_times'].append(mapping_result.processing_time_ms)

        else:
            self.session_stats['failed_mappings'] += 1

            # Contar tipo de dispositivo que falló
            device_type = self._determine_device_type(device_data)
            if device_type not in self.session_stats['by_type']:
                self.session_stats['by_type'][device_type] = {
                    'total': 0, 'successful': 0, 'avg_confidence': 0, 'confidences': []
                }
            self.session_stats['by_type'][device_type]['total'] += 1

    def _generate_session_report(self, tarea_id: str, total_time_seconds: float) -> MappingSessionReport:
        """Genera reporte completo de la sesión."""
        try:
            # Calcular métricas agregadas
            avg_processing_time = sum(self.session_stats['processing_times']) / max(len(self.session_stats['processing_times']), 1)

            # Generar recomendaciones automáticas
            recommendations = self._generate_recommendations()

            # Identificar nuevos conocimientos descubiertos
            new_knowledge = self._identify_new_knowledge(tarea_id)

            # Crear reporte
            report = MappingSessionReport.objects.create(
                tarea_id=tarea_id,
                total_devices_processed=self.session_stats['total_processed'],
                successfully_mapped=self.session_stats['successful_mappings'],
                failed_mappings=self.session_stats['failed_mappings'],
                high_confidence_mappings=self.session_stats['high_confidence'],
                medium_confidence_mappings=self.session_stats['medium_confidence'],
                low_confidence_mappings=self.session_stats['low_confidence'],
                devices_by_type=self.session_stats['by_type'],
                algorithms_used=self.session_stats['by_algorithm'],
                total_processing_time_ms=int(total_time_seconds * 1000),
                avg_processing_time_ms=avg_processing_time,
                mappings_needing_review=self._count_mappings_needing_review(tarea_id),
                new_knowledge_discovered=new_knowledge,
                recommendations=recommendations
            )

            return report

        except Exception as e:
            logger.error(f"Error generando reporte de sesión: {str(e)}")
            return None

    def _generate_recommendations(self) -> List[str]:
        """Genera recomendaciones automáticas basadas en las estadísticas."""
        recommendations = []

        # Recomendaciones por tasa de éxito
        success_rate = self.session_stats['successful_mappings'] / max(self.session_stats['total_processed'], 1)
        if success_rate < 0.8:
            recommendations.append(f"Tasa de éxito baja ({success_rate:.1%}). Considerar revisar base de conocimiento.")

        # Recomendaciones por confianza
        low_confidence_rate = self.session_stats['low_confidence'] / max(self.session_stats['successful_mappings'], 1)
        if low_confidence_rate > 0.2:
            recommendations.append(f"{self.session_stats['low_confidence']} mappings con baja confianza necesitan revisión.")

        # Recomendaciones por tipo de dispositivo
        for device_type, stats in self.session_stats['by_type'].items():
            type_success_rate = stats['successful'] / max(stats['total'], 1)
            if type_success_rate < 0.7:
                recommendations.append(f"Mapeo de {device_type} tiene baja tasa de éxito ({type_success_rate:.1%}). Revisar estrategia.")

        # Recomendaciones por algoritmo
        if 'fuzzy_similarity' in self.session_stats['by_algorithm']:
            fuzzy_count = self.session_stats['by_algorithm']['fuzzy_similarity']
            if fuzzy_count > self.session_stats['successful_mappings'] * 0.3:
                recommendations.append(f"{fuzzy_count} dispositivos mapeados por similitud difusa. Considerar mejorar base de conocimiento.")

        return recommendations

    def _identify_new_knowledge(self, tarea_id: str) -> List[dict]:
        """Identifica nuevos A-numbers o patrones descubiertos."""
        new_knowledge = []

        try:
            # Buscar A-numbers no registrados en base de conocimiento
            mappings = DeviceMappingV2.objects.filter(
                algorithm_version="2.0"
            ).exclude(extracted_a_number="")

            for mapping in mappings:
                a_number = mapping.extracted_a_number
                if a_number and not AppleDeviceKnowledgeBase.objects.filter(a_number=a_number).exists():
                    new_knowledge.append({
                        'type': 'new_a_number',
                        'a_number': a_number,
                        'device_type': mapping.source_type,
                        'model_name': mapping.extracted_model_name,
                        'confidence': mapping.confidence_score,
                        'should_add_to_kb': mapping.confidence_score >= 85
                    })

        except Exception as e:
            logger.error(f"Error identificando nuevo conocimiento: {str(e)}")

        return new_knowledge

    def _count_mappings_needing_review(self, tarea_id: str) -> int:
        """Cuenta mappings que necesitan revisión manual."""
        try:
            return MappingAuditLog.objects.filter(
                tarea_id=tarea_id,
                needs_review=True
            ).count()
        except Exception:
            return 0

    def get_mapping_statistics(self, days_back: int = 7) -> Dict[str, Any]:
        """
        Obtiene estadísticas de mapeo de los últimos días.

        Args:
            days_back: Número de días hacia atrás

        Returns:
            Diccionario con estadísticas agregadas
        """
        from datetime import timedelta

        cutoff_date = timezone.now() - timedelta(days=days_back)

        stats = {
            'total_mappings': 0,
            'successful_mappings': 0,
            'avg_confidence': 0,
            'by_device_type': {},
            'by_algorithm': {},
            'quality_distribution': {'high': 0, 'medium': 0, 'low': 0},
            'needs_review': 0,
            'user_validated': 0
        }

        try:
            # Estadísticas básicas
            mappings = DeviceMappingV2.objects.filter(created_at__gte=cutoff_date)
            stats['total_mappings'] = mappings.count()

            if stats['total_mappings'] > 0:
                # Confianza promedio
                stats['avg_confidence'] = mappings.aggregate(Avg('confidence_score'))['confidence_score__avg'] or 0

                # Por tipo de dispositivo
                by_type = mappings.values('source_type').annotate(count=Count('id')).order_by('source_type')
                for item in by_type:
                    stats['by_device_type'][item['source_type']] = item['count']

                # Por algoritmo
                by_algorithm = mappings.values('mapping_algorithm').annotate(count=Count('id')).order_by('mapping_algorithm')
                for item in by_algorithm:
                    stats['by_algorithm'][item['mapping_algorithm']] = item['count']

                # Distribución de calidad
                stats['quality_distribution']['high'] = mappings.filter(confidence_score__gte=85).count()
                stats['quality_distribution']['medium'] = mappings.filter(confidence_score__gte=60, confidence_score__lt=85).count()
                stats['quality_distribution']['low'] = mappings.filter(confidence_score__lt=60).count()

                # Necesitan revisión
                stats['needs_review'] = mappings.filter(needs_review=True).count()

                # Validados por usuario
                stats['user_validated'] = mappings.filter(validated_by_user=True).count()

        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {str(e)}")

        return stats

    def validate_mapping(self, mapping_id: str, feedback: str, user_notes: str = "", user_id: str = "") -> bool:
        """
        Permite validar un mapeo específico con feedback de usuario.

        Args:
            mapping_id: UUID del mapeo
            feedback: Tipo de feedback ('correct', 'incorrect', 'partial', 'needs_review')
            user_notes: Notas adicionales del usuario
            user_id: ID del usuario que valida

        Returns:
            True si la validación fue exitosa
        """
        try:
            mapping = DeviceMappingV2.objects.get(id=mapping_id)
            mapping.add_user_feedback(feedback, user_notes)

            # Actualizar audit log si existe
            audit_log = MappingAuditLog.objects.filter(mapping_v2=mapping).first()
            if audit_log:
                audit_log.user_validation = feedback
                audit_log.validator_user = user_id
                audit_log.validation_notes = user_notes
                audit_log.validation_date = timezone.now()
                audit_log.save()

            logger.info(f"Validación de mapeo {mapping_id}: {feedback}")
            return True

        except DeviceMappingV2.DoesNotExist:
            logger.error(f"Mapeo {mapping_id} no encontrado")
            return False
        except Exception as e:
            logger.error(f"Error validando mapeo {mapping_id}: {str(e)}")
            return False

    def get_mappings_for_review(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Obtiene mappings que necesitan revisión manual.

        Args:
            limit: Número máximo de mappings a retornar

        Returns:
            Lista de mappings con información para revisión
        """
        try:
            mappings = DeviceMappingV2.objects.filter(
                needs_review=True,
                validated_by_user=False
            ).order_by('confidence_score', '-created_at')[:limit]

            review_items = []
            for mapping in mappings:
                review_items.append({
                    'id': str(mapping.id),
                    'device_signature': mapping.device_signature,
                    'source_type': mapping.source_type,
                    'extracted_model_name': mapping.extracted_model_name,
                    'extracted_a_number': mapping.extracted_a_number,
                    'extracted_capacity_gb': mapping.extracted_capacity_gb,
                    'mapped_capacity_id': mapping.mapped_capacity.id,
                    'mapped_description': str(mapping.mapped_capacity),
                    'confidence_score': mapping.confidence_score,
                    'mapping_algorithm': mapping.mapping_algorithm,
                    'review_reason': mapping.review_reason,
                    'created_at': mapping.created_at.isoformat(),
                    'source_data': mapping.source_data
                })

            return review_items

        except Exception as e:
            logger.error(f"Error obteniendo mappings para revisión: {str(e)}")
            return []