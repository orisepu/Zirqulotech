"""
Sistema de Mapeo de Dispositivos - API Principal.

Este modulo provee la API unificada para mapear dispositivos
desde datos de Likewize a modelos en la BD.

Soporta multiples versiones del sistema de mapeo:
- v3: Sistema legacy (auto_learning_engine_v3)
- v4: Nuevo sistema modular y robusto

Uso:
    from productos.mapping import map_device

    # Usar v4 (recomendado)
    result = map_device({'FullName': 'iPhone 13 Pro 128GB'}, system='v4')

    # Usar v3 (legacy)
    result = map_device({'FullName': 'iPhone 13 Pro 128GB'}, system='v3')

    # Auto (v4 con fallback a v3)
    result = map_device({'FullName': 'iPhone 13 Pro 128GB'}, system='auto')
"""

from typing import Dict, Any, Optional, Literal
import logging

from productos.mapping.adapters.v3_compatibility import map_device_v4

logger = logging.getLogger(__name__)

# Feature flag para habilitar v4 globalmente
MAPPING_V4_ENABLED = True  # Cambiar a False para rollback instantaneo

# Porcentaje de rollout para A/B testing (0-100)
MAPPING_V4_ROLLOUT_PERCENT = 100  # 100 = todos los dispositivos usan v4


def map_device(
    likewize_data: Dict[str, Any],
    system: Literal['v3', 'v4', 'auto'] = 'auto',
    compare_with_v3: bool = False
) -> Dict[str, Any]:
    """
    Mapea un dispositivo de Likewize a un modelo en la BD.

    API unificada que soporta multiples versiones del sistema.

    Args:
        likewize_data: Dict con datos de Likewize
            {
                'FullName': 'iPhone 13 Pro 128GB',
                'MModel': 'MLVD3QL/A',
                'DevicePrice': '450.00',
                ...
            }

        system: Que sistema usar
            - 'v3': Usa sistema legacy (auto_learning_engine_v3)
            - 'v4': Usa nuevo sistema modular
            - 'auto': Usa v4 con fallback a v3 si falla

        compare_with_v3: Si True, ejecuta ambos sistemas y compara
            (util para validacion y metricas)

    Returns:
        Dict con resultado del mapeo:
            {
                'success': True,
                'capacidad_id': 123,
                'modelo_id': 45,
                'modelo_descripcion': 'iPhone 13 Pro',
                'confidence': 0.95,
                'strategy': 'generation',
                'mapping_version': 'v4',
                ...
            }

    Example:
        >>> # Usar v4 (recomendado)
        >>> result = map_device({'FullName': 'iPhone 13 Pro 128GB'})
        >>> if result['success']:
        ...     print(f"Capacidad ID: {result['capacidad_id']}")

        >>> # Comparar v3 vs v4
        >>> result = map_device(
        ...     {'FullName': 'iPhone 13 Pro 128GB'},
        ...     compare_with_v3=True
        ... )
        >>> if 'comparison' in result:
        ...     print(f"v3 match: {result['comparison']['v3_matched']}")
        ...     print(f"v4 match: {result['comparison']['v4_matched']}")
    """
    # Validar que tenemos datos minimos
    model_name = (
        likewize_data.get('FullName') or
        likewize_data.get('fullName') or
        likewize_data.get('model_name') or
        ""
    )

    if not model_name or not model_name.strip():
        return {
            'success': False,
            'error_message': 'model_name es requerido y no puede estar vacio',
            'error_code': 'INVALID_INPUT',
            'mapping_version': None,
        }

    # Determinar que sistema usar
    if system == 'v3':
        return _map_with_v3(likewize_data)

    elif system == 'v4':
        result = _map_with_v4(likewize_data)

        # Si se pidio comparacion, ejecutar v3 tambien
        if compare_with_v3:
            result_v3 = _map_with_v3(likewize_data)
            result['comparison'] = _compare_results(result_v3, result, model_name)

        return result

    elif system == 'auto':
        # Intentar con v4, fallback a v3 si falla
        if MAPPING_V4_ENABLED:
            try:
                result_v4 = _map_with_v4(likewize_data)

                # Si v4 tuvo exito, usarlo
                if result_v4['success']:
                    return result_v4

                # Si v4 sugiere crear capacidad, NO caer en v3
                # Retornar resultado de v4 con la sugerencia
                if result_v4.get('needs_capacity_creation'):
                    logger.info(
                        f"v4 sugiere crear capacidad para {model_name}. "
                        f"No usando fallback v3."
                    )
                    result_v4['v4_attempted'] = True
                    result_v4['v3_skipped'] = True
                    result_v4['v3_skip_reason'] = 'v4_suggests_capacity_creation'
                    return result_v4

                # Si v4 no encontro match y no sugiere crear capacidad, intentar v3 como fallback
                logger.warning(
                    f"v4 no encontro match para {model_name}, "
                    f"intentando v3 como fallback"
                )
                result_v3 = _map_with_v3(likewize_data)
                result_v3['v4_attempted'] = True
                result_v3['v4_result'] = 'no_match'
                return result_v3

            except Exception as e:
                logger.error(
                    f"v4 fallo para {model_name}: {e}, "
                    f"usando v3 como fallback"
                )
                result_v3 = _map_with_v3(likewize_data)
                result_v3['v4_attempted'] = True
                result_v3['v4_error'] = str(e)
                return result_v3
        else:
            # v4 deshabilitado, usar v3
            return _map_with_v3(likewize_data)

    else:
        raise ValueError(f"Sistema invalido: {system}. Usar 'v3', 'v4', o 'auto'")


def _map_with_v3(likewize_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mapea con sistema v3 (legacy).

    Args:
        likewize_data: Datos de Likewize

    Returns:
        Dict con resultado formato v3
    """
    try:
        # Importar aqui para evitar circular imports
        from productos.services.auto_learning_engine_v3 import mapear_dispositivo as map_v3

        result = map_v3(likewize_data)
        result['mapping_version'] = 'v3'
        return result

    except ImportError:
        logger.error("No se pudo importar auto_learning_engine_v3")
        return {
            'success': False,
            'error_message': 'Sistema v3 no disponible',
            'error_code': 'V3_NOT_AVAILABLE',
            'mapping_version': 'v3',
        }
    except Exception as e:
        logger.error(f"Error en v3: {e}")
        return {
            'success': False,
            'error_message': f'Error en v3: {str(e)}',
            'error_code': 'V3_ERROR',
            'mapping_version': 'v3',
        }


def _map_with_v4(likewize_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Mapea con sistema v4 (nuevo).

    Args:
        likewize_data: Datos de Likewize

    Returns:
        Dict con resultado formato v3 (compatible)
    """
    return map_device_v4(likewize_data)


def _compare_results(
    result_v3: Dict[str, Any],
    result_v4: Dict[str, Any],
    device_name: str
) -> Dict[str, Any]:
    """
    Compara resultados de v3 vs v4.

    Args:
        result_v3: Resultado de v3
        result_v4: Resultado de v4
        device_name: Nombre del dispositivo

    Returns:
        Dict con comparacion
    """
    v3_matched = result_v3.get('success', False)
    v4_matched = result_v4.get('success', False)

    same_result = (
        v3_matched == v4_matched and
        result_v3.get('capacidad_id') == result_v4.get('capacidad_id')
    )

    comparison = {
        'device_name': device_name,
        'v3_matched': v3_matched,
        'v4_matched': v4_matched,
        'same_result': same_result,
        'v3_capacidad_id': result_v3.get('capacidad_id'),
        'v4_capacidad_id': result_v4.get('capacidad_id'),
        'v3_modelo_descripcion': result_v3.get('modelo_descripcion'),
        'v4_modelo_descripcion': result_v4.get('modelo_descripcion'),
        'v3_confidence': result_v3.get('confidence', 0),
        'v4_confidence': result_v4.get('confidence', 0),
    }

    # Log diferencias
    if not same_result:
        logger.warning(
            f"Discrepancia v3 vs v4 para {device_name}:\n"
            f"  v3: {result_v3.get('modelo_descripcion')} "
            f"(capacidad_id={result_v3.get('capacidad_id')}, "
            f"confidence={result_v3.get('confidence', 0):.2f})\n"
            f"  v4: {result_v4.get('modelo_descripcion')} "
            f"(capacidad_id={result_v4.get('capacidad_id')}, "
            f"confidence={result_v4.get('confidence', 0):.2f})"
        )

    return comparison


# Exportar API principal
__all__ = [
    'map_device',
    'map_device_v4',
    'MAPPING_V4_ENABLED',
    'MAPPING_V4_ROLLOUT_PERCENT',
]
