from rest_framework import viewsets, permissions, filters
from rest_framework.exceptions import PermissionDenied
from django_tenants.utils import schema_context
from ..models.cliente import Cliente, ComentarioCliente
from ..serializers import ClienteSerializer, ComentarioClienteSerializer,ClienteListSerializer
from progeek.models import UserGlobalRole, RolPorTenant
from .pagination import StandardResultsSetPagination
from decimal import Decimal
from django.db.models import Sum, Count, Q, Value, DecimalField
from django.db.models.functions import Coalesce

class ClienteViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    filter_backends = [filters.SearchFilter]
    search_fields = [
        "razon_social", "cif", "contacto", "correo",
        "nombre", "apellidos", "nombre_comercial",
        "nif", "dni_nie", "telefono",
    ]
    ordering_fields = ["razon_social", "nombre", "apellidos", "id", "tienda_id"]

    def get_serializer_class(self):
        # Serializer ligero para list; completo para retrieve/create/update
        return ClienteListSerializer if self.action == "list" else ClienteSerializer
    
    def _es_super(self, user):
        try:
            gr = user.global_role
            return bool(gr.es_superadmin or gr.es_empleado_interno)
        except UserGlobalRole.DoesNotExist:
            return False
        
    def _qs_filtrado(self, qs):
        tipo = self.request.query_params.get("tipo_cliente")
        if tipo:
            qs = qs.filter(tipo_cliente=tipo)

        canal = self.request.query_params.get("canal")
        if canal in ("b2b", "b2c"):
            qs = qs.filter(canal=canal)

        tienda_id = self.request.query_params.get("tienda_id")
        if tienda_id:
            qs = qs.filter(tienda_id=tienda_id)

        return qs

    def get_queryset(self):
        user = self.request.user
        schema = self.request.query_params.get("schema")
        es_super = self._es_super(user)

        if es_super and schema:
            with schema_context(schema):
                qs = Cliente.objects.all()
                return self._qs_filtrado(qs).order_by("id")
            
        tenant_slug = self.request.tenant.schema_name.lower()
        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug)
        except (UserGlobalRole.DoesNotExist, RolPorTenant.DoesNotExist):
            raise PermissionDenied("No tienes permisos en este tenant.")

        if rol.rol == "manager":
            qs = Cliente.objects.all()
        elif rol.tienda_id:
            qs = Cliente.objects.filter(tienda_id=rol.tienda_id)
        else:
            qs = Cliente.objects.none()
        
        qs = qs.select_related("tienda").annotate(
            oportunidades_count=Count("oportunidades", distinct=True),
            valor_total_final=Coalesce(
                Sum(
                    "oportunidades__dispositivos_reales__precio_final",
                    output_field=DecimalField(max_digits=24, decimal_places=6)
                ),
                Value(Decimal("0"), output_field=DecimalField(max_digits=24, decimal_places=6))
            ),
        )
        return self._qs_filtrado(qs).order_by("id")

    def create(self, request, *args, **kwargs):
        schema = request.query_params.get("schema")
        if self._es_super(request.user) and schema:
            with schema_context(schema):
                return super().create(request, *args, **kwargs)
        return super().create(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        schema = request.query_params.get("schema")
        if self._es_super(request.user) and schema:
            with schema_context(schema):
                return super().partial_update(request, *args, **kwargs)
        return super().partial_update(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        user = self.request.user
        tenant_slug = self.request.tenant.schema_name.lower()

        if self._es_super(user) and self.request.query_params.get("schema"):
            serializer.save()
            return

        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug)
        except (UserGlobalRole.DoesNotExist, RolPorTenant.DoesNotExist):
            raise PermissionDenied("No tienes permisos en este tenant.")

        if not rol.tienda_id:
            raise serializers.ValidationError("No tienes tienda asignada.")

        serializer.save(tienda_id=rol.tienda_id)


class ComentarioClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ComentarioClienteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        tenant_slug = self.request.tenant.schema_name.lower()

        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug)
        except RolPorTenant.DoesNotExist:
            return ComentarioCliente.objects.none()

        if rol.rol == "manager":
            return ComentarioCliente.objects.all()
        elif rol.tienda_id:
            return ComentarioCliente.objects.filter(cliente__tienda_id=rol.tienda_id)
        else:
            return ComentarioCliente.objects.none()

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)
