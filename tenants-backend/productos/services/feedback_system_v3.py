import logging
from typing import Dict, List, Optional, Tuple
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model

from productos.models.autoaprendizaje import (
    LikewizeKnowledgeBase,
    MappingCorrection,
    LearningSession,
    FeaturePattern
)
from productos.models.modelos import Capacidad
from productos.services.feature_extractor_v3 import FeatureExtractor

User = get_user_model()
logger = logging.getLogger(__name__)


class FeedbackSystem:
    """
    Sistema de feedback para correcciones manuales y aprendizaje continuo
    """

    def __init__(self):
        self.feature_extractor = FeatureExtractor()

    @transaction.atomic
    def record_manual_correction(
        self,
        likewize_item: Dict,
        capacidad_correcta: Capacidad,
        user: User,
        correction_reason: str = ""
    ) -> MappingCorrection:
        """
        Registra una corrección manual y actualiza el sistema de aprendizaje
        """
        logger.info(
            f"Registrando corrección manual: {likewize_item.get('ModelName')} → {capacidad_correcta}"
        )

        # Extraer características del item de Likewize
        features = self.feature_extractor.extract_features(
            likewize_item.get('ModelName', '')
        )

        # Buscar mapeo incorrecto anterior
        old_kb_entry = LikewizeKnowledgeBase.objects.filter(
            likewize_model_name=likewize_item.get('ModelName', ''),
            likewize_capacity=likewize_item.get('Capacity', '')
        ).first()

        original_confidence = old_kb_entry.confidence_score if old_kb_entry else None

        # Crear o actualizar entrada correcta en base de conocimiento
        kb_entry, created = LikewizeKnowledgeBase.objects.update_or_create(
            likewize_model_name=likewize_item.get('ModelName', ''),
            likewize_capacity=likewize_item.get('Capacity', ''),
            defaults={
                'likewize_m_model': likewize_item.get('M_Model', ''),
                'likewize_phone_model_id': likewize_item.get('PhoneModelId'),
                'likewize_full_name': likewize_item.get('FullName', ''),
                'local_modelo': capacidad_correcta.modelo,
                'local_capacidad': capacidad_correcta,
                'user_validated': True,
                'confidence_score': 1.0,  # Máxima confianza para correcciones manuales
                'auto_learned': False,
                'created_by_correction': True,
                'features': features,
                'success_rate': 1.0,
                'times_used': 1 if created else old_kb_entry.times_used + 1
            }
        )

        # Registrar la corrección para auditoría
        correction = MappingCorrection.objects.create(
            likewize_data=likewize_item,
            original_mapping=old_kb_entry.local_capacidad if old_kb_entry else None,
            corrected_mapping=capacidad_correcta,
            corrected_by=user,
            correction_reason=correction_reason,
            kb_entry=kb_entry,
            original_confidence=original_confidence,
            correction_confidence=1.0
        )

        # Penalizar mapeos incorrectos similares
        self._penalize_similar_incorrect_mappings(features, capacidad_correcta)

        # Aprender patrones de la corrección
        self._learn_correction_patterns(likewize_item, capacidad_correcta, features)

        logger.info(f"Corrección registrada exitosamente: ID {correction.id}")
        return correction

    def _penalize_similar_incorrect_mappings(self, features: Dict, capacidad_correcta: Capacidad):
        """
        Reduce la confianza de mapeos similares que sean incorrectos
        """
        try:
            # Buscar entradas similares que no mapeen a la capacidad correcta
            similar_entries = LikewizeKnowledgeBase.objects.filter(
                user_validated=False,
                auto_learned=True
            ).exclude(local_capacidad=capacidad_correcta)

            penalized_count = 0

            for entry in similar_entries:
                if not entry.features:
                    continue

                # Calcular similitud
                similarity = self.feature_extractor.calculate_similarity(
                    features, entry.features
                )

                # Si es muy similar, penalizar
                if similarity > 0.85:
                    # Reducir confianza proporcionalmente a la similitud
                    penalty_factor = 0.5 + (similarity - 0.85) * 2  # 0.5 to 0.8
                    entry.confidence_score *= (1 - penalty_factor)
                    entry.success_rate *= 0.8  # Reducir tasa de éxito también

                    # Marcar como necesita revisión si la confianza es muy baja
                    if entry.confidence_score < 0.3:
                        entry.confidence_score = 0.1

                    entry.save(update_fields=['confidence_score', 'success_rate'])
                    penalized_count += 1

            if penalized_count > 0:
                logger.info(f"Penalizadas {penalized_count} entradas similares incorrectas")

        except Exception as e:
            logger.error(f"Error al penalizar mapeos similares: {e}")

    def _learn_correction_patterns(self, likewize_item: Dict, capacidad_correcta: Capacidad, features: Dict):
        """
        Aprende patrones de las correcciones para mejorar mapeos futuros
        """
        try:
            # Analizar qué características fueron clave en la corrección
            key_features = self._identify_key_features(features, capacidad_correcta)

            # Crear o actualizar patrones
            for feature_name, feature_value in key_features.items():
                pattern_name = f"correction_{feature_name}_{feature_value}"

                pattern, created = FeaturePattern.objects.get_or_create(
                    pattern_name=pattern_name,
                    defaults={
                        'pattern_type': 'correction',
                        'pattern_value': str(feature_value),
                        'confidence_threshold': 0.8,
                        'times_applied': 1,
                        'success_count': 1,
                        'is_active': True
                    }
                )

                if not created:
                    pattern.times_applied += 1
                    pattern.success_count += 1
                    pattern.save(update_fields=['times_applied', 'success_count'])

                logger.debug(f"Patrón de corrección actualizado: {pattern_name}")

        except Exception as e:
            logger.error(f"Error al aprender patrones de corrección: {e}")

    def _identify_key_features(self, features: Dict, capacidad: Capacidad) -> Dict:
        """
        Identifica las características clave que diferencian este mapeo
        """
        key_features = {}

        # Características críticas para el mapeo
        critical_features = [
            'device_type', 'storage_gb', 'processor_family', 'year',
            'has_pro', 'has_max', 'has_air', 'has_mini', 'generation'
        ]

        for feature in critical_features:
            if feature in features and features[feature] is not None:
                key_features[feature] = features[feature]

        return key_features

    def apply_batch_corrections(
        self,
        corrections: List[Dict],
        user: User
    ) -> List[MappingCorrection]:
        """
        Aplica múltiples correcciones en lote
        """
        results = []

        with transaction.atomic():
            for correction_data in corrections:
                try:
                    correction = self.record_manual_correction(
                        likewize_item=correction_data['likewize_item'],
                        capacidad_correcta=correction_data['capacidad_correcta'],
                        user=user,
                        correction_reason=correction_data.get('reason', '')
                    )
                    results.append(correction)

                except Exception as e:
                    logger.error(f"Error aplicando corrección: {e}")
                    # Continuar con las siguientes correcciones

        logger.info(f"Aplicadas {len(results)} correcciones en lote")
        return results

    def validate_kb_entry(self, kb_entry: LikewizeKnowledgeBase, user: User, is_correct: bool):
        """
        Permite a un usuario validar si un mapeo automático es correcto
        """
        with transaction.atomic():
            # Actualizar tasa de éxito
            kb_entry.update_success_rate(is_correct)

            if is_correct:
                # Marcar como validado por usuario
                kb_entry.user_validated = True
                kb_entry.confidence_score = min(1.0, kb_entry.confidence_score * 1.1)
            else:
                # Reducir confianza significativamente
                kb_entry.confidence_score *= 0.3

            kb_entry.save()

            logger.info(
                f"Validación de mapeo: {kb_entry.likewize_model_name} - "
                f"{'Correcto' if is_correct else 'Incorrecto'}"
            )

    def get_entries_needing_review(self, limit: int = 50) -> List[LikewizeKnowledgeBase]:
        """
        Obtiene entradas que necesitan revisión manual
        """
        return list(
            LikewizeKnowledgeBase.objects.filter(
                user_validated=False,
                confidence_score__lt=0.7,
                times_used__gte=2
            ).order_by('confidence_score', '-times_used')[:limit]
        )

    def get_correction_statistics(self, days: int = 30) -> Dict:
        """
        Obtiene estadísticas de correcciones recientes
        """
        since_date = timezone.now() - timezone.timedelta(days=days)

        corrections = MappingCorrection.objects.filter(
            created_at__gte=since_date
        )

        total_corrections = corrections.count()

        if total_corrections == 0:
            return {
                'total_corrections': 0,
                'avg_original_confidence': 0.0,
                'most_corrected_models': [],
                'correction_rate_by_day': []
            }

        # Estadísticas básicas
        avg_original_confidence = corrections.aggregate(
            avg=models.Avg('original_confidence')
        )['avg'] or 0.0

        # Modelos más corregidos
        from django.db.models import Count
        most_corrected = (
            corrections.values('likewize_data__ModelName')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # Tasa de correcciones por día
        from django.db.models.functions import TruncDate
        daily_corrections = (
            corrections.annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        return {
            'total_corrections': total_corrections,
            'avg_original_confidence': avg_original_confidence,
            'most_corrected_models': list(most_corrected),
            'correction_rate_by_day': list(daily_corrections)
        }

    def suggest_improvements(self) -> List[Dict]:
        """
        Sugiere mejoras basándose en el análisis de correcciones
        """
        suggestions = []

        # Analizar patrones de correcciones frecuentes
        frequent_corrections = self._analyze_frequent_corrections()
        if frequent_corrections:
            suggestions.append({
                'type': 'frequent_corrections',
                'description': 'Hay patrones de modelos que se corrigen frecuentemente',
                'data': frequent_corrections,
                'priority': 'high'
            })

        # Analizar entradas de baja confianza
        low_confidence_count = LikewizeKnowledgeBase.objects.filter(
            confidence_score__lt=0.5,
            times_used__gte=3
        ).count()

        if low_confidence_count > 10:
            suggestions.append({
                'type': 'low_confidence_cleanup',
                'description': f'{low_confidence_count} entradas tienen baja confianza',
                'data': {'count': low_confidence_count},
                'priority': 'medium'
            })

        # Analizar cobertura de validación de usuarios
        total_entries = LikewizeKnowledgeBase.objects.count()
        validated_entries = LikewizeKnowledgeBase.objects.filter(
            user_validated=True
        ).count()

        validation_rate = validated_entries / total_entries if total_entries > 0 else 0

        if validation_rate < 0.2 and total_entries > 50:
            suggestions.append({
                'type': 'low_validation_rate',
                'description': f'Solo {validation_rate:.1%} de entradas están validadas por usuarios',
                'data': {
                    'validation_rate': validation_rate,
                    'total_entries': total_entries,
                    'validated_entries': validated_entries
                },
                'priority': 'low'
            })

        return suggestions

    def _analyze_frequent_corrections(self) -> List[Dict]:
        """
        Analiza correcciones frecuentes para identificar patrones problemáticos
        """
        from django.db.models import Count

        # Buscar modelos que han sido corregidos múltiples veces
        frequent = (
            MappingCorrection.objects
            .values('likewize_data__ModelName', 'likewize_data__M_Model')
            .annotate(count=Count('id'))
            .filter(count__gte=3)
            .order_by('-count')[:10]
        )

        return list(frequent)

    def export_learning_data(self) -> Dict:
        """
        Exporta datos de aprendizaje para análisis externo
        """
        return {
            'knowledge_base_entries': list(
                LikewizeKnowledgeBase.objects.values(
                    'likewize_model_name', 'likewize_m_model', 'likewize_capacity',
                    'local_modelo__descripcion', 'local_capacidad__tamaño',
                    'confidence_score', 'times_used', 'success_rate',
                    'user_validated', 'features'
                )
            ),
            'corrections': list(
                MappingCorrection.objects.values(
                    'likewize_data', 'corrected_mapping__modelo__descripcion',
                    'corrected_mapping__tamaño', 'correction_reason',
                    'original_confidence', 'created_at'
                )
            ),
            'feature_patterns': list(
                FeaturePattern.objects.values(
                    'pattern_name', 'pattern_type', 'pattern_value',
                    'confidence_threshold', 'times_applied', 'success_count'
                )
            )
        }