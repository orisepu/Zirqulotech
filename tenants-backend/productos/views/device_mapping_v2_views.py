"""
Vistas API para el sistema de mapeo de dispositivos V2.
Proporciona endpoints para validación, feedback y análisis del mapeo.
"""

import logging
from typing import Dict, Any

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import json

from ..models import (
    DeviceMappingV2,
    AppleDeviceKnowledgeBase,
    MappingAuditLog,
    MappingSessionReport
)
from ..services.device_mapping_v2_service import DeviceMappingV2Service


logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_mapping(request):
    """
    Endpoint para validar un mapeo específico con feedback de usuario.

    POST /api/device-mapping/v2/validate/
    {
        "mapping_id": "uuid",
        "feedback": "correct|incorrect|partial|needs_review",
        "user_notes": "Comentarios opcionales",
        "suggested_capacity_id": 123  // opcional para feedback incorrecto
    }
    """
    try:
        data = request.data
        mapping_id = data.get('mapping_id')
        feedback = data.get('feedback')
        user_notes = data.get('user_notes', '')
        suggested_capacity_id = data.get('suggested_capacity_id')

        if not mapping_id or not feedback:
            return Response({
                'error': 'mapping_id y feedback son requeridos'
            }, status=status.HTTP_400_BAD_REQUEST)

        if feedback not in ['correct', 'incorrect', 'partial', 'needs_review']:
            return Response({
                'error': 'feedback debe ser: correct, incorrect, partial o needs_review'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validar mapeo
        service = DeviceMappingV2Service()
        success = service.validate_mapping(
            mapping_id=mapping_id,
            feedback=feedback,
            user_notes=user_notes,
            user_id=str(request.user.id)
        )

        if success:
            # Si es incorrecto y hay sugerencia, registrarla
            if feedback == 'incorrect' and suggested_capacity_id:
                try:
                    mapping = DeviceMappingV2.objects.get(id=mapping_id)
                    mapping.user_notes = f"{user_notes}\nCapacidad sugerida: {suggested_capacity_id}"
                    mapping.save()
                except Exception as e:
                    logger.error(f"Error guardando capacidad sugerida: {str(e)}")

            return Response({
                'success': True,
                'message': 'Validación registrada exitosamente'
            })
        else:
            return Response({
                'error': 'No se pudo validar el mapeo'
            }, status=status.HTTP_404_NOT_FOUND)

    except Exception as e:
        logger.error(f"Error en validate_mapping: {str(e)}")
        return Response({
            'error': 'Error interno del servidor'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_mappings_for_review(request):
    """
    Obtiene mappings que necesitan revisión manual.

    GET /api/device-mapping/v2/review/?limit=50&device_type=mac
    """
    try:
        limit = int(request.GET.get('limit', 50))
        device_type = request.GET.get('device_type', '')
        min_confidence = int(request.GET.get('min_confidence', 0))

        service = DeviceMappingV2Service()
        review_items = service.get_mappings_for_review(limit=limit)

        # Filtrar por tipo de dispositivo si se especifica
        if device_type:
            review_items = [item for item in review_items if item['source_type'] == device_type]

        # Filtrar por confianza mínima
        if min_confidence > 0:
            review_items = [item for item in review_items if item['confidence_score'] >= min_confidence]

        return Response({
            'success': True,
            'mappings': review_items,
            'count': len(review_items)
        })

    except Exception as e:
        logger.error(f"Error en get_mappings_for_review: {str(e)}")
        return Response({
            'error': 'Error obteniendo mappings para revisión'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_mapping_statistics(request):
    """
    Obtiene estadísticas de mapeo del sistema V2.

    GET /api/device-mapping/v2/statistics/?days=7
    """
    try:
        days_back = int(request.GET.get('days', 7))

        service = DeviceMappingV2Service()
        stats = service.get_mapping_statistics(days_back=days_back)

        return Response({
            'success': True,
            'statistics': stats,
            'period_days': days_back
        })

    except Exception as e:
        logger.error(f"Error en get_mapping_statistics: {str(e)}")
        return Response({
            'error': 'Error obteniendo estadísticas'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_session_report(request, tarea_id):
    """
    Obtiene reporte detallado de una sesión de mapeo.

    GET /api/device-mapping/v2/session-report/{tarea_id}/
    """
    try:
        report = MappingSessionReport.objects.filter(tarea_id=tarea_id).first()

        if not report:
            return Response({
                'error': 'Reporte de sesión no encontrado'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'success': True,
            'report': {
                'tarea_id': report.tarea_id,
                'total_devices_processed': report.total_devices_processed,
                'successfully_mapped': report.successfully_mapped,
                'failed_mappings': report.failed_mappings,
                'success_rate': (report.successfully_mapped / max(report.total_devices_processed, 1)) * 100,
                'high_confidence_mappings': report.high_confidence_mappings,
                'medium_confidence_mappings': report.medium_confidence_mappings,
                'low_confidence_mappings': report.low_confidence_mappings,
                'devices_by_type': report.devices_by_type,
                'algorithms_used': report.algorithms_used,
                'total_processing_time_ms': report.total_processing_time_ms,
                'avg_processing_time_ms': report.avg_processing_time_ms,
                'mappings_needing_review': report.mappings_needing_review,
                'new_knowledge_discovered': report.new_knowledge_discovered,
                'recommendations': report.recommendations,
                'created_at': report.created_at.isoformat()
            }
        })

    except Exception as e:
        logger.error(f"Error en get_session_report: {str(e)}")
        return Response({
            'error': 'Error obteniendo reporte de sesión'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def test_device_mapping(request):
    """
    Endpoint para probar el mapeo de un dispositivo individual.

    POST /api/device-mapping/v2/test/
    {
        "device_data": {
            "M_Model": "iPhone 15 Pro",
            "MasterModelName": "iPhone 15 Pro",
            "ModelName": "iPhone 15 Pro 256GB",
            "FullName": "Apple iPhone 15 Pro 256GB",
            "Capacity": "256GB",
            "ModelValue": 350,
            "BrandName": "Apple",
            "ProductCategoryName": "iPhone"
        }
    }
    """
    try:
        device_data = request.data.get('device_data')

        if not device_data:
            return Response({
                'error': 'device_data es requerido'
            }, status=status.HTTP_400_BAD_REQUEST)

        service = DeviceMappingV2Service()
        result = service.map_single_device(device_data, tarea_id="TEST")

        if result:
            return Response({
                'success': True,
                'mapping': {
                    'id': str(result.id),
                    'device_signature': result.device_signature,
                    'source_type': result.source_type,
                    'extracted_model_name': result.extracted_model_name,
                    'extracted_a_number': result.extracted_a_number,
                    'extracted_capacity_gb': result.extracted_capacity_gb,
                    'mapped_capacity_id': result.mapped_capacity.id,
                    'mapped_description': str(result.mapped_capacity),
                    'confidence_score': result.confidence_score,
                    'mapping_algorithm': result.mapping_algorithm,
                    'processing_time_ms': result.processing_time_ms,
                    'decision_path': result.decision_path,
                    'candidates_considered': result.candidates_considered
                }
            })
        else:
            return Response({
                'success': False,
                'error': 'No se pudo mapear el dispositivo',
                'device_type': service._determine_device_type(device_data)
            })

    except Exception as e:
        logger.error(f"Error en test_device_mapping: {str(e)}")
        return Response({
            'error': 'Error probando mapeo de dispositivo'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_mapping_details(request, mapping_id):
    """
    Obtiene detalles completos de un mapeo específico.

    GET /api/device-mapping/v2/details/{mapping_id}/
    """
    try:
        mapping = DeviceMappingV2.objects.get(id=mapping_id)
        audit_log = MappingAuditLog.objects.filter(mapping_v2=mapping).first()

        return Response({
            'success': True,
            'mapping': {
                'id': str(mapping.id),
                'device_signature': mapping.device_signature,
                'source_type': mapping.source_type,
                'source_data': mapping.source_data,
                'extracted_a_number': mapping.extracted_a_number,
                'extracted_model_name': mapping.extracted_model_name,
                'extracted_cpu': mapping.extracted_cpu,
                'extracted_year': mapping.extracted_year,
                'extracted_capacity_gb': mapping.extracted_capacity_gb,
                'mapped_capacity': {
                    'id': mapping.mapped_capacity.id,
                    'description': str(mapping.mapped_capacity),
                    'size': mapping.mapped_capacity.tamaño
                },
                'confidence_score': mapping.confidence_score,
                'mapping_algorithm': mapping.mapping_algorithm,
                'decision_path': mapping.decision_path,
                'candidates_considered': mapping.candidates_considered,
                'rejection_reasons': mapping.rejection_reasons,
                'processing_time_ms': mapping.processing_time_ms,
                'needs_review': mapping.needs_review,
                'validated_by_user': mapping.validated_by_user,
                'validation_feedback': mapping.validation_feedback,
                'user_notes': mapping.user_notes,
                'created_at': mapping.created_at.isoformat()
            },
            'audit_log': {
                'automatic_quality_score': audit_log.automatic_quality_score if audit_log else None,
                'quality_flags': audit_log.quality_flags if audit_log else [],
                'decision_factors': audit_log.decision_factors if audit_log else {},
                'user_validation': audit_log.user_validation if audit_log else 'pending'
            } if audit_log else None
        })

    except DeviceMappingV2.DoesNotExist:
        return Response({
            'error': 'Mapeo no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error en get_mapping_details: {str(e)}")
        return Response({
            'error': 'Error obteniendo detalles del mapeo'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_knowledge_base_entry(request):
    """
    Añade una nueva entrada a la base de conocimiento de Apple.

    POST /api/device-mapping/v2/knowledge-base/
    {
        "device_family": "iPhone",
        "model_name": "iPhone 15 Pro Max",
        "a_number": "A3108",
        "release_date": "2023-09-22",
        "cpu_family": "A17 Pro",
        "available_capacities": [256, 512, 1024],
        "likewize_model_names": ["iPhone 15 Pro Max"],
        "confidence_level": "verified",
        "source": "apple_official"
    }
    """
    try:
        data = request.data

        required_fields = ['device_family', 'model_name', 'a_number', 'release_date']
        for field in required_fields:
            if field not in data:
                return Response({
                    'error': f'Campo requerido: {field}'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Verificar que no exista ya
        if AppleDeviceKnowledgeBase.objects.filter(a_number=data['a_number']).exists():
            return Response({
                'error': f'A-number {data["a_number"]} ya existe en la base de conocimiento'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Crear entrada
        knowledge_entry = AppleDeviceKnowledgeBase.objects.create(
            device_family=data['device_family'],
            model_name=data['model_name'],
            a_number=data['a_number'],
            release_date=data['release_date'],
            cpu_family=data.get('cpu_family', ''),
            available_capacities=data.get('available_capacities', []),
            likewize_model_names=data.get('likewize_model_names', []),
            likewize_master_patterns=data.get('likewize_master_patterns', []),
            confidence_level=data.get('confidence_level', 'needs_verification'),
            source=data.get('source', 'manual'),
            verification_notes=data.get('verification_notes', ''),
            created_by=str(request.user.email)
        )

        return Response({
            'success': True,
            'message': 'Entrada añadida a la base de conocimiento',
            'id': knowledge_entry.id
        })

    except Exception as e:
        logger.error(f"Error en add_knowledge_base_entry: {str(e)}")
        return Response({
            'error': 'Error añadiendo entrada a la base de conocimiento'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_knowledge_base(request):
    """
    Busca en la base de conocimiento de Apple.

    GET /api/device-mapping/v2/knowledge-base/search/?q=iPhone&device_family=iPhone
    """
    try:
        query = request.GET.get('q', '')
        device_family = request.GET.get('device_family', '')
        a_number = request.GET.get('a_number', '')

        filters = {}
        if device_family:
            filters['device_family__icontains'] = device_family
        if a_number:
            filters['a_number__icontains'] = a_number

        queryset = AppleDeviceKnowledgeBase.objects.filter(**filters)

        if query:
            queryset = queryset.filter(model_name__icontains=query)

        results = []
        for entry in queryset[:20]:  # Limitar a 20 resultados
            results.append({
                'id': entry.id,
                'device_family': entry.device_family,
                'model_name': entry.model_name,
                'a_number': entry.a_number,
                'release_date': entry.release_date.isoformat(),
                'cpu_family': entry.cpu_family,
                'available_capacities': entry.available_capacities,
                'likewize_model_names': entry.likewize_model_names,
                'confidence_level': entry.confidence_level,
                'source': entry.source
            })

        return Response({
            'success': True,
            'results': results,
            'count': len(results)
        })

    except Exception as e:
        logger.error(f"Error en search_knowledge_base: {str(e)}")
        return Response({
            'error': 'Error buscando en la base de conocimiento'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_algorithm_comparison(request):
    """
    Compara rendimiento de diferentes algoritmos de mapeo.

    GET /api/device-mapping/v2/algorithm-comparison/?days=30
    """
    try:
        days_back = int(request.GET.get('days', 30))

        from datetime import timedelta
        from django.utils import timezone
        from django.db import models

        cutoff_date = timezone.now() - timedelta(days=days_back)

        # Obtener estadísticas por algoritmo
        algorithm_stats = {}

        for algorithm in ['a_number_direct', 'exact_name_capacity', 'enriched_a_number', 'fuzzy_name_match', 'tech_specs_match']:
            mappings = DeviceMappingV2.objects.filter(
                mapping_algorithm=algorithm,
                created_at__gte=cutoff_date
            )

            if mappings.exists():
                algorithm_stats[algorithm] = {
                    'total_mappings': mappings.count(),
                    'avg_confidence': mappings.aggregate(avg=models.Avg('confidence_score'))['avg'] or 0,
                    'high_confidence_count': mappings.filter(confidence_score__gte=85).count(),
                    'needs_review_count': mappings.filter(needs_review=True).count(),
                    'avg_processing_time': mappings.aggregate(avg=models.Avg('processing_time_ms'))['avg'] or 0
                }

        return Response({
            'success': True,
            'algorithm_comparison': algorithm_stats,
            'period_days': days_back
        })

    except Exception as e:
        logger.error(f"Error en get_algorithm_comparison: {str(e)}")
        return Response({
            'error': 'Error comparando algoritmos'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def apply_manual_correction(request):
    """
    Aplica una corrección manual a un mapeo sospechoso.

    POST /api/device-mapping/v2/manual-correction/
    {
        "tarea_id": "uuid",
        "staging_item_id": "uuid|int",
        "new_capacidad_id": 123,
        "reason": "Corrección manual: modelo incorrecto"
    }
    """
    try:
        from ..models import LikewizeItemStaging, TareaActualizacionLikewize
        from django.db import transaction

        data = request.data
        tarea_id = data.get('tarea_id')
        staging_item_id = data.get('staging_item_id')
        new_capacidad_id = data.get('new_capacidad_id')
        reason = data.get('reason', 'Corrección manual')

        if not all([tarea_id, staging_item_id, new_capacidad_id]):
            return Response({
                'error': 'tarea_id, staging_item_id y new_capacidad_id son requeridos'
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Buscar staging item
            try:
                staging_item = LikewizeItemStaging.objects.get(
                    id=staging_item_id,
                    tarea_id=tarea_id
                )
            except LikewizeItemStaging.DoesNotExist:
                return Response({
                    'error': 'Staging item no encontrado'
                }, status=status.HTTP_404_NOT_FOUND)

            old_capacidad_id = staging_item.capacidad_id

            # Actualizar capacidad
            staging_item.capacidad_id = new_capacidad_id
            staging_item.save(update_fields=['capacidad_id'])

            # Registrar en audit log si existe DeviceMappingV2 relacionado
            try:
                mapping = DeviceMappingV2.objects.filter(
                    external_model_name=staging_item.modelo_norm,
                    external_storage_gb=staging_item.almacenamiento_gb
                ).first()

                if mapping:
                    MappingAuditLog.objects.create(
                        mapping=mapping,
                        action='manual_correction',
                        performed_by=str(request.user.id),
                        changes={
                            'old_capacidad_id': old_capacidad_id,
                            'new_capacidad_id': new_capacidad_id,
                            'reason': reason,
                            'tarea_id': str(tarea_id),
                            'staging_item_id': str(staging_item_id)
                        },
                        notes=reason
                    )
            except Exception as e:
                logger.warning(f"No se pudo registrar en audit log: {str(e)}")

            return Response({
                'success': True,
                'message': 'Corrección aplicada exitosamente',
                'old_capacidad_id': old_capacidad_id,
                'new_capacidad_id': new_capacidad_id
            })

    except Exception as e:
        logger.error(f"Error en apply_manual_correction: {str(e)}")
        return Response({
            'error': 'Error aplicando corrección manual'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)