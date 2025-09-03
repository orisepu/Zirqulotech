from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, renderer_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.renderers import JSONRenderer
from django.utils.dateparse import parse_date
from django.utils.timezone import make_aware
from datetime import datetime, time
from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth, TruncWeek, TruncDay
from django.db.models import F, Value, DecimalField, When, Case, IntegerField
from django.db.models.functions import Coalesce
import logging

from ..models.dispositivo import Dispositivo, DispositivoReal
from ..models.oportunidad import Oportunidad
from ..models.tienda import Tienda
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

        fecha_inicio = parse_date(fecha_inicio_raw)
        fecha_fin = parse_date(fecha_fin_raw)

        if not fecha_inicio or not fecha_fin:
            return Response({"error": "Fechas inválidas"}, status=400)

        fecha_inicio = make_aware(datetime.combine(fecha_inicio, time.min))
        fecha_fin = make_aware(datetime.combine(fecha_fin, time.max))

        granularidad = request.query_params.get("granularidad", "mes")

        ESTADOS = [
            "Pendiente", "Aceptado", "Cancelado", "Recogida generada", "En tránsito", "Recibido",
            "En revisión", "Oferta confirmada", "Pendiente factura", "Factura recibida", "Pendiente de pago",
            "Pagado", "Nueva oferta enviada", "Rechazada", "Devolución iniciada", "Equipo enviado",
            "Recibido por el cliente", "Nueva oferta confirmada", "Nuevo contrato", "Contrato",
        ]
        ESTADOS_EXCLUIDOS_VALOR = [
            "Nueva oferta enviada","Rechazada", "Devolución iniciada", "Equipo enviado", "Recibido por el cliente","Pendiente",
            "Aceptado", "Cancelado", "Recogida generada", "En tránsito", "Recibido","En revisión",
        ]

        if estado_minimo not in ESTADOS:
            return Response({"error": "Estado no válido"}, status=400)

        idx = ESTADOS.index(estado_minimo)
        estados_filtrados = ESTADOS[idx:]

        truncador = {
            "dia": TruncDay,
            "semana": TruncWeek,
            "mes": TruncMonth,
        }.get(granularidad, TruncMonth)

        tiendas = list(Tienda.objects.values_list("nombre", flat=True))

        valores = DispositivoReal.objects.filter(
            oportunidad__estado__in=estados_filtrados,
            oportunidad__fecha_creacion__range=[fecha_inicio, fecha_fin]
        ).exclude(
            oportunidad__estado__in=ESTADOS_EXCLUIDOS_VALOR
        ).annotate(
            grupo=truncador("oportunidad__fecha_creacion")
        ).values(
            "grupo", "oportunidad__tienda__nombre"
        ).annotate(
            total=Sum(Coalesce("precio_final", Value(0), output_field=DecimalField(max_digits=12, decimal_places=0)))
        )

        dispositivos = Dispositivo.objects.filter(
            oportunidad__estado__in=estados_filtrados,
            oportunidad__fecha_creacion__range=[fecha_inicio, fecha_fin]
        ).annotate(
            grupo=truncador("oportunidad__fecha_creacion")
        ).values(
            "grupo", "oportunidad__tienda__nombre"
        ).annotate(
            cantidad_dispositivos=Sum("cantidad")
        )

        oportunidades = Oportunidad.objects.filter(
            estado__in=estados_filtrados,
            fecha_creacion__range=[fecha_inicio, fecha_fin]
        ).annotate(
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
