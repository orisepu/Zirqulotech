from .admincapacidades import (
    ModeloMiniSerializer,
    ModeloCreateSerializer,
    CapacidadAdminListSerializer,
    SetPrecioRecompraSerializer,
    CapacidadAdminUpsertSerializer,
)
from .costespiezas import CostoPiezaListSerializer
from .tiposreparacion import PiezaTipoSerializer,ManoObraTipoSerializer
from .actualizador import TareaLikewizeSerializer,LikewizeCazadorResultadoSerializer
from .valoraciones import (
    ComercialIphoneInputSerializer,
    BaseValoracionInputSerializer,
    ComercialIpadInputSerializer,
    ComercialMacBookInputSerializer,
    ComercialIMacInputSerializer,
    ComercialMacProInputSerializer,
)
__all__ = [
   "ModeloMiniSerializer",
   "ModeloCreateSerializer",
   "CapacidadAdminListSerializer",
   "SetPrecioRecompraSerializer",
   "CapacidadAdminUpsertSerializer",
   "CostoPiezaListSerializer",
   "PiezaTipoSerializer",
   "ManoObraTipoSerializer",
   "TareaLikewizeSerializer",
   "ComercialIphoneInputSerializer",
   "LikewizeCazadorResultadoSerializer",
   "BaseValoracionInputSerializer",
   "ComercialIpadInputSerializer",
   "ComercialMacBookInputSerializer",
   "ComercialIMacInputSerializer",
   "ComercialMacProInputSerializer",
]
