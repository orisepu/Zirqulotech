from .base import ClienteSimpleSerializer
from .oportunidad import OportunidadSerializer, ComentarioOportunidadSerializer, HistorialOportunidadSerializer
from .dispositivo import DispositivoSerializer, DispositivoRealSerializer
from .cliente import ClienteSerializer, ComentarioClienteSerializer,ClienteListSerializer
from .tienda import TiendaSerializer
from .legal import (
    B2CContratoCreateSerializer,
    B2CContratoDetailSerializer,
    B2CContratoKYCFlagsSerializer,
    B2CContratoSerializer,
    LegalTemplateSerializer,
)
from .user import UsuarioTenantSerializer, CustomTokenObtainPairSerializer
from .kpis import DashboardManagerSerializer
from .documento import DocumentoSerializer
from .producto import ModeloSerializer, CapacidadSerializer
from .objetivo import ObjetivoSerializer

__all__ = [
    "ClienteSimpleSerializer",
    "OportunidadSerializer",
    "ComentarioOportunidadSerializer",
    "HistorialOportunidadSerializer",
    "DispositivoSerializer",
    "DispositivoRealSerializer",
    "ClienteSerializer",
    "ComentarioClienteSerializer",
    "TiendaSerializer",
    "B2CContratoCreateSerializer",
    "B2CContratoDetailSerializer",
    "B2CContratoKYCFlagsSerializer",
    "B2CContratoSerializer",
    "LegalTemplateSerializer",
    "UsuarioTenantSerializer",
    "CustomTokenObtainPairSerializer",
    "DashboardManagerSerializer",
    "DocumentoSerializer",
    "ModeloSerializer",
    "CapacidadSerializer",
    "ClienteListSerializer",
    "ObjetivoSerializer",
]
