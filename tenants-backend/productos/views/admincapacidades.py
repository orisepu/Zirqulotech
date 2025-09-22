from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Q, OuterRef, Subquery
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from productos.models.modelos import Modelo, Capacidad
from productos.models.precios import PrecioRecompra
from productos.serializers import (
    CapacidadAdminListSerializer,
    CapacidadAdminUpsertSerializer,
    SetPrecioRecompraSerializer,
)


@api_view(["GET"])
def tipos_modelo(request):
    tipos = Modelo.objects.values_list("tipo", flat=True).distinct().order_by("tipo")
    return Response(tipos)


class AdminPageNumberPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


def annotate_capacidades(qs, fecha):
    """Añade anotaciones con precios vigentes B2B/B2C."""

    vigente_base = (
        PrecioRecompra.objects
        .filter(capacidad_id=OuterRef("pk"), valid_from__lte=fecha)
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=fecha))
        .order_by("-valid_from")
    )

    b2b_qs = vigente_base.filter(canal="B2B")
    b2c_qs = vigente_base.filter(canal="B2C")

    return qs.annotate(
        _b2b=Subquery(b2b_qs.values("precio_neto")[:1]),
        _b2b_from=Subquery(b2b_qs.values("valid_from")[:1]),
        _b2b_to=Subquery(b2b_qs.values("valid_to")[:1]),
        _b2b_src=Subquery(b2b_qs.values("fuente")[:1]),
        _b2c=Subquery(b2c_qs.values("precio_neto")[:1]),
        _b2c_from=Subquery(b2c_qs.values("valid_from")[:1]),
        _b2c_to=Subquery(b2c_qs.values("valid_to")[:1]),
        _b2c_src=Subquery(b2c_qs.values("fuente")[:1]),
    )


class CapacidadAdminMixin:
    """Utilidades compartidas entre las vistas admin de capacidades."""

    def _resolve_fecha(self):
        request = getattr(self, "request", None)
        if not request:
            return timezone.now()

        raw = None
        if request.method in ("POST", "PUT", "PATCH"):
            data = getattr(request, "data", None)
            if hasattr(data, "get"):
                raw = data.get("fecha")
        if not raw and hasattr(request, "query_params"):
            raw = request.query_params.get("fecha")
        return parse_datetime(raw or "") or timezone.now()

    def _annotate_single(self, capacidad: Capacidad):
        fecha = self._resolve_fecha()
        qs = annotate_capacidades(
            Capacidad.objects.select_related("modelo").filter(pk=capacidad.pk),
            fecha,
        )
        return qs.first() or capacidad


class CapacidadAdminListView(CapacidadAdminMixin, generics.ListCreateAPIView):
    """Lista y crea capacidades administradas."""

    serializer_class = CapacidadAdminListSerializer
    permission_classes = [IsAdminUser]
    pagination_class = AdminPageNumberPagination

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CapacidadAdminUpsertSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        qs = Capacidad.objects.select_related("modelo")
        params = self.request.query_params

        modelo_id = params.get("modelo_id")
        if modelo_id:
            qs = qs.filter(modelo_id=modelo_id)

        tipo = params.get("tipo")
        if tipo:
            qs = qs.filter(modelo__tipo=tipo)

        q = (params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(modelo__descripcion__icontains=q)
                | Q(tamaño__icontains=q)
                | Q(modelo__procesador__icontains=q)
            )

        fecha = self._resolve_fecha()
        qs = annotate_capacidades(qs, fecha)

        ordering = params.get("ordering") or "modelo__descripcion,tamaño"
        for field in [f.strip() for f in ordering.split(",") if f.strip()]:
            qs = qs.order_by(field, *qs.query.order_by) if qs.query.order_by else qs.order_by(field)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = CapacidadAdminUpsertSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        capacidad = serializer.save()
        annotated = self._annotate_single(capacidad)
        data = CapacidadAdminListSerializer(
            annotated,
            context=self.get_serializer_context(),
        ).data
        headers = self.get_success_headers(data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)


class CapacidadAdminDetailView(CapacidadAdminMixin, generics.RetrieveUpdateAPIView):
    queryset = Capacidad.objects.select_related("modelo")
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CapacidadAdminUpsertSerializer
        return CapacidadAdminListSerializer

    def retrieve(self, request, *args, **kwargs):
        instancia = self.get_object()
        annotated = self._annotate_single(instancia)
        data = CapacidadAdminListSerializer(
            annotated,
            context=self.get_serializer_context(),
        ).data
        return Response(data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instancia = self.get_object()
        serializer = CapacidadAdminUpsertSerializer(
            instancia,
            data=request.data,
            partial=partial,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        capacidad = serializer.save()
        annotated = self._annotate_single(capacidad)
        data = CapacidadAdminListSerializer(
            annotated,
            context=self.get_serializer_context(),
        ).data
        return Response(data)


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
            "valid_to": row.valid_to,
            "fuente": row.fuente,
            "tenant_schema": row.tenant_schema,
        }, status=status.HTTP_201_CREATED)
