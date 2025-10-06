import logging
import re
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

            # 🔥 VALIDACIÓN ESTRICTA: Si ambos tienen model_variant, deben coincidir exactamente
            # Esto evita que "iPhone X" coincida con "iPhone XS" o "iPhone XR"
            current_variant = features.get('model_variant')
            kb_variant = kb_entry.features.get('model_variant')
            if current_variant and kb_variant and current_variant != kb_variant:
                # Variantes diferentes, saltar este candidato
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
        # Likewize NO tiene campo Capacity separado, viene en ModelName
        capacity_str = self._extract_capacity_from_name(model_name)

        features = self.feature_extractor.extract_features(model_name)

        # 🔥 ESTRATEGIA A-NUMBER PRIMERO (Macs)
        if features.get('a_number'):
            result = self._match_by_a_number(features, capacity_str, model_name)
            if result:
                capacidad, confidence, match_type = result

                # Si encontramos el modelo pero falta la capacidad, NO continuar con otras estrategias
                if match_type == 'model_found_capacity_missing':
                    logger.warning(
                        f"🛑 Mapeo detenido: Modelo correcto encontrado por A-number "
                        f"pero capacidad '{capacity_str}' no existe. "
                        "El item quedará sin mapear para permitir creación manual de capacidad."
                    )
                    return None  # Retornar None para que quede unmapped

                # Mapeo exitoso
                self._learn_from_mapping(likewize_item, capacidad, confidence, match_type)
                return capacidad, confidence

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

                # 🔥 VALIDACIÓN: Si Likewize envió A-number, verificar que coincida
                likewize_a_number = features.get('a_number')
                if likewize_a_number:
                    # Extraer A-number del modelo mapeado (si existe en descripción)
                    modelo_descripcion = capacidad.modelo.descripcion
                    import re
                    modelo_a_match = re.search(r'A\d{4}', modelo_descripcion, re.I)
                    modelo_a_number = modelo_a_match.group() if modelo_a_match else None

                    # Si el modelo tiene A-number y NO coincide, rechazar mapeo
                    if modelo_a_number and modelo_a_number.upper() != likewize_a_number.upper():
                        logger.warning(
                            f"Mapeo rechazado: A-number no coincide. "
                            f"Likewize: {likewize_a_number}, Modelo: {modelo_a_number} ({modelo_descripcion})"
                        )
                        continue  # Intentar siguiente estrategia

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

    def _match_by_a_number(self, features: Dict, capacity_str: str, model_name: str = '') -> Optional[Tuple[Capacidad, float, str]]:
        """Mapeo por A-number (único en Apple, ignora tipo)"""
        a_number = features.get('a_number')
        if not a_number:
            return None

        # A-number es único, buscar en TODAS las descripciones
        modelos = Modelo.objects.filter(
            descripcion__icontains=a_number
        )

        if not modelos.exists():
            return None

        # 🔥 Refinar por processor variant (M3 Pro vs M3 Max, etc.)
        if modelos.count() > 1 and features.get('processor_variant'):
            variant_candidates = modelos.filter(
                Q(procesador__icontains=features['processor_variant']) |
                Q(descripcion__icontains=features['processor_variant'])
            )
            if variant_candidates.exists():
                modelos = variant_candidates
                logger.info(f"Refinado por processor_variant '{features['processor_variant']}': {modelos.count()} modelos")

        # Refinar por GPU cores si hay múltiples
        if modelos.count() > 1 and features.get('gpu_cores'):
            gpu_candidates = modelos.filter(
                Q(descripcion__icontains=f"{features['gpu_cores']}-core GPU") |
                Q(descripcion__icontains=f"{features['gpu_cores']} core GPU") |
                Q(descripcion__icontains=f"{features['gpu_cores']} Core GPU")
            )
            if gpu_candidates.exists():
                modelos = gpu_candidates
                logger.info(f"Refinado por GPU cores '{features['gpu_cores']}': {modelos.count()} modelos")

        # 🔥 Refinar por procesador Intel + frecuencia (Core i7/i9 2.4, etc.) - PRIMERO
        if modelos.count() > 1 and model_name:
            import re
            # Buscar patrón "i9 2.4" o "i7 2.6"
            intel_freq_match = re.search(r'(i[3579])\s+(\d+\.?\d*)', model_name, re.I)
            if intel_freq_match:
                intel_gen = intel_freq_match.group(1).upper()  # i9 -> I9
                intel_freq = intel_freq_match.group(2)  # 2.4
                # Buscar Core I9 2.4 en descripción o procesador
                intel_candidates = modelos.filter(
                    Q(descripcion__icontains=f"{intel_gen} {intel_freq}") |
                    Q(procesador__icontains=f"{intel_gen} {intel_freq}")
                )
                if intel_candidates.exists():
                    modelos = intel_candidates
                    logger.info(f"Refinado por Intel CPU + freq '{intel_gen} {intel_freq}': {modelos.count()} modelos")

        # 🔥 Refinar por CPU cores si aún múltiples (para Mac Pro, Mac Studio, MacBook Pro M-series)
        if modelos.count() > 1 and model_name:
            import re

            # Buscar específicamente "X Core CPU" primero (para MacBook Pro M-series)
            cpu_core_match = re.search(r'(\d+)\s*Core\s*CPU', model_name, re.I)
            if cpu_core_match:
                cpu_cores = cpu_core_match.group(1)
                cpu_candidates = modelos.filter(
                    Q(descripcion__icontains=f"{cpu_cores} Core CPU") |
                    Q(descripcion__icontains=f"{cpu_cores} Core Cpu") |
                    Q(descripcion__icontains=f"{cpu_cores}-Core CPU")
                )
                if cpu_candidates.exists():
                    modelos = cpu_candidates
                    logger.info(f"Refinado por CPU cores '{cpu_cores}': {modelos.count()} modelos")
            # Si no encontró "Core CPU", buscar "X Core Y.Z" (para iMac Pro, Mac Pro con Xeon)
            else:
                # Buscar patrón "8 Core 3.2" (cores + frecuencia) - DEBE tener decimal en frecuencia
                cpu_freq_match = re.search(r'(\d+)\s*Core\s+(\d+\.\d+)', model_name, re.I)
                if cpu_freq_match:
                    cpu_cores = cpu_freq_match.group(1)
                    cpu_freq = cpu_freq_match.group(2)
                    # Intentar primero con cores + frecuencia
                    cpu_candidates = modelos.filter(
                        Q(descripcion__icontains=f"{cpu_cores} Core {cpu_freq}") |
                        Q(procesador__icontains=f"{cpu_cores} Core {cpu_freq}")
                    )
                    if cpu_candidates.exists():
                        modelos = cpu_candidates
                        logger.info(f"Refinado por CPU cores + freq '{cpu_cores} Core {cpu_freq}': {modelos.count()} modelos")

        # Refinar por processor family si aún múltiples
        if modelos.count() > 1 and features.get('processor_family'):
            cpu_candidates = modelos.filter(
                Q(procesador__icontains=features['processor_family']) |
                Q(descripcion__icontains=features['processor_family'])
            )
            if cpu_candidates.exists():
                modelos = cpu_candidates
                logger.info(f"Refinado por processor_family '{features['processor_family']}': {modelos.count()} modelos")

        # Buscar capacidad en el(los) modelo(s) encontrado(s)
        for modelo in modelos:
            logger.info(f"Buscando capacidad '{capacity_str}' en modelo: {modelo.descripcion}")
            capacidad = self._find_matching_capacity(modelo, capacity_str, features)
            if capacidad:
                logger.info(f"✅ MATCH encontrado: {modelo.descripcion} - {capacidad.tamaño}")
                return capacidad, 0.98, 'a_number_match'  # Máxima confianza

        # 🔥 IMPORTANTE: Si encontramos el modelo por A-number (refinado por GPU/CPU) pero no la capacidad,
        # devolver señal especial para NO continuar con otras estrategias de mapeo.
        # Esto permite que quede sin mapear para que el usuario cree la capacidad manualmente.
        if modelos.count() > 0:
            logger.warning(
                f"⚠️ Modelo encontrado por A-number ({modelos.first().descripcion}) "
                f"pero capacidad '{capacity_str}' no existe. "
                "Se requiere crear la capacidad manualmente."
            )
            # Devolver tuple especial que indica "modelo correcto encontrado, capacidad faltante"
            return None, 0.0, 'model_found_capacity_missing'

        logger.info(f"❌ No se encontró modelo con A-number {a_number}")
        return None

    def _match_by_model_description(self, features: Dict, m_model: str, capacity_str: str) -> Optional[Tuple[Capacidad, float, str]]:
        """Mapeo por descripción del modelo"""
        device_type = features.get('device_type')
        if not device_type:
            return None

        # Crear consulta base
        queryset = Modelo.objects.filter(tipo__iexact=device_type)

        # 🔥 Filtrar por variante especial (XS, SE, etc.)
        model_variant = features.get('model_variant')
        generation = features.get('generation')
        processor_family = features.get('processor_family')

        if model_variant and device_type in ('iPhone', 'iPad'):
            # Para variantes especiales, buscar la variante exacta con word boundaries (PostgreSQL)
            # Esto evita que 'X' coincida con 'Max' o 'XR'
            # Usar [[:<:]] y [[:>:]] para word boundaries en PostgreSQL
            queryset = queryset.filter(descripcion__iregex=rf'[[:<:]]{re.escape(model_variant)}[[:>:]]')

            # 🔥 EXCLUSIÓN: Si NO tiene Max/Plus en el nombre Likewize, excluir modelos con Max/Plus
            # Ej: "iPhone XS" (has_max=False) NO debe mapear a "iPhone XS Max"
            if not features.get('has_max'):
                queryset = queryset.exclude(descripcion__icontains='max')
            if not features.get('has_plus'):
                queryset = queryset.exclude(descripcion__icontains='plus')

            # ADEMÁS, si hay generación, filtrar por ella también (ej: SE 3rd generation)
            if generation:
                # Buscar "(3.ª generación)", "(3rd generation)", "SE 3", etc.
                queryset = queryset.filter(
                    Q(descripcion__icontains=f'{generation}.ª generación') |
                    Q(descripcion__icontains=f'{generation}rd generation') |
                    Q(descripcion__icontains=f'{generation}nd generation') |
                    Q(descripcion__icontains=f'{generation}th generation') |
                    Q(descripcion__icontains=f'{generation}st generation') |
                    Q(descripcion__icontains=f'{model_variant} {generation}')
                )
        # 🔥 Si no hay variante especial, filtrar por generación/modelo (iPhone 16, iPad 10, etc.)
        # PERO solo si NO tenemos procesador (M4, M2, etc.) que ya identifica la generación
        elif not model_variant and generation and device_type in ('iPhone', 'iPad') and not processor_family:
            # Buscar "iPhone 16" o "iPad 10" o "(6.ª generación)" en la descripción
            queryset = queryset.filter(
                Q(descripcion__icontains=f'{device_type} {generation}') |
                Q(descripcion__icontains=f'{device_type}{generation}') |
                Q(descripcion__icontains=f'{generation}.ª generación') |
                Q(descripcion__icontains=f'{generation}rd generation') |
                Q(descripcion__icontains=f'{generation}nd generation') |
                Q(descripcion__icontains=f'{generation}th generation') |
                Q(descripcion__icontains=f'{generation}st generation')
            )

        # Filtrar por características específicas (SIEMPRE aplicar estos filtros cuando existan)
        # Estos son críticos para diferenciar iPad Pro vs iPad Air vs iPad mini vs iPad normal
        if features.get('has_pro'):
            queryset = queryset.filter(descripcion__icontains='pro')
        elif features.get('has_air'):  # ELIF: si no es Pro, puede ser Air
            queryset = queryset.filter(descripcion__icontains='air')
        elif features.get('has_mini'):  # ELIF: si no es Pro ni Air, puede ser mini
            queryset = queryset.filter(descripcion__icontains='mini')
        # Si no tiene pro/air/mini, es iPad normal (no filtrar)

        # 🔥 NUEVO: Filtrar por generación para iPad Air/Pro/mini si tiene generación pero NO model_variant
        # Esto maneja casos como "iPad Air 5" que tienen generación detectada (5) pero no model_variant
        # Previene que "iPad Air 5 256GB" mapee a "iPad Air 6ª generación" incorrectamente
        if generation and device_type and device_type.startswith('iPad') and not model_variant:
            if features.get('has_air') or features.get('has_pro') or features.get('has_mini'):
                # Filtrar por generación con todos los formatos posibles
                queryset = queryset.filter(
                    Q(descripcion__icontains=f'{generation}.ª generación') |
                    Q(descripcion__icontains=f'({generation}rd generation)') |
                    Q(descripcion__icontains=f'({generation}th generation)') |
                    Q(descripcion__icontains=f'({generation}nd generation)') |
                    Q(descripcion__icontains=f'({generation}st generation)')
                )

        if features.get('has_max') and model_variant != 'XS Max':
            queryset = queryset.filter(descripcion__icontains='max')
        if features.get('has_plus'):
            queryset = queryset.filter(descripcion__icontains='plus')

        # Filtrar por tamaño de pantalla (iPad Pro 13" vs 12.9" vs 11")
        screen_size = features.get('screen_size')
        if screen_size and device_type and device_type.startswith('iPad'):
            # Normalizar: 11.0 → buscar "11" y "11.0", 12.9 → buscar "12.9"
            size_int = int(screen_size) if screen_size == int(screen_size) else None

            # Buscar modelos que tengan el tamaño en pantalla o descripción
            size_filters = Q(pantalla__icontains=f'{screen_size}') | Q(descripcion__icontains=f'{screen_size}')
            if size_int:
                # También buscar sin decimal: 11.0 → "11"
                size_filters |= Q(pantalla__icontains=f'{size_int}') | Q(descripcion__icontains=f'{size_int}')

            queryset = queryset.filter(size_filters)

            # EXCLUIR modelos con tamaños de pantalla diferentes (que no sean "Nan" o null)
            # Esto previene que iPad Air 11" mapee a iPad Air 10.5" (3ª gen)
            exclude_filters = Q(pantalla__isnull=False) & ~Q(pantalla='Nan')
            if size_int:
                exclude_filters &= ~Q(pantalla__icontains=str(size_int)) & ~Q(pantalla__icontains=f'{screen_size}')
            else:
                exclude_filters &= ~Q(pantalla__icontains=f'{screen_size}')

            queryset = queryset.exclude(exclude_filters)

        # Filtrar por procesador (M4, M2, M1, etc.) para iPad Pro
        processor_family = features.get('processor_family')
        if processor_family and device_type and device_type.startswith('iPad'):
            queryset = queryset.filter(
                Q(procesador__icontains=processor_family) |
                Q(descripcion__icontains=processor_family)
            )

        # Filtrar por conectividad WiFi vs Cellular (iPad)
        if device_type and device_type.startswith('iPad'):
            has_wifi = features.get('has_wifi', False)
            has_cellular = features.get('has_cellular', False)

            # Si especifica WiFi explícitamente (y no Cellular), filtrar solo WiFi
            if has_wifi and not has_cellular:
                queryset = queryset.filter(
                    Q(descripcion__icontains='wifi') | Q(descripcion__icontains='wi-fi')
                ).exclude(descripcion__icontains='cellular')
            # Si especifica Cellular, filtrar solo Cellular
            elif has_cellular:
                queryset = queryset.filter(descripcion__icontains='cellular')

        # Filtrar por año si está disponible
        if features.get('year'):
            queryset = queryset.filter(año=features['year'])

        # 🔥 NUEVO: Detectar ambigüedad para iPad/iPhone cuando hay múltiples generaciones
        # Si hay múltiples modelos y NO tenemos información de año/procesador/generación,
        # es ambiguo y no deberíamos mapear (evita mapeos incorrectos)
        if device_type in ('iPhone', 'iPad') and not features.get('year') and not processor_family and not generation:
            # Verificar si hay múltiples modelos distintos en el queryset
            modelos_count = queryset.count()
            if modelos_count > 1:
                # Hay ambigüedad: múltiples generaciones posibles sin forma de distinguir
                modelos_list = list(queryset.values_list('descripcion', flat=True)[:5])
                logger.warning(
                    f"Ambigüedad detectada para {m_model}: {modelos_count} modelos posibles "
                    f"({modelos_list}) sin información de generación/procesador/año. "
                    "No se mapeará para evitar errores."
                )
                return None

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

        # Filtrar por variante especial y generación (igual que en _match_by_model_description)
        model_variant = features.get('model_variant')
        generation = features.get('generation')
        processor_family = features.get('processor_family')

        if model_variant and device_type in ('iPhone', 'iPad'):
            # Usar regex con word boundaries (PostgreSQL) para evitar que 'X' coincida con 'Max'
            modelos = modelos.filter(descripcion__iregex=rf'[[:<:]]{re.escape(model_variant)}[[:>:]]')

            # 🔥 EXCLUSIÓN: Si NO tiene Max/Plus en el nombre Likewize, excluir modelos con Max/Plus
            if not features.get('has_max'):
                modelos = modelos.exclude(descripcion__icontains='max')
            if not features.get('has_plus'):
                modelos = modelos.exclude(descripcion__icontains='plus')

            if generation:
                modelos = modelos.filter(
                    Q(descripcion__icontains=f'{generation}.ª generación') |
                    Q(descripcion__icontains=f'{generation}rd generation') |
                    Q(descripcion__icontains=f'{generation}nd generation') |
                    Q(descripcion__icontains=f'{generation}th generation') |
                    Q(descripcion__icontains=f'{generation}st generation') |
                    Q(descripcion__icontains=f'{model_variant} {generation}')
                )
        elif not model_variant and generation and device_type in ('iPhone', 'iPad') and not processor_family:
            modelos = modelos.filter(
                Q(descripcion__icontains=f'{device_type} {generation}') |
                Q(descripcion__icontains=f'{device_type}{generation}') |
                Q(descripcion__icontains=f'{generation}.ª generación') |
                Q(descripcion__icontains=f'{generation}rd generation') |
                Q(descripcion__icontains=f'{generation}nd generation') |
                Q(descripcion__icontains=f'{generation}th generation') |
                Q(descripcion__icontains=f'{generation}st generation')
            )

        # Filtrar por características específicas (igual que en _match_by_model_description)
        if features.get('has_pro'):
            modelos = modelos.filter(descripcion__icontains='pro')
        elif features.get('has_air'):
            modelos = modelos.filter(descripcion__icontains='air')
        elif features.get('has_mini'):
            modelos = modelos.filter(descripcion__icontains='mini')

        # Filtrar por tamaño de pantalla (igual que en _match_by_model_description)
        screen_size = features.get('screen_size')
        if screen_size and device_type and device_type.startswith('iPad'):
            size_int = int(screen_size) if screen_size == int(screen_size) else None

            size_filters = Q(pantalla__icontains=f'{screen_size}') | Q(descripcion__icontains=f'{screen_size}')
            if size_int:
                size_filters |= Q(pantalla__icontains=f'{size_int}') | Q(descripcion__icontains=f'{size_int}')

            modelos = modelos.filter(size_filters)

            exclude_filters = Q(pantalla__isnull=False) & ~Q(pantalla='Nan')
            if size_int:
                exclude_filters &= ~Q(pantalla__icontains=str(size_int)) & ~Q(pantalla__icontains=f'{screen_size}')
            else:
                exclude_filters &= ~Q(pantalla__icontains=f'{screen_size}')

            modelos = modelos.exclude(exclude_filters)

        # Filtrar por conectividad WiFi vs Cellular (igual que en _match_by_model_description)
        if device_type and device_type.startswith('iPad'):
            has_wifi = features.get('has_wifi', False)
            has_cellular = features.get('has_cellular', False)

            if has_wifi and not has_cellular:
                modelos = modelos.filter(
                    Q(descripcion__icontains='wifi') | Q(descripcion__icontains='wi-fi')
                ).exclude(descripcion__icontains='cellular')
            elif has_cellular:
                modelos = modelos.filter(descripcion__icontains='cellular')

        # 🔥 NUEVO: Detectar ambigüedad (igual que en _match_by_model_description)
        processor_family = features.get('processor_family')
        if device_type in ('iPhone', 'iPad') and not features.get('year') and not processor_family and not generation:
            modelos_count = modelos.count()
            if modelos_count > 1:
                modelos_list = list(modelos.values_list('descripcion', flat=True)[:5])
                logger.warning(
                    f"Ambigüedad detectada en _match_by_features para {m_model}: "
                    f"{modelos_count} modelos posibles ({modelos_list}) sin información de generación/procesador/año. "
                    "No se mapeará para evitar errores."
                )
                return None

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

        # Filtrar por variante especial y generación (igual que en _match_by_model_description)
        model_variant = features.get('model_variant')
        generation = features.get('generation')
        processor_family = features.get('processor_family')

        if model_variant and device_type in ('iPhone', 'iPad'):
            # Usar regex con word boundaries (PostgreSQL) para evitar que 'X' coincida con 'Max'
            queryset = queryset.filter(descripcion__iregex=rf'[[:<:]]{re.escape(model_variant)}[[:>:]]')

            # 🔥 EXCLUSIÓN: Si NO tiene Max/Plus en el nombre Likewize, excluir modelos con Max/Plus
            if not features.get('has_max'):
                queryset = queryset.exclude(descripcion__icontains='max')
            if not features.get('has_plus'):
                queryset = queryset.exclude(descripcion__icontains='plus')

            if generation:
                queryset = queryset.filter(
                    Q(descripcion__icontains=f'{generation}.ª generación') |
                    Q(descripcion__icontains=f'{generation}rd generation') |
                    Q(descripcion__icontains=f'{generation}nd generation') |
                    Q(descripcion__icontains=f'{generation}th generation') |
                    Q(descripcion__icontains=f'{generation}st generation') |
                    Q(descripcion__icontains=f'{model_variant} {generation}')
                )
        elif not model_variant and generation and device_type in ('iPhone', 'iPad') and not processor_family:
            queryset = queryset.filter(
                Q(descripcion__icontains=f'{device_type} {generation}') |
                Q(descripcion__icontains=f'{device_type}{generation}') |
                Q(descripcion__icontains=f'{generation}.ª generación') |
                Q(descripcion__icontains=f'{generation}rd generation') |
                Q(descripcion__icontains=f'{generation}nd generation') |
                Q(descripcion__icontains=f'{generation}th generation') |
                Q(descripcion__icontains=f'{generation}st generation')
            )

        # Filtrar por características específicas (igual que en _match_by_model_description)
        if features.get('has_pro'):
            queryset = queryset.filter(descripcion__icontains='pro')
        elif features.get('has_air'):
            queryset = queryset.filter(descripcion__icontains='air')
        elif features.get('has_mini'):
            queryset = queryset.filter(descripcion__icontains='mini')

        # Filtrar por tamaño de pantalla (igual que en _match_by_model_description)
        screen_size = features.get('screen_size')
        if screen_size and device_type and device_type.startswith('iPad'):
            size_int = int(screen_size) if screen_size == int(screen_size) else None

            size_filters = Q(pantalla__icontains=f'{screen_size}') | Q(descripcion__icontains=f'{screen_size}')
            if size_int:
                size_filters |= Q(pantalla__icontains=f'{size_int}') | Q(descripcion__icontains=f'{size_int}')

            queryset = queryset.filter(size_filters)

            exclude_filters = Q(pantalla__isnull=False) & ~Q(pantalla='Nan')
            if size_int:
                exclude_filters &= ~Q(pantalla__icontains=str(size_int)) & ~Q(pantalla__icontains=f'{screen_size}')
            else:
                exclude_filters &= ~Q(pantalla__icontains=f'{screen_size}')

            queryset = queryset.exclude(exclude_filters)

        # Filtrar por conectividad WiFi vs Cellular (igual que en _match_by_model_description)
        if device_type and device_type.startswith('iPad'):
            has_wifi = features.get('has_wifi', False)
            has_cellular = features.get('has_cellular', False)

            if has_wifi and not has_cellular:
                queryset = queryset.filter(
                    Q(descripcion__icontains='wifi') | Q(descripcion__icontains='wi-fi')
                ).exclude(descripcion__icontains='cellular')
            elif has_cellular:
                queryset = queryset.filter(descripcion__icontains='cellular')

        for token in main_tokens:
            queryset = queryset.filter(descripcion__icontains=token)

        # 🔥 NUEVO: Detectar ambigüedad (igual que en los otros métodos)
        processor_family = features.get('processor_family')
        if device_type in ('iPhone', 'iPad') and not features.get('year') and not processor_family and not generation:
            modelos_count = queryset.count()
            if modelos_count > 1:
                modelos_list = list(queryset.values_list('descripcion', flat=True)[:5])
                logger.warning(
                    f"Ambigüedad detectada en _match_by_text_similarity para {m_model}: "
                    f"{modelos_count} modelos posibles ({modelos_list}) sin información de generación/procesador/año. "
                    "No se mapeará para evitar errores."
                )
                return None

        for modelo in queryset[:10]:
            capacidad = self._find_matching_capacity(modelo, capacity_str, features)
            if capacidad:
                return capacidad, self.match_weights['fuzzy'], 'fuzzy_match'

        return None

    def _extract_capacity_from_name(self, model_name: str) -> str:
        """Extrae capacidad del nombre del modelo (ej: '1TB SSD' → '1 TB')"""
        import re
        # Buscar patrón de capacidad: 256GB, 1TB, etc.
        match = re.search(r'(\d+(?:\.\d+)?)\s*(TB|GB)', model_name, re.I)
        if match:
            qty = match.group(1)
            unit = match.group(2).upper()
            return f"{qty} {unit}"
        return ""

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
            capacidades = Capacidad.objects.filter(
                modelo=modelo,
                tamaño__icontains=pattern,
                activo=True
            )

            if capacidades.exists():
                # Si hay múltiples capacidades (ej: WiFi y Cellular del mismo modelo)
                # preferir la que coincida con la conectividad detectada
                if capacidades.count() > 1:
                    has_wifi = features.get('has_wifi', False)
                    has_cellular = features.get('has_cellular', False)

                    # Preferir WiFi si se detectó WiFi (sin Cellular)
                    if has_wifi and not has_cellular:
                        wifi_cap = capacidades.filter(
                            Q(modelo__descripcion__icontains='wifi') |
                            Q(modelo__descripcion__icontains='wi-fi')
                        ).exclude(modelo__descripcion__icontains='cellular').first()
                        if wifi_cap:
                            return wifi_cap

                    # Preferir Cellular si se detectó Cellular
                    elif has_cellular:
                        cellular_cap = capacidades.filter(
                            modelo__descripcion__icontains='cellular'
                        ).first()
                        if cellular_cap:
                            return cellular_cap

                # Si no hay preferencia o solo hay una, devolver la primera
                return capacidades.first()

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