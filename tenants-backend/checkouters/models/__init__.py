from .oportunidad import Oportunidad, HistorialOportunidad, ComentarioOportunidad
from .dispositivo import (
    Dispositivo,
    DispositivoReal,
    Valoracion,
    Reparacion,
    NotaInterna,
    HistorialCambio,
)
# IMPORTANTE: DispositivoPersonalizado ahora está en productos (SHARED_APPS)
# from .dispositivo_personalizado import DispositivoPersonalizado
from .cliente import Cliente, ComentarioCliente, ConsultaCliente
from .tienda import Tienda, UserTenantExtension
from .objetivo import Objetivo
from .legal import B2CContrato, LegalTemplate
from .documento import Documento
from .utils import validar_imei

__all__ = [
    "Oportunidad",
    "HistorialOportunidad",
    "ComentarioOportunidad",
    "Dispositivo",
    "DispositivoReal",
    # "DispositivoPersonalizado",  # Movido a productos (SHARED_APPS)
    "Valoracion",
    "Reparacion",
    "NotaInterna",
    "HistorialCambio",
    "Cliente",
    "ComentarioCliente",
    "ConsultaCliente",
    "Tienda",
    "UserTenantExtension",
    "Objetivo",
    "B2CContrato",
    "LegalTemplate",
    "Documento",
    "validar_imei",
]
