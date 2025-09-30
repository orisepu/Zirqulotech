import logging
from typing import Dict, List, Optional, Tuple, Set
from django.db.models import Q, F, Avg, Count
from django.utils import timezone
from decimal import Decimal

from productos.models.autoaprendizaje import (
    LikewizeKnowledgeBase,
    MappingCorrection,
    LearningSession,
    FeaturePattern
)
from productos.models.modelos import Modelo, Capacidad
from productos.services.feature_extractor_v3 import FeatureExtractor


logger = logging.getLogger(__name__)


class AutoLearningEngine:
    """
    Motor de aprendizaje automático para mapeo de dispositivos Likewize
    """

    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.similarity_threshold = 0.75
        self.confidence_threshold = 0.7
        self.max_candidates = 50

        # Pesos para diferentes tipos de match
        self.match_weights = {
            'exact': 1.0,
            'likewize_field': 0.95,
            'high_similarity': 0.85,
            'medium_similarity': 0.7,
            'pattern_based': 0.6,
            'fuzzy': 0.5
        }

    def predict_mapping(self, likewize_item: Dict) -> Tuple[Optional[Capacidad], float, str]:
        """
        Predice mapeo basándose en conocimiento previo y aprendizaje
        """
        logger.info(f"Prediciendo mapeo para: {likewize_item.get('ModelName', 'Unknown')}")

        # 1. Búsqueda exacta en base de conocimiento
        exact_match = self._exact_knowledge_match(likewize_item)
        if exact_match:
            capacidad, confidence = exact_match
            logger.info(f"Match exacto encontrado con confianza {confidence:.3f}")
            return capacidad, confidence, 'exact_knowledge'

        # 2. Búsqueda por similitud en base de conocimiento
        similarity_match = self._similarity_knowledge_match(likewize_item)
        if similarity_match:
            capacidad, confidence = similarity_match
            logger.info(f"Match por similitud encontrado con confianza {confidence:.3f}")
            return capacidad, confidence, 'similarity_knowledge'

        # 3. Mapeo tradicional con aprendizaje
        traditional_match = self._traditional_mapping_with_learning(likewize_item)
        if traditional_match:
            capacidad, confidence = traditional_match
            logger.info(f"Match tradicional encontrado con confianza {confidence:.3f}")
            return capacidad, confidence, 'traditional_learned'

        logger.info("No se encontró mapeo")
        return None, 0.0, 'unmapped'

    def _exact_knowledge_match(self, likewize_item: Dict) -> Optional[Tuple[Capacidad, float]]:
        """Búsqueda exacta en base de conocimiento"""
        model_name = likewize_item.get('ModelName', '')
        capacity = likewize_item.get('Capacity', '')

        kb_entry = LikewizeKnowledgeBase.objects.filter(
            likewize_model_name=model_name,
            likewize_capacity=capacity,
            confidence_score__gte=self.confidence_threshold,
            success_rate__gte=0.8
        ).first()

        if kb_entry:
            # Actualizar estadísticas de uso
            kb_entry.times_used = F('times_used') + 1
            kb_entry.last_used = timezone.now()
            kb_entry.save(update_fields=['times_used', 'last_used'])

            return kb_entry.local_capacidad, kb_entry.confidence_score

        return None

    def _similarity_knowledge_match(self, likewize_item: Dict) -> Optional[Tuple[Capacidad, float]]:
        """Búsqueda por similitud en base de conocimiento"""
        features = self.feature_extractor.extract_features(
            likewize_item.get('ModelName', '')
        )

        # Filtrar candidatos por características clave
        candidates = self._get_similarity_candidates(features)

        best_match = None
        best_score = 0.0

        for kb_entry in candidates:
            # Calcular similitud entre características
            if not kb_entry.features:
                continue

            similarity = self.feature_extractor.calculate_similarity(
                features, kb_entry.features
            )

            # Ajustar score basándose en confianza histórica
            adjusted_score = similarity * kb_entry.confidence_score * kb_entry.success_rate

            if adjusted_score > best_score and adjusted_score >= self.similarity_threshold:
                best_score = adjusted_score
                best_match = kb_entry

        if best_match:
            # Actualizar uso
            best_match.times_used = F('times_used') + 1
            best_match.last_used = timezone.now()
            best_match.save(update_fields=['times_used', 'last_used'])

            return best_match.local_capacidad, best_score

        return None

    def _get_similarity_candidates(self, features: Dict) -> List[LikewizeKnowledgeBase]:
        """Obtiene candidatos para búsqueda por similitud"""
        queryset = LikewizeKnowledgeBase.objects.filter(
            confidence_score__gte=0.6,
            success_rate__gte=0.7
        )

        # Filtrar por tipo de dispositivo si está disponible
        device_type = features.get('device_type')
        if device_type:
            queryset = queryset.filter(
                features__device_type=device_type
            )

        # Filtrar por características clave
        if features.get('storage_gb'):
            storage_range = self._get_storage_range(features['storage_gb'])
            queryset = queryset.filter(
                features__storage_gb__gte=storage_range[0],
                features__storage_gb__lte=storage_range[1]
            )

        if features.get('year'):
            year_range = self._get_year_range(features['year'])
            queryset = queryset.filter(
                features__year__gte=year_range[0],
                features__year__lte=year_range[1]
            )

        return list(queryset.order_by('-confidence_score', '-times_used')[:self.max_candidates])

    def _traditional_mapping_with_learning(self, likewize_item: Dict) -> Optional[Tuple[Capacidad, float]]:
        """Mapeo tradicional con capacidad de aprendizaje"""
        # Extraer información del item de Likewize
        model_name = likewize_item.get('ModelName', '')
        m_model = likewize_item.get('M_Model', '')
        capacity_str = likewize_item.get('Capacity', '')

        features = self.feature_extractor.extract_features(model_name)

        # Estrategias de mapeo en orden de precisión
        strategies = [
            self._match_by_likewize_field,
            self._match_by_model_description,
            self._match_by_features,
            self._match_by_fuzzy_similarity
        ]

        for strategy in strategies:
            result = strategy(features, m_model, capacity_str)
            if result:
                capacidad, confidence, match_type = result

                # Aprender del mapeo exitoso
                self._learn_from_mapping(likewize_item, capacidad, confidence, match_type)

                return capacidad, confidence

        return None

    def _match_by_likewize_field(self, features: Dict, m_model: str, capacity_str: str) -> Optional[Tuple[Capacidad, float, str]]:
        """Mapeo por campo likewize_modelo"""
        if not m_model:
            return None

        modelos = Modelo.objects.filter(
            likewize_modelo__iexact=m_model
        )

        for modelo in modelos:
            capacidad = self._find_matching_capacity(modelo, capacity_str, features)
            if capacidad:
                return capacidad, self.match_weights['likewize_field'], 'likewize_field'

        return None

    def _match_by_model_description(self, features: Dict, m_model: str, capacity_str: str) -> Optional[Tuple[Capacidad, float, str]]:
        """Mapeo por descripción del modelo"""
        device_type = features.get('device_type')
        if not device_type:
            return None

        # Crear consulta base
        queryset = Modelo.objects.filter(tipo__iexact=device_type)

        # Filtrar por características específicas
        if features.get('has_pro'):
            queryset = queryset.filter(descripcion__icontains='pro')
        if features.get('has_max'):
            queryset = queryset.filter(descripcion__icontains='max')
        if features.get('has_air'):
            queryset = queryset.filter(descripcion__icontains='air')
        if features.get('has_mini'):
            queryset = queryset.filter(descripcion__icontains='mini')

        # Filtrar por año si está disponible
        if features.get('year'):
            queryset = queryset.filter(año=features['year'])

        # Buscar en los modelos filtrados
        for modelo in queryset[:20]:  # Limitar para performance
            capacidad = self._find_matching_capacity(modelo, capacity_str, features)
            if capacidad:
                return capacidad, self.match_weights['high_similarity'], 'description_match'

        return None

    def _match_by_features(self, features: Dict, m_model: str, capacity_str: str) -> Optional[Tuple[Capacidad, float, str]]:
        """Mapeo basado en características extraídas"""
        # Obtener todos los modelos del tipo correcto
        device_type = features.get('device_type')
        if not device_type:
            return None

        modelos = Modelo.objects.filter(tipo__iexact=device_type)

        best_match = None
        best_score = 0.0

        for modelo in modelos:
            # Calcular similitud con cada modelo
            modelo_features = self.feature_extractor.extract_features(modelo.descripcion)
            similarity = self.feature_extractor.calculate_similarity(features, modelo_features)

            if similarity > best_score and similarity >= 0.7:
                capacidad = self._find_matching_capacity(modelo, capacity_str, features)
                if capacidad:
                    best_score = similarity
                    best_match = capacidad

        if best_match:
            confidence = best_score * self.match_weights['medium_similarity']
            return best_match, confidence, 'feature_match'

        return None

    def _match_by_fuzzy_similarity(self, features: Dict, m_model: str, capacity_str: str) -> Optional[Tuple[Capacidad, float, str]]:
        """Mapeo por similitud difusa"""
        device_type = features.get('device_type')
        if not device_type:
            return None

        # Obtener tokens del nombre de Likewize
        tokens = features.get('tokens', [])
        if not tokens:
            return None

        # Buscar modelos que contengan alguno de los tokens principales
        main_tokens = [token for token in tokens if len(token) > 3][:3]

        queryset = Modelo.objects.filter(tipo__iexact=device_type)
        for token in main_tokens:
            queryset = queryset.filter(descripcion__icontains=token)

        for modelo in queryset[:10]:
            capacidad = self._find_matching_capacity(modelo, capacity_str, features)
            if capacidad:
                return capacidad, self.match_weights['fuzzy'], 'fuzzy_match'

        return None

    def _find_matching_capacity(self, modelo: Modelo, capacity_str: str, features: Dict) -> Optional[Capacidad]:
        """Encuentra capacidad coincidente en un modelo"""
        if not capacity_str:
            return None

        # Normalizar capacidad de Likewize
        storage_gb = features.get('storage_gb')
        if not storage_gb:
            return None

        # Buscar capacidad exacta
        capacity_patterns = self._get_capacity_patterns(storage_gb)

        for pattern in capacity_patterns:
            capacidad = Capacidad.objects.filter(
                modelo=modelo,
                tamaño__icontains=pattern,
                activo=True
            ).first()

            if capacidad:
                return capacidad

        return None

    def _get_capacity_patterns(self, storage_gb: int) -> List[str]:
        """Genera patrones de búsqueda para capacidad"""
        patterns = []

        if storage_gb >= 1024:
            tb = storage_gb / 1024
            if tb == int(tb):
                patterns.extend([f"{int(tb)}TB", f"{int(tb)} TB"])
            else:
                patterns.extend([f"{tb:.1f}TB", f"{tb:.1f} TB"])

        patterns.extend([f"{storage_gb}GB", f"{storage_gb} GB"])

        # Patrones alternativos
        if storage_gb == 64:
            patterns.append("64")
        elif storage_gb == 128:
            patterns.append("128")
        elif storage_gb == 256:
            patterns.append("256")
        elif storage_gb == 512:
            patterns.append("512")

        return patterns

    def _learn_from_mapping(self, likewize_item: Dict, capacidad: Capacidad, confidence: float, match_type: str):
        """Aprende de un mapeo exitoso"""
        try:
            features = self.feature_extractor.extract_features(
                likewize_item.get('ModelName', '')
            )

            kb_entry, created = LikewizeKnowledgeBase.objects.get_or_create(
                likewize_model_name=likewize_item.get('ModelName', ''),
                likewize_capacity=likewize_item.get('Capacity', ''),
                defaults={
                    'likewize_m_model': likewize_item.get('M_Model', ''),
                    'likewize_phone_model_id': likewize_item.get('PhoneModelId'),
                    'likewize_full_name': likewize_item.get('FullName', ''),
                    'local_modelo': capacidad.modelo,
                    'local_capacidad': capacidad,
                    'confidence_score': confidence,
                    'features': features,
                    'auto_learned': True,
                    'user_validated': False
                }
            )

            if not created:
                # Actualizar entrada existente con media ponderada
                total_uses = kb_entry.times_used + 1
                kb_entry.confidence_score = (
                    (kb_entry.confidence_score * kb_entry.times_used + confidence) / total_uses
                )
                kb_entry.times_used = total_uses
                kb_entry.features = features  # Actualizar características
                kb_entry.save()

            logger.info(f"Aprendido mapeo: {likewize_item.get('ModelName')} → {capacidad}")

        except Exception as e:
            logger.error(f"Error al aprender mapeo: {e}")

    def _get_storage_range(self, storage_gb: int) -> Tuple[int, int]:
        """Obtiene rango de almacenamiento para filtrado"""
        if storage_gb <= 64:
            return 32, 128
        elif storage_gb <= 256:
            return 128, 512
        elif storage_gb <= 512:
            return 256, 1024
        else:
            return 512, storage_gb * 2

    def _get_year_range(self, year: int) -> Tuple[int, int]:
        """Obtiene rango de años para filtrado"""
        return year - 1, year + 1

    def calculate_learning_metrics(self) -> Dict:
        """Calcula métricas de aprendizaje del sistema"""
        total_entries = LikewizeKnowledgeBase.objects.count()

        if total_entries == 0:
            return {
                'total_entries': 0,
                'avg_confidence': 0.0,
                'high_confidence_ratio': 0.0,
                'user_validated_ratio': 0.0,
                'recent_activity': 0
            }

        metrics = LikewizeKnowledgeBase.objects.aggregate(
            avg_confidence=Avg('confidence_score'),
            high_confidence_count=Count('id', filter=Q(confidence_score__gte=0.9)),
            user_validated_count=Count('id', filter=Q(user_validated=True)),
            recent_count=Count('id', filter=Q(
                last_used__gte=timezone.now() - timezone.timedelta(days=7)
            ))
        )

        return {
            'total_entries': total_entries,
            'avg_confidence': metrics['avg_confidence'] or 0.0,
            'high_confidence_ratio': metrics['high_confidence_count'] / total_entries,
            'user_validated_ratio': metrics['user_validated_count'] / total_entries,
            'recent_activity': metrics['recent_count']
        }

    def cleanup_low_confidence_entries(self, threshold: float = 0.3, min_uses: int = 5):
        """Limpia entradas de baja confianza"""
        deleted_count = LikewizeKnowledgeBase.objects.filter(
            confidence_score__lt=threshold,
            times_used__gte=min_uses,
            user_validated=False
        ).delete()[0]

        logger.info(f"Eliminadas {deleted_count} entradas de baja confianza")
        return deleted_count