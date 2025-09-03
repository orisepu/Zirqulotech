from collections import defaultdict
from rest_framework.views import APIView
from rest_framework.response import Response
from datetime import timedelta
from django.db.models import Count, Sum, Avg, F, Q
from .models.oportunidad import Oportunidad, HistorialOportunidad
from .models.dispositivo import Dispositivo, DispositivoReal
from decimal import Decimal
from django.db.models import F, Sum, ExpressionWrapper, DecimalField,Value
from django.db.models.functions import Coalesce
from django.db.models.functions import TruncDay, TruncWeek, TruncMonth
from django.utils.dateparse import parse_date
from datetime import timedelta, datetime,time
from rest_framework.permissions import IsAuthenticated
from django_tenants.utils import schema_context

DECIMAL = DecimalField(max_digits=12, decimal_places=2)
ZERO_DEC = Value(0, output_field=DECIMAL)

def calcular_valores_por_usuario(usuario_id, tienda_id, fecha_inicio, fecha_fin, estado_minimo, granularidad):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin),
        estado__gte=estado_minimo
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    dispositivos_reales = DispositivoReal.objects.filter(oportunidad__in=queryset)
    dispositivos = Dispositivo.objects.filter(oportunidad__in=queryset)

    valores_por_usuario = dispositivos_reales.values("oportunidad__usuario__name").annotate(
        total=Sum(
            ExpressionWrapper(
                Coalesce(F("precio_final"), Value(Decimal("0.00"))),
                output_field=DecimalField()
            )
        )
    ).order_by("-total")

    return [
        {"usuario": v["oportunidad__usuario__name"], "total": v["total"] or 0}
        for v in valores_por_usuario
    ]


def calcular_valores_por_tienda(usuario_id, tienda_id, fecha_inicio, fecha_fin, estado_minimo, granularidad):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin),
        estado__gte=estado_minimo
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    dispositivos = (
        DispositivoReal.objects
        .filter(oportunidad__in=queryset)
        .select_related("oportunidad", "oportunidad__tienda", "oportunidad__usuario", "modelo")
    )
   
    valores_por_tienda = (
        dispositivos
        .values("oportunidad__tienda__nombre")
        .annotate(total=Sum(Coalesce(F("precio_final"), ZERO_DEC), output_field=DECIMAL))
        .order_by("-total")
    )
    return [
        {"tienda": v["oportunidad__tienda__nombre"], "total": v["total"] or 0}
        for v in valores_por_tienda
    ]


def calcular_totales_generales(usuario_id, tienda_id, fecha_inicio, fecha_fin, estado_minimo):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin),
        estado__gte=estado_minimo
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)


    oportunidad_ids = queryset.values_list("id", flat=True)
    dispositivos = DispositivoReal.objects.filter(oportunidad_id__in=oportunidad_ids)

    total_valor = dispositivos.aggregate(
        total=Sum(
            ExpressionWrapper(
                F("precio_final"),
                output_field=DecimalField()
            )
        )
    )["total"] or Decimal("0.00")

   
    return {
        "valor_total": total_valor,
        "comision_total": total_valor * Decimal("0.10"),
        "numero_dispositivos": dispositivos.count(),
        "numero_oportunidades": queryset.count(),
    }


def calcular_tasa_conversion(usuario_id, tienda_id, fecha_inicio, fecha_fin):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin)
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    total = queryset.count()
    convertidas = queryset.filter(estado__gte=3).count()

    tasa = (convertidas / total) * 100 if total > 0 else 0.0
    return {
        "tasa": round(tasa, 2),
        "oportunidades_totales": total,
        "oportunidades_convertidas": convertidas,
    }


def calcular_tiempo_respuesta(usuario_id, tienda_id, fecha_inicio, fecha_fin):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin)
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    tiempos = []
    for op in queryset:
        cambio = (
            HistorialOportunidad.objects
            .filter(oportunidad=op, estado_nuevo="Aceptado")
            .order_by("fecha")
            .first()
        )
        if cambio:
            delta = cambio.fecha - op.fecha_creacion
            tiempos.append(delta.total_seconds() / 3600)

    media = sum(tiempos) / len(tiempos) if tiempos else 0
    return {"media_horas": media, "numero_respuestas": len(tiempos)}


def calcular_tiempo_hasta_recogida(usuario_id, tienda_id, fecha_inicio, fecha_fin):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin)
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    tiempos = []
    for op in queryset:
        aceptado = (
            HistorialOportunidad.objects
            .filter(oportunidad=op, estado_nuevo="Aceptado")
            .order_by("fecha")
            .first()
        )
        recogido = (
            HistorialOportunidad.objects
            .filter(
                oportunidad=op,
                estado_nuevo__in=["Recogida generada", "En tránsito", "Recibido"],
            )
            .order_by("fecha")
            .first()
        )
        if aceptado and recogido:
            delta = recogido.fecha - aceptado.fecha
            tiempos.append(delta.total_seconds() / 3600)

    media = sum(tiempos) / len(tiempos) if tiempos else 0
    return {"media_horas": media, "numero_recogidas": len(tiempos)}


def obtener_pipeline(usuario_id, tienda_id, fecha_inicio, fecha_fin,estado_minimo=None, granularidad=None):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin)
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    pipeline = queryset.values("estado").annotate(
        total=Count("id")
    )

    resultado = {}
    for p in pipeline:
        estado = p["estado"]  # por ejemplo: 'pendiente', 'aceptado', etc.
        resultado[estado] = p["total"]

    return resultado


def obtener_rechazos(usuario_id, tienda_id, fecha_inicio, fecha_fin,estado_minimo=None, granularidad=None):
    dispositivos = Dispositivo.objects.filter(
        oportunidad__fecha_creacion__range=(fecha_inicio, fecha_fin),
        oportunidad__estado=("cancelado",'Recibido por el cliente'),
    )
    if usuario_id:
        dispositivos = dispositivos.filter(oportunidad__usuario_id=usuario_id)
    if tienda_id:
        dispositivos = dispositivos.filter(oportunidad__tienda_id=tienda_id)

    estado_funcional = dispositivos.values("estado_funcional").annotate(total=Count("id"))
    estado_estetico = dispositivos.values("estado_fisico").annotate(total=Count("id"))

    return {
        "estado_funcional": {e["estado_funcional"]: e["total"] for e in estado_funcional},
        "estado_estetico": {e["estado_estetico"]: e["total"] for e in estado_estetico},
    }


def obtener_ranking_productos(usuario_id, tienda_id, fecha_inicio, fecha_fin):
    dispositivos = Dispositivo.objects.filter(
        oportunidad__fecha_creacion__range=(fecha_inicio, fecha_fin)
    )
    if usuario_id:
        dispositivos = dispositivos.filter(oportunidad__usuario_id=usuario_id)
    if tienda_id:
        dispositivos = dispositivos.filter(oportunidad__tienda_id=tienda_id)

    ranking = dispositivos.values("modelo__descripcion").annotate(
        total=Sum("cantidad")  # ✅ usa cantidad real
    ).order_by("-total")[:10]

    return [
        {"modelo": r["modelo__descripcion"], "cantidad": r["total"]}
        for r in ranking
    ]

def calcular_resumen_por_usuario(usuario_id, tienda_id, fecha_inicio, fecha_fin, estado_minimo, granularidad):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin),
        estado__gte=estado_minimo,
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    oportunidad_ids = queryset.values_list("id", flat=True)
    dispositivos = DispositivoReal.objects.filter(oportunidad_id__in=oportunidad_ids)

    resumen = dispositivos.values("oportunidad__usuario__name").annotate(
        total=Sum(Coalesce("precio_final", ZERO_DEC), output_field=DECIMAL),
        dispositivos=Count("id"),
        oportunidades=Count("oportunidad", distinct=True)
    ).order_by("-total")

    return [
        {
            "usuario": r["oportunidad__usuario__name"],
            "total": r["total"] or 0,
            "dispositivos": r["dispositivos"] or 0,
            "oportunidades": r["oportunidades"],
        }
        for r in resumen
    ]

def calcular_resumen_por_tienda(usuario_id, tienda_id, fecha_inicio, fecha_fin, estado_minimo, granularidad):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin),
        estado__gte=estado_minimo,
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    oportunidad_ids = queryset.values_list("id", flat=True)
    dispositivos = DispositivoReal.objects.filter(oportunidad_id__in=oportunidad_ids)

    resumen = dispositivos.values("oportunidad__tienda__nombre").annotate(
        total=Sum(Coalesce("precio_final", ZERO_DEC), output_field=DECIMAL),
        dispositivos=Count("id"),
        oportunidades=Count("oportunidad", distinct=True)
    ).order_by("-total")

    return [
        {
            "tienda": r["oportunidad__tienda__nombre"] or "Sin asignar",
            "total": r["total"] or 0,
            "dispositivos": r["dispositivos"] or 0,
            "oportunidades": r["oportunidades"],
        }
        for r in resumen
    ]

def calcular_porcentaje_rechazo(usuario_id, tienda_id, fecha_inicio, fecha_fin, estado_minimo, granularidad):
    total = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin)
    )
    rechazadas = total.filter(estado="Cancelado")

    if usuario_id:
        total = total.filter(usuario_id=usuario_id)
        rechazadas = rechazadas.filter(usuario_id=usuario_id)

    if tienda_id:
        total = total.filter(tienda_id=tienda_id)
        rechazadas = rechazadas.filter(tienda_id=tienda_id)

    total_count = total.count()
    rechazadas_count = rechazadas.count()

    porcentaje = (rechazadas_count / total_count) * 100 if total_count > 0 else 0

    return {
        "rechazadas": rechazadas_count,
        "totales": total_count,
        "porcentaje": round(porcentaje, 2)
    }


def calcular_series_temporales(usuario_id, tienda_id, fecha_inicio, fecha_fin, estado_minimo, granularidad, agrupacion_por, metrica):
    queryset = Oportunidad.objects.filter(
        fecha_creacion__range=(fecha_inicio, fecha_fin),
        estado__gte=estado_minimo,
    )
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    # Determinar función de truncado por fecha
    if granularidad == "dia" or granularidad == "día":
        trunc = TruncDay("fecha_recepcion")
    elif granularidad == "mes":
        trunc = TruncMonth("fecha_recepcion")
    else:
        trunc = TruncWeek("fecha_recepcion")

    oportunidad_ids = queryset.values_list("id", flat=True)
    dispositivos = DispositivoReal.objects.filter(oportunidad_id__in=oportunidad_ids).select_related("oportunidad", "oportunidad__usuario", "oportunidad__tienda")

    # Agregar clave de agrupación y fecha truncada
    if agrupacion_por == "usuario":
        base = dispositivos.annotate(
            grupo=F("oportunidad__usuario__name"),
            fecha=trunc,
        )
    else:  # tienda
        base = dispositivos.annotate(
            grupo=F("oportunidad__tienda__nombre"),
            fecha=trunc,
        )

    # Definir métrica
    if metrica == "oportunidades":
        metric_expr = Count("oportunidad", distinct=True)
    elif metrica == "dispositivos":
        metric_expr = Sum("cantidad")
    else:  # total
        metric_expr = Sum(Coalesce(F("precio_final"), ZERO_DEC), output_field=DECIMAL)

    agrupados = base.values("fecha", "grupo").annotate(valor=metric_expr)

    # Reorganizar como [{fecha, grupo1: x, grupo2: y, ...}]
    resultados = {}
    for fila in agrupados:
        fecha = fila["fecha"].date().isoformat()
        grupo = fila["grupo"] or "Sin asignar"
        valor = float(fila["valor"] or 0)

        if fecha not in resultados:
            resultados[fecha] = {}
        resultados[fecha][grupo] = valor

    # Convertir a lista ordenada por fecha y rellenar con ceros
    fechas_ordenadas = sorted(resultados.keys())
    todos_los_grupos = set()

    # Obtener todos los grupos usados
    for grupos_en_fecha in resultados.values():
        todos_los_grupos.update(grupos_en_fecha.keys())

    # Armar la lista final con ceros donde falte
    lista_final = []
    for fecha in fechas_ordenadas:
        row = {"fecha": fecha}
        for grupo in todos_los_grupos:
            row[grupo] = resultados[fecha].get(grupo, 0)
        lista_final.append(row)

    return lista_final

def calcular_total_pagado(usuario_id=None, tienda_id=None, fecha_inicio=None, fecha_fin=None):
    queryset = Oportunidad.objects.filter(
        estado__in=["Pagado", "Pendiente de pago", "Factura recibida"]
    )

    if fecha_inicio and fecha_fin:
        queryset = queryset.filter(fecha_creacion__range=(fecha_inicio, fecha_fin))
    if usuario_id:
        queryset = queryset.filter(usuario_id=usuario_id)
    if tienda_id:
        queryset = queryset.filter(tienda_id=tienda_id)

    
    dispositivos_reales = DispositivoReal.objects.filter(oportunidad__in=queryset)

    total = dispositivos_reales.aggregate(
        total=Coalesce(
            Sum(Coalesce('precio_final', Value(0), output_field=DecimalField(max_digits=12, decimal_places=2))),
            Value(0),
            output_field=DecimalField(max_digits=12, decimal_places=0),
        )
    )['total'] or 0

    return {'total_pagado': total}

class DashboardTotalPagadoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        usuario_id = request.query_params.get("usuario_id")
        tienda_id = request.query_params.get("tienda_id")
        fecha_inicio = request.query_params.get("fecha_inicio")
        fecha_fin = request.query_params.get("fecha_fin")
        schema = request.query_params.get("schema")

        if getattr(request.user.global_role, "es_superadmin", False):
            if not schema:
                return Response({"detail": "Schema requerido para superadmin"}, status=400)
            with schema_context(schema):
                data = calcular_total_pagado(usuario_id, tienda_id, fecha_inicio, fecha_fin)
        else:
            data = calcular_total_pagado(usuario_id, tienda_id, fecha_inicio, fecha_fin)

        return Response(data)

class DashboardManagerAPIView(APIView):
    def get(self, request):
        fecha_inicio = request.GET.get("fecha_inicio")
        fecha_fin = request.GET.get("fecha_fin")
        estado_minimo = request.GET.get("estado_minimo", "Pendiente")
        granularidad = request.GET.get("granularidad", "mes")
        usuario_id = request.GET.get("usuario")
        tienda_id = request.GET.get("tienda")
        agrupacion_por = request.query_params.get("agrupacion_por", "usuario")
        metrica = request.query_params.get("metrica", "total")

        # parseo de fechas
        fecha_inicio = parse_date(fecha_inicio) or (datetime.today() - timedelta(days=30)).date()
        fecha_fin = parse_date(fecha_fin) or datetime.today().date()
        from .serializers.kpis import DashboardManagerSerializer
        data = DashboardManagerSerializer.collect(
            usuario_id=usuario_id,
            tienda_id=tienda_id,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            estado_minimo=estado_minimo,
            granularidad=granularidad,
            agrupacion_por=agrupacion_por,
            metrica=metrica,
        )
        return Response(data)