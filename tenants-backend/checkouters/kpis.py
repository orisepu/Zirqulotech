from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import OuterRef, Subquery, F, ExpressionWrapper, DurationField, Avg,Count, Q
from .models.dispositivo import Dispositivo,DispositivoReal
from .models.oportunidad import Oportunidad,HistorialOportunidad
from .models.tienda import Tienda
from django.utils.dateparse import parse_date
from datetime import timedelta
from django.utils.timezone import make_aware
from datetime import timedelta, datetime,time
from django.db.models.functions import TruncMonth, TruncWeek, TruncDay
from django.db.models import Sum,DecimalField
from .serializers import DashboardManagerSerializer
from django.db.models.functions import Coalesce
from django.db.models import F, Sum, ExpressionWrapper, DecimalField,Value
DECIMAL = DecimalField(max_digits=12, decimal_places=2)
ZERO_DEC = Value(0, output_field=DECIMAL)

class RankingProductosAPIView(APIView):
    """
    Ranking de productos por modelo.
    Por defecto:
      - estado = 'Pagado'
      - orden = 'valor' (sumatorio de precio_final)
      - sin slice (devuelve todos). Puedes pasar ?limit=10
    Params: tienda, usuario, fecha_inicio, fecha_fin, estado, orden, limit
    """
    def get(self, request):
        estado = request.GET.get('estado', 'Pagado')
        tienda_id = request.GET.get('tienda')
        usuario_id = request.GET.get('usuario')  # ajusta el campo si en Oportunidad es 'creado_por'
        fecha_inicio = request.GET.get('fecha_inicio')  # YYYY-MM-DD
        fecha_fin = request.GET.get('fecha_fin')        # YYYY-MM-DD
        orden = request.GET.get('orden', 'valor')       # 'valor' | 'cantidad'
        try:
            limit = int(request.GET.get('limit')) if request.GET.get('limit') else None
        except ValueError:
            limit = None

        qs = DispositivoReal.objects.all()

        # Filtrado por estado de la oportunidad
        if estado:
            qs = qs.filter(oportunidad__estado=estado)

        # Filtros de tienda / usuario (ajusta el campo de usuario si procede)
        if tienda_id:
            qs = qs.filter(oportunidad__tienda_id=tienda_id)
        if usuario_id:
            qs = qs.filter(oportunidad__usuario_id=usuario_id)

        # Fechas: usa la que te interese para el KPI. Si tienes fecha de pago, úsala.
        # Aquí mantengo fecha_creacion por compatibilidad con tu código actual.
        if fecha_inicio:
            fi = parse_date(fecha_inicio)
            if fi:
                qs = qs.filter(oportunidad__fecha_creacion__date__gte=fi)
        if fecha_fin:
            ff = parse_date(fecha_fin)
            if ff:
                qs = qs.filter(oportunidad__fecha_creacion__date__lte=ff)

        agg = (
            qs.values('modelo__descripcion')
              .annotate(
                  total=Count('id'),
                  total_valor=Coalesce(Sum('precio_final'), 0, output_field=DecimalField(max_digits=12, decimal_places=2)),
              )
        )

        if orden == 'cantidad':
            agg = agg.order_by('-total', '-total_valor')
        else:
            agg = agg.order_by('-total_valor', '-total')

        if limit:
            agg = agg[:limit]

        return Response(list(agg))
    
class TasaConversionAPIView(APIView):
    def get(self, request):
        tienda_id = request.GET.get('tienda')
        usuario_id = request.GET.get('usuario')
        fecha_inicio = request.GET.get('fecha_inicio')
        fecha_fin = request.GET.get('fecha_fin')
        qs = Oportunidad.objects.all()

        if tienda_id:
            qs = qs.filter(tienda_id=tienda_id)
            
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
           
        if fecha_inicio:
            qs = qs.filter(fecha_creacion__date__gte=parse_date(fecha_inicio))
            print(f"🔎 tras filtro fecha_inicio → {qs.count()} oportunidades")
        if fecha_fin:
            qs = qs.filter(fecha_creacion__date__lte=parse_date(fecha_fin))
            print(f"🔎 tras filtro fecha_fin → {qs.count()} oportunidades")
        total = qs.count()
        finalizadas = qs.filter(estado__in=['Pagado']).count()
        print(f"📊 total oportunidades: {total}")
        print(f"✅ oportunidades finalizadas (pagado): {finalizadas}")
        tasa_conversion = (finalizadas / total) * 100 if total > 0 else 0
        print(f"📈 tasa de conversión: {tasa_conversion:.2f}%")
        return Response({
            "total": total,
            "finalizadas": finalizadas,
            "tasa_conversion": round(tasa_conversion, 2),
        })


class TiempoEntreEstadosAPIView(APIView):
    def get(self, request):
        estado_inicio = request.GET.get('estado_inicio')
        estado_fin = request.GET.get('estado_fin')

        if not estado_inicio or not estado_fin:
            return Response({"error": "Debes indicar estado_inicio y estado_fin"}, status=400)

        tienda_id = request.GET.get('tienda')
        usuario_id = request.GET.get('usuario')
        fecha_inicio = request.GET.get('fecha_inicio')
        fecha_fin = request.GET.get('fecha_fin')

        oportunidades = Oportunidad.objects.all()

        if tienda_id:
            oportunidades = oportunidades.filter(tienda_id=tienda_id)
        if usuario_id:
            oportunidades = oportunidades.filter(usuario_id=usuario_id)
        if fecha_inicio:
            oportunidades = oportunidades.filter(fecha_creacion__date__gte=parse_date(fecha_inicio))
        if fecha_fin:
            oportunidades = oportunidades.filter(fecha_creacion__date__lte=parse_date(fecha_fin))

        # Subconsulta: primera vez que llega al estado_inicio
        sub_inicio = HistorialOportunidad.objects.filter(
            oportunidad_id=OuterRef('pk'),
            tipo_evento='cambio_estado',
            estado_nuevo=estado_inicio
        ).order_by('fecha').values('fecha')[:1]

        # Subconsulta: primera vez que llega al estado_fin
        sub_fin = HistorialOportunidad.objects.filter(
            oportunidad_id=OuterRef('pk'),
            tipo_evento='cambio_estado',
            estado_nuevo=estado_fin
        ).order_by('fecha').values('fecha')[:1]

        oportunidades = oportunidades.annotate(
            fecha_inicio=Subquery(sub_inicio),
            fecha_fin=Subquery(sub_fin),
        ).exclude(fecha_inicio__isnull=True, fecha_fin__isnull=True)

        oportunidades = oportunidades.annotate(
            tiempo=ExpressionWrapper(
                F('fecha_fin') - F('fecha_inicio'),
                output_field=DurationField()
            )
        )

        promedio = oportunidades.aggregate(promedio=Avg('tiempo'))['promedio']

        return Response({
            "estado_inicio": estado_inicio,
            "estado_fin": estado_fin,
            "tiempo_medio_segundos": promedio.total_seconds() if promedio else 0,
            "tiempo_medio_horas": round(promedio.total_seconds() / 3600, 2) if promedio else 0,
        })
    

class PipelineEstadosAPIView(APIView):
    def get(self, request):
        tienda_id = request.GET.get('tienda')
        usuario_id = request.GET.get('usuario')
        fecha_inicio = request.GET.get('fecha_inicio')
        fecha_fin = request.GET.get('fecha_fin')

        qs = Oportunidad.objects.all()

        if tienda_id:
            qs = qs.filter(tienda_id=tienda_id)
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_inicio:
            qs = qs.filter(fecha_creacion__date__gte=parse_date(fecha_inicio))
        if fecha_fin:
            qs = qs.filter(fecha_creacion__date__lte=parse_date(fecha_fin))

        resultados = (
            qs.values('estado')
            .annotate(total=Count('id'))
            .order_by('-total')
        )

        return Response(resultados)  
    
class RechazosPorEstadoAPIView(APIView):
    def get(self, request):
        tienda_id = request.GET.get('tienda')
        usuario_id = request.GET.get('usuario')
        fecha_inicio = request.GET.get('fecha_inicio')
        fecha_fin = request.GET.get('fecha_fin')

        estados_rechazo = ['cancelado', 'Recibido por el cliente']

        qs = Oportunidad.objects.filter(estado__in=estados_rechazo)

        if tienda_id:
            qs = qs.filter(tienda_id=tienda_id)
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)
        if fecha_inicio:
            qs = qs.filter(fecha_creacion__date__gte=parse_date(fecha_inicio))
        if fecha_fin:
            qs = qs.filter(fecha_creacion__date__lte=parse_date(fecha_fin))

        resultado = (
            qs.values('estado')
            .annotate(total=Count('id'))
            .order_by('-total')
        )

        return Response(resultado)
    
class ValorPorUsuarioAPIView(APIView):
    def get(self, request):
        estado_minimo = request.query_params.get("estado_minimo", "Oferta confirmada")
        granularidad = request.query_params.get("granularidad", "mes")
        fecha_inicio_raw = request.query_params.get("fecha_inicio")
        fecha_fin_raw = request.query_params.get("fecha_fin")

        fecha_inicio = parse_date(fecha_inicio_raw)
        fecha_fin = parse_date(fecha_fin_raw)

        if not fecha_inicio or not fecha_fin:
            return Response({"error": "Fechas inválidas"}, status=400)

        fecha_inicio = make_aware(datetime.combine(fecha_inicio, time.min))
        fecha_fin = make_aware(datetime.combine(fecha_fin, time.max))

        ESTADOS = [
            "Pendiente", "Aceptado", "Cancelado", "Recogida generada", "En tránsito", "Recibido",
            "En revisión", "Oferta confirmada", "Pendiente factura", "Factura recibida", "Pendiente de pago",
            "Pagado", "Nueva oferta enviada", "Rechazada", "Devolución iniciada", "Equipo enviado",
            "Recibido por el cliente", "Nueva oferta confirmada", "Nuevo contrato", "Contrato",
        ]

        if estado_minimo not in ESTADOS:
            return Response({"error": "Estado no válido"}, status=400)

        idx = ESTADOS.index(estado_minimo)
        estados_filtrados = ESTADOS[idx:]

        # Elegir truncador
        truncador = {
            "dia": TruncDay,
            "semana": TruncWeek,
            "mes": TruncMonth,
        }.get(granularidad, TruncMonth)

       

        # A. Valor total por usuario y periodo
        valores = (
            Dispositivo.objects.filter(
                oportunidad__estado__in=estados_filtrados,
                oportunidad__fecha_creacion__range=[fecha_inicio, fecha_fin]
            )
            .annotate(grupo=truncador("oportunidad__fecha_creacion"))
            .values("grupo", "oportunidad__usuario__name")
            .annotate(
                total=Sum(F("precio_orientativo") * F("cantidad"))
            )
        )

        # B. Dispositivos por usuario y periodo
        dispositivos = (
            Dispositivo.objects.filter(
                oportunidad__estado__in=estados_filtrados,
                oportunidad__fecha_creacion__range=[fecha_inicio, fecha_fin]
            )
            .annotate(grupo=truncador("oportunidad__fecha_creacion"))
            .values("grupo", "oportunidad__usuario__name")
            .annotate(
                cantidad=Sum("cantidad")
            )
        )
         # Usuarios detectados
        usuarios = list(set(row["oportunidad__usuario__name"] for row in dispositivos))

        # C. Oportunidades por usuario y periodo
        oportunidades = (
            Oportunidad.objects.filter(
                estado__in=estados_filtrados,
                fecha_creacion__range=[fecha_inicio, fecha_fin]
            )
            .annotate(grupo=truncador("fecha_creacion"))
            .values("grupo", "usuario__name")
            .annotate(
                cantidad=Count("id", distinct=True)
            )
        )

        # Función para formatear fechas
        def format_grupo(dt):
            if granularidad == "dia":
                return dt.strftime("%d/%m/%Y")
            elif granularidad == "semana":
                return f"Semana {dt.strftime('%W')} ({dt.strftime('%d/%m')})"
            else:
                return dt.strftime("%B")

        # Inicializador de fila por período
        def init_periodo():
            d = {u: 0.0 for u in usuarios}
            d.update({f"{u}__n_dispositivos": 0 for u in usuarios})
            d.update({f"{u}__n_oportunidades": 0 for u in usuarios})
            return d

        # Recopilación de datos
        data = {}

        # A. Valores
        for row in valores:
            clave = format_grupo(row["grupo"])
            nombre = row["oportunidad__usuario__name"] or "Sin nombre"
            data.setdefault(clave, init_periodo())
            data[clave][nombre] = float(row["total"] or 0)
            data[clave]["__orden"] = row["grupo"]

        # B. Dispositivos
        for row in dispositivos:
            clave = format_grupo(row["grupo"])
            nombre = row["oportunidad__usuario__name"] or "Sin nombre"
            data.setdefault(clave, init_periodo())
            data[clave][f"{nombre}__n_dispositivos"] = int(row["cantidad"] or 0)
            data[clave]["__orden"] = row["grupo"]

        # C. Oportunidades
        for row in oportunidades:
            clave = format_grupo(row["grupo"])
            nombre = row["usuario__name"] or "Sin nombre"
            data.setdefault(clave, init_periodo())
            data[clave][f"{nombre}__n_oportunidades"] = int(row["cantidad"] or 0)
            data[clave]["__orden"] = row["grupo"]

        # Rellenar períodos faltantes
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
                data[clave] = init_periodo()
                data[clave]["__orden"] = fecha

        # Formato final
        final = []
        for clave, contenido in sorted(data.items(), key=lambda x: x[1].get("__orden", datetime.min)):
            fila = {"mes": clave}
            fila.update({k: v for k, v in contenido.items() if not k.startswith("__")})
            final.append(fila)

        return Response(final)
    
class ValorPorTiendaManagerAPIView(APIView):
    """
    Datos para manager: valor pagado por tienda/periodo usando fecha de pago (fecha_inicio_pago)
    y sumando DispositivoReal.precio_final. Mantiene el mismo shape que ValorPorTiendaAPIView.
    """

    def get(self, request):
        # Parámetros
        fecha_inicio_raw = request.query_params.get("fecha_inicio")
        fecha_fin_raw = request.query_params.get("fecha_fin")
        granularidad = request.query_params.get("granularidad", "mes")
        tienda_id = request.query_params.get("tienda_id")
        usuario_id = request.query_params.get("usuario_id")

        # Validación fechas
        try:
            fi_date = datetime.fromisoformat(fecha_inicio_raw).date()
            ff_date = datetime.fromisoformat(fecha_fin_raw).date()
        except Exception:
            return Response({"error": "Fechas inválidas. Use YYYY-MM-DD."}, status=400)

        fecha_inicio = make_aware(datetime.combine(fi_date, time.min))
        fecha_fin = make_aware(datetime.combine(ff_date, time.max))

        truncador = {
            "dia": TruncDay,
            "día": TruncDay,
            "semana": TruncWeek,
            "mes": TruncMonth,
        }.get(granularidad, TruncMonth)

        # Lista de tiendas del tenant
        tiendas = list(Tienda.objects.values_list("nombre", flat=True))

        # Base de pago (sólo Pagado y por fecha de pago)
        filtro_pago = dict(
            oportunidad__estado__iexact="Pagado",
            oportunidad__fecha_inicio_pago__range=[fecha_inicio, fecha_fin],
        )
        if tienda_id:
            filtro_pago["oportunidad__tienda_id"] = tienda_id
        if usuario_id:
            filtro_pago["oportunidad__usuario_id"] = usuario_id

        # 1) Valor pagado = suma de precio_final de DispositivoReal
        valores = (
            DispositivoReal.objects.filter(**filtro_pago)
            .annotate(grupo=truncador("oportunidad__fecha_inicio_pago"))
            .values("grupo", "oportunidad__tienda__nombre")
            .annotate(
                total=Sum(Coalesce(F("precio_final"), ZERO_DEC, output_field=DecimalField(max_digits=12, decimal_places=2)))
            )
        )

        # 2) Dispositivos = contar reales en las mismas oportunidades
        dispositivos = (
            DispositivoReal.objects.filter(**filtro_pago)
            .annotate(grupo=truncador("oportunidad__fecha_inicio_pago"))
            .values("grupo", "oportunidad__tienda__nombre")
            .annotate(cantidad_dispositivos=Count("id"))
        )

        # 3) Oportunidades = contar oportunidades Pagado por fecha_inicio_pago
        oportunidades_filtro = dict(
            estado__iexact="Pagado",
            fecha_inicio_pago__range=[fecha_inicio, fecha_fin],
        )
        if tienda_id:
            oportunidades_filtro["tienda_id"] = tienda_id
        if usuario_id:
            oportunidades_filtro["usuario_id"] = usuario_id

        oportunidades = (
            Oportunidad.objects.filter(**oportunidades_filtro)
            .annotate(grupo=truncador("fecha_inicio_pago"))
            .values("grupo", "tienda__nombre")
            .annotate(cantidad_oportunidades=Count("id", distinct=True))
        )

        # Helpers de formato y estructura (idénticos a tu view normal)
        def format_grupo(dt):
            if granularidad in ("dia", "día"):
                return dt.strftime("%d/%m/%Y")
            elif granularidad == "semana":
                return f"Semana {dt.strftime('%W')} ({dt.strftime('%d/%m')})"
            else:
                return dt.strftime("%B")

        def init_periodo():
            d = {f"{t}": 0.0 for t in tiendas}
            d.update({f"{t}__n_dispositivos": 0 for t in tiendas})
            d.update({f"{t}__n_oportunidades": 0 for t in tiendas})
            return d

        data = {}

        # A. Valor total
        for row in valores:
            clave = format_grupo(row["grupo"])
            tienda = row["oportunidad__tienda__nombre"] or "Sin tienda"
            data.setdefault(clave, init_periodo())
            data[clave][tienda] = float(row["total"] or 0)
            data[clave]["__orden"] = row["grupo"]

        # B. Dispositivos
        for row in dispositivos:
            clave = format_grupo(row["grupo"])
            tienda = row["oportunidad__tienda__nombre"] or "Sin tienda"
            data.setdefault(clave, init_periodo())
            data[clave][f"{tienda}__n_dispositivos"] = int(row["cantidad_dispositivos"] or 0)
            data[clave]["__orden"] = row["grupo"]

        # C. Oportunidades
        for row in oportunidades:
            clave = format_grupo(row["grupo"])
            tienda = row["tienda__nombre"] or "Sin tienda"
            data.setdefault(clave, init_periodo())
            data[clave][f"{tienda}__n_oportunidades"] = int(row["cantidad_oportunidades"] or 0)
            data[clave]["__orden"] = row["grupo"]

        # Relleno de huecos (periodos sin datos)
        claves_posibles = {}
        actual = fi_date
        while actual <= ff_date:
            if granularidad in ("dia", "día"):
                clave = format_grupo(actual)
                claves_posibles[clave] = make_aware(datetime.combine(actual, time.min))
                actual += timedelta(days=1)
            elif granularidad == "semana":
                clave = format_grupo(actual)
                claves_posibles[clave] = make_aware(datetime.combine(actual, time.min))
                actual += timedelta(weeks=1)
            else:
                primer_dia = actual.replace(day=1)
                clave = format_grupo(primer_dia)
                claves_posibles[clave] = make_aware(datetime.combine(primer_dia, time.min))
                # avanzar al 1º del mes siguiente
                next_month = primer_dia.replace(day=28) + timedelta(days=4)
                actual = next_month.replace(day=1)

        for clave, fecha in claves_posibles.items():
            if clave not in data:
                data[clave] = init_periodo()
                data[clave]["__orden"] = fecha

        # Ordenar y preparar respuesta
        final = []
        for clave, contenido in sorted(data.items(), key=lambda x: x[1].get("__orden", datetime.min)):
            fila = {"mes": clave}  # conservamos la clave 'mes' como en tu API original
            fila.update({k: v for k, v in contenido.items() if not k.startswith("__")})
            final.append(fila)

        return Response(final)