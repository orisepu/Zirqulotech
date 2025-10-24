from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from rest_framework import status as http_status
from django.utils.dateparse import parse_date
from django.utils.timezone import make_aware
from datetime import datetime, time
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth, TruncWeek, TruncDay
from django.db.models import F, Value, DecimalField, When, Case, IntegerField
from django.db.models.functions import Coalesce
from decimal import Decimal
import logging

from ..models.dispositivo import Dispositivo, DispositivoReal
from ..models.oportunidad import Oportunidad
from ..models.tienda import Tienda
from ..permissions import IsComercialOrAbove, IsStoreManagerOrAbove, IsManagerOnly
from ..utils.role_filters import get_user_rol_tenant
from progeek.models import RolPorTenant
from datetime import timedelta
logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@renderer_classes([JSONRenderer])
def mi_dashboard(request):
    user = request.user
    data = {
        "usuario": getattr(user, "username", user.email),
    }
    return Response(data)


class ValorPorTiendaAPIView(APIView):
    def get(self, request):
        estado_minimo = request.query_params.get("estado_minimo", "Oferta confirmada")
        fecha_inicio_raw = request.query_params.get("fecha_inicio")
        fecha_fin_raw = request.query_params.get("fecha_fin")
        usuario_id = request.query_params.get("usuario")

        fecha_inicio = parse_date(fecha_inicio_raw)
        fecha_fin = parse_date(fecha_fin_raw)

        if not fecha_inicio or not fecha_fin:
            return Response({"error": "Fechas inválidas"}, status=400)

        fecha_inicio = make_aware(datetime.combine(fecha_inicio, time.min))
        fecha_fin = make_aware(datetime.combine(fecha_fin, time.max))

        granularidad = request.query_params.get("granularidad", "mes")

        # Estados completos del flujo
        ESTADOS = [
            "Pendiente", "Aceptado", "Cancelado", "Recogida solicitada", "Recogida generada", "En tránsito", "Recibido",
            "Check in OK", "En revisión", "Oferta confirmada", "Pendiente factura", "Factura recibida", "Pendiente de pago",
            "Pagado", "Nueva oferta enviada", "Rechazada", "Devolución iniciada", "Equipo enviado",
            "Recibido por el cliente", "Nueva oferta confirmada", "Nuevo contrato", "Contrato",
        ]

        # Estados de OPORTUNIDAD (antes de confirmación) para el KPI "Oportunidades"
        ESTADOS_OPORTUNIDAD = [
            "Pendiente", "Aceptado", "Recogida solicitada", "Recogida generada",
            "En tránsito", "Recibido", "Check in OK", "En revisión"
        ]

        # Estados excluidos del cálculo de valor (no tienen valor confirmado)
        ESTADOS_EXCLUIDOS_VALOR = [
            "Nueva oferta enviada","Rechazada", "Devolución iniciada", "Equipo enviado", "Recibido por el cliente","Pendiente",
            "Aceptado", "Cancelado", "Recogida solicitada", "Recogida generada", "En tránsito", "Recibido","Check in OK", "En revisión",
        ]

        if estado_minimo not in ESTADOS:
            return Response({"error": "Estado no válido"}, status=400)

        idx = ESTADOS.index(estado_minimo)
        estados_filtrados = ESTADOS[idx:]  # Para valor y dispositivos (OPERACIONES)

        truncador = {
            "dia": TruncDay,
            "semana": TruncWeek,
            "mes": TruncMonth,
        }.get(granularidad, TruncMonth)

        tiendas = list(Tienda.objects.values_list("nombre", flat=True))

        # Valores: Solo dispositivos reales de OPERACIONES (con valor confirmado)
        valores = DispositivoReal.objects.filter(
            oportunidad__estado__in=estados_filtrados,
            oportunidad__fecha_creacion__date__range=[fecha_inicio.date(), fecha_fin.date()]
        ).exclude(
            oportunidad__estado__in=ESTADOS_EXCLUIDOS_VALOR
        )

        if usuario_id:
            valores = valores.filter(oportunidad__usuario_id=usuario_id)

        valores = valores.annotate(
            grupo=truncador("oportunidad__fecha_creacion")
        ).values(
            "grupo", "oportunidad__tienda__nombre"
        ).annotate(
            total=Sum(Coalesce("precio_final", Value(0), output_field=DecimalField(max_digits=12, decimal_places=0)))
        )

        # Dispositivos: De OPERACIONES (confirmadas)
        dispositivos = Dispositivo.objects.filter(
            oportunidad__estado__in=estados_filtrados,
            oportunidad__fecha_creacion__date__range=[fecha_inicio.date(), fecha_fin.date()]
        )

        if usuario_id:
            dispositivos = dispositivos.filter(oportunidad__usuario_id=usuario_id)

        dispositivos = dispositivos.annotate(
            grupo=truncador("oportunidad__fecha_creacion")
        ).values(
            "grupo", "oportunidad__tienda__nombre"
        ).annotate(
            cantidad_dispositivos=Sum("cantidad")
        )

        # Oportunidades: Solo estados de OPORTUNIDAD (antes de confirmación)
        oportunidades = Oportunidad.objects.filter(
            estado__in=ESTADOS_OPORTUNIDAD,
            fecha_creacion__date__range=[fecha_inicio.date(), fecha_fin.date()]
        )

        if usuario_id:
            oportunidades = oportunidades.filter(usuario_id=usuario_id)

        oportunidades = oportunidades.annotate(
            grupo=truncador("fecha_creacion")
        ).values(
            "grupo", "tienda__nombre"
        ).annotate(
            cantidad_oportunidades=Count("id", distinct=True)
        )

        data = {}

        def format_grupo(dt):
            if granularidad == "dia":
                return dt.strftime("%d/%m/%Y")
            elif granularidad == "semana":
                return f"Semana {dt.strftime('%W')} ({dt.strftime('%d/%m')})"
            else:
                return dt.strftime("%B")

        def init_mes():
            d = {f"{t}": 0.0 for t in tiendas}
            d.update({f"{t}__n_dispositivos": 0 for t in tiendas})
            d.update({f"{t}__n_oportunidades": 0 for t in tiendas})
            return d

        for row in valores:
            clave = format_grupo(row["grupo"])
            tienda = row["oportunidad__tienda__nombre"] or "Sin tienda"
            data.setdefault(clave, init_mes())
            data[clave][tienda] = float(row["total"] or 0)
            data[clave]["__orden"] = row["grupo"]

        for row in dispositivos:
            clave = format_grupo(row["grupo"])
            tienda = row["oportunidad__tienda__nombre"] or "Sin tienda"
            data.setdefault(clave, init_mes())
            data[clave][f"{tienda}__n_dispositivos"] = int(row["cantidad_dispositivos"] or 0)
            data[clave]["__orden"] = row["grupo"]

        for row in oportunidades:
            clave = format_grupo(row["grupo"])
            tienda = row["tienda__nombre"] or "Sin tienda"
            data.setdefault(clave, init_mes())
            data[clave][f"{tienda}__n_oportunidades"] = int(row["cantidad_oportunidades"] or 0)
            data[clave]["__orden"] = row["grupo"]

        claves_posibles = {}
        actual = fecha_inicio
        while actual <= fecha_fin:
            if granularidad == "dia":
                clave = format_grupo(actual)
                claves_posibles[clave] = actual
                actual += timedelta(days=1)
            elif granularidad == "semana":
                clave = format_grupo(actual)
                claves_posibles[clave] = actual
                actual += timedelta(weeks=1)
            else:
                primer_dia = actual.replace(day=1)
                clave = format_grupo(primer_dia)
                claves_posibles[clave] = primer_dia
                next_month = primer_dia.replace(day=28) + timedelta(days=4)
                actual = next_month.replace(day=1)

        for clave, fecha in claves_posibles.items():
            if clave not in data:
                data[clave] = init_mes()
                data[clave]["__orden"] = fecha

        final = []
        for clave, contenido in sorted(data.items(), key=lambda x: x[1].get("__orden", datetime.min)):
            fila = {"mes": clave}
            fila.update({k: v for k, v in contenido.items() if not k.startswith("__")})
            final.append(fila)

        return Response(final)

# ============================================================================
# ENDPOINTS DE COMISIONES POR ROL JERÁRQUICO
# ============================================================================

@api_view(['GET'])
@permission_classes([IsComercialOrAbove])
def kpi_comisiones_comercial(request):
    """
    KPI de comisiones para Comercial (2% sobre operaciones propias cerradas).
    """
    user = request.user
    schema = request.query_params.get("schema")
    
    rol_tenant = get_user_rol_tenant(user, schema)
    if not rol_tenant or not rol_tenant.es_comercial():
        return Response(
            {"detail": "Este endpoint es solo para usuarios con rol Comercial"},
            status=http_status.HTTP_403_FORBIDDEN
        )
    
    # Fechas (mes actual por defecto)
    fecha_inicio = request.query_params.get("fecha_inicio")
    fecha_fin = request.query_params.get("fecha_fin")
    
    if not fecha_inicio or not fecha_fin:
        from django.utils import timezone
        hoy = timezone.now().date()
        fecha_inicio = hoy.replace(day=1)
        fecha_fin = hoy
    else:
        fecha_inicio = parse_date(fecha_inicio)
        fecha_fin = parse_date(fecha_fin)
    
    # Filtrar oportunidades cerradas del comercial
    ops = Oportunidad.objects.filter(
        usuario=user,
        estado="Pagado",
        tienda_id=rol_tenant.tienda_id,
        fecha_creacion__date__gte=fecha_inicio,
        fecha_creacion__date__lte=fecha_fin
    )
    
    agregado = ops.aggregate(
        total=Coalesce(Sum('precio_final'), Decimal('0.00'), output_field=DecimalField()),
        count=Count('id')
    )
    
    total = agregado['total'] or Decimal('0.00')
    comision = (total * Decimal('2.0') / Decimal('100.0')).quantize(Decimal('0.01'))
    
    return Response({
        "rol": "comercial",
        "comision_porcentaje": 2.0,
        "total_operaciones": float(total),
        "comision_total": float(comision),
        "num_operaciones": agregado['count'],
        "periodo": {
            "fecha_inicio": str(fecha_inicio),
            "fecha_fin": str(fecha_fin)
        }
    })


@api_view(['GET'])
@permission_classes([IsStoreManagerOrAbove])
def kpi_comisiones_store_manager(request):
    """
    KPI de comisiones para Store Manager (2% individual + 1% tienda).
    """
    user = request.user
    schema = request.query_params.get("schema")
    
    rol_tenant = get_user_rol_tenant(user, schema)
    if not rol_tenant or not rol_tenant.es_store_manager():
        return Response(
            {"detail": "Este endpoint es solo para Store Manager"},
            status=http_status.HTTP_403_FORBIDDEN
        )
    
    # Fechas
    fecha_inicio = request.query_params.get("fecha_inicio")
    fecha_fin = request.query_params.get("fecha_fin")
    
    if not fecha_inicio or not fecha_fin:
        from django.utils import timezone
        hoy = timezone.now().date()
        fecha_inicio = hoy.replace(day=1)
        fecha_fin = hoy
    else:
        fecha_inicio = parse_date(fecha_inicio)
        fecha_fin = parse_date(fecha_fin)
    
    # 1. Comisión individual (2%)
    ops_indiv = Oportunidad.objects.filter(
        usuario=user,
        estado="Pagado",
        tienda_id=rol_tenant.tienda_id,
        fecha_creacion__date__gte=fecha_inicio,
        fecha_creacion__date__lte=fecha_fin
    )
    
    ag_indiv = ops_indiv.aggregate(
        total=Coalesce(Sum('precio_final'), Decimal('0.00'), output_field=DecimalField()),
        count=Count('id')
    )
    
    total_indiv = ag_indiv['total'] or Decimal('0.00')
    comision_indiv = (total_indiv * Decimal('2.0') / Decimal('100.0')).quantize(Decimal('0.01'))
    
    # 2. Comisión tienda (1%)
    ops_tienda = Oportunidad.objects.filter(
        estado="Pagado",
        tienda_id=rol_tenant.tienda_id,
        fecha_creacion__date__gte=fecha_inicio,
        fecha_creacion__date__lte=fecha_fin
    )
    
    ag_tienda = ops_tienda.aggregate(
        total=Coalesce(Sum('precio_final'), Decimal('0.00'), output_field=DecimalField()),
        count=Count('id')
    )
    
    total_tienda = ag_tienda['total'] or Decimal('0.00')
    comision_tienda = (total_tienda * Decimal('1.0') / Decimal('100.0')).quantize(Decimal('0.01'))
    
    return Response({
        "rol": "store_manager",
        "comision_individual": {
            "porcentaje": 2.0,
            "total_operaciones": float(total_indiv),
            "comision": float(comision_indiv),
            "num_operaciones": ag_indiv['count']
        },
        "comision_tienda": {
            "porcentaje": 1.0,
            "total_tienda": float(total_tienda),
            "comision": float(comision_tienda),
            "num_operaciones": ag_tienda['count']
        },
        "comision_total": float(comision_indiv + comision_tienda),
        "periodo": {
            "fecha_inicio": str(fecha_inicio),
            "fecha_fin": str(fecha_fin)
        }
    })


@api_view(['GET'])
@permission_classes([IsManagerOnly])
def kpi_comisiones_manager(request):
    """
    KPI de comisiones para Manager (comisiones del equipo).
    """
    user = request.user
    schema = request.query_params.get("schema")
    
    rol_tenant = get_user_rol_tenant(user, schema)
    if not rol_tenant or not rol_tenant.es_manager():
        return Response(
            {"detail": "Este endpoint es solo para Manager"},
            status=http_status.HTTP_403_FORBIDDEN
        )
    
    # Fechas
    fecha_inicio = request.query_params.get("fecha_inicio")
    fecha_fin = request.query_params.get("fecha_fin")
    
    if not fecha_inicio or not fecha_fin:
        from django.utils import timezone
        hoy = timezone.now().date()
        fecha_inicio = hoy.replace(day=1)
        fecha_fin = hoy
    else:
        fecha_inicio = parse_date(fecha_inicio)
        fecha_fin = parse_date(fecha_fin)
    
    # Tiendas gestionadas
    es_general = rol_tenant.gestiona_todas_tiendas()
    tiendas_ids = None if es_general else (rol_tenant.managed_store_ids or [])
    
    ops_base = Oportunidad.objects.filter(
        estado="Pagado",
        fecha_creacion__date__gte=fecha_inicio,
        fecha_creacion__date__lte=fecha_fin
    )
    
    if not es_general and tiendas_ids:
        ops_base = ops_base.filter(tienda_id__in=tiendas_ids)
    
    # Tenant actual
    tenant_slug = schema or request.tenant.schema_name
    
    # Comerciales
    roles_com = RolPorTenant.objects.filter(tenant_slug=tenant_slug, rol='comercial')
    if not es_general and tiendas_ids:
        roles_com = roles_com.filter(tienda_id__in=tiendas_ids)
    
    comerciales_detalle = []
    total_com = Decimal('0.00')
    
    for rc in roles_com:
        ops = ops_base.filter(usuario=rc.user_role.user)
        total = ops.aggregate(total=Coalesce(Sum('precio_final'), Decimal('0.00'), output_field=DecimalField()))['total'] or Decimal('0.00')
        comision = (total * Decimal('2.0') / Decimal('100.0')).quantize(Decimal('0.01'))
        total_com += comision
        
        if comision > 0:
            comerciales_detalle.append({
                "usuario": rc.user_role.user.name,
                "email": rc.user_role.user.email,
                "tienda_id": rc.tienda_id,
                "total_operaciones": float(total),
                "comision": float(comision)
            })
    
    # Store Managers
    roles_sm = RolPorTenant.objects.filter(tenant_slug=tenant_slug, rol='store_manager')
    if not es_general and tiendas_ids:
        roles_sm = roles_sm.filter(tienda_id__in=tiendas_ids)
    
    sm_detalle = []
    total_sm = Decimal('0.00')
    
    for rsm in roles_sm:
        # Individual (2%)
        ops_indiv = ops_base.filter(usuario=rsm.user_role.user, tienda_id=rsm.tienda_id)
        total_indiv = ops_indiv.aggregate(total=Coalesce(Sum('precio_final'), Decimal('0.00'), output_field=DecimalField()))['total'] or Decimal('0.00')
        comision_indiv = (total_indiv * Decimal('2.0') / Decimal('100.0')).quantize(Decimal('0.01'))
        
        # Tienda (1%)
        ops_t = ops_base.filter(tienda_id=rsm.tienda_id)
        total_t = ops_t.aggregate(total=Coalesce(Sum('precio_final'), Decimal('0.00'), output_field=DecimalField()))['total'] or Decimal('0.00')
        comision_t = (total_t * Decimal('1.0') / Decimal('100.0')).quantize(Decimal('0.01'))
        
        comision_total_sm = comision_indiv + comision_t
        total_sm += comision_total_sm
        
        if comision_total_sm > 0:
            sm_detalle.append({
                "usuario": rsm.user_role.user.name,
                "email": rsm.user_role.user.email,
                "tienda_id": rsm.tienda_id,
                "comision_individual": float(comision_indiv),
                "comision_tienda": float(comision_t),
                "comision_total": float(comision_total_sm)
            })
    
    return Response({
        "rol": "manager",
        "es_general_manager": es_general,
        "comisiones_comerciales": {
            "total": float(total_com),
            "num_comerciales": len(comerciales_detalle),
            "detalle": comerciales_detalle
        },
        "comisiones_store_managers": {
            "total": float(total_sm),
            "num_store_managers": len(sm_detalle),
            "detalle": sm_detalle
        },
        "comision_total": float(total_com + total_sm),
        "tiendas_gestionadas": tiendas_ids if not es_general else "todas",
        "periodo": {
            "fecha_inicio": str(fecha_inicio),
            "fecha_fin": str(fecha_fin)
        }
    })


@api_view(['GET'])
@permission_classes([IsComercialOrAbove])
def kpi_resumen_por_rol(request):
    """
    Endpoint unificado que retorna KPIs según el rol del usuario.
    """
    user = request.user
    schema = request.query_params.get("schema")
    
    rol_tenant = get_user_rol_tenant(user, schema)
    if not rol_tenant:
        return Response(
            {"detail": "No tienes rol asignado en este tenant"},
            status=http_status.HTTP_403_FORBIDDEN
        )
    
    # Redirigir según el rol
    if rol_tenant.es_comercial():
        return kpi_comisiones_comercial(request)
    elif rol_tenant.es_store_manager():
        return kpi_comisiones_store_manager(request)
    elif rol_tenant.es_manager():
        return kpi_comisiones_manager(request)
    else:
        return Response({
            "rol": rol_tenant.rol,
            "mensaje": "El rol Auditor no tiene comisiones asignadas"
        })
