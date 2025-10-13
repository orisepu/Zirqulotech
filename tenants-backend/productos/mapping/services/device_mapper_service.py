"""
Device Mapper Service - Facade principal del sistema de mapeo v4.

Coordina múltiples engines de mapeo y provee una API unificada
para mapear dispositivos de Likewize a modelos en la BD.

Este servicio implementa el patrón Facade, ocultando la complejidad
de seleccionar y coordinar engines específicos por tipo de dispositivo.
"""

from typing import List

from productos.mapping.core.interfaces import IDeviceMapper, IMappingEngine
from productos.mapping.core.types import (
    LikewizeInput,
    MatchResult,
    MatchStatus,
    MappingContext,
)
from productos.mapping.engines.iphone_engine import iPhoneEngine
from productos.mapping.engines.ipad_engine import iPadEngine
from productos.mapping.engines.macbook_engine import MacEngine
from productos.mapping.engines.pixel_engine import PixelEngine
from productos.mapping.engines.samsung_engine import SamsungEngine


class DeviceMapperService(IDeviceMapper):
    """
    Servicio principal de mapeo de dispositivos.

    Responsabilidades:
    - Registrar y coordinar múltiples engines
    - Seleccionar el engine apropiado para cada input
    - Delegar el proceso de mapeo al engine seleccionado
    - Proveer una API unificada para todo el sistema

    Uso:
        service = DeviceMapperService()
        result = service.map(LikewizeInput(model_name="iPhone 13 Pro 128GB"))
        if result.status == MatchStatus.SUCCESS:
            print(f"Match encontrado: {result.matched_capacidad_id}")

    Thread-safe: Sí (los engines son stateless)
    """

    def __init__(self):
        """Inicializa el servicio con engines por defecto."""
        self._engines: List[IMappingEngine] = []

        # Registrar engines por defecto
        self._register_default_engines()

    def _register_default_engines(self):
        """Registra los engines por defecto del sistema."""
        # Registrar engines soportados
        self.register_engine(iPhoneEngine())
        self.register_engine(iPadEngine())
        self.register_engine(MacEngine())
        self.register_engine(PixelEngine())
        self.register_engine(SamsungEngine())

    def register_engine(self, engine: IMappingEngine):
        """
        Registra un engine de mapeo.

        Los engines se prueban en el orden en que fueron registrados.
        El primer engine que pueda manejar el input será usado.

        Args:
            engine: Engine a registrar

        Example:
            service = DeviceMapperService()
            service.register_engine(iPadEngine())
            service.register_engine(MacEngine())
        """
        self._engines.append(engine)

    def map(self, input_data: LikewizeInput) -> MatchResult:
        """
        Mapea input de Likewize a un modelo/capacidad en la BD.

        Proceso:
        1. Selecciona el engine apropiado (can_handle)
        2. Delega el mapeo al engine seleccionado
        3. Retorna el resultado del engine

        Args:
            input_data: Datos crudos de Likewize

        Returns:
            MatchResult con el match encontrado o error

        Raises:
            InvalidInputError: Si el input es inválido (ya validado en LikewizeInput)
        """
        # Buscar un engine que pueda manejar este input
        selected_engine = self._select_engine(input_data)

        if not selected_engine:
            # Ningún engine puede manejar este input
            return self._create_no_engine_error(input_data)

        # Delegar al engine seleccionado
        return selected_engine.map(input_data)

    def _select_engine(self, input_data: LikewizeInput) -> IMappingEngine:
        """
        Selecciona el engine apropiado para el input dado.

        Prueba cada engine en orden hasta encontrar uno que
        pueda manejar el input (can_handle retorna True).

        Args:
            input_data: Input a procesar

        Returns:
            El primer engine compatible, o None si no hay ninguno
        """
        for engine in self._engines:
            if engine.can_handle(input_data):
                return engine

        return None

    def _create_no_engine_error(self, input_data: LikewizeInput) -> MatchResult:
        """
        Crea un MatchResult de error cuando no hay engine compatible.

        Args:
            input_data: Input que no pudo ser procesado

        Returns:
            MatchResult con status ERROR
        """
        context = MappingContext(input_data=input_data)
        context.start_timer()
        context.error(
            f"No se encontró un engine capaz de procesar: {input_data.model_name}"
        )
        context.stop_timer()

        return MatchResult(
            status=MatchStatus.ERROR,
            error_message=(
                f"No se encontró un engine capaz de procesar el dispositivo: "
                f"{input_data.model_name}. "
                f"Tipos soportados: iPhone, iPad, MacBook, Pixel"
            ),
            error_code="NO_ENGINE_AVAILABLE",
            context=context
        )

    def get_registered_engines(self) -> List[str]:
        """
        Retorna los nombres de los engines registrados.

        Útil para debugging y logging.

        Returns:
            Lista de nombres de engines (ej: ["iPhoneEngine"])
        """
        return [engine.__class__.__name__ for engine in self._engines]

    def get_supported_device_types(self) -> List[str]:
        """
        Retorna los tipos de dispositivos soportados.

        Returns:
            Lista de tipos (ej: ["iPhone", "iPad", "MacBook", "Pixel", "Samsung"])
        """
        return ["iPhone", "iPad", "MacBook", "Pixel", "Samsung"]
