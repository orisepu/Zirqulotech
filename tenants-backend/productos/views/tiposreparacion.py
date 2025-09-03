from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from productos.models.precios import PiezaTipo, ManoObraTipo, CostoPieza
from productos.serializers.tiposreparacion import (
    PiezaTipoSerializer,
    ManoObraTipoSerializer,
)
from .admincapacidades import AdminPageNumberPagination

class PiezaTipoViewSet(ModelViewSet):
    """
    /api/admin/piezas-tipo/  (GET, POST)
    /api/admin/piezas-tipo/{id}/  (GET, PATCH, DELETE)
    Query params opcionales:
      - q=<texto>  (filtro por nombre icontains)
      - activo=1|0
      - ordering=nombre,-categoria (coma separada)
    """
    permission_classes = [IsAdminUser]
    serializer_class = PiezaTipoSerializer
    queryset = PiezaTipo.objects.all().order_by("nombre")
    pagination_class = AdminPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["activo", "categoria"]
    search_fields = ["nombre", "categoria"]
    ordering_fields = ["id", "nombre", "categoria", "activo"]
    ordering = ["nombre"]

    def get_queryset(self):
        qs = super().get_queryset()
        request = self.request

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(nombre__icontains=q)

        activo = request.query_params.get("activo")
        if activo in ("1", "true", "True", "t", "yes", "y"):
            qs = qs.filter(activo=True)
        elif activo in ("0", "false", "False", "f", "no", "n"):
            qs = qs.filter(activo=False)

        ordering = (request.query_params.get("ordering") or "").strip()
        if ordering:
            qs = qs.order_by(*[frag.strip() for frag in ordering.split(",") if frag.strip()])
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Evita borrar si está referenciado por costes
        if CostoPieza.objects.filter(pieza_tipo=instance).exists():
            return Response(
                {"detail": "No se puede borrar: está en uso por costes de piezas."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class ManoObraTipoViewSet(ModelViewSet):
    """
    /api/admin/mano-obra-tipos/  (GET, POST)
    /api/admin/mano-obra-tipos/{id}/  (GET, PATCH, DELETE)
    Query params opcionales:
      - q=<texto>  (filtro por nombre/descripcion icontains)
      - ordering=nombre,-coste_por_hora
    """
    permission_classes = [IsAdminUser]
    serializer_class = ManoObraTipoSerializer
    queryset = ManoObraTipo.objects.all().order_by("nombre")
    pagination_class = AdminPageNumberPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["nombre", "descripcion"]
    ordering_fields = ["id", "nombre", "coste_por_hora"]
    ordering = ["nombre"]
    def get_queryset(self):
        qs = super().get_queryset()
        request = self.request

        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(nombre__icontains=q) | qs.filter(descripcion__icontains=q)

        ordering = (request.query_params.get("ordering") or "").strip()
        if ordering:
            qs = qs.order_by(*[frag.strip() for frag in ordering.split(",") if frag.strip()])
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Evita borrar si hay costes vinculados
        if CostoPieza.objects.filter(mano_obra_tipo=instance).exists():
            return Response(
                {"detail": "No se puede borrar: hay costes que usan este tipo de mano de obra."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)
