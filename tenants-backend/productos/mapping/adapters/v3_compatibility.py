"""
Adapter de compatibilidad entre v3 y v4.

Convierte entre los formatos de entrada/salida de v3 (dict-based)
y v4 (dataclass-based) para permitir integración transparente.
"""

from typing import Dict, Any, Optional
from decimal import Decimal

from productos.mapping.core.types import LikewizeInput, MatchResult
from productos.mapping.services.device_mapper_service import DeviceMapperService


class V3CompatibilityAdapter:
    """
    Adapter que convierte entre formatos v3 y v4.

    V3 usa dicts con estructura específica.
    V4 usa dataclasses tipados (LikewizeInput, MatchResult).

    Este adapter permite:
    - Convertir dict v3 → LikewizeInput v4
    - Convertir MatchResult v4 → dict v3
    - Usar v4 desde código que espera formato v3
    """

    def __init__(self):
        """Inicializa el adapter con el servicio v4."""
        self._service = DeviceMapperService()

    def map_from_dict(self, likewize_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mapea un dispositivo usando formato v3 (dict).

        Internamente usa v4, pero la API es compatible con v3.

        Args:
            likewize_dict: Dict con formato de Likewize (compatible v3)
                {
                    'FullName': 'iPhone 13 Pro 128GB',
                    'MModel': 'MLVD3QL/A',
                    'Capacity': '128GB',
                    'DevicePrice': '450.00',
                    ...
                }

        Returns:
            Dict con formato v3:
                {
                    'success': True,
                    'capacidad_id': 123,
                    'modelo_id': 45,
                    'modelo_descripcion': 'iPhone 13 Pro',
                    'capacidad_tamanio': '128 GB',
                    'confidence': 0.95,
                    'match_score': 0.95,
                    'strategy': 'generation',
                    'error_message': None,
                    'features': {...},
                    'candidates_count': 1,
                }
        """
        # Convertir dict v3 → LikewizeInput v4
        input_v4 = self._dict_to_likewize_input(likewize_dict)

        # Mapear con v4
        result_v4 = self._service.map(input_v4)

        # Convertir MatchResult v4 → dict v3
        result_dict = self._match_result_to_dict(result_v4)

        return result_dict

    def _dict_to_likewize_input(self, data: Dict[str, Any]) -> LikewizeInput:
        """
        Convierte dict v3 → LikewizeInput v4.

        Soporta múltiples formatos de campos que pueden venir de Likewize:
        - FullName / fullName / full_name
        - MModel / mModel / m_model
        - etc.

        Args:
            data: Dict con datos de Likewize

        Returns:
            LikewizeInput para v4
        """
        # Extraer model_name (campo requerido)
        model_name = (
            data.get('FullName') or
            data.get('fullName') or
            data.get('full_name') or
            data.get('model_name') or
            data.get('ModelName') or
            ""
        )

        # Extraer m_model (código de modelo)
        m_model = (
            data.get('MModel') or
            data.get('mModel') or
            data.get('m_model') or
            data.get('model_code') or
            ""
        )

        # Extraer capacity
        capacity = (
            data.get('Capacity') or
            data.get('capacity') or
            data.get('Storage') or
            ""
        )

        # Extraer device_price
        device_price_raw = (
            data.get('DevicePrice') or
            data.get('device_price') or
            data.get('price') or
            data.get('Price')
        )

        device_price = None
        if device_price_raw is not None:
            try:
                device_price = Decimal(str(device_price_raw))
            except (ValueError, TypeError):
                device_price = None

        # Extraer brand
        brand_name = (
            data.get('BrandName') or
            data.get('brand_name') or
            data.get('brand') or
            "Apple"
        )

        return LikewizeInput(
            model_name=model_name,
            m_model=m_model,
            capacity=capacity,
            device_price=device_price,
            brand_name=brand_name,
            phone_model_id=data.get('PhoneModelId'),
            master_model_id=data.get('MasterModelId'),
            product_category=data.get('ProductCategory', ''),
        )

    def _match_result_to_dict(self, result: MatchResult) -> Dict[str, Any]:
        """
        Convierte MatchResult v4 → dict v3.

        Args:
            result: MatchResult de v4

        Returns:
            Dict compatible con formato v3
        """
        # Detectar si v4 extrajo features válidas pero no encontró la capacidad
        # Esto indica que el modelo existe pero falta crear la capacidad
        features_valid = result.features and result.features.device_type is not None

        # Verificar si el engine detectó que el modelo existe pero falta la capacidad
        # (metadata agregada por MacEngine cuando ANumberMatcher encuentra modelo sin capacidad)
        model_found_but_no_capacity = (
            result.context and
            result.context.metadata.get('capacity_missing_for_model', False)
        )

        should_create_capacity = (
            not result.success and
            features_valid and
            result.features.storage_gb is not None and
            (
                model_found_but_no_capacity or  # Caso específico: modelo encontrado sin capacidad
                (
                    result.error_message and
                    ('Filtrado por' in result.error_message or 'No se encontraron candidatos' in result.error_message)
                )
            )
        )

        output = {
            # Campos básicos (compatibilidad v3)
            'success': result.success,
            'capacidad_id': result.matched_capacidad_id,
            'modelo_id': result.matched_modelo_id,
            'modelo_descripcion': result.matched_modelo_descripcion,
            'capacidad_tamanio': result.matched_capacidad_tamanio,

            # Scoring
            'confidence': result.match_score,
            'match_score': result.match_score,

            # Estrategia y metadata
            'strategy': result.match_strategy.value if result.match_strategy else None,
            'match_strategy': result.match_strategy.value if result.match_strategy else None,

            # Status
            'status': result.status.value,

            # Error info
            'error_message': result.error_message,
            'error_code': result.error_code,

            # Features extraídas
            'features': result.features.to_dict() if result.features else None,

            # Candidatos
            'candidates_count': len(result.all_candidates),
            'all_candidates': [
                {
                    'capacidad_id': c.capacidad_id,
                    'modelo_id': c.modelo_id,
                    'modelo_descripcion': c.modelo_descripcion,
                    'capacidad_tamanio': c.capacidad_tamanio,
                    'score': c.match_score,
                }
                for c in result.all_candidates[:5]  # Top 5 candidatos
            ],

            # Timing y logs
            'elapsed_time': result.context.get_elapsed_time() if result.context else None,
            'logs_count': len(result.context.logs) if result.context else 0,

            # Metadata adicional
            'mapping_version': 'v4',

            # Flag para indicar que se debe crear la capacidad
            'needs_capacity_creation': should_create_capacity,
        }

        # Si necesita crear capacidad, agregar sugerencia ENRIQUECIDA
        if should_create_capacity:
            output['suggested_action'] = 'create_capacity'
            # IMPORTANTE: Pasar context para enriquecer con capacidades existentes/comunes
            output['suggested_capacity'] = self._build_capacity_suggestion(
                result.features,
                result.context  # ← Pasar context con model_ids
            )

            # Si encontramos modelo(s) específico(s) que necesitan la capacidad, incluirlos
            if result.context and result.context.metadata.get('model_ids_found'):
                output['suggested_capacity']['model_ids'] = result.context.metadata.get('model_ids_found')
                output['suggested_capacity']['model_found'] = True
            else:
                output['suggested_capacity']['model_found'] = False

        return output

    def _build_capacity_suggestion(self, features, context=None) -> Dict[str, Any]:
        """
        Construye sugerencia ENRIQUECIDA de capacidad a crear.

        Incluye:
        - Capacidades existentes del modelo (en BD)
        - Capacidades que existen en Likewize para ese modelo
        - Capacidades faltantes (diferencia entre Likewize y BD)

        Args:
            features: ExtractedFeatures de v4
            context: MappingContext opcional (contiene model_ids_found)

        Returns:
            Dict con sugerencia enriquecida
        """
        suggestion = {
            'device_type': features.device_type.value if features.device_type else None,
            'variant': features.variant,
            'storage_gb': features.storage_gb,
            'year': features.year,
            'generation': features.generation,
        }

        # Agregar campos específicos por tipo
        if features.screen_size:
            suggestion['screen_size'] = features.screen_size
        if features.cpu:
            suggestion['cpu'] = features.cpu
        if features.cpu_cores:
            suggestion['cpu_cores'] = features.cpu_cores
        if features.gpu_cores:
            suggestion['gpu_cores'] = features.gpu_cores
        if features.has_cellular is not None:
            suggestion['connectivity'] = 'Cellular' if features.has_cellular else 'Wi-Fi'

        # NUEVO: Enriquecer con capacidades existentes si tenemos model_ids
        if context and context.metadata.get('model_ids_found'):
            model_ids = context.metadata.get('model_ids_found')

            if model_ids and len(model_ids) > 0:
                # IMPORTANTE: Si hay múltiples modelos, filtrar por CPU/GPU cores
                # Esto es crítico para A-numbers ambiguos como A2816 (Mac mini M2 vs M2 Pro)
                modelo_id = self._select_best_model_by_cores(model_ids, features)

                # Obtener capacidades existentes en BD
                existing_caps = self._get_existing_capacities(modelo_id)
                suggestion['existing_capacities'] = existing_caps

                # Obtener capacidades que existen en Likewize para este modelo
                # Buscar por A-number principalmente
                likewize_caps = self._get_likewize_capacities_for_model(features)
                suggestion['likewize_capacities'] = likewize_caps

                # Calcular capacidades faltantes (en Likewize pero no en BD)
                missing = set(likewize_caps) - set(existing_caps)
                suggestion['missing_capacities'] = sorted(list(missing))

                # Agregar descripción del modelo para contexto en UI
                suggestion['modelo_descripcion'] = self._get_modelo_descripcion(modelo_id)

        return suggestion

    def _get_existing_capacities(self, modelo_id: int) -> list[int]:
        """
        Obtiene capacidades existentes para un modelo (en GB).

        Args:
            modelo_id: ID del modelo

        Returns:
            Lista de capacidades en GB (ej: [64, 128, 256, 512])
        """
        from productos.models.modelos import Capacidad

        capacidades = Capacidad.objects.filter(
            modelo_id=modelo_id,
            activo=True
        ).values_list('tamaño', flat=True)

        # Convertir "512 GB" → 512, "1 TB" → 1024
        return sorted([self._parse_storage_gb(cap) for cap in capacidades if self._parse_storage_gb(cap) > 0])

    def _parse_storage_gb(self, tamanio_str: str) -> int:
        """
        Convierte '512 GB' o '1 TB' a GB numérico.

        Args:
            tamanio_str: String como "512 GB", "1 TB", "256GB"

        Returns:
            Capacidad en GB (512, 1024, 256)
        """
        import re

        match = re.search(r'(\d+(?:\.\d+)?)\s*(TB|GB)', tamanio_str, re.I)
        if not match:
            return 0

        value = float(match.group(1))
        unit = match.group(2).upper()

        return int(value * 1024 if unit == 'TB' else value)

    def _get_common_capacities_for_device_type(self, device_type) -> list[int]:
        """
        Retorna capacidades comunes para un tipo de dispositivo.

        Args:
            device_type: DeviceType enum

        Returns:
            Lista de capacidades típicas en GB
        """
        from productos.mapping.core.types import DeviceType

        capacity_sets = {
            DeviceType.IPHONE: [64, 128, 256, 512, 1024],
            DeviceType.IPAD_PRO: [128, 256, 512, 1024, 2048],
            DeviceType.IPAD_AIR: [64, 128, 256],
            DeviceType.IPAD_MINI: [64, 256],
            DeviceType.IPAD: [64, 256],
            DeviceType.MACBOOK_PRO: [256, 512, 1024, 2048, 4096, 8192],
            DeviceType.MACBOOK_AIR: [256, 512, 1024, 2048],
            DeviceType.MAC_MINI: [256, 512, 1024, 2048, 4096, 8192],  # M2 Pro soporta hasta 8TB
            DeviceType.IMAC: [256, 512, 1024, 2048],
            DeviceType.MAC_STUDIO: [512, 1024, 2048, 4096, 8192],
            DeviceType.MAC_PRO: [1024, 2048, 4096, 8192],
        }

        return capacity_sets.get(device_type, [64, 128, 256, 512, 1024])

    def _get_likewize_capacities_for_model(self, features) -> list[int]:
        """
        Obtiene capacidades que existen en Likewize para un modelo específico.

        Busca en LikewizeItemStaging items que matchean con:
        - Mismo A-number (prioritario)
        - Mismo CPU + CPU cores + GPU cores (para Mac sin A-number)
        - Mismo device type + variant + year (fallback)

        Args:
            features: ExtractedFeatures con a_number, cpu, cores, etc.

        Returns:
            Lista de capacidades encontradas en Likewize (GB), ordenada
        """
        from productos.models import LikewizeItemStaging
        from django.db.models import Q

        capacities = set()

        # 1. Buscar por A-number (más confiable)
        if features.a_number:
            items = LikewizeItemStaging.objects.filter(
                a_number=features.a_number
            ).values_list('almacenamiento_gb', flat=True).distinct()

            capacities.update([gb for gb in items if gb and gb > 0])

        # 2. Si no hay A-number o no encontramos suficientes capacidades, buscar por CPU/cores
        if len(capacities) < 2 and features.cpu:
            query = Q(cpu__icontains=features.cpu)

            # Para Mac mini/MacBook/iMac, agregar filtros de cores si existen
            if features.cpu_cores:
                # Buscar en modelo_norm algo como "12 Core CPU"
                query &= Q(modelo_norm__icontains=f'{features.cpu_cores} Core CPU')

            if features.gpu_cores:
                query &= Q(modelo_norm__icontains=f'{features.gpu_cores} Core GPU')

            items = LikewizeItemStaging.objects.filter(query).values_list(
                'almacenamiento_gb', flat=True
            ).distinct()

            capacities.update([gb for gb in items if gb and gb > 0])

        # 3. Fallback: usar capacidades comunes para el tipo de dispositivo
        if len(capacities) == 0:
            return self._get_common_capacities_for_device_type(features.device_type)

        return sorted(list(capacities))

    def _get_modelo_descripcion(self, modelo_id: int) -> str:
        """
        Obtiene descripción del modelo por ID.

        Args:
            modelo_id: ID del modelo

        Returns:
            Descripción del modelo
        """
        from productos.models.modelos import Modelo

        try:
            return Modelo.objects.get(id=modelo_id).descripcion
        except Modelo.DoesNotExist:
            return "Modelo desconocido"

    def _select_best_model_by_cores(self, model_ids: list, features) -> int:
        """
        Selecciona el mejor modelo cuando hay múltiples con el mismo A-number.

        Usa CPU/GPU cores para desambiguar modelos con A-number compartido.
        Crítico para casos como:
        - A2816: Mac mini M2 10-Core vs M2 Pro 12-Core
        - A3403: MacBook Pro M4 Pro 14-Core vs 16-Core

        Args:
            model_ids: Lista de IDs de modelos candidatos
            features: ExtractedFeatures con cpu, cpu_cores, gpu_cores

        Returns:
            ID del modelo que mejor matchea
        """
        from productos.models.modelos import Modelo

        # Si solo hay 1 modelo, retornar ese
        if len(model_ids) == 1:
            return model_ids[0]

        # Obtener todos los modelos
        modelos = Modelo.objects.filter(id__in=model_ids)

        best_modelo_id = model_ids[0]  # Default: primer modelo
        best_score = 0

        for modelo in modelos:
            score = 0

            # 1. Match de chip variant (M2 vs M2 Pro vs M2 Max)
            if features.cpu:
                cpu_lower = features.cpu.lower()
                procesador_lower = modelo.procesador.lower() if modelo.procesador else ""

                # Match exacto del chip completo
                if cpu_lower == procesador_lower:
                    score += 50  # Peso alto: chip variant exacto
                # Match parcial: "M2 Pro" contiene "M2"
                elif cpu_lower in procesador_lower or procesador_lower in cpu_lower:
                    score += 25

            # 2. Match de CPU cores (crítico para Mac mini M2 10-Core vs M2 Pro 12-Core)
            if features.cpu_cores:
                # Buscar CPU cores en la descripción
                import re
                desc_lower = modelo.descripcion.lower()
                cpu_cores_match = re.search(r'(\d+)\s+core\s+cpu', desc_lower)

                if cpu_cores_match:
                    modelo_cpu_cores = int(cpu_cores_match.group(1))
                    if modelo_cpu_cores == features.cpu_cores:
                        score += 30  # Peso alto: CPU cores exacto
                    else:
                        # Penalizar diferencia
                        diff = abs(modelo_cpu_cores - features.cpu_cores)
                        score -= diff * 5

            # 3. Match de GPU cores (crítico para Mac mini M2 16-Core GPU vs M2 Pro 19-Core GPU)
            if features.gpu_cores:
                import re
                desc_lower = modelo.descripcion.lower()
                gpu_cores_match = re.search(r'(\d+)\s+core\s+gpu', desc_lower)

                if gpu_cores_match:
                    modelo_gpu_cores = int(gpu_cores_match.group(1))
                    if modelo_gpu_cores == features.gpu_cores:
                        score += 20  # Peso medio: GPU cores exacto
                    else:
                        # Penalizar diferencia
                        diff = abs(modelo_gpu_cores - features.gpu_cores)
                        score -= diff * 3

            # Actualizar mejor modelo si este tiene mejor score
            if score > best_score:
                best_score = score
                best_modelo_id = modelo.id

        return best_modelo_id


def map_device_v4(likewize_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Función helper para mapear con v4 usando formato v3.

    Esta es la función que debe usar el código legacy para
    adoptar v4 sin cambiar su interfaz.

    Args:
        likewize_dict: Dict con datos de Likewize (formato v3)

    Returns:
        Dict con resultado (formato v3)

    Example:
        >>> result = map_device_v4({
        ...     'FullName': 'iPhone 13 Pro 128GB',
        ...     'DevicePrice': '450.00'
        ... })
        >>> if result['success']:
        ...     print(f"Match: {result['capacidad_id']}")
    """
    adapter = V3CompatibilityAdapter()
    return adapter.map_from_dict(likewize_dict)
