from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from django.utils.dateparse import parse_datetime
from django.db.models import Q, OuterRef, Subquery, F, DecimalField, ExpressionWrapper
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from productos.models.precios import PrecioRecompra
from productos.models.modelos import Modelo, Capacidad
from productos.serializers import CapacidadAdminListSerializer,SetPrecioRecompraSerializer
from rest_framework.pagination import PageNumberPagination

@api_view(['GET'])
def tipos_modelo(request):
    tipos = Modelo.objects.values_list('tipo', flat=True).distinct().order_by('tipo')
    return Response(tipos)

class AdminPageNumberPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200

class CapacidadAdminListView(ListAPIView):
    """
    GET /api/admin/capacidades/?modelo_id=&tipo=&q=&fecha=&ordering=
    - Solo admin
    - Devuelve B2B/B2C vigentes a 'fecha' (o now), fuente y vigencias.
    """
    serializer_class = CapacidadAdminListSerializer
    permission_classes = [IsAdminUser]
    pagination_class = AdminPageNumberPagination
    def get_queryset(self):
        qs = Capacidad.objects.select_related("modelo")
        params = self.request.query_params

        # Filtros
        modelo_id = params.get("modelo_id")
        if modelo_id:
            qs = qs.filter(modelo_id=modelo_id)

        tipo = params.get("tipo")
        if tipo:
            qs = qs.filter(modelo__tipo=tipo)

        q = (params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(modelo__descripcion__icontains=q) |
                Q(tamaño__icontains=q) |
                Q(modelo__procesador__icontains=q)
            )

        # Fecha a la que evaluar el vigente
        fecha = parse_datetime(params.get("fecha") or "") or timezone.now()

        # Subqueries de vigente [valid_from, valid_to)
        vigente_base = (PrecioRecompra.objects
                        .filter(capacidad_id=OuterRef('pk'), valid_from__lte=fecha)
                        .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=fecha))
                        .order_by('-valid_from'))

        b2b_qs = vigente_base.filter(canal='B2B')
        b2c_qs = vigente_base.filter(canal='B2C')

        qs = qs.annotate(
            _b2b=Subquery(b2b_qs.values('precio_neto')[:1]),
            _b2b_from=Subquery(b2b_qs.values('valid_from')[:1]),
            _b2b_to=Subquery(b2b_qs.values('valid_to')[:1]),
            _b2b_src=Subquery(b2b_qs.values('fuente')[:1]),
            _b2c=Subquery(b2c_qs.values('precio_neto')[:1]),
            _b2c_from=Subquery(b2c_qs.values('valid_from')[:1]),
            _b2c_to=Subquery(b2c_qs.values('valid_to')[:1]),
            _b2c_src=Subquery(b2c_qs.values('fuente')[:1]),
        )

       

        # Ordenación
        ordering = params.get("ordering") or "modelo__descripcion,tamaño"
        # Permite: ordering=_b2b, -_b2c, tamaño, modelo__tipo, etc.
        # Sanitiza separando por coma
        for field in [f.strip() for f in ordering.split(",") if f.strip()]:
            qs = qs.order_by(field, *qs.query.order_by) if qs.query.order_by else qs.order_by(field)

        return qs

class SetPrecioRecompraAdminView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        ser = SetPrecioRecompraSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        row = ser.save()
        return Response({
            "id": row.id,
            "capacidad_id": row.capacidad_id,
            "canal": row.canal,
            "precio_neto": str(row.precio_neto),
            "valid_from": row.valid_from.isoformat(),
            "valid_to": row.valid_to,  # siempre None al crear
            "fuente": row.fuente,
            "tenant_schema": row.tenant_schema,
        }, status=status.HTTP_201_CREATED)