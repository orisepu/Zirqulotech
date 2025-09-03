from decimal import Decimal
from django.utils import timezone
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from productos.models.modelos import Capacidad  # Modelo/Capacidad
from productos.models.precios import PrecioRecompra, CostoPieza  # precios + costes
from productos.serializers.valoraciones import ComercialIphoneInputSerializer
from productos.services.grading import Params, calcular, v_suelo_desde_max

# --- helpers DB ---

def vigente_precio_recompra(capacidad_id: int, canal: str, tenant_schema: str | None):
    """
    Devuelve precio vigente (Decimal) para capacidad+canal, preferencia por tenant_schema si existe;
    si no hay override de tenant, cae al global (tenant_schema NULL).
    """
    now = timezone.now()
    base = (PrecioRecompra.objects
            .filter(capacidad_id=capacidad_id, canal=canal, valid_from__lte=now)
            .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now)))
    if tenant_schema:
        rows = list(base.filter(tenant_schema=tenant_schema).order_by('-valid_from')[:1])
        if not rows:
            rows = list(base.filter(tenant_schema__isnull=True).order_by('-valid_from')[:1])
    else:
        rows = list(base.filter(tenant_schema__isnull=True).order_by('-valid_from')[:1])
    return rows[0].precio_neto if rows else None

def vigente_coste_pieza(modelo_id: int, capacidad_id: int | None, pieza_names_icase: list[str]) -> Decimal:
    """
    Suma coste neto + MO (horas*tarifa + fija) para la pieza más específica vigente.
    Busca por nombre de pieza (icontains) en PiezaTipo.nombre.
    Si hay versión por capacidad, prioriza esa; si no, usa NULL (por modelo).
    """
    now = timezone.now()
    qs = (CostoPieza.objects
          .filter(modelo_id=modelo_id, valid_from__lte=now)
          .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
          .select_related('mano_obra_tipo','pieza_tipo'))
    # filtra por nombre de pieza
    q_or = Q()
    for nm in pieza_names_icase:
        q_or |= Q(pieza_tipo__nombre__icontains=nm)
    qs = qs.filter(q_or).order_by('-valid_from')

    # preferencia por capacidad exacta
    filas = list(qs.filter(capacidad_id=capacidad_id)[:1]) or list(qs.filter(capacidad__isnull=True)[:1])
    if not filas:
        return Decimal('0')

    row = filas[0]
    coste = Decimal(row.coste_neto or 0)
    tarifa_h = Decimal(row.mano_obra_tipo.coste_por_hora)
    horas = Decimal(row.horas or 0)
    mo_fija = Decimal(row.mano_obra_fija_neta or 0)
    return coste + (tarifa_h * horas) + mo_fija

class IphoneComercialValoracionView(APIView):
    """
    POST /api/valoraciones/iphone/comercial/
    Calcula oferta + telemetría (no persiste).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ComercialIphoneInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        i = ser.validated_data

        # 1) Precio máximo vigente (V_Aplus) por capacidad/canal
        canal = i.get('canal') or 'B2C'
        tenant_schema = i.get('tenant') or None
        v_aplus = vigente_precio_recompra(i['capacidad_id'], canal, tenant_schema)
        if v_aplus is None:
            return Response({"detail": "No hay precio vigente para esa capacidad/canal."}, status=status.HTTP_404_NOT_FOUND)

        V_Aplus = int(Decimal(v_aplus).quantize(Decimal('1')))  # entero €

        # 2) Costes de reparación vigentes por modelo/capacidad (desde tu DB)
        pr_bateria  = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['bater', 'battery']))
        pr_pantalla = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['pant', 'screen', 'display']))
        pr_chasis   = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['chasis','tapa','back','carcasa','housing','glass']))

        # 3) Suelo dinámico
        V_suelo, regla = v_suelo_desde_max(V_Aplus)

        params = Params(
            V_Aplus=V_Aplus,
            pp_A=0.08, pp_B=0.12, pp_C=0.15,
            V_suelo=V_suelo,
            pr_bateria=pr_bateria, pr_pantalla=pr_pantalla, pr_chasis=pr_chasis,
            v_suelo_regla=regla
        )

        out = calcular(params, i)

        return Response({
            **out,
            "params": {
                "V_suelo": params.V_suelo,
                "pp_A": params.pp_A, "pp_B": params.pp_B, "pp_C": params.pp_C,
                "pr_bateria": params.pr_bateria, "pr_pantalla": params.pr_pantalla, "pr_chasis": params.pr_chasis,
                "v_suelo_regla": params.v_suelo_regla,
            },
        }, status=status.HTTP_200_OK)
