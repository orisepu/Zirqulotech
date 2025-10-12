"""
Tipos y DTOs para el sistema de mapeo v4.

Este módulo define los tipos de datos fundamentales usados en todo el sistema de mapeo.
Siguiendo principios de Clean Architecture, separamos los tipos de dominio de la implementación.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from decimal import Decimal
from enum import Enum


class DeviceType(str, Enum):
    """Tipos de dispositivos soportados."""
    IPHONE = "iPhone"
    IPAD = "iPad"
    IPAD_PRO = "iPad Pro"
    IPAD_AIR = "iPad Air"
    IPAD_MINI = "iPad mini"
    MACBOOK_PRO = "MacBook Pro"
    MACBOOK_AIR = "MacBook Air"
    IMAC = "iMac"
    MAC_MINI = "Mac mini"
    MAC_PRO = "Mac Pro"
    MAC_STUDIO = "Mac Studio"


class MatchStrategy(str, Enum):
    """Estrategias de matching disponibles."""
    EXACT = "exact"                      # Coincidencia exacta
    GENERATION = "generation"            # Por generación (iPhone 13, iPad 10)
    A_NUMBER = "a_number"                # Por A-number (A2337, A1419)
    NAME = "name"                        # Por nombre del modelo (iPhone 16 Pro)
    FUZZY = "fuzzy"                      # Fuzzy matching (fallback)


class MatchStatus(str, Enum):
    """Estados posibles del resultado de mapeo."""
    SUCCESS = "success"                  # Match encontrado exitosamente
    NO_MATCH = "no_match"                # No se encontró match
    ERROR = "error"                      # Error durante el proceso
    AMBIGUOUS = "ambiguous"              # Múltiples matches con mismo score


@dataclass(frozen=True)
class LikewizeInput:
    """
    DTO de entrada desde Likewize API.

    Representa los datos crudos que recibimos de Likewize para mapear.
    Inmutable para evitar modificaciones accidentales durante el proceso.
    """
    model_name: str                      # "iPhone 13 Pro 128GB"
    m_model: str = ""                    # "MLVD3QL/A" o código de modelo
    full_name: str = ""                  # Nombre completo expandido
    capacity: str = ""                   # "128GB", "256GB" (puede venir vacío)
    device_price: Optional[Decimal] = None  # Precio con IVA
    brand_name: str = "Apple"            # Marca del dispositivo

    # Metadatos opcionales
    phone_model_id: Optional[int] = None
    master_model_id: Optional[str] = None
    product_category: str = ""

    def __post_init__(self):
        """Validación básica de datos requeridos."""
        if not self.model_name or not self.model_name.strip():
            raise ValueError("model_name es requerido y no puede estar vacío")


@dataclass
class ExtractedFeatures:
    """
    Features extraídas del nombre del dispositivo.

    Contiene toda la información estructurada que podemos inferir
    del nombre crudo del dispositivo. Mutable porque se enriquece
    progresivamente (ej: agregar año desde KB).
    """
    # Identificación básica
    device_type: Optional[DeviceType] = None
    brand: str = "Apple"

    # Características numéricas
    generation: Optional[int] = None     # 13, 15, 16 para iPhones
    year: Optional[int] = None           # 2021, 2023, 2024
    storage_gb: Optional[int] = None     # 128, 256, 512, 1024
    screen_size: Optional[float] = None  # 6.1, 12.9 (en pulgadas)

    # Variantes de modelo
    variant: Optional[str] = None        # "Pro", "Max", "SE", "XS", etc.
    has_pro: bool = False
    has_max: bool = False
    has_plus: bool = False
    has_mini: bool = False
    has_air: bool = False

    # Hardware
    cpu: Optional[str] = None            # "A15 Bionic", "M2", "Core i7"
    a_number: Optional[str] = None       # "A2337" (único en Macs)
    cpu_cores: Optional[int] = None      # 8, 10, 12, 14, 16 (MacBook Pro M-series)
    gpu_cores: Optional[int] = None      # 10, 16, 19

    # Conectividad (iPads)
    has_wifi: bool = False
    has_cellular: bool = False

    # Texto original para referencia
    original_text: str = ""

    # Metadatos de extracción
    extraction_confidence: float = 0.0   # 0.0-1.0
    extraction_notes: List[str] = field(default_factory=list)

    def add_note(self, note: str):
        """Agrega una nota sobre el proceso de extracción."""
        self.extraction_notes.append(note)

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario para logging/serialización."""
        return {
            "device_type": self.device_type.value if self.device_type else None,
            "generation": self.generation,
            "year": self.year,
            "storage_gb": self.storage_gb,
            "variant": self.variant,
            "cpu": self.cpu,
            "cpu_cores": self.cpu_cores,  # ← AGREGADO
            "gpu_cores": self.gpu_cores,  # ← AGREGADO
            "a_number": self.a_number,
            "screen_size": self.screen_size,  # También agregar screen_size
            "confidence": self.extraction_confidence,
        }


@dataclass
class MatchCandidate:
    """
    Candidato de matching con su score.

    Representa un modelo/capacidad candidato con información
    sobre qué tan bien coincide y por qué.
    """
    # Referencia a modelo Django
    capacidad_id: int                    # ID de la capacidad candidata
    modelo_id: int                       # ID del modelo
    modelo_descripcion: str              # "iPhone 13 Pro"
    capacidad_tamanio: str               # "128 GB"
    modelo_anio: Optional[int] = None    # 2021

    # Scoring
    match_score: float = 0.0             # 0.0-1.0
    match_strategy: Optional[MatchStrategy] = None

    # Metadata de matching
    match_details: Dict[str, Any] = field(default_factory=dict)

    def __lt__(self, other):
        """Para ordenar candidatos por score (menor que)."""
        return self.match_score < other.match_score


@dataclass
class MatchResult:
    """
    Resultado final del proceso de mapeo.

    Contiene el match exitoso o información sobre por qué falló.
    Incluye metadata completa para debugging y auditoría.
    """
    # Status del resultado
    status: MatchStatus

    # Match encontrado (si status == SUCCESS)
    matched_capacidad_id: Optional[int] = None
    matched_modelo_id: Optional[int] = None
    matched_modelo_descripcion: Optional[str] = None
    matched_capacidad_tamanio: Optional[str] = None

    # Scoring y estrategia
    match_score: float = 0.0             # 0.0-1.0
    match_strategy: Optional[MatchStrategy] = None

    # Features extraídas
    features: Optional[ExtractedFeatures] = None

    # Todos los candidatos encontrados (ordenados por score)
    all_candidates: List[MatchCandidate] = field(default_factory=list)

    # Contexto con logs y metadata
    context: Optional['MappingContext'] = None

    # Error info (si status == ERROR o NO_MATCH)
    error_message: Optional[str] = None
    error_code: Optional[str] = None

    @property
    def success(self) -> bool:
        """Compatibilidad con código legacy."""
        return self.status == MatchStatus.SUCCESS

    @property
    def capacidad_id(self) -> Optional[int]:
        """Compatibilidad con código legacy."""
        return self.matched_capacidad_id

    @property
    def modelo_id(self) -> Optional[int]:
        """Compatibilidad con código legacy."""
        return self.matched_modelo_id

    def to_dict(self) -> Dict[str, Any]:
        """Convierte a diccionario para serialización."""
        return {
            "status": self.status.value,
            "success": self.success,
            "matched_capacidad_id": self.matched_capacidad_id,
            "matched_modelo_id": self.matched_modelo_id,
            "matched_modelo_descripcion": self.matched_modelo_descripcion,
            "matched_capacidad_tamanio": self.matched_capacidad_tamanio,
            "match_score": self.match_score,
            "match_strategy": self.match_strategy.value if self.match_strategy else None,
            "candidates_found": len(self.all_candidates),
            "error": self.error_message,
            "features": self.features.to_dict() if self.features else None,
        }


@dataclass
class LogEntry:
    """Una entrada de log con timestamp y nivel."""
    timestamp: float
    level: str
    message: str

    def __str__(self):
        """Formato legible."""
        from datetime import datetime
        dt = datetime.fromtimestamp(self.timestamp)
        return f"[{self.level}] {dt.strftime('%H:%M:%S.%f')[:-3]} {self.message}"


@dataclass
class MappingContext:
    """
    Contexto de ejecución del mapeo.

    Mantiene estado y logs durante el proceso completo de mapeo.
    Útil para debugging y auditoría.
    """
    input_data: LikewizeInput
    logs: List[LogEntry] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    # Timing
    start_time: Optional[float] = None
    end_time: Optional[float] = None

    def log(self, message: str, level: str = "INFO"):
        """Registra un mensaje con nivel y timestamp."""
        import time
        entry = LogEntry(
            timestamp=time.time(),
            level=level,
            message=message
        )
        self.logs.append(entry)

    def debug(self, message: str):
        """Log nivel DEBUG."""
        self.log(message, "DEBUG")

    def info(self, message: str):
        """Log nivel INFO."""
        self.log(message, "INFO")

    def warning(self, message: str):
        """Log nivel WARNING."""
        self.log(message, "WARNING")

    def error(self, message: str):
        """Log nivel ERROR."""
        self.log(message, "ERROR")

    def set_metadata(self, key: str, value: Any):
        """Almacena metadata del proceso."""
        self.metadata[key] = value

    def start_timer(self):
        """Inicia el timer de ejecución."""
        import time
        self.start_time = time.time()

    def stop_timer(self):
        """Detiene el timer de ejecución."""
        import time
        self.end_time = time.time()

    def get_elapsed_time(self) -> Optional[float]:
        """Retorna el tiempo transcurrido en segundos."""
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return None

    def get_logs_text(self) -> str:
        """Retorna todos los logs como texto."""
        return "\n".join([str(log) for log in self.logs])
