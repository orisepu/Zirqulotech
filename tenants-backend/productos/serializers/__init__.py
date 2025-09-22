from .admincapacidades import (
    ModeloMiniSerializer,
    CapacidadAdminListSerializer,
    SetPrecioRecompraSerializer,
    CapacidadAdminUpsertSerializer,
)
from .costespiezas import CostoPiezaListSerializer
from .tiposreparacion import PiezaTipoSerializer,ManoObraTipoSerializer
from .actualizador import TareaLikewizeSerializer,LikewizeCazadorResultadoSerializer
from .valoraciones import ComercialIphoneInputSerializer
__all__ = [
   "ModeloMiniSerializer",
   "CapacidadAdminListSerializer",
   "SetPrecioRecompraSerializer",
   "CapacidadAdminUpsertSerializer",
   "CostoPiezaListSerializer",
   "PiezaTipoSerializer",
   "ManoObraTipoSerializer",
   "TareaLikewizeSerializer",
   "ComercialIphoneInputSerializer",
   "LikewizeCazadorResultadoSerializer",
]
