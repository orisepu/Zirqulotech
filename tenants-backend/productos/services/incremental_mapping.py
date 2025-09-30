"""
Sistema de actualización incremental para mapeo de dispositivos.
Optimiza el procesamiento al identificar solo cambios relevantes.
"""

import hashlib
import logging
from typing import Dict, List, Set, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.utils import timezone
from django.db.models import Q, Max, Count
from django.db import transaction

from ..models import LikewizeItemStaging, DeviceMapping, MappingMetrics
from .device_mapping import DeviceMappingService, DeviceMetadata
from .metadata_extractors import AppleMetadataExtractor, GoogleMetadataExtractor, SamsungMetadataExtractor


logger = logging.getLogger(__name__)


@dataclass
class ChangeDetectionResult:
    """Resultado de detección de cambios en datos de staging."""
    new_devices: List[Dict]
    modified_devices: List[Dict]
    removed_device_signatures: Set[str]
    unchanged_count: int
    total_processed: int


@dataclass
class IncrementalMappingResult:
    """Resultado de procesamiento incremental."""
    newly_mapped: int
    updated_mappings: int
    failed_mappings: int
    invalidated_mappings: int
    processing_time_seconds: float
    changes_detected: ChangeDetectionResult


class IncrementalMappingService:
    """
    Servicio para actualizaciones incrementales eficientes.
    Detecta cambios y procesa solo lo necesario.
    """

    def __init__(self):
        self.mapping_service = DeviceMappingService()
        self.extractors = {
            'apple': AppleMetadataExtractor(),
            'google': GoogleMetadataExtractor(),
            'samsung': SamsungMetadataExtractor(),
        }

    def process_incremental_update(self, tarea_id: str, force_full_update: bool = False) -> IncrementalMappingResult:
        """
        Procesa actualización incremental para una tarea específica.

        Args:
            tarea_id: ID de la tarea de actualización
            force_full_update: Forzar procesamiento completo ignorando caché
        """
        start_time = timezone.now()

        try:
            # Detectar cambios en staging vs. mappings existentes
            changes = self._detect_changes(tarea_id, force_full_update)

            # Procesar solo cambios detectados
            mapping_results = self._process_changes(changes, tarea_id)

            # Invalidar mappings de dispositivos removidos
            invalidated = self._invalidate_removed_devices(changes.removed_device_signatures)

            processing_time = (timezone.now() - start_time).total_seconds()

            result = IncrementalMappingResult(
                newly_mapped=mapping_results['newly_mapped'],
                updated_mappings=mapping_results['updated_mappings'],
                failed_mappings=mapping_results['failed_mappings'],
                invalidated_mappings=invalidated,
                processing_time_seconds=processing_time,
                changes_detected=changes
            )

            self._log_incremental_results(result)
            return result

        except Exception as e:
            logger.exception(f"Error en procesamiento incremental para tarea {tarea_id}: {e}")
            raise

    def _detect_changes(self, tarea_id: str, force_full: bool) -> ChangeDetectionResult:
        """Detecta cambios entre staging actual y mappings previos."""

        # Obtener todos los items de staging para la tarea
        staging_items = list(
            LikewizeItemStaging.objects.filter(tarea_id=tarea_id)
            .values('tipo', 'marca', 'modelo_norm', 'almacenamiento_gb', 'modelo_raw',
                   'a_number', 'pulgadas', 'any', 'cpu', 'likewize_model_code')
        )

        if force_full:
            return ChangeDetectionResult(
                new_devices=staging_items,
                modified_devices=[],
                removed_device_signatures=set(),
                unchanged_count=0,
                total_processed=len(staging_items)
            )

        # Generar signatures para staging items
        staging_signatures = {}
        for item in staging_items:
            signature = self._generate_device_signature(item)
            staging_signatures[signature] = item

        # Obtener signatures de mappings existentes activos (últimas 48 horas)
        cutoff_date = timezone.now() - timedelta(hours=48)
        existing_mappings = DeviceMapping.objects.filter(
            is_active=True,
            last_confirmed_at__gte=cutoff_date
        ).values('source_brand', 'source_model_normalized', 'source_capacity_gb',
                'a_number', 'screen_size', 'year', 'cpu')

        existing_signatures = set()
        for mapping in existing_mappings:
            signature = self._generate_mapping_signature(mapping)
            existing_signatures.add(signature)

        # Identificar cambios
        current_signatures = set(staging_signatures.keys())

        new_signatures = current_signatures - existing_signatures
        removed_signatures = existing_signatures - current_signatures

        # Los dispositivos "modificados" son aquellos que existen pero pueden tener
        # cambios en metadatos secundarios (precio, descripción, etc.)
        potentially_modified = current_signatures & existing_signatures

        # Para simplificar, tratamos los potencialmente modificados como sin cambios
        # En futuras iteraciones se puede implementar detección más granular

        new_devices = [staging_signatures[sig] for sig in new_signatures]

        return ChangeDetectionResult(
            new_devices=new_devices,
            modified_devices=[],  # Por ahora vacío
            removed_device_signatures=removed_signatures,
            unchanged_count=len(potentially_modified),
            total_processed=len(staging_items)
        )

    def _generate_device_signature(self, staging_item: Dict) -> str:
        """Genera signature única para un item de staging."""
        # Usar campos clave para generar hash único
        key_fields = [
            staging_item.get('marca', '').lower(),
            staging_item.get('modelo_norm', '').lower(),
            str(staging_item.get('almacenamiento_gb', 0)),
            staging_item.get('a_number', '').upper(),
            str(staging_item.get('pulgadas', 0)),
            str(staging_item.get('any', 0)),
        ]

        signature_text = '|'.join(key_fields)
        return hashlib.md5(signature_text.encode()).hexdigest()

    def _generate_mapping_signature(self, mapping: Dict) -> str:
        """Genera signature para un mapping existente."""
        key_fields = [
            mapping.get('source_brand', '').lower(),
            mapping.get('source_model_normalized', '').lower(),
            str(mapping.get('source_capacity_gb', 0)),
            mapping.get('a_number', '').upper(),
            str(mapping.get('screen_size', 0)),
            str(mapping.get('year', 0)),
        ]

        signature_text = '|'.join(key_fields)
        return hashlib.md5(signature_text.encode()).hexdigest()

    def _process_changes(self, changes: ChangeDetectionResult, tarea_id: str) -> Dict[str, int]:
        """Procesa los cambios detectados."""
        results = {
            'newly_mapped': 0,
            'updated_mappings': 0,
            'failed_mappings': 0
        }

        # Procesar dispositivos nuevos
        for device_data in changes.new_devices:
            try:
                # Extraer metadatos usando extractor específico
                metadata = self._extract_metadata_for_device(device_data)

                # Intentar mapeo
                mapping_result = self.mapping_service.map_device(metadata, use_cache=True)

                if mapping_result.capacity_id:
                    results['newly_mapped'] += 1

                    # Actualizar staging con resultado
                    self._update_staging_with_result(tarea_id, device_data, mapping_result)
                else:
                    results['failed_mappings'] += 1
                    logger.warning(f"Fallo mapeo para {device_data.get('modelo_raw', 'Unknown')}")

            except Exception as e:
                results['failed_mappings'] += 1
                logger.exception(f"Error procesando dispositivo {device_data.get('modelo_raw', 'Unknown')}: {e}")

        # Procesar dispositivos modificados (futura implementación)
        for device_data in changes.modified_devices:
            # TODO: Implementar lógica de actualización para dispositivos modificados
            results['updated_mappings'] += 1

        return results

    def _extract_metadata_for_device(self, device_data: Dict) -> DeviceMetadata:
        """Extrae metadatos usando el extractor apropiado."""
        brand = device_data.get('marca', '').lower()

        # Usar extractor específico si está disponible
        if brand in self.extractors:
            # Convertir formato staging a formato raw_data esperado por extractors
            raw_data = {
                'ModelName': device_data.get('modelo_raw', ''),
                'BrandName': device_data.get('marca', ''),
                'M_Model': device_data.get('likewize_model_code', ''),
                'ProductCategoryName': device_data.get('tipo', ''),
            }
            return self.extractors[brand].extract_metadata(raw_data)

        # Extractor genérico
        return DeviceMetadata(
            brand=device_data.get('marca', ''),
            device_type=device_data.get('tipo', ''),
            model_raw=device_data.get('modelo_raw', ''),
            model_normalized=device_data.get('modelo_norm', ''),
            capacity_gb=device_data.get('almacenamiento_gb'),
            a_number=device_data.get('a_number', ''),
            screen_size=device_data.get('pulgadas'),
            year=device_data.get('any'),
            cpu=device_data.get('cpu', ''),
            likewize_model_code=device_data.get('likewize_model_code', '')
        )

    def _update_staging_with_result(self, tarea_id: str, device_data: Dict, mapping_result):
        """Actualiza staging con resultado de mapeo."""
        try:
            LikewizeItemStaging.objects.filter(
                tarea_id=tarea_id,
                tipo=device_data.get('tipo'),
                modelo_norm=device_data.get('modelo_norm'),
                almacenamiento_gb=device_data.get('almacenamiento_gb')
            ).update(capacidad_id=mapping_result.capacity_id)
        except Exception as e:
            logger.exception(f"Error actualizando staging: {e}")

    def _invalidate_removed_devices(self, removed_signatures: Set[str]) -> int:
        """Invalida mappings de dispositivos que ya no están en Likewize."""
        if not removed_signatures:
            return 0

        try:
            # Por simplificar, invalidamos por fecha de última confirmación
            # En implementación completa, usaríamos las signatures para ser más precisos
            cutoff_date = timezone.now() - timedelta(days=7)

            invalidated_count = DeviceMapping.objects.filter(
                is_active=True,
                last_confirmed_at__lt=cutoff_date,
                source="likewize"
            ).update(
                is_active=False,
                invalidated_at=timezone.now(),
                invalidation_reason="Device no longer in source data"
            )

            logger.info(f"Invalidated {invalidated_count} stale mappings")
            return invalidated_count

        except Exception as e:
            logger.exception(f"Error invalidating removed devices: {e}")
            return 0

    def _log_incremental_results(self, result: IncrementalMappingResult):
        """Registra resultados del procesamiento incremental."""
        logger.info(f"""
        Incremental mapping completed:
        - Newly mapped: {result.newly_mapped}
        - Updated mappings: {result.updated_mappings}
        - Failed mappings: {result.failed_mappings}
        - Invalidated mappings: {result.invalidated_mappings}
        - Processing time: {result.processing_time_seconds:.2f}s
        - Total changes: {result.changes_detected.total_processed}
        - New devices: {len(result.changes_detected.new_devices)}
        - Unchanged: {result.changes_detected.unchanged_count}
        """)

    def cleanup_old_mappings(self, days_threshold: int = 30) -> int:
        """
        Limpia mappings antiguos no confirmados.

        Args:
            days_threshold: Días sin confirmar antes de limpieza

        Returns:
            Número de mappings limpiados
        """
        cutoff_date = timezone.now() - timedelta(days=days_threshold)

        # Identificar mappings para limpieza
        old_mappings = DeviceMapping.objects.filter(
            is_active=True,
            last_confirmed_at__lt=cutoff_date,
            times_confirmed=1,  # Solo los confirmados una vez
            confidence_score__lt=60  # Solo mappings de baja confianza
        )

        count = old_mappings.count()

        if count > 0:
            old_mappings.update(
                is_active=False,
                invalidated_at=timezone.now(),
                invalidation_reason=f"Cleanup: Not confirmed for {days_threshold} days"
            )

            logger.info(f"Cleaned up {count} old unconfirmed mappings")

        return count

    def get_mapping_health_report(self) -> Dict:
        """Genera reporte de salud del sistema de mapeo."""
        now = timezone.now()
        last_week = now - timedelta(days=7)

        # Estadísticas básicas
        total_active_mappings = DeviceMapping.objects.filter(is_active=True).count()
        mappings_last_week = DeviceMapping.objects.filter(
            first_mapped_at__gte=last_week
        ).count()

        # Distribución por confianza
        confidence_distribution = {}
        confidence_ranges = [(0, 30), (30, 50), (50, 70), (70, 90), (90, 100)]

        for min_conf, max_conf in confidence_ranges:
            count = DeviceMapping.objects.filter(
                is_active=True,
                confidence_score__gte=min_conf,
                confidence_score__lt=max_conf
            ).count()
            confidence_distribution[f"{min_conf}-{max_conf}"] = count

        # Mappings que necesitan revisión
        needs_review = DeviceMapping.objects.filter(
            is_active=True,
            needs_review=True
        ).count()

        # Métricas por marca
        brand_metrics = list(
            MappingMetrics.objects.filter(date__gte=last_week.date())
            .values('brand')
            .annotate(
                total=Count('id'),
                avg_success_rate=Count('successfully_mapped') * 100.0 / Count('total_processed')
            )
            .order_by('-total')[:10]
        )

        return {
            'total_active_mappings': total_active_mappings,
            'new_mappings_last_week': mappings_last_week,
            'confidence_distribution': confidence_distribution,
            'mappings_needing_review': needs_review,
            'top_brands_last_week': brand_metrics,
            'generated_at': now.isoformat()
        }


class MappingOptimizer:
    """Optimizador para mejorar rendimiento del sistema de mapeo."""

    def __init__(self):
        self.mapping_service = DeviceMappingService()

    def optimize_low_confidence_mappings(self, min_confidence: int = 40) -> Dict:
        """
        Re-procesa mappings de baja confianza para mejorarlos.

        Args:
            min_confidence: Umbral mínimo de confianza para re-procesamiento

        Returns:
            Estadísticas de optimización
        """
        # Identificar mappings de baja confianza
        low_confidence_mappings = DeviceMapping.objects.filter(
            is_active=True,
            confidence_score__lt=min_confidence,
            needs_review=False  # No re-procesar los que ya están marcados para revisión
        ).select_related()[:100]  # Limitar para evitar sobrecarga

        improved_count = 0
        marked_for_review = 0

        for mapping in low_confidence_mappings:
            try:
                # Reconstruir metadatos
                metadata = DeviceMetadata(
                    brand=mapping.source_brand,
                    device_type=mapping.source_type,
                    model_raw=mapping.source_model_raw,
                    model_normalized=mapping.source_model_normalized,
                    capacity_gb=mapping.source_capacity_gb,
                    a_number=mapping.a_number,
                    screen_size=mapping.screen_size,
                    year=mapping.year,
                    cpu=mapping.cpu,
                    gpu_cores=mapping.gpu_cores,
                    likewize_model_code=mapping.likewize_model_code
                )

                # Re-procesar sin caché para forzar nuevo análisis
                new_result = self.mapping_service.map_device(metadata, use_cache=False)

                if new_result.capacity_id and new_result.confidence_score > mapping.confidence_score:
                    # Actualizar con mejor resultado
                    mapping.confidence_score = new_result.confidence_score
                    mapping.mapping_algorithm = new_result.algorithm_used
                    mapping.last_confirmed_at = timezone.now()
                    mapping.save(update_fields=['confidence_score', 'mapping_algorithm', 'last_confirmed_at'])
                    improved_count += 1

                elif new_result.confidence_score < 30:
                    # Marcar para revisión manual si el score es muy bajo
                    mapping.flag_for_review("Low confidence after re-processing")
                    marked_for_review += 1

            except Exception as e:
                logger.exception(f"Error optimizing mapping {mapping.id}: {e}")

        return {
            'processed': len(low_confidence_mappings),
            'improved': improved_count,
            'marked_for_review': marked_for_review
        }

    def rebuild_cache_for_brand(self, brand: str) -> int:
        """
        Reconstruye caché de mappings para una marca específica.
        Útil después de cambios importantes en la BD de productos.
        """
        try:
            # Invalidar mappings existentes de la marca
            invalidated = DeviceMapping.objects.filter(
                source_brand__iexact=brand,
                is_active=True
            ).update(
                is_active=False,
                invalidated_at=timezone.now(),
                invalidation_reason=f"Cache rebuild for {brand}"
            )

            logger.info(f"Invalidated {invalidated} mappings for {brand} to rebuild cache")
            return invalidated

        except Exception as e:
            logger.exception(f"Error rebuilding cache for {brand}: {e}")
            return 0