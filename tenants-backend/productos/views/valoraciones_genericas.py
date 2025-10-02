# productos/views/valoraciones_genericas.py
"""
Vistas genéricas de valoración que funcionan para todos los tipos de dispositivos.
Usan GradingConfig para determinar las capacidades del dispositivo (batería, pantalla).
"""
from decimal import Decimal
import logging
from django.db import connection
from django.utils import timezone
from django.db.models import Q
from django.db.models.functions import Length
from django.db.utils import DatabaseError, ProgrammingError, OperationalError
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status as http_status

from productos.models.modelos import Capacidad, Modelo
from productos.models.grading_config import GradingConfig
from checkouters.models.dispositivo import DispositivoReal
from productos.models.precios import PrecioRecompra, CostoPieza
from productos.serializers.valoraciones import (
    ComercialIphoneInputSerializer,
    ComercialIpadInputSerializer,
    ComercialMacBookInputSerializer,
    ComercialIMacInputSerializer,
    ComercialMacProInputSerializer,
)
from productos.services.grading import Params, calcular, v_suelo_desde_max

logger = logging.getLogger(__name__)

# --- Helpers DB (reutilizados de valoraciones.py) ---

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
    if rows:
        row = rows[0]
        try:
            logger.info(
                "[valoraciones_genericas] vigente_precio_recompra: capacidad_id=%s canal=%s tenant=%s -> precio_neto=%s",
                capacidad_id, canal, tenant_schema, getattr(row, 'precio_neto', None)
            )
        except Exception:
            pass
        return row.precio_neto
    logger.info(
        "[valoraciones_genericas] vigente_precio_recompra: SIN PRECIO capacidad_id=%s canal=%s tenant=%s",
        capacidad_id, canal, tenant_schema
    )
    return None


def vigente_coste_pieza(modelo_id: int, capacidad_id: int | None, pieza_names_icase: list[str]) -> Decimal:
    """
    Suma coste neto + MO (horas*tarifa + fija) para la pieza más específica vigente.
    """
    now = timezone.now()
    qs = (CostoPieza.objects
          .filter(modelo_id=modelo_id, valid_from__lte=now)
          .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
          .select_related('mano_obra_tipo','pieza_tipo'))
    q_or = Q()
    for nm in pieza_names_icase:
        q_or |= Q(pieza_tipo__nombre__icontains=nm)
    qs = qs.filter(q_or).order_by('-valid_from')

    filas = list(qs.filter(capacidad_id=capacidad_id)[:1]) or list(qs.filter(capacidad__isnull=True)[:1])
    if not filas:
        logger.info(
            "[valoraciones_genericas] vigente_coste_pieza: SIN COSTE modelo_id=%s capacidad_id=%s piezas=%s",
            modelo_id, capacidad_id, pieza_names_icase
        )
        return Decimal('0')

    row = filas[0]
    coste = Decimal(row.coste_neto or 0)
    tarifa_h = Decimal(row.mano_obra_tipo.coste_por_hora)
    horas = Decimal(row.horas or 0)
    mo_fija = Decimal(row.mano_obra_fija_neta or 0)
    total = coste + (tarifa_h * horas) + mo_fija
    return total


# --- Mapeo de tipo dispositivo → Serializer ---

SERIALIZER_MAP = {
    'iPhone': ComercialIphoneInputSerializer,
    'iPad': ComercialIpadInputSerializer,
    'MacBook Air': ComercialMacBookInputSerializer,
    'MacBook Pro': ComercialMacBookInputSerializer,
    'MacBook': ComercialMacBookInputSerializer,
    'iMac': ComercialIMacInputSerializer,
    'Mac Pro': ComercialMacProInputSerializer,
    'Mac Studio': ComercialMacProInputSerializer,
    'Mac mini': ComercialMacProInputSerializer,
}


def get_serializer_for_tipo(tipo: str):
    """Devuelve el serializer adecuado para el tipo de dispositivo."""
    # Buscar coincidencia exacta primero
    if tipo in SERIALIZER_MAP:
        return SERIALIZER_MAP[tipo]

    # Buscar coincidencia parcial (case-insensitive)
    tipo_lower = tipo.lower()
    for key, serializer in SERIALIZER_MAP.items():
        if key.lower() in tipo_lower:
            return serializer

    # Fallback: usar iPhone serializer (más completo)
    logger.warning("[valoraciones_genericas] Tipo '%s' no reconocido, usando iPhone serializer", tipo)
    return ComercialIphoneInputSerializer


class ValoracionComercialGenericaView(APIView):
    """
    POST /api/valoraciones/{tipo}/comercial/
    Vista genérica de valoración comercial que funciona para todos los tipos de dispositivos.

    El tipo de dispositivo se determina desde:
    1. Parámetro de URL (path parameter 'tipo')
    2. Campo 'tipo' en el payload
    3. Modelo asociado al dispositivo_id o modelo_id

    Usa GradingConfig para determinar las capacidades del dispositivo (batería, pantalla).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, tipo=None):
        # Determinar tipo de dispositivo
        tipo_dispositivo = tipo or request.data.get('tipo')

        # Validación inicial con serializer genérico (sin validar tipo específico aún)
        # Primero necesitamos resolver el modelo para obtener su tipo
        modelo_tipo = None

        # Intentar obtener el tipo desde dispositivo_id o modelo_id
        if request.data.get('dispositivo_id'):
            try:
                disp = DispositivoReal.objects.select_related('modelo').get(id=request.data['dispositivo_id'])
                modelo_tipo = disp.modelo.tipo
            except DispositivoReal.DoesNotExist:
                pass
            except (DatabaseError, ProgrammingError, OperationalError):
                pass

        if not modelo_tipo and request.data.get('modelo_id'):
            try:
                modelo = Modelo.objects.get(id=request.data['modelo_id'])
                modelo_tipo = modelo.tipo
            except Modelo.DoesNotExist:
                pass

        # Usar tipo del modelo si está disponible, sino usar el proporcionado
        tipo_dispositivo = modelo_tipo or tipo_dispositivo

        if not tipo_dispositivo:
            return Response({
                "detail": "No se pudo determinar el tipo de dispositivo. Proporciona 'tipo', 'modelo_id' o 'dispositivo_id'."
            }, http_status.HTTP_400_BAD_REQUEST)

        # Obtener serializer adecuado para este tipo
        serializer_class = get_serializer_for_tipo(tipo_dispositivo)
        ser = serializer_class(data=request.data)
        ser.is_valid(raise_exception=True)
        i = ser.validated_data

        try:
            logger.info(
                "[valoraciones_genericas] Comercial POST tipo=%s payload=%s",
                tipo_dispositivo, {k: i.get(k) for k in list(i.keys())[:50]}
            )
        except Exception:
            pass

        # === Resolver IDs desde dispositivo_id o desde nombres ===
        if not i.get('modelo_id') or not i.get('capacidad_id'):
            disp_id = i.get('dispositivo_id')
            if disp_id:
                try:
                    d = DispositivoReal.objects.select_related('modelo','capacidad').get(id=disp_id)
                    i['modelo_id'] = d.modelo_id
                    i['capacidad_id'] = d.capacidad_id
                    tipo_dispositivo = d.modelo.tipo  # Actualizar tipo desde dispositivo real
                except DispositivoReal.DoesNotExist:
                    logger.info("[valoraciones_genericas] dispositivo_id=%s no encontrado", disp_id)
                except (DatabaseError, ProgrammingError, OperationalError) as e:
                    logger.warning("[valoraciones_genericas] lookup dispositivo_id falló: %s", str(e))

            modelo_id = i.get('modelo_id')
            capacidad_id = i.get('capacidad_id')
            modelo_nombre = (i.get('modelo_nombre') or '').strip()
            capacidad_texto = (i.get('capacidad_texto') or '').strip()

            # Resolver capacidad_id → modelo_id
            if capacidad_id and not modelo_id:
                try:
                    cap = Capacidad.objects.select_related('modelo').get(id=capacidad_id)
                    modelo_id = cap.modelo_id
                    tipo_dispositivo = cap.modelo.tipo
                except Capacidad.DoesNotExist:
                    return Response({"detail": "capacidad_id no válido"}, http_status.HTTP_400_BAD_REQUEST)

            # Resolver modelo_nombre → modelo_id
            if not modelo_id and modelo_nombre:
                exact = Modelo.objects.filter(descripcion__iexact=modelo_nombre)
                if exact.exists():
                    m = exact.order_by('id').first()
                    modelo_id = m.id
                    tipo_dispositivo = m.tipo
                else:
                    mqs = (Modelo.objects
                           .filter(descripcion__icontains=modelo_nombre)
                           .annotate(desc_len=Length('descripcion'))
                           .order_by('desc_len','id'))
                    if not mqs.exists():
                        return Response({"detail": "No se encontró modelo por nombre"}, http_status.HTTP_400_BAD_REQUEST)
                    m = mqs.first()
                    modelo_id = m.id
                    tipo_dispositivo = m.tipo

            # Resolver capacidad_texto → capacidad_id
            if not capacidad_id and capacidad_texto and modelo_id:
                txt = capacidad_texto.lower().replace('gb','').replace('tb','').strip()
                base = Capacidad.objects.filter(modelo_id=modelo_id)
                cqs_exact = base.filter(tamaño__iexact=capacidad_texto)
                if cqs_exact.exists():
                    capacidad_id = cqs_exact.order_by('id').first().id
                else:
                    cqs = (base.filter(tamaño__icontains=capacidad_texto) | base.filter(tamaño__icontains=txt))
                    cqs = cqs.annotate(tam_len=Length('tamaño')).order_by('tam_len','id')
                    if not cqs.exists():
                        return Response({"detail": "No se encontró capacidad por texto"}, http_status.HTTP_400_BAD_REQUEST)
                    capacidad_id = cqs.first().id

            if not modelo_id or not capacidad_id:
                return Response({"detail": "Faltan modelo_id y/o capacidad_id"}, http_status.HTTP_400_BAD_REQUEST)

            i['modelo_id'] = modelo_id
            i['capacidad_id'] = capacidad_id

        # === Obtener GradingConfig para este tipo de dispositivo ===
        try:
            grading_config = GradingConfig.objects.get(tipo_dispositivo=tipo_dispositivo, activo=True)
            logger.info("[valoraciones_genericas] GradingConfig encontrado: %s", grading_config)
        except GradingConfig.DoesNotExist:
            # Fallback: usar configuración por defecto (iPhone-like)
            logger.warning(
                "[valoraciones_genericas] No hay GradingConfig para tipo '%s', usando valores por defecto",
                tipo_dispositivo
            )
            grading_config = None

        # === Parámetros de grading ===
        active_schema = getattr(connection, 'schema_name', None)
        tenant_schema = i.get('tenant') or (active_schema if active_schema and active_schema != 'public' else None)
        canal = i.get('canal') or ('B2B' if tenant_schema else 'B2C')

        # 1) Precio máximo vigente (V_Aplus)
        v_aplus = vigente_precio_recompra(i['capacidad_id'], canal, tenant_schema)
        if v_aplus is None:
            return Response({"detail": "No hay precio vigente para esa capacidad/canal."}, http_status.HTTP_404_NOT_FOUND)
        V_Aplus = int(Decimal(v_aplus).quantize(Decimal('1')))

        # 2) Costes de reparación
        pr_bateria  = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['bater', 'battery']))
        pr_pantalla = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['pant', 'screen', 'display']))
        pr_chasis   = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['chasis','tapa','back','carcasa','housing','glass']))

        # 3) Suelo dinámico
        V_suelo, regla = v_suelo_desde_max(V_Aplus)

        # 4) Parámetros de penalización (desde GradingConfig o fallback)
        if grading_config:
            pp_A = float(grading_config.pp_A)
            pp_B = float(grading_config.pp_B)
            pp_C = float(grading_config.pp_C)
            has_battery = grading_config.has_battery
            has_display = grading_config.has_display
        else:
            # Valores por defecto (iPhone-like)
            pp_A, pp_B, pp_C = 0.08, 0.12, 0.15
            has_battery = True
            has_display = True

        params = Params(
            V_Aplus=V_Aplus,
            pp_A=pp_A,
            pp_B=pp_B,
            pp_C=pp_C,
            V_suelo=V_suelo,
            pr_bateria=pr_bateria,
            pr_pantalla=pr_pantalla,
            pr_chasis=pr_chasis,
            v_suelo_regla=regla,
            has_battery=has_battery,
            has_display=has_display,
            tipo_dispositivo=tipo_dispositivo
        )

        try:
            logger.info(
                "[valoraciones_genericas] Params: tipo=%s modelo_id=%s capacidad_id=%s canal=%s V_Aplus=%s pp_A=%s pp_B=%s pp_C=%s has_battery=%s has_display=%s",
                tipo_dispositivo, i['modelo_id'], i['capacidad_id'], canal, V_Aplus, pp_A, pp_B, pp_C, has_battery, has_display
            )
        except Exception:
            pass

        # === Calcular ===
        out = calcular(params, i)

        try:
            logger.info("[valoraciones_genericas] Resultado: %s", out)
        except Exception:
            pass

        # === Respuesta ===
        return Response({
            "tipo_dispositivo": tipo_dispositivo,
            "modelo_id": i['modelo_id'],
            "capacidad_id": i['capacidad_id'],
            "canal": canal,
            "tenant": tenant_schema,
            **out,
            "params": {
                "V_suelo": params.V_suelo,
                "pp_A": params.pp_A,
                "pp_B": params.pp_B,
                "pp_C": params.pp_C,
                "pr_bateria": params.pr_bateria,
                "pr_pantalla": params.pr_pantalla,
                "pr_chasis": params.pr_chasis,
                "v_suelo_regla": params.v_suelo_regla,
            },
        }, http_status.HTTP_200_OK)


class ValoracionAuditoriaGenericaView(APIView):
    """
    POST /api/valoraciones/{tipo}/auditoria/
    Vista genérica de valoración de auditoría (más completa que comercial).

    Similar a ValoracionComercialGenericaView pero con validaciones adicionales
    y campos de auditoría técnica (FMI, SIM lock, blacklist, etc.).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, tipo=None):
        # Por ahora, simplemente delegar a la lógica comercial
        # En el futuro se pueden agregar campos adicionales de auditoría
        comercial_view = ValoracionComercialGenericaView()
        return comercial_view.post(request, tipo=tipo)
