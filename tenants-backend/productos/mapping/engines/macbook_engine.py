"""
Mac Engine - Motor de mapeo para todos los Macs (portátiles y de escritorio).

Orquesta el proceso completo de mapeo para Macs:
1. Extrae features con MacFeatureExtractor
2. Busca candidatos con GenerationMatcher
3. Aplica filtros especializados:
   - ChipVariantFilter (M3 vs M3 Pro vs M3 Max)
   - CPUCoresFilter (8 vs 10 vs 12 cores) ← CRÍTICO para Mac mini
   - GPUCoresFilter (16 vs 19 cores) ← CRÍTICO para Mac mini
   - ScreenSizeFilter (13", 14", 15", 16" - solo para laptops)
   - YearFilter
   - CapacityFilter

Soporta:
- MacBook Air (M1/M2/M3/M4, 13" y 15")
- MacBook Pro (Intel/M-series, 13"/14"/15"/16")
- Mac mini (M1/M2/M2 Pro, 2020-2024)
- iMac (Intel/M-series, 21.5"/24"/27")
- Mac Studio (M1 Max/Ultra, M2 Max/Ultra)
- Mac Pro (Intel/M2 Ultra)
"""

from typing import List
from productos.mapping.core.interfaces import IMappingEngine
from productos.mapping.core.types import (
    LikewizeInput,
    MatchResult,
    MatchStatus,
    MappingContext,
    MatchCandidate
)
from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
from productos.mapping.knowledge.macbook_kb import MacBookKnowledgeBase
from productos.mapping.matchers.a_number_matcher import ANumberMatcher
from productos.mapping.matchers.generation_matcher import GenerationMatcher
from productos.mapping.rules.chip_variant_filter import ChipVariantFilter
from productos.mapping.rules.cpu_cores_filter import CPUCoresFilter
from productos.mapping.rules.gpu_cores_filter import GPUCoresFilter
from productos.mapping.rules.screen_size_filter import ScreenSizeFilter
from productos.mapping.rules.year_filter import YearFilter
from productos.mapping.rules.capacity_filter import CapacityFilter


class MacEngine(IMappingEngine):
    """
    Motor de mapeo para todos los Macs (portátiles y de escritorio).

    Arquitectura unificada que maneja:
    - MacBook Air/Pro (portátiles)
    - Mac mini, iMac, Mac Studio, Mac Pro (escritorio)
    """

    def __init__(self):
        """Inicializa componentes del engine."""
        self.extractor = MacBookFeatureExtractor()
        self.knowledge_base = MacBookKnowledgeBase()

        # Matchers en orden de precisión (más específico primero)
        self.a_number_matcher = ANumberMatcher()      # MÁS PRECISO: A-number exacto (85%)
        self.generation_matcher = GenerationMatcher() # Fallback: generación + año (70%)

        # Filtros aplicados en orden (más específicos primero)
        self.rules = [
            ChipVariantFilter(),   # M3 vs M3 Pro vs M3 Max
            CPUCoresFilter(),      # 8 vs 10 vs 12 CPU cores (CRÍTICO para Mac mini M2 vs M2 Pro)
            GPUCoresFilter(),      # 16 vs 19 vs 30 vs 38 vs 40 GPU cores
            ScreenSizeFilter(),    # 13"/14"/15"/16" (solo para laptops)
            YearFilter(),          # 2017-2024
            CapacityFilter(),      # 256GB - 8TB
        ]

    def can_handle(self, input_data: LikewizeInput) -> bool:
        """
        Verifica si este engine puede manejar el input.

        Args:
            input_data: Input de Likewize

        Returns:
            True si es cualquier Mac (MacBook, Mac mini, iMac, Mac Studio, Mac Pro)
        """
        model_name = input_data.model_name.lower()
        return any([
            "macbook" in model_name,
            "macmini" in model_name,
            "mac mini" in model_name,
            "imac" in model_name,
            "mac studio" in model_name,
            "macstudio" in model_name,
            "mac pro" in model_name,
            "macpro" in model_name,
        ])

    def map(self, input_data: LikewizeInput) -> MatchResult:
        """
        Ejecuta el proceso completo de mapeo (interfaz IMappingEngine).

        Args:
            input_data: Datos crudos de Likewize

        Returns:
            MatchResult con el resultado del mapeo
        """
        # Crear contexto de mapeo
        context = MappingContext(input_data=input_data)
        context.start_timer()

        try:
            # Delegar al método interno
            return self.map_device(input_data, context)
        except Exception as e:
            context.error(f"Error inesperado durante el mapeo: {str(e)}")
            context.stop_timer()
            return MatchResult(
                status=MatchStatus.ERROR,
                error_message=f"Error inesperado: {str(e)}",
                context=context
            )

    def map_device(
        self,
        input_data: LikewizeInput,
        context: MappingContext
    ) -> MatchResult:
        """
        Mapea un MacBook de Likewize a la BD.

        Args:
            input_data: Input de Likewize con FullName
            context: Contexto de mapeo

        Returns:
            MatchResult con el mapeo
        """
        context.info(f"=== Mac Engine: {input_data.model_name} ===")

        # 1. Extraer features
        context.info("Paso 1: Extrayendo features")
        features = self.extractor.extract(input_data, context)

        if not features.variant:
            context.error("No se pudo detectar variante de Mac (Air/Pro/mini/iMac/Studio/Pro)")
            context.stop_timer()
            return MatchResult(
                status=MatchStatus.NO_MATCH,
                error_message="No se detectó variante de Mac",
                features=features,
                context=context
            )

        context.info(
            f"Features: variant={features.variant}, chip={features.cpu}, "
            f"screen={features.screen_size}\", storage={features.storage_gb}GB, year={features.year}"
        )

        # 2. Buscar candidatos con matcher
        # Estrategia: Intentar A-number primero (más preciso), luego Generation (fallback)
        context.info("Paso 2: Buscando candidatos")
        candidates = []
        matcher_used = None

        # Intentar A-number primero si está disponible
        if features.a_number:
            context.info(f"Intentando ANumberMatcher con A-number: {features.a_number}")

            # Verificar si el modelo existe (sin filtrar por capacidad primero)
            from productos.models.modelos import Modelo
            models_with_a_number = Modelo.objects.filter(
                descripcion__icontains=features.a_number,
                tipo__iexact=features.device_type.value,
                año=features.year
            )

            if models_with_a_number.exists():
                context.info(f"Modelo con A-number {features.a_number} EXISTE en BD ({models_with_a_number.count()} modelos)")
                context.set_metadata('model_found_by_a_number', True)
                context.set_metadata('model_ids_found', list(models_with_a_number.values_list('id', flat=True)))

                # Marcar para activar enriquecimiento de capacidades en V3CompatibilityAdapter
                context.set_metadata('capacity_missing_for_model', True)

            candidates = self.a_number_matcher.find_candidates(features, context)
            if candidates:
                matcher_used = "ANumberMatcher"
                context.info(f"✓ ANumberMatcher encontró {len(candidates)} candidatos (confidence: ~85%)")
            else:
                if models_with_a_number.exists():
                    context.warning(
                        f"⚠️ Modelo con A-number {features.a_number} existe pero NO tiene "
                        f"capacidad de {features.storage_gb}GB. Sugerir crear capacidad."
                    )
                    context.set_metadata('capacity_missing_for_model', True)
                else:
                    context.warning(f"ANumberMatcher no encontró candidatos para A-number {features.a_number}")

        # Si A-number no encontró candidatos, verificar si el modelo existe
        # REGLA IMPORTANTE: Si el modelo con A-number existe pero falta capacidad,
        # NO caer a GenerationMatcher (para evitar mapear a otro A-number diferente)
        model_exists_but_no_capacity = context.metadata.get('model_found_by_a_number', False)

        if not candidates and not model_exists_but_no_capacity:
            # Solo usar GenerationMatcher si NO encontramos el modelo con A-number
            context.info("Usando GenerationMatcher como fallback (modelo con A-number NO existe)")
            candidates = self.generation_matcher.find_candidates(features, context)
            if candidates:
                matcher_used = "GenerationMatcher"
                context.info(f"✓ GenerationMatcher encontró {len(candidates)} candidatos (confidence: ~70%)")
            else:
                context.warning("GenerationMatcher tampoco encontró candidatos")
        elif not candidates and model_exists_but_no_capacity:
            # El modelo existe pero falta la capacidad → NO usar GenerationMatcher
            context.warning(
                f"⚠️ Modelo con A-number {features.a_number} existe pero falta capacidad. "
                f"NO se usará GenerationMatcher para evitar mapear a otro A-number diferente."
            )

        # Si ninguno encontró candidatos, retornar NO_MATCH
        if not candidates:
            context.error("Ningún matcher encontró candidatos")
            context.stop_timer()
            return MatchResult(
                status=MatchStatus.NO_MATCH,
                error_message="No se encontraron candidatos en BD",
                features=features,
                context=context
            )

        context.info(f"{matcher_used} será usado para este mapeo")

        # 3. Aplicar filtros en cadena
        context.info("Paso 3: Aplicando filtros")
        filtered_candidates = candidates

        for rule in self.rules:
            rule_name = rule.get_rule_name()
            context.info(f"Aplicando {rule_name}...")

            before_count = len(filtered_candidates)
            filtered_candidates = rule.apply(filtered_candidates, features, context)
            after_count = len(filtered_candidates)

            context.info(f"{rule_name}: {before_count} → {after_count} candidatos")

            # Si no quedan candidatos, detener
            if not filtered_candidates:
                context.warning(f"{rule_name} eliminó todos los candidatos")
                context.stop_timer()
                return MatchResult(
                    status=MatchStatus.NO_MATCH,
                    error_message=f"Filtrado por {rule_name}",
                    features=features,
                    all_candidates=candidates,
                    context=context
                )

        # 4. Seleccionar mejor candidato
        context.info("Paso 4: Seleccionando mejor candidato")
        best_candidate = self._select_best_candidate(filtered_candidates, features, context)

        if not best_candidate:
            context.error("No se pudo seleccionar candidato final")
            context.stop_timer()
            return MatchResult(
                status=MatchStatus.NO_MATCH,
                error_message="Error en selección de candidato",
                features=features,
                all_candidates=filtered_candidates,
                context=context
            )

        # 5. Construir resultado exitoso
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

    def _select_best_candidate(
        self,
        candidates: List[MatchCandidate],
        features,
        context: MappingContext
    ) -> MatchCandidate | None:
        """
        Selecciona el mejor candidato de la lista filtrada.

        Args:
            candidates: Lista de candidatos (ya filtrados)
            features: Features extraídas
            context: Contexto de mapeo

        Returns:
            Mejor candidato o None
        """
        if not candidates:
            return None

        # Si solo hay 1, retornar ese
        if len(candidates) == 1:
            context.info("Solo 1 candidato, seleccionándolo")
            return candidates[0]

        # Si hay múltiples, ordenar por score y tomar el mejor
        sorted_candidates = sorted(candidates, key=lambda c: c.match_score, reverse=True)
        best = sorted_candidates[0]

        context.info(
            f"Seleccionado mejor de {len(candidates)} candidatos: "
            f"{best.modelo_descripcion} (score={best.match_score:.2f})"
        )

        return best

    def get_supported_device_types(self) -> List[str]:
        """
        Retorna los tipos de dispositivos soportados.

        Returns:
            Lista con todos los tipos de Mac soportados
        """
        return ["MacBook", "Mac mini", "iMac", "Mac Studio", "Mac Pro"]


# Backward compatibility alias
# Permite que código existente que importa MacBookEngine siga funcionando
MacBookEngine = MacEngine
