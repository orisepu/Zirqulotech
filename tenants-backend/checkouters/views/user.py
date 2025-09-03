from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django_tenants.utils import schema_context, get_public_schema_name
from ..serializers import UsuarioTenantSerializer
from ..permissions import IsTenantManagerOrSuper
from progeek.models import RolPorTenant
from django.db import connection
import logging
logger = logging.getLogger(__name__)


class UsuarioTenantViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsTenantManagerOrSuper]
    serializer_class = UsuarioTenantSerializer

    def _resolve_tenant_slug(self, request, **kwargs):
        path_schema = (kwargs.get("tenant") or kwargs.get("schema") or "").strip().lower()
        qp_schema = (request.query_params.get("schema") or "").strip().lower()
        header_schema = (request.headers.get("X-Tenant") or "").strip().lower()
        req_tenant = getattr(getattr(request, "tenant", None), "schema_name", "") or ""
        conn_schema = (connection.schema_name or "").strip().lower()
        # Prioridad: path > query param > header > request.tenant > connection
        resolved = path_schema or qp_schema or header_schema or req_tenant or conn_schema
        logger.debug(
             "UsuarioTenantViewSet._resolve_tenant_slug | path=%r header=%r req_tenant=%r qp=%r conn=%r -> resolved=%r",
            path_schema, header_schema, req_tenant, qp_schema, conn_schema, resolved
         )
        return resolved or None
    
    def get_serializer_context(self):
       ctx = super().get_serializer_context()
       tenant_slug = self._resolve_tenant_slug(self.request, **getattr(self, "kwargs", {}))
       ctx["tenant_slug"] = tenant_slug
       return ctx
    
    def _get_users_for_tenant(self, tenant_slug: str):
        public_schema = get_public_schema_name() if callable(get_public_schema_name) else "public"
        logger.debug("Entrando en _get_users_for_tenant | tenant_slug=%s | usando schema=%s", tenant_slug, public_schema)
        with schema_context(public_schema):
            qs_roles = RolPorTenant.objects.filter(
                tenant_slug=tenant_slug,
                rol__in=["manager", "empleado"],
            )
            ids = list(qs_roles.values_list("user_role__user_id", flat=True))
            logger.info(
                "Roles encontrados para tenant=%s | count_roles=%d | user_ids=%s",
                tenant_slug, qs_roles.count(), ids
            )
            users_qs = get_user_model().objects.filter(id__in=ids)
            logger.info("Usuarios filtrados para tenant=%s | count_users=%d", tenant_slug, users_qs.count())
            return users_qs

    def get_queryset(self):
        tenant_slug = self._resolve_tenant_slug(self.request, **getattr(self, "kwargs", {}))
        if not tenant_slug:
            # Devuelve vacío, y en list() informamos error 400
            return get_user_model().objects.none()
        return self._get_users_for_tenant(tenant_slug).order_by("id")
    
    def list(self, request, *args, **kwargs):
        tenant_slug = self._resolve_tenant_slug(request, **kwargs)
        if not tenant_slug:
            return Response({"detail": "Falta schema/tenant."}, status=status.HTTP_400_BAD_REQUEST)
        return super().list(request, *args, **kwargs)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        tenant_slug = self._resolve_tenant_slug(self.request, **getattr(self, "kwargs", {}))
        ctx["tenant_slug"] = tenant_slug
        return ctx
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        out = self.get_serializer(instance).data
        return Response(out, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        pk = kwargs.get("pk")
        public_schema = get_public_schema_name() if callable(get_public_schema_name) else "public"
        with schema_context(public_schema):
            instance = get_object_or_404(get_user_model(), id=pk)

        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        out = self.get_serializer(instance).data
        return Response(out, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cambiar_contraseña(request):
    user = request.user
    current_password = request.data.get("current_password")
    new_password = request.data.get("new_password")

    if not current_password or not new_password:
        return Response({"detail": "Debes rellenar todos los campos."}, status=status.HTTP_400_BAD_REQUEST)

    if not user.check_password(current_password):
        return Response({"detail": "La contraseña actual es incorrecta."}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 6:
        return Response({"detail": "La nueva contraseña debe tener al menos 6 caracteres."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()

    return Response({"detail": "Contraseña cambiada correctamente."}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cambiar_contraseña_usuario(request):
    user_id = request.data.get('user_id')
    new_password = request.data.get('new_password')
    tenant_slug = request.tenant.schema_name.lower()

    if not user_id or not new_password:
        return Response({"error": "Faltan datos"}, status=400)

    try:
        rol = request.user.global_role.roles.get(tenant_slug=tenant_slug)
    except (AttributeError, RolPorTenant.DoesNotExist):
        return Response({"error": "No tienes permisos."}, status=403)

    if rol.rol != "manager":
        return Response({"error": "Solo los managers pueden cambiar contraseñas."}, status=403)

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({"error": "Usuario no encontrado"}, status=404)

    user.set_password(new_password)
    user.save()

    return Response({"success": "Contraseña actualizada"})
