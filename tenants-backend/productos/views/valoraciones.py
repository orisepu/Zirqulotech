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
from rest_framework import status

from productos.models.modelos import Capacidad, Modelo  # Modelo/Capacidad
from checkouters.models.dispositivo import DispositivoReal
from productos.models.precios import PrecioRecompra, CostoPieza  # precios + costes
from productos.serializers.valoraciones import ComercialIphoneInputSerializer
from productos.services.grading import Params, calcular, v_suelo_desde_max

logger = logging.getLogger(__name__)

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
    if rows:
        row = rows[0]
        try:
            logger.info(
                "[valoraciones] vigente_precio_recompra: capacidad_id=%s canal=%s tenant=%s -> precio_neto=%s valid_from=%s valid_to=%s tenant_schema=%s",
                capacidad_id, canal, tenant_schema, getattr(row, 'precio_neto', None), getattr(row, 'valid_from', None), getattr(row, 'valid_to', None), getattr(row, 'tenant_schema', None)
            )
        except Exception:
            pass
        return row.precio_neto
    logger.info(
        "[valoraciones] vigente_precio_recompra: SIN PRECIO capacidad_id=%s canal=%s tenant=%s",
        capacidad_id, canal, tenant_schema
    )
    return None

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
        logger.info(
            "[valoraciones] vigente_coste_pieza: SIN COSTE modelo_id=%s capacidad_id=%s piezas=%s",
            modelo_id, capacidad_id, pieza_names_icase
        )
        return Decimal('0')

    row = filas[0]
    coste = Decimal(row.coste_neto or 0)
    tarifa_h = Decimal(row.mano_obra_tipo.coste_por_hora)
    horas = Decimal(row.horas or 0)
    mo_fija = Decimal(row.mano_obra_fija_neta or 0)
    total = coste + (tarifa_h * horas) + mo_fija
    try:
        logger.info(
            "[valoraciones] vigente_coste_pieza: modelo_id=%s capacidad_id=%s piezas=%s -> coste_neto=%s tarifa_h=%s horas=%s mo_fija=%s total=%s pieza_tipo=%s",
            modelo_id, capacidad_id, pieza_names_icase, coste, tarifa_h, horas, mo_fija, total, getattr(row.pieza_tipo, 'nombre', None)
        )
    except Exception:
        pass
    return total

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
        try:
            logger.info("[valoraciones] Comercial POST payload(validated)=%s", {k: i.get(k) for k in list(i.keys())[:50]})
        except Exception:
            pass

        # Resolver IDs desde dispositivo_id o desde nombres si faltan
        if not i.get('modelo_id') or not i.get('capacidad_id'):
            # Si llega dispositivo_id, priorizamos su modelo/capacidad exactos
            disp_id = i.get('dispositivo_id')
            if disp_id:
                try:
                    d = DispositivoReal.objects.select_related('modelo','capacidad').get(id=disp_id)
                    i['modelo_id'] = d.modelo_id
                    i['capacidad_id'] = d.capacidad_id
                    logger.info("[valoraciones] Comercial usando dispositivo_id=%s -> modelo_id=%s capacidad_id=%s", disp_id, d.modelo_id, d.capacidad_id)
                except DispositivoReal.DoesNotExist:
                    logger.info("[valoraciones] Comercial dispositivo_id=%s no encontrado; se intentará por nombre", disp_id)
                except (DatabaseError, ProgrammingError, OperationalError) as e:
                    logger.warning("[valoraciones] Comercial lookup por dispositivo_id falló (posible esquema público): %s", str(e))

            modelo_id = i.get('modelo_id')
            capacidad_id = i.get('capacidad_id')
            modelo_nombre = (i.get('modelo_nombre') or '').strip()
            capacidad_texto = (i.get('capacidad_texto') or '').strip()

            # Si viene capacidad_id pero no modelo_id, lo inferimos desde la relación
            if capacidad_id and not modelo_id:
                try:
                    cap = Capacidad.objects.select_related('modelo').get(id=capacidad_id)
                    modelo_id = cap.modelo_id
                except Capacidad.DoesNotExist:
                    return Response({"detail": "capacidad_id no válido"}, status=status.HTTP_400_BAD_REQUEST)

            # Si no hay modelo_id y tenemos nombre, prioriza coincidencia exacta; si no, icontains por longitud
            if not modelo_id and modelo_nombre:
                exact = Modelo.objects.filter(descripcion__iexact=modelo_nombre)
                if exact.exists():
                    modelo_id = exact.order_by('id').first().id
                else:
                    mqs = (Modelo.objects
                           .filter(descripcion__icontains=modelo_nombre)
                           .annotate(desc_len=Length('descripcion'))
                           .order_by('desc_len','id'))
                    if not mqs.exists():
                        return Response({"detail": "No se encontró modelo por nombre"}, status=status.HTTP_400_BAD_REQUEST)
                    modelo_id = mqs.first().id

            # Si no hay capacidad_id y tenemos tamaño/nombre y modelo resuelto, buscamos esa capacidad
            if not capacidad_id and capacidad_texto and modelo_id:
                txt = capacidad_texto.lower().replace('gb','').replace('tb','').strip()
                base = Capacidad.objects.filter(modelo_id=modelo_id)
                # primero exacto
                cqs_exact = base.filter(tamaño__iexact=capacidad_texto)
                if cqs_exact.exists():
                    capacidad_id = cqs_exact.order_by('id').first().id
                else:
                    cqs = (base.filter(tamaño__icontains=capacidad_texto) | base.filter(tamaño__icontains=txt))
                    cqs = cqs.annotate(tam_len=Length('tamaño')).order_by('tam_len','id')
                    if not cqs.exists():
                        return Response({"detail": "No se encontró capacidad por texto para ese modelo"}, status=status.HTTP_400_BAD_REQUEST)
                    capacidad_id = cqs.first().id

            # Si tras resolver aún faltan IDs, error de validación
            if not modelo_id or not capacidad_id:
                return Response({"detail": "Faltan modelo_id y/o capacidad_id"}, status=status.HTTP_400_BAD_REQUEST)

            # Actualiza el dict de entrada
            i['modelo_id'] = modelo_id
            i['capacidad_id'] = capacidad_id

        # 1) Precio máximo vigente (V_Aplus) por capacidad/canal
        # Fallbacks sensatos: si no llega canal/tenant en payload, usa el schema activo
        active_schema = getattr(connection, 'schema_name', None)
        tenant_schema = i.get('tenant') or (active_schema if active_schema and active_schema != 'public' else None)
        canal = i.get('canal') or ('B2B' if tenant_schema else 'B2C')
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

        try:
            logger.info(
                "[valoraciones] Comercial params: modelo_id=%s capacidad_id=%s canal=%s tenant=%s V_Aplus=%s V_suelo=%s regla=%s pr_bateria=%s pr_pantalla=%s pr_chasis=%s active_schema=%s",
                i.get('modelo_id'), i.get('capacidad_id'), i.get('canal') or 'B2C', i.get('tenant') or None,
                params.V_Aplus, params.V_suelo, params.v_suelo_regla, params.pr_bateria, params.pr_pantalla, params.pr_chasis,
                getattr(connection, 'schema_name', None)
            )
        except Exception:
            pass

        out = calcular(params, i)

        try:
            logger.info("[valoraciones] Comercial resultado: %s", out)
        except Exception:
            pass

        return Response({
            **out,
            "params": {
                "V_suelo": params.V_suelo,
                "pp_A": params.pp_A, "pp_B": params.pp_B, "pp_C": params.pp_C,
                "pr_bateria": params.pr_bateria, "pr_pantalla": params.pr_pantalla, "pr_chasis": params.pr_chasis,
                "v_suelo_regla": params.v_suelo_regla,
            },
        }, status=status.HTTP_200_OK)




class IphoneAuditoriaValoracionView(APIView):
    """
    POST /api/valoraciones/iphone/auditoria/
    Alias del cálculo técnico; mismo pipeline y serializer que comercial.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ComercialIphoneInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        i = ser.validated_data
        try:
            logger.info("[valoraciones] Auditoria POST payload(validated)=%s", {k: i.get(k) for k in list(i.keys())[:50]})
        except Exception:
            pass

        # Resolver IDs desde dispositivo_id o desde nombres si faltan (misma lógica que comercial)
        if not i.get('modelo_id') or not i.get('capacidad_id'):
            disp_id = i.get('dispositivo_id')
            if disp_id:
                try:
                    d = DispositivoReal.objects.select_related('modelo','capacidad').get(id=disp_id)
                    i['modelo_id'] = d.modelo_id
                    i['capacidad_id'] = d.capacidad_id
                    logger.info("[valoraciones] Auditoria usando dispositivo_id=%s -> modelo_id=%s capacidad_id=%s", disp_id, d.modelo_id, d.capacidad_id)
                except DispositivoReal.DoesNotExist:
                    logger.info("[valoraciones] Auditoria dispositivo_id=%s no encontrado; se intentará por nombre", disp_id)
                except (DatabaseError, ProgrammingError, OperationalError) as e:
                    logger.warning("[valoraciones] Auditoria lookup por dispositivo_id falló (posible esquema público): %s", str(e))
            modelo_id = i.get('modelo_id')
            capacidad_id = i.get('capacidad_id')
            modelo_nombre = (i.get('modelo_nombre') or '').strip()
            capacidad_texto = (i.get('capacidad_texto') or '').strip()

            if capacidad_id and not modelo_id:
                try:
                    cap = Capacidad.objects.select_related('modelo').get(id=capacidad_id)
                    modelo_id = cap.modelo_id
                except Capacidad.DoesNotExist:
                    return Response({"detail": "capacidad_id no válido"}, status=status.HTTP_400_BAD_REQUEST)

            if not modelo_id and modelo_nombre:
                exact = Modelo.objects.filter(descripcion__iexact=modelo_nombre)
                if exact.exists():
                    modelo_id = exact.order_by('id').first().id
                else:
                    mqs = (Modelo.objects
                           .filter(descripcion__icontains=modelo_nombre)
                           .annotate(desc_len=Length('descripcion'))
                           .order_by('desc_len','id'))
                    if not mqs.exists():
                        return Response({"detail": "No se encontró modelo por nombre"}, status=status.HTTP_400_BAD_REQUEST)
                    modelo_id = mqs.first().id

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
                        return Response({"detail": "No se encontró capacidad por texto para ese modelo"}, status=status.HTTP_400_BAD_REQUEST)
                    capacidad_id = cqs.first().id

            if not modelo_id or not capacidad_id:
                return Response({"detail": "Faltan modelo_id y/o capacidad_id"}, status=status.HTTP_400_BAD_REQUEST)

            i['modelo_id'] = modelo_id
            i['capacidad_id'] = capacidad_id

        canal = i.get('canal') or 'B2C'
        tenant_schema = i.get('tenant') or None
        v_aplus = vigente_precio_recompra(i['capacidad_id'], canal, tenant_schema)
        if v_aplus is None:
            return Response({"detail": "No hay precio vigente para esa capacidad/canal."}, status=status.HTTP_404_NOT_FOUND)

        V_Aplus = int(Decimal(v_aplus).quantize(Decimal('1')))

        pr_bateria  = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['bater', 'battery']))
        pr_pantalla = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['pant', 'screen', 'display']))
        pr_chasis   = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['chasis','tapa','back','carcasa','housing','glass']))

        V_suelo, regla = v_suelo_desde_max(V_Aplus)
        params = Params(
            V_Aplus=V_Aplus,
            pp_A=0.08, pp_B=0.12, pp_C=0.15,
            V_suelo=V_suelo,
            pr_bateria=pr_bateria, pr_pantalla=pr_pantalla, pr_chasis=pr_chasis,
            v_suelo_regla=regla
        )

        try:
            logger.info(
                "[valoraciones] Auditoria params: modelo_id=%s capacidad_id=%s canal=%s tenant=%s v_aplus_raw=%s V_Aplus=%s V_suelo=%s regla=%s pr_bateria=%s pr_pantalla=%s pr_chasis=%s active_schema=%s",
                i.get('modelo_id'), i.get('capacidad_id'), canal, tenant_schema,
                v_aplus, V_Aplus, params.V_suelo, params.v_suelo_regla, params.pr_bateria, params.pr_pantalla, params.pr_chasis,
                active_schema
            )
        except Exception:
            pass

        out = calcular(params, i)
        try:
            logger.info("[valoraciones] Auditoria resultado: %s", out)
        except Exception:
            pass
        return Response({
            **out,
            "params": {
                "V_suelo": params.V_suelo,
                "pp_A": params.pp_A, "pp_B": params.pp_B, "pp_C": params.pp_C,
                "pr_bateria": params.pr_bateria, "pr_pantalla": params.pr_pantalla, "pr_chasis": params.pr_chasis,
                "v_suelo_regla": params.v_suelo_regla,
            },
        }, status=status.HTTP_200_OK)
