from datetime import timedelta
from django.db.models import Q, Count, Avg, F, Max
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging
from django.core.management import call_command
from threading import Thread
import subprocess
import uuid
import logging
from productos.models.autoaprendizaje import (
    LikewizeKnowledgeBase,
    MappingCorrection,
    LearningSession,
    FeaturePattern
)
from productos.models.modelos import Capacidad
from django.http import JsonResponse, Http404
import os
# from productos.services.auto_learning_engine_v3 import AutoLearningEngine
# from productos.services.feedback_system_v3 import FeedbackSystem


class LanzarActualizacionV3View(APIView):
    """
    Lanza una actualización V3 con autoaprendizaje
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        try:
            # Parámetros de la solicitud
            categories = request.data.get('categories', [])
            enable_learning = request.data.get('enable_learning', True)
            confidence_threshold = request.data.get('confidence_threshold', 0.7)
            parallel_requests = request.data.get('parallel_requests', 5)

            # Crear nueva tarea
            tarea = TareaActualizacionLikewize.objects.create(
                estado='PENDING',
                meta={
                    'usuario': request.user.name if request.user else 'system',
                    'fuente': 'likewize_v3',
                    'enable_learning': enable_learning,
                    'confidence_threshold': confidence_threshold,
                    'parallel_requests': parallel_requests,
                    'categories': categories
                }
            )

            # Parámetros para el comando
            cmd_params = {
                'tarea_id': str(tarea.id),
                'enable_learning': enable_learning,
                'confidence_threshold': confidence_threshold,
                'parallel_requests': parallel_requests,
            }

            if categories:
                cmd_params['categories'] = ','.join(categories)

            # Lanzar comando usando call_command como V1, pero con logs V3
            from pathlib import Path
            from django.conf import settings

            try:
                # Crear directorio de logs timestamped como V1
                stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
                base_dir = Path(settings.MEDIA_ROOT) / "likewize" / f"v3_{stamp}"

                # Asegurar que el directorio padre existe
                base_dir.mkdir(parents=True, exist_ok=True)
                log_path = base_dir / "log.txt"

                # CRÍTICO: Crear archivo de log inmediatamente para evitar 404s
                with open(log_path, 'w', encoding='utf-8') as f:
                    f.write(f"[{timezone.now().isoformat()}] 📋 Log V3 inicializado para tarea {tarea.id}\n")
                    f.write(f"[{timezone.now().isoformat()}] 📂 Directorio: {base_dir}\n")
                    f.flush()

                # Actualizar tarea con log_path
                tarea.log_path = str(log_path)
                tarea.save(update_fields=["log_path"])

                # Función para ejecutar el comando en un hilo separado (como V1)
                def _runner():
                    # Inicializar variables de logger en None para poder limpiarlas en finally
                    v3_logger = None
                    original_logger = None

                    try:
                        # Log inmediato para debug - crear archivo directamente
                        with open(log_path, 'w', encoding='utf-8') as f:
                            f.write(f"[{timezone.now().isoformat()}] 🚀 V3 Runner iniciado - Tarea {tarea.id}\n")
                            f.flush()

                        # Configurar logger V3 para logs adicionales
                        v3_logger = logging.getLogger(f"likewize.v3.{tarea.id}")
                        v3_logger.setLevel(logging.INFO)
                        v3_logger.handlers.clear()

                        # Handler para archivo V3
                        v3_fh = logging.FileHandler(log_path, encoding="utf-8")
                        v3_fh.setFormatter(logging.Formatter("[%(asctime)s] %(message)s"))
                        v3_logger.addHandler(v3_fh)
                        v3_logger.propagate = False

                        # Configurar interceptor para logs del comando original
                        original_logger = logging.getLogger(f"likewize.{tarea.id}")
                        original_logger.setLevel(logging.INFO)
                        original_logger.handlers.clear()

                        # Handler compartido para logs del comando original
                        shared_fh = logging.FileHandler(log_path, encoding="utf-8")
                        shared_fh.setFormatter(logging.Formatter("[%(asctime)s] %(message)s"))
                        original_logger.addHandler(shared_fh)
                        original_logger.propagate = False

                        # Log inicial V3
                        v3_logger.info("🚀 Iniciando actualización V3 con autoaprendizaje...")
                        v3_logger.info(f"Tarea ID: {tarea.id}")
                        v3_logger.info(f"Parámetros V3: learning={enable_learning}, threshold={confidence_threshold}, parallel={parallel_requests}")

                        # Actualizar estado a RUNNING - CRÍTICO: hacer esto ANTES del call_command
                        v3_logger.info("📝 Actualizando estado de tarea a RUNNING...")
                        current_tarea = TareaActualizacionLikewize.objects.get(pk=tarea.id)
                        current_tarea.estado = 'RUNNING'
                        current_tarea.iniciado_en = timezone.now()
                        current_tarea.save()
                        v3_logger.info(f"✅ Estado actualizado a RUNNING en {current_tarea.iniciado_en}")

                        v3_logger.info("🔧 Ejecutando comando actualizar_likewize...")
                        v3_logger.info(f"Parámetros: mode=apple, mapping_system=v2, categories={categories}")

                        # Ejecutar comando usando call_command como V1
                        # IMPORTANTE: Para V3 queremos usar mapping_system='v2' para mejorar datos
                        # pero si falla demasiado, podemos volver a 'v1'
                        cmd_kwargs = {
                            'tarea': str(tarea.id),
                            'mode': 'apple',
                            'mapping_system': 'v2'  # Usar V2 para V3 para mejor mapeo
                        }

                        # Añadir brands si están especificados
                        if categories:
                            # V3 usa categories pero el comando espera brands
                            cmd_kwargs['brands'] = categories
                            v3_logger.info(f"Añadiendo brands: {categories}")

                        v3_logger.info(f"Ejecutando call_command con: {cmd_kwargs}")

                        # CRÍTICO: Asegurar que existe el comando y está disponible
                        from django.core.management import get_commands
                        available_commands = get_commands()
                        if 'actualizar_likewize' not in available_commands:
                            raise Exception("Comando 'actualizar_likewize' no encontrado en Django")

                        v3_logger.info(f"✅ Comando 'actualizar_likewize' encontrado")

                        try:
                            v3_logger.info("🏃 Iniciando call_command...")
                            v3_logger.info(f"📋 Argumentos finales: tarea={cmd_kwargs['tarea']}, mode={cmd_kwargs['mode']}, mapping_system={cmd_kwargs['mapping_system']}")
                            if 'brands' in cmd_kwargs:
                                v3_logger.info(f"📋 Brands: {cmd_kwargs['brands']}")

                            call_command('actualizar_likewize', **cmd_kwargs)
                            v3_logger.info("📝 Comando call_command ejecutado sin excepciones")
                        except Exception as cmd_error:
                            v3_logger.error(f"❌ Error en call_command: {str(cmd_error)}")
                            v3_logger.error(f"❌ Tipo de error: {type(cmd_error).__name__}")
                            v3_logger.error(f"❌ Argumentos que causaron error: {cmd_kwargs}")
                            import traceback
                            v3_logger.error(f"❌ Traceback completo: {traceback.format_exc()}")

                            # Si el error es por mapping_system v2, intentar con v1 como fallback
                            if 'mapping_system' in str(cmd_error) or 'v2' in str(cmd_error):
                                v3_logger.warning("🔄 Intentando fallback con mapping_system='v1'...")
                                cmd_kwargs_fallback = cmd_kwargs.copy()
                                cmd_kwargs_fallback['mapping_system'] = 'v1'

                                try:
                                    call_command('actualizar_likewize', **cmd_kwargs_fallback)
                                    v3_logger.info("✅ Fallback a V1 exitoso")
                                except Exception as fallback_error:
                                    v3_logger.error(f"❌ Error también en fallback V1: {str(fallback_error)}")
                                    raise fallback_error
                            else:
                                raise

                        # Si llegamos aquí, el comando se ejecutó sin excepciones
                        v3_logger.info("🔄 Actualizando estado final de la tarea...")
                        final_tarea = TareaActualizacionLikewize.objects.get(pk=tarea.id)
                        final_tarea.estado = 'SUCCESS'  # Usar SUCCESS para compatibilidad con DiffLikewizeView
                        final_tarea.finalizado_en = timezone.now()
                        final_tarea.save()

                        v3_logger.info("✅ Actualización V3 completada exitosamente")

                    except Exception as e:
                        # Error en la ejecución
                        try:
                            error_tarea = TareaActualizacionLikewize.objects.get(pk=tarea.id)
                            error_tarea.estado = 'ERROR'
                            error_tarea.error_message = f'Error en comando V3: {str(e)}'
                            error_tarea.finalizado_en = timezone.now()
                            error_tarea.save()

                            # Log del error con más detalles
                            if v3_logger:
                                v3_logger.error(f"❌ Error en actualización V3: {str(e)}")
                                v3_logger.error(f"❌ Tipo de error: {type(e).__name__}")
                                import traceback
                                v3_logger.error(f"❌ Traceback completo: {traceback.format_exc()}")
                            else:
                                # Fallback si no hay logger configurado
                                with open(log_path, 'a', encoding='utf-8') as f:
                                    f.write(f"[{timezone.now().isoformat()}] ❌ Error en actualización V3: {str(e)}\n")
                                    f.write(f"[{timezone.now().isoformat()}] ❌ Tipo: {type(e).__name__}\n")
                                    import traceback
                                    f.write(f"[{timezone.now().isoformat()}] ❌ Traceback: {traceback.format_exc()}\n")
                        except Exception as save_error:
                            # Error al guardar el error - registrar en archivo
                            with open(log_path, 'a', encoding='utf-8') as f:
                                f.write(f"[{timezone.now().isoformat()}] ❌ ERROR CRÍTICO: No se pudo actualizar estado de error: {str(save_error)}\n")
                                f.write(f"[{timezone.now().isoformat()}] ❌ Error original: {str(e)}\n")

                    finally:
                        # Limpiar handlers SIEMPRE
                        try:
                            if original_logger:
                                original_logger.handlers.clear()
                            if v3_logger:
                                v3_logger.handlers.clear()
                        except:
                            pass

                        # Log final de debug
                        try:
                            with open(log_path, 'a', encoding='utf-8') as f:
                                f.write(f"[{timezone.now().isoformat()}] 🏁 V3 Runner finalizado\n")
                        except:
                            pass

                # Iniciar ejecución en hilo NO daemon para evitar terminación prematura
                runner_thread = Thread(target=_runner, daemon=False)
                runner_thread.start()

                # Log inmediato para confirmar que el hilo se inició
                with open(log_path, 'a', encoding='utf-8') as f:
                    f.write(f"[{timezone.now().isoformat()}] 🧵 Thread iniciado, ID: {runner_thread.ident}\n")

                # Estado inicial
                tarea.estado = 'PENDING'
                tarea.save()

            except Exception as e:
                tarea.estado = 'ERROR'
                tarea.error_message = f'Error lanzando V3: {str(e)}'
                tarea.save()
                raise

            return Response({
                'success': True,
                'tarea_id': str(tarea.id),
                'message': 'Actualización V3 lanzada correctamente',
                'parameters': cmd_params
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'message': 'Error al lanzar la actualización V3'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LearningMetricsView(APIView):
    """
    Métricas del sistema de autoaprendizaje
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id=None):
        if tarea_id:
            return self._get_task_metrics(tarea_id)
        else:
            return self._get_global_metrics()

    def _get_task_metrics(self, tarea_id):
        """Métricas específicas de una tarea"""
        try:
            tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
        except TareaActualizacionLikewize.DoesNotExist:
            return Response(
                {"detail": "Tarea no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Métricas de staging
        staging_stats = LikewizeItemStaging.objects.filter(tarea=tarea).aggregate(
            total_items=Count('id'),
            mapped_items=Count('id', filter=Q(capacidad_id__isnull=False)),
            high_confidence=Count('id', filter=Q(confidence_score__gte=0.9)),
            medium_confidence=Count('id', filter=Q(
                confidence_score__gte=0.7,
                confidence_score__lt=0.9
            )),
            low_confidence=Count('id', filter=Q(confidence_score__lt=0.7)),
            avg_confidence=Avg('confidence_score')
        )

        # Métricas de aprendizaje
        learning_sessions = LearningSession.objects.filter(tarea=tarea)
        session_stats = learning_sessions.aggregate(
            total_learned=Count('items_learned'),
            total_predicted=Count('items_predicted'),
            avg_accuracy=Avg('prediction_accuracy'),
            total_processing_time=Avg('processing_time_seconds')
        )

        # Distribución por tipos de dispositivo
        device_distribution = list(
            LikewizeItemStaging.objects.filter(tarea=tarea)
            .values('tipo')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Confianza por tipo de dispositivo
        confidence_by_type = list(
            LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=False)
            .values('tipo')
            .annotate(
                avg_confidence=Avg('confidence_score'),
                count=Count('id')
            )
            .order_by('-avg_confidence')
        )

        return Response({
            'tarea_id': tarea_id,
            'tarea_estado': tarea.estado,
            'staging_metrics': staging_stats,
            'learning_metrics': session_stats,
            'device_distribution': device_distribution,
            'confidence_by_type': confidence_by_type,
            'mapping_rate': (
                staging_stats['mapped_items'] / staging_stats['total_items']
                if staging_stats['total_items'] > 0 else 0
            )
        })

    def _get_global_metrics(self):
        """Métricas globales del sistema"""
        # Métricas de base de conocimiento
        kb_stats = LikewizeKnowledgeBase.objects.aggregate(
            total_entries=Count('id'),
            high_confidence_entries=Count('id', filter=Q(confidence_score__gte=0.9)),
            user_validated_entries=Count('id', filter=Q(user_validated=True)),
            auto_learned_entries=Count('id', filter=Q(auto_learned=True)),
            avg_confidence=Avg('confidence_score'),
            avg_success_rate=Avg('success_rate'),
            most_used_entry_uses=Max('times_used')
        )

        # Métricas de correcciones (últimos 30 días)
        thirty_days_ago = timezone.now() - timedelta(days=30)
        correction_stats = MappingCorrection.objects.filter(
            created_at__gte=thirty_days_ago
        ).aggregate(
            total_corrections=Count('id'),
            avg_original_confidence=Avg('original_confidence')
        )

        # Tendencia de aprendizaje (último mes)
        learning_trend = self._calculate_learning_trend()

        # Top modelos corregidos
        most_corrected_models = list(
            MappingCorrection.objects
            .filter(created_at__gte=thirty_days_ago)
            .values('likewize_data__ModelName')
            .annotate(correction_count=Count('id'))
            .order_by('-correction_count')[:10]
        )

        # Rendimiento por marca
        performance_by_brand = self._calculate_brand_performance()

        return Response({
            'knowledge_base_metrics': kb_stats,
            'correction_metrics': correction_stats,
            'learning_trend': learning_trend,
            'most_corrected_models': most_corrected_models,
            'performance_by_brand': performance_by_brand,
            'system_health': self._calculate_system_health(kb_stats)
        })

    def _calculate_learning_trend(self):
        """Calcula tendencia de aprendizaje por semana"""
        from django.db.models.functions import TruncWeek

        four_weeks_ago = timezone.now() - timedelta(weeks=4)

        weekly_stats = (
            LikewizeKnowledgeBase.objects
            .filter(created_at__gte=four_weeks_ago)
            .annotate(week=TruncWeek('created_at'))
            .values('week')
            .annotate(
                entries_created=Count('id'),
                avg_confidence=Avg('confidence_score')
            )
            .order_by('week')
        )

        return list(weekly_stats)

    def _calculate_brand_performance(self):
        """Calcula rendimiento por marca"""
        return list(
            LikewizeKnowledgeBase.objects
            .values('local_modelo__marca')
            .annotate(
                total_mappings=Count('id'),
                avg_confidence=Avg('confidence_score'),
                avg_success_rate=Avg('success_rate'),
                user_validated_count=Count('id', filter=Q(user_validated=True))
            )
            .order_by('-total_mappings')
        )

    def _calculate_system_health(self, kb_stats):
        """Calcula salud general del sistema"""
        total_entries = kb_stats['total_entries'] or 0
        if total_entries == 0:
            return {'score': 0, 'status': 'no_data', 'recommendations': []}

        # Factores de salud
        confidence_score = (kb_stats['avg_confidence'] or 0) * 100
        validation_rate = (
            (kb_stats['user_validated_entries'] or 0) / total_entries * 100
        )
        high_confidence_rate = (
            (kb_stats['high_confidence_entries'] or 0) / total_entries * 100
        )

        # Score ponderado
        health_score = (
            confidence_score * 0.4 +
            validation_rate * 0.3 +
            high_confidence_rate * 0.3
        )

        # Determinar estado
        if health_score >= 80:
            status_text = 'excellent'
        elif health_score >= 60:
            status_text = 'good'
        elif health_score >= 40:
            status_text = 'fair'
        else:
            status_text = 'poor'

        # Recomendaciones
        recommendations = []
        if confidence_score < 70:
            recommendations.append('Revisar y corregir mapeos de baja confianza')
        if validation_rate < 20:
            recommendations.append('Incrementar validación manual de mapeos')
        if high_confidence_rate < 50:
            recommendations.append('Optimizar algoritmos de mapeo')

        return {
            'score': round(health_score, 1),
            'status': status_text,
            'confidence_score': round(confidence_score, 1),
            'validation_rate': round(validation_rate, 1),
            'high_confidence_rate': round(high_confidence_rate, 1),
            'recommendations': recommendations
        }


class ReviewMappingView(APIView):
    """
    Revisión y corrección de mapeos
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        """Obtiene items que necesitan revisión"""
        limit = int(request.query_params.get('limit', 50))
        confidence_threshold = float(request.query_params.get('confidence', 0.7))

        # feedback_system = FeedbackSystem()
        # entries_needing_review = feedback_system.get_entries_needing_review(limit)
        entries_needing_review = []  # Temporary placeholder

        # Convertir a formato serializable
        review_items = []
        for entry in entries_needing_review:
            review_items.append({
                'id': entry.id,
                'likewize_model_name': entry.likewize_model_name,
                'likewize_capacity': entry.likewize_capacity,
                'current_mapping': {
                    'modelo': entry.local_modelo.descripcion,
                    'capacidad': entry.local_capacidad.tamaño,
                    'capacidad_id': entry.local_capacidad.id
                },
                'confidence_score': entry.confidence_score,
                'times_used': entry.times_used,
                'success_rate': entry.success_rate,
                'features': entry.features
            })

        return Response({
            'items_for_review': review_items,
            'total_count': len(review_items),
            'confidence_threshold': confidence_threshold
        })

    def post(self, request):
        """Aplica correcciones a mapeos"""
        corrections = request.data.get('corrections', [])
        if not corrections:
            return Response(
                {"detail": "No se proporcionaron correcciones"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # feedback_system = FeedbackSystem()
        applied_corrections = []

        for correction_data in corrections:
            try:
                # Validar datos de corrección
                kb_entry_id = correction_data.get('kb_entry_id')
                capacidad_id = correction_data.get('capacidad_id')
                reason = correction_data.get('reason', '')

                if not kb_entry_id or not capacidad_id:
                    continue

                # Obtener objetos
                kb_entry = LikewizeKnowledgeBase.objects.get(id=kb_entry_id)
                capacidad = Capacidad.objects.get(id=capacidad_id)

                # Crear datos de Likewize simulados para el feedback
                likewize_item = {
                    'ModelName': kb_entry.likewize_model_name,
                    'M_Model': kb_entry.likewize_m_model,
                    'Capacity': kb_entry.likewize_capacity,
                    'PhoneModelId': kb_entry.likewize_phone_model_id,
                    'FullName': kb_entry.likewize_full_name
                }

                # Aplicar corrección
                # correction = feedback_system.record_manual_correction(
                #     likewize_item=likewize_item,
                #     capacidad_correcta=capacidad,
                #     user=request.user,
                #     correction_reason=reason
                # )
                # Temporary placeholder
                correction = type('obj', (object,), {'id': 1})()

                applied_corrections.append({
                    'id': correction.id,
                    'kb_entry_id': kb_entry_id,
                    'success': True
                })

            except Exception as e:
                applied_corrections.append({
                    'kb_entry_id': correction_data.get('kb_entry_id'),
                    'success': False,
                    'error': str(e)
                })

        return Response({
            'applied_corrections': applied_corrections,
            'total_applied': len([c for c in applied_corrections if c['success']]),
            'total_failed': len([c for c in applied_corrections if not c['success']])
        })


class KnowledgeBaseStatsView(APIView):
    """
    Estadísticas detalladas de la base de conocimiento
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        # Distribución de confianza
        confidence_distribution = self._get_confidence_distribution()

        # Entradas más utilizadas
        most_used_entries = list(
            LikewizeKnowledgeBase.objects
            .select_related('local_modelo', 'local_capacidad')
            .order_by('-times_used')[:20]
            .values(
                'likewize_model_name',
                'local_modelo__descripcion',
                'local_capacidad__tamaño',
                'times_used',
                'confidence_score',
                'user_validated'
            )
        )

        # Estadísticas por dispositivo
        device_stats = list(
            LikewizeKnowledgeBase.objects
            .values('local_modelo__tipo')
            .annotate(
                count=Count('id'),
                avg_confidence=Avg('confidence_score'),
                avg_success_rate=Avg('success_rate')
            )
            .order_by('-count')
        )

        # Patrones de características más exitosos
        successful_patterns = list(
            FeaturePattern.objects
            .filter(is_active=True)
            .annotate(success_rate=F('success_count') / F('times_applied'))
            .filter(success_rate__gte=0.8)
            .order_by('-success_rate')[:10]
            .values(
                'pattern_name',
                'pattern_type',
                'times_applied',
                'success_count',
                'success_rate'
            )
        )

        return Response({
            'confidence_distribution': confidence_distribution,
            'most_used_entries': most_used_entries,
            'device_statistics': device_stats,
            'successful_patterns': successful_patterns,
            'summary': {
                'total_kb_entries': LikewizeKnowledgeBase.objects.count(),
                'total_patterns': FeaturePattern.objects.filter(is_active=True).count(),
                'avg_system_confidence': LikewizeKnowledgeBase.objects.aggregate(
                    avg=Avg('confidence_score')
                )['avg'] or 0
            }
        })

    def _get_confidence_distribution(self):
        """Obtiene distribución de confianza en rangos"""
        ranges = [
            (0.0, 0.3, 'very_low'),
            (0.3, 0.5, 'low'),
            (0.5, 0.7, 'medium'),
            (0.7, 0.9, 'high'),
            (0.9, 1.0, 'very_high')
        ]

        distribution = []
        for min_val, max_val, label in ranges:
            count = LikewizeKnowledgeBase.objects.filter(
                confidence_score__gte=min_val,
                confidence_score__lt=max_val
            ).count()

            distribution.append({
                'range': f"{min_val}-{max_val}",
                'label': label,
                'count': count
            })

        return distribution


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def cleanup_knowledge_base(request):
    """
    Limpia entradas de baja calidad de la base de conocimiento
    """
    threshold = float(request.data.get('confidence_threshold', 0.3))
    min_uses = int(request.data.get('min_uses', 5))
    dry_run = request.data.get('dry_run', True)

    # learning_engine = AutoLearningEngine()

    if dry_run:
        # Solo contar qué se eliminaría
        to_delete = LikewizeKnowledgeBase.objects.filter(
            confidence_score__lt=threshold,
            times_used__gte=min_uses,
            user_validated=False
        )

        return Response({
            'dry_run': True,
            'entries_to_delete': to_delete.count(),
            'threshold': threshold,
            'min_uses': min_uses
        })
    else:
        # Ejecutar limpieza real
        # deleted_count = learning_engine.cleanup_low_confidence_entries(
        #     threshold=threshold,
        #     min_uses=min_uses
        # )
        deleted_count = 0  # Temporary placeholder

        return Response({
            'dry_run': False,
            'deleted_entries': deleted_count,
            'threshold': threshold,
            'min_uses': min_uses
        })


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def export_learning_data(request):
    """
    Exporta datos de aprendizaje para análisis externo
    """
    # feedback_system = FeedbackSystem()
    # data = feedback_system.export_learning_data()
    data = {
        'knowledge_base_entries': [],
        'corrections': [],
        'feature_patterns': []
    }  # Temporary placeholder

    return Response({
        'export_timestamp': timezone.now().isoformat(),
        'data': data,
        'summary': {
            'knowledge_base_entries': len(data['knowledge_base_entries']),
            'corrections': len(data['corrections']),
            'feature_patterns': len(data['feature_patterns'])
        }
    })


class TaskLogV3View(APIView):
    """
    Vista para leer logs de tareas V3 en tiempo real
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id):
        """Obtiene los logs de una tarea V3"""
        try:
            # Obtener la tarea
            tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)

            # Debug info para troubleshooting
            debug_info = {
                'tarea_id': str(tarea_id),
                'estado': tarea.estado,
                'log_path': tarea.log_path,
                'log_exists': tarea.log_path and os.path.exists(tarea.log_path) if tarea.log_path else False,
                'meta': tarea.meta,
                'iniciado_en': tarea.iniciado_en.isoformat() if tarea.iniciado_en else None,
                'finalizado_en': tarea.finalizado_en.isoformat() if tarea.finalizado_en else None
            }

            if not tarea.log_path or not os.path.exists(tarea.log_path):
                return Response({
                    'success': False,
                    'error': 'Log file not found',
                    'debug_info': debug_info
                }, status=status.HTTP_404_NOT_FOUND)

            # Leer parámetros
            lines = int(request.query_params.get('lines', 100))  # Últimas N líneas
            offset = int(request.query_params.get('offset', 0))  # Offset desde el final

            # Leer el archivo de log
            try:
                with open(tarea.log_path, 'r', encoding='utf-8') as f:
                    all_lines = f.readlines()

                # Aplicar offset y limit
                if offset > 0:
                    # Desde el final, saltar las últimas N líneas
                    end_index = len(all_lines) - offset
                    start_index = max(0, end_index - lines)
                    log_lines = all_lines[start_index:end_index]
                else:
                    # Últimas N líneas
                    log_lines = all_lines[-lines:] if lines > 0 else all_lines

                # Calcular estadísticas del log
                total_lines = len(all_lines)
                current_size = sum(len(line.encode('utf-8')) for line in all_lines)

                return Response({
                    'success': True,
                    'tarea_id': str(tarea_id),
                    'estado': tarea.estado,
                    'iniciado_en': tarea.iniciado_en.isoformat() if tarea.iniciado_en else None,
                    'finalizado_en': tarea.finalizado_en.isoformat() if tarea.finalizado_en else None,
                    'log_stats': {
                        'total_lines': total_lines,
                        'current_size_bytes': current_size,
                        'returned_lines': len(log_lines),
                        'offset': offset
                    },
                    'log_content': ''.join(log_lines),
                    'log_lines': [line.rstrip('\n') for line in log_lines]
                })

            except Exception as e:
                return Response({
                    'success': False,
                    'error': f'Error reading log file: {str(e)}',
                    'tarea_id': str(tarea_id)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except TareaActualizacionLikewize.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Task not found',
                'tarea_id': str(tarea_id)
            }, status=status.HTTP_404_NOT_FOUND)


class TaskStatusV3View(APIView):
    """
    Vista para consultar el estado de tareas V3
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id=None):
        """Obtiene el estado de una tarea específica o lista de tareas activas"""

        if tarea_id:
            # Estado de una tarea específica
            try:
                tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)

                # Información básica de la tarea
                task_info = {
                    'tarea_id': str(tarea.id),
                    'estado': tarea.estado,
                    'iniciado_en': tarea.iniciado_en.isoformat() if tarea.iniciado_en else None,
                    'finalizado_en': tarea.finalizado_en.isoformat() if tarea.finalizado_en else None,
                    'error_message': tarea.error_message,
                    'log_path': tarea.log_path,
                    'meta': tarea.meta or {}
                }

                # Estadísticas adicionales si es V3
                if tarea.meta and tarea.meta.get('fuente') == 'likewize_v3':
                    task_info['is_v3'] = True
                    task_info['v3_params'] = {
                        'enable_learning': tarea.meta.get('enable_learning'),
                        'confidence_threshold': tarea.meta.get('confidence_threshold'),
                        'parallel_requests': tarea.meta.get('parallel_requests'),
                        'categories': tarea.meta.get('categories')
                    }

                    # Si hay log disponible, incluir resumen
                    if tarea.log_path and os.path.exists(tarea.log_path):
                        try:
                            with open(tarea.log_path, 'r', encoding='utf-8') as f:
                                lines = f.readlines()

                            task_info['log_summary'] = {
                                'total_lines': len(lines),
                                'file_size_bytes': os.path.getsize(tarea.log_path),
                                'last_updated': timezone.datetime.fromtimestamp(
                                    os.path.getmtime(tarea.log_path)
                                ).isoformat(),
                                'recent_activity': len([
                                    line for line in lines[-10:]
                                    if timezone.now().timestamp() -
                                    timezone.datetime.fromisoformat(line[1:20] if line.startswith('[') else '1970-01-01').timestamp() < 300
                                ]) > 0  # Actividad en los últimos 5 minutos
                            }
                        except:
                            task_info['log_summary'] = {'error': 'Could not read log file'}

                return Response({
                    'success': True,
                    'task': task_info
                })

            except TareaActualizacionLikewize.DoesNotExist:
                return Response({
                    'success': False,
                    'error': 'Task not found'
                }, status=status.HTTP_404_NOT_FOUND)

        else:
            # Lista de tareas V3 activas
            active_tasks = TareaActualizacionLikewize.objects.filter(
                estado__in=['PENDING', 'RUNNING'],
                meta__fuente='likewize_v3'
            ).order_by('-iniciado_en')[:10]

            tasks_info = []
            for tarea in active_tasks:
                task_summary = {
                    'tarea_id': str(tarea.id),
                    'estado': tarea.estado,
                    'iniciado_en': tarea.iniciado_en.isoformat() if tarea.iniciado_en else None,
                    'duracion_minutos': (
                        (timezone.now() - tarea.iniciado_en).total_seconds() / 60
                        if tarea.iniciado_en else None
                    ),
                    'has_log': bool(tarea.log_path and os.path.exists(tarea.log_path)),
                    'v3_params': {
                        'enable_learning': tarea.meta.get('enable_learning') if tarea.meta else None,
                        'confidence_threshold': tarea.meta.get('confidence_threshold') if tarea.meta else None
                    }
                }
                tasks_info.append(task_summary)

            return Response({
                'success': True,
                'active_tasks_count': len(tasks_info),
                'tasks': tasks_info
            })


class DiffV3View(APIView):
    """
    Vista de diferencias para V3 con comparación de modelos
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, tarea_id):
        try:
            tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
        except TareaActualizacionLikewize.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Tarea no encontrada'
            }, status=status.HTTP_404_NOT_FOUND)

        if tarea.estado != "SUCCESS":
            return Response({
                "detail": f"La tarea V3 aún no está lista. Estado actual: {tarea.estado}",
                "estado": tarea.estado,
                "is_v3": True
            }, status=status.HTTP_409_CONFLICT)

        try:
            # Obtener datos básicos de staging (sin confidence_score que no existe)
            staging_items = list(
                LikewizeItemStaging.objects
                .filter(tarea=tarea, capacidad_id__isnull=False)
                .values(
                    'id',
                    'capacidad_id',
                    'precio_b2b',
                    'tipo',
                    'modelo_norm',
                    'modelo_raw',
                    'marca',
                    'likewize_model_code',
                    'almacenamiento_gb'
                )
            )

            # Preparar respuesta básica
            comparisons = []
            inserts = []
            updates = []

            # Obtener información de precios actual de forma simple
            try:
                from productos.models import PrecioRecompra
            except ImportError:
                from django.apps import apps
                PrecioRecompra = apps.get_model('productos.PrecioRecompra')

            precios_actuales = {}
            if staging_items:
                # Para PrecioRecompra necesitamos filtrar por canal B2B y vigentes
                for precio in PrecioRecompra.objects.filter(
                    capacidad_id__in=[item['capacidad_id'] for item in staging_items],
                    canal='B2B',
                    valid_to__isnull=True  # Solo precios vigentes
                ).values('capacidad_id', 'precio_neto'):
                    precios_actuales[precio['capacidad_id']] = precio

            # Obtener información real de capacidades y modelos desde la BD
            capacidades_info = {}
            if staging_items:
                from django.apps import apps
                from django.conf import settings

                CapacidadModel = apps.get_model(getattr(settings, 'CAPACIDAD_MODEL', 'checkouters.Capacidad'))
                rel_field = getattr(settings, 'CAPACIDAD_REL_MODEL_FIELD', 'modelo')

                try:
                    # Obtener capacidades con sus modelos relacionados
                    for cap in CapacidadModel.objects.filter(
                        id__in=[item['capacidad_id'] for item in staging_items]
                    ).select_related(rel_field):
                        modelo = getattr(cap, rel_field, None)
                        capacidades_info[cap.id] = {
                            'descripcion': getattr(modelo, 'descripcion', None) if modelo else None,
                            'marca': getattr(modelo, 'marca', None) if modelo else None,
                            'capacidad': getattr(cap, getattr(settings, 'CAPACIDAD_GB_FIELD', 'tamaño'), None)
                        }
                except Exception as e:
                    # Si falla, seguir con diccionario vacío
                    pass

            # Procesar cada item de staging
            for item in staging_items:
                cap_id = item['capacidad_id']
                precio_actual = precios_actuales.get(cap_id)
                precio_nuevo = item.get('precio_b2b')

                # Crear datos de comparación básicos
                comparison_data = {
                    'id': cap_id,  # Añadir ID que espera el frontend
                    'staging_item_id': item.get('id'),  # ID del LikewizeItemStaging para correcciones manuales
                    'capacidad_id': cap_id,
                    'capacidad_descripcion': f"Capacidad ID {cap_id}",

                    'likewize_info': {
                        'modelo_raw': item.get('modelo_raw', 'N/A'),
                        'modelo_norm': item.get('modelo_norm', 'N/A'),
                        'marca': item.get('marca', 'N/A'),
                        'tipo': item.get('tipo', 'N/A'),
                        'almacenamiento_gb': item.get('almacenamiento_gb')
                    },

                    'bd_info': {
                        'modelo_descripcion': capacidades_info.get(cap_id, {}).get('descripcion') or 'Información no disponible',
                        'marca': capacidades_info.get(cap_id, {}).get('marca') or item.get('marca', 'N/A'),
                        'capacidad': capacidades_info.get(cap_id, {}).get('capacidad') or f"ID {cap_id}"
                    },

                    'precio_info': {
                        'precio_actual': precio_actual['precio_neto'] if precio_actual else None,
                        'precio_nuevo': float(precio_nuevo) if precio_nuevo else None
                    },

                    'v3_metrics': {
                        'confidence_score': 0.85  # Valor fijo por ahora ya que no existe el campo
                    }
                }

                # Determinar tipo de cambio
                if not precio_actual:
                    comparison_data['change_type'] = 'INSERT'
                    inserts.append(comparison_data)
                elif precio_actual and precio_actual['precio_neto'] != precio_nuevo:
                    comparison_data['change_type'] = 'UPDATE'
                    comparison_data['precio_info']['diferencia'] = (
                        float(precio_nuevo) - float(precio_actual['precio_neto'])
                        if precio_nuevo and precio_actual['precio_neto'] else 0
                    )
                    updates.append(comparison_data)
                else:
                    comparison_data['change_type'] = 'NO_CHANGE'

                comparisons.append(comparison_data)

            # Estadísticas básicas (valores simulados ya que no existe confidence_score)
            confidence_stats = {
                'promedio': 0.85,  # Valor fijo simulado
                'alta_confianza': len(staging_items) if staging_items else 0,  # Simulamos que todos tienen alta confianza
                'media_confianza': 0,
                'baja_confianza': 0
            }

            return Response({
                'success': True,
                'tarea_id': str(tarea_id),
                'is_v3': True,
                'estado': tarea.estado,
                'meta': tarea.meta,

                'resumen': {
                    'total_comparaciones': len(comparisons),
                    'inserciones': len(inserts),
                    'actualizaciones': len(updates),
                    'eliminaciones': 0,  # Por simplicidad, no calculamos eliminaciones
                    'sin_cambios': len([c for c in comparisons if c['change_type'] == 'NO_CHANGE'])
                },

                # Para compatibilidad con frontend existente que espera 'summary'
                'summary': {
                    'total': len(comparisons),
                    'inserts': len(inserts),
                    'updates': len(updates),
                    'deletes': 0,  # Por simplicidad, no calculamos eliminaciones
                    'no_changes': len([c for c in comparisons if c['change_type'] == 'NO_CHANGE'])
                },

                'v3_stats': {
                    'confidence_stats': confidence_stats,
                    'mapping_system': tarea.meta.get('mapping_system') if tarea.meta else 'unknown'
                },

                'comparaciones': comparisons,
                'inserciones': inserts,
                'actualizaciones': updates,
                'eliminaciones': [],

                # Para compatibilidad con frontend existente que espera 'changes'
                'changes': inserts + updates,  # Combinamos inserts y updates para el listado

                # Para compatibilidad con frontend existente
                'diff_data': {
                    'inserts': inserts,
                    'updates': updates,
                    'deletes': []
                }
            })

        except Exception as e:
            import traceback
            return Response({
                'success': False,
                'error': f'Error procesando diff V3: {str(e)}',
                'tarea_id': str(tarea_id),
                'is_v3': True,
                'debug_info': {
                    'error_type': type(e).__name__,
                    'traceback': traceback.format_exc()[-500:]
                }
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AplicarCambiosV3View(APIView):
    """
    Vista para aplicar cambios de precios V3
    """
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, tarea_id):
        """Aplica los cambios de precios de V3"""
        try:
            tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
        except TareaActualizacionLikewize.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Tarea no encontrada'
            }, status=status.HTTP_404_NOT_FOUND)

        if tarea.estado != "SUCCESS":
            return Response({
                "detail": f"La tarea V3 no está lista para aplicar cambios. Estado: {tarea.estado}",
                "estado": tarea.estado
            }, status=status.HTTP_409_CONFLICT)

        # Parámetros de aplicación
        aplicar_inserciones = request.data.get('aplicar_inserciones', True)
        aplicar_actualizaciones = request.data.get('aplicar_actualizaciones', True)
        aplicar_eliminaciones = request.data.get('aplicar_eliminaciones', False)  # Por defecto False para seguridad
        staging_item_ids = request.data.get('staging_item_ids', None)  # IDs específicos a aplicar (None = todos)

        # Filtros de confianza
        confidence_threshold = float(request.data.get('confidence_threshold', 0.7))

        try:
            from django.apps import apps
            from django.conf import settings
            from django.db import transaction

            # Obtener modelo de precios
            PrecioRecompra = apps.get_model(getattr(settings, "PRECIOS_B2B_MODEL", "productos.PrecioRecompra"))

            # Estadísticas de aplicación
            stats = {
                'inserciones_aplicadas': 0,
                'actualizaciones_aplicadas': 0,
                'eliminaciones_aplicadas': 0,
                'errores': []
            }

            with transaction.atomic():
                # Obtener datos de staging (sin filtro de confianza ya que no existe el campo)
                staging_query = LikewizeItemStaging.objects.filter(
                    tarea=tarea,
                    capacidad_id__isnull=False
                )

                # Si se especifican IDs específicos, filtrar solo esos
                if staging_item_ids is not None:
                    staging_query = staging_query.filter(id__in=staging_item_ids)

                staging_items = staging_query.values(
                    'capacidad_id',
                    'precio_b2b'
                )

                # Obtener precios actuales (solo B2B vigentes)
                precios_existentes = {
                    p['capacidad_id']: p for p in
                    PrecioRecompra.objects.filter(
                        capacidad_id__in=[item['capacidad_id'] for item in staging_items],
                        canal='B2B',
                        valid_to__isnull=True  # Solo vigentes
                    ).values('id', 'capacidad_id', 'precio_neto')
                }

                for item in staging_items:
                        cap_id = item['capacidad_id']
                        precio_nuevo = item['precio_b2b']
                        confidence = 0.85  # Valor fijo ya que no existe el campo confidence_score

                        if not precio_nuevo:
                            continue

                        try:
                            precio_existente = precios_existentes.get(cap_id)

                            if not precio_existente and aplicar_inserciones:
                                # Inserción
                                PrecioRecompra.objects.create(
                                    capacidad_id=cap_id,
                                    canal='B2B',
                                    fuente='likewize',
                                    precio_neto=precio_nuevo,
                                    valid_from=timezone.now()
                                )
                                stats['inserciones_aplicadas'] += 1

                            elif precio_existente and aplicar_actualizaciones:
                                # Actualización
                                if precio_existente['precio_neto'] != precio_nuevo:
                                    PrecioRecompra.objects.filter(id=precio_existente['id']).update(
                                        precio_neto=precio_nuevo,
                                        updated_at=timezone.now()
                                    )
                                    stats['actualizaciones_aplicadas'] += 1

                        except Exception as e:
                            stats['errores'].append({
                                'capacidad_id': cap_id,
                                'error': str(e),
                                'confidence': confidence
                            })

                # Aplicar eliminaciones si se solicitó
                if aplicar_eliminaciones:
                    # Obtener capacidades que ya no están en staging
                    capacidades_staging = {item['capacidad_id'] for item in staging_items}

                    # Eliminar precios de capacidades que ya no están en Likewize
                    # (Solo para las marcas procesadas en esta tarea)
                    marcas_procesadas = LikewizeItemStaging.objects.filter(tarea=tarea).values_list('marca', flat=True).distinct()

                    eliminaciones = PrecioRecompra.objects.filter(
                        capacidad__modelo__marca__in=marcas_procesadas,
                        canal='B2B',
                        fuente='likewize',
                        valid_to__isnull=True  # Solo vigentes
                    ).exclude(
                        capacidad_id__in=capacidades_staging
                    )

                    count_eliminaciones = eliminaciones.count()
                    eliminaciones.delete()
                    stats['eliminaciones_aplicadas'] = count_eliminaciones

                # Marcar tarea como aplicada
                tarea.estado = 'APPLIED'
                tarea.finalizado_en = timezone.now()
                tarea.save()

            return Response({
                'success': True,
                'tarea_id': str(tarea_id),
                'is_v3': True,
                'aplicado_en': timezone.now().isoformat(),
                'configuracion': {
                    'aplicar_inserciones': aplicar_inserciones,
                    'aplicar_actualizaciones': aplicar_actualizaciones,
                    'aplicar_eliminaciones': aplicar_eliminaciones,
                    'confidence_threshold': confidence_threshold
                },
                'estadisticas': stats
            })

        except Exception as e:
            return Response({
                'success': False,
                'error': f'Error aplicando cambios V3: {str(e)}',
                'tarea_id': str(tarea_id)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def get_unmapped_items(request, tarea_id):
    """
    GET /api/likewize/v3/tareas/<uuid:tarea_id>/no-mapeados/

    Retorna items de staging que no tienen capacidad_id (no se pudieron mapear)
    """
    try:
        from django.shortcuts import get_object_or_404

        tarea = get_object_or_404(TareaActualizacionLikewize, id=tarea_id)

        # Obtener items sin mapear
        unmapped = LikewizeItemStaging.objects.filter(
            tarea=tarea,
            capacidad_id__isnull=True
        ).values(
            'id',
            'modelo_raw',
            'modelo_norm',
            'marca',
            'tipo',
            'almacenamiento_gb',
            'precio_b2b',
            'likewize_model_code'
        ).order_by('modelo_norm', 'almacenamiento_gb')

        items_list = list(unmapped)

        return Response({
            'success': True,
            'tarea_id': str(tarea_id),
            'total_unmapped': len(items_list),
            'items': items_list
        })

    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)