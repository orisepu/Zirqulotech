"""
iPhone Mapping Engine - Orquestación completa del proceso de mapeo.

Coordina todos los componentes para mapear dispositivos iPhone:
1. Extractor: Parsea el texto crudo y extrae features
2. Knowledge Base: Enriquece con información (año, CPU)
3. Matcher: Encuentra candidatos en la BD
4. Rules: Filtra candidatos según reglas de negocio
5. Resultado: Retorna el mejor match o error

Este engine implementa el patrón Template Method donde cada
paso es delegado a componentes especializados.
"""

from typing import List
import re

from productos.mapping.core.interfaces import IMappingEngine
from productos.mapping.core.types import (
    LikewizeInput,
    MatchResult,
    MatchStatus,
    MappingContext,
    MatchCandidate,
)
from productos.mapping.extractors.iphone_extractor import iPhoneFeatureExtractor
from productos.mapping.knowledge.iphone_kb import iPhoneKnowledgeBase
from productos.mapping.matchers.a_number_matcher import ANumberMatcher
from productos.mapping.matchers.name_matcher import NameMatcher
from productos.mapping.matchers.generation_matcher import GenerationMatcher
from productos.mapping.rules.year_filter import YearFilter
from productos.mapping.rules.variant_filter import VariantFilter
from productos.mapping.rules.capacity_filter import CapacityFilter


class iPhoneEngine(IMappingEngine):
    """
    Engine de mapeo para iPhone.

    Orquesta el proceso completo:
    - Extracción de features
    - Enriquecimiento con KB
    - Matching en BD (prioridad: A-number → Name → Generation)
    - Aplicación de reglas de filtrado
    - Selección del mejor candidato

    Thread-safe: cada instancia puede procesar múltiples requests.
    """

    def __init__(self):
        """Inicializa el engine con sus componentes."""
        # Componentes del pipeline
        self.extractor = iPhoneFeatureExtractor()
        self.knowledge_base = iPhoneKnowledgeBase()

        # Matchers (en orden de prioridad)
        self.a_number_matcher = ANumberMatcher()  # 85% confidence
        self.name_matcher = NameMatcher()         # 80% confidence
        self.generation_matcher = GenerationMatcher()  # 70% confidence

        # Reglas de filtrado (aplicadas en orden)
        self.rules = [
            YearFilter(),
            VariantFilter(),
            CapacityFilter(),
        ]

        # Patrón para detectar iPhone
        self.iphone_pattern = re.compile(r'\biphone\b', re.I)

    def can_handle(self, input_data: LikewizeInput) -> bool:
        """
        Verifica si este engine puede manejar el input dado.

        Args:
            input_data: Input de Likewize

        Returns:
            True si es un iPhone
        """
        return bool(self.iphone_pattern.search(input_data.model_name))

    def map(self, input_data: LikewizeInput) -> MatchResult:
        """
        Ejecuta el proceso completo de mapeo.

        Pipeline:
        1. Crear contexto
        2. Extraer features
        3. Enriquecer con KB
        4. Buscar candidatos (matcher)
        5. Aplicar reglas de filtrado
        6. Seleccionar mejor candidato
        7. Retornar resultado

        Args:
            input_data: Datos crudos de Likewize

        Returns:
            MatchResult con el resultado del mapeo
        """
        # 1. Crear contexto de mapeo
        context = MappingContext(input_data=input_data)
        context.info("=== Iniciando proceso de mapeo de iPhone ===")
        context.start_timer()

        try:
            # 2. Extraer features
            context.info("Paso 1: Extrayendo features del input")
            features = self.extractor.extract(input_data, context)

            if not features.device_type:
                context.error("No se pudo detectar device_type")
                return self._create_error_result(
                    context,
                    MatchStatus.ERROR,
                    "No se pudo detectar el tipo de dispositivo",
                    features
                )

            # 3. Enriquecer con knowledge base
            context.info("Paso 2: Enriqueciendo features con knowledge base")
            features = self.knowledge_base.enrich_features(features, context)

            # 4. Buscar candidatos con matcher (prioridad: A-number → Name → Generation)
            context.info("Paso 3: Buscando candidatos con matcher (A-number → Name → Generation)")
            candidates = []
            matcher_used = None

            # Intentar A-number primero si está disponible
            if features.a_number:
                context.info(f"Intentando ANumberMatcher con A-number: {features.a_number}")
                candidates = self.a_number_matcher.find_candidates(features, context)
                if candidates:
                    matcher_used = "ANumberMatcher"
                    context.info(f"✓ ANumberMatcher encontró {len(candidates)} candidatos (confidence: ~85%)")

            # Si no hay A-number o no se encontraron candidatos, intentar NameMatcher
            # NameMatcher necesita: device_type + (generation OR variant)
            can_use_name_matcher = features.device_type and (features.generation or features.variant)
            if not candidates and can_use_name_matcher:
                context.info("Intentando NameMatcher (sin A-number o A-number no encontró candidatos)")
                candidates = self.name_matcher.find_candidates(features, context)
                if candidates:
                    matcher_used = "NameMatcher"
                    context.info(f"✓ NameMatcher encontró {len(candidates)} candidatos (confidence: ~80%)")

            # Si aún no hay candidatos, usar GenerationMatcher como fallback
            if not candidates:
                context.info("Usando GenerationMatcher como fallback")
                candidates = self.generation_matcher.find_candidates(features, context)
                if candidates:
                    matcher_used = "GenerationMatcher"
                    context.info(f"✓ GenerationMatcher encontró {len(candidates)} candidatos (confidence: ~70%)")

            if not candidates:
                context.warning("Ningún matcher encontró candidatos")
                return self._create_no_match_result(
                    context,
                    "No se encontraron candidatos que coincidan con el dispositivo",
                    features
                )

            context.info(
                f"Encontrados {len(candidates)} candidatos con {matcher_used} antes de filtrado"
            )
            context.set_metadata('matcher_used', matcher_used)

            # 5. Aplicar reglas de filtrado
            context.info("Paso 4: Aplicando reglas de filtrado")
            filtered_candidates = self._apply_rules(candidates, features, context)

            if not filtered_candidates:
                context.warning("Todos los candidatos fueron filtrados por las reglas")
                return self._create_no_match_result(
                    context,
                    "No se encontraron candidatos después del filtrado por reglas",
                    features,
                    all_candidates=candidates  # Incluir candidatos pre-filtro para debug
                )

            context.info(f"Quedan {len(filtered_candidates)} candidatos después del filtrado")

            # 6. Seleccionar mejor candidato
            best_candidate = self._select_best_candidate(filtered_candidates, context)

            # 7. Crear resultado exitoso
            context.info(
                f"Mapeo exitoso: {best_candidate.modelo_descripcion} "
                f"{best_candidate.capacidad_tamanio} (score: {best_candidate.match_score:.2f})"
            )
            context.stop_timer()

            return MatchResult(
                status=MatchStatus.SUCCESS,
                matched_capacidad_id=best_candidate.capacidad_id,
                matched_modelo_id=best_candidate.modelo_id,
                matched_modelo_descripcion=best_candidate.modelo_descripcion,
                matched_capacidad_tamanio=best_candidate.capacidad_tamanio,
                match_score=best_candidate.match_score,
                match_strategy=best_candidate.match_strategy,
                features=features,
                all_candidates=filtered_candidates,
                context=context
            )

        except Exception as e:
            context.error(f"Error inesperado durante el mapeo: {str(e)}")
            context.stop_timer()
            return self._create_error_result(
                context,
                MatchStatus.ERROR,
                f"Error inesperado: {str(e)}",
                None
            )

    def _apply_rules(
        self,
        candidates: List[MatchCandidate],
        features,
        context: MappingContext
    ) -> List[MatchCandidate]:
        """
        Aplica todas las reglas de filtrado en cadena.

        Args:
            candidates: Lista de candidatos iniciales
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            Lista filtrada de candidatos
        """
        filtered = candidates

        for rule in self.rules:
            if not filtered:
                context.warning(f"No hay candidatos para aplicar {rule.get_rule_name()}")
                break

            filtered = rule.apply(filtered, features, context)

        return filtered

    def _select_best_candidate(
        self,
        candidates: List[MatchCandidate],
        context: MappingContext
    ) -> MatchCandidate:
        """
        Selecciona el mejor candidato de la lista.

        Asume que los candidatos ya están ordenados por score (descendente).

        Args:
            candidates: Lista de candidatos filtrados
            context: Contexto de mapeo

        Returns:
            El mejor candidato (primero de la lista)
        """
        if not candidates:
            raise ValueError("No se puede seleccionar candidato de lista vacía")

        # Los candidatos ya están ordenados por score (desde el matcher)
        best = candidates[0]

        if len(candidates) > 1:
            context.debug(
                f"Seleccionando mejor candidato entre {len(candidates)}: "
                f"{best.modelo_descripcion} (score: {best.match_score:.2f})"
            )

        return best

    def _create_no_match_result(
        self,
        context: MappingContext,
        message: str,
        features=None,
        all_candidates: List[MatchCandidate] = None
    ) -> MatchResult:
        """
        Crea un MatchResult para caso de no match.

        Args:
            context: Contexto de mapeo
            message: Mensaje descriptivo
            features: Features extraídas (opcional)
            all_candidates: Candidatos pre-filtro (opcional, para debug)

        Returns:
            MatchResult con status NO_MATCH
        """
        context.stop_timer()
        return MatchResult(
            status=MatchStatus.NO_MATCH,
            error_message=message,
            features=features,
            all_candidates=all_candidates or [],
            context=context
        )

    def _create_error_result(
        self,
        context: MappingContext,
        status: MatchStatus,
        message: str,
        features=None
    ) -> MatchResult:
        """
        Crea un MatchResult para caso de error.

        Args:
            context: Contexto de mapeo
            status: Status del error
            message: Mensaje descriptivo
            features: Features extraídas (opcional)

        Returns:
            MatchResult con status de error
        """
        context.stop_timer()
        return MatchResult(
            status=status,
            error_message=message,
            features=features,
            all_candidates=[],
            context=context
        )
