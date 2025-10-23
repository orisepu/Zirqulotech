import logging
from django.core.exceptions import PermissionDenied
from django_tenants.middleware.main import TenantMainMiddleware
from tenant_users.permissions.models import UserTenantPermissions
from django.db import connection
from django.utils import timezone
from zoneinfo import ZoneInfo


logger = logging.getLogger(__name__)

# Rutas que no requieren tenant resolution en el middleware
PUBLIC_ROUTES = [
    "/api/login/",
    "/api/token/",
    "/api/token/refresh/",
    "/api/yo/",
    "/api/pipeline-oportunidades/",
    "/api/resumen-global/",
    "/admin/",
    "/static/",
]

class HeaderTenantMiddleware(TenantMainMiddleware):
    """
    Middleware que permite seleccionar el tenant mediante cabecera `X-Tenant`
    y verifica que el usuario tenga permisos en ese tenant.
    """

    def process_request(self, request):
        self.request = request

        # Verificar si hay parámetro schema o header X-Tenant para el admin
        schema_param = request.headers.get("X-Tenant") or request.headers.get("x-tenant") or request.GET.get("schema")

        # Si es admin con schema específico, NO hacer bypass
        if request.path.startswith("/admin/") and schema_param:
            logger.debug("Admin con schema específico: %s → procesando con tenant resolution", schema_param)
            # Continuar con el proceso normal de tenant resolution
            response = super().process_request(request)

            user = getattr(request, "user", None)
            if user and user.is_authenticated:
                # Solo verificar permisos si no estamos en el esquema `public`
                if connection.schema_name != 'public':
                    try:
                        _ = user.usertenantpermissions
                    except UserTenantPermissions.DoesNotExist:
                        raise PermissionDenied("No tienes permisos en este tenant.")

            return response

        # Bypass para rutas públicas - establecer schema público como base
        # El view puede usar schema_context() para cambiar temporalmente
        if any(request.path.startswith(route) for route in PUBLIC_ROUTES):
            logger.debug("Ruta pública detectada: %s → estableciendo base en schema público", request.path)
            connection.set_schema_to_public()
            # Establecer un tenant público mínimo para evitar errores
            from django_tenants.utils import get_tenant_model, get_public_schema_name
            TenantModel = get_tenant_model()
            try:
                request.tenant = TenantModel.objects.get(schema_name=get_public_schema_name())
            except TenantModel.DoesNotExist:
                pass
            return None

        response = super().process_request(request)

        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            # Solo verificar permisos si no estamos en el esquema `public`
            if connection.schema_name != 'public':
                try:
                    _ = user.usertenantpermissions
                except UserTenantPermissions.DoesNotExist:
                    raise PermissionDenied("No tienes permisos en este tenant.")

        return response

    def get_tenant(self, domain_model, hostname):
        """
        Si existe la cabecera `X-Tenant`, busca el tenant por `schema_name`.
        Si no, se comporta como el middleware original de django-tenants.
        """
        request = getattr(self, "request", None)
        schema = None

        if request is not None:
            schema = request.headers.get("X-Tenant") or request.headers.get("x-tenant")
            if not schema:
                schema = request.GET.get("schema")

        logger.debug("Middleware activado. Cabecera schema=%s", schema)

        if schema:
            from django_tenants.utils import get_tenant_model

            TenantModel = get_tenant_model()
            try:
                tenant = TenantModel.objects.get(schema_name=schema)
                logger.debug("Tenant resuelto por cabecera/schema=%s", schema)
                return tenant
            except TenantModel.DoesNotExist:
                logger.warning("❌ Tenant no encontrado para schema_name='%s'", schema)

        return super().get_tenant(domain_model, hostname)

class FixedTimeZoneMiddleware:
    def __init__(self, get_response): self.get_response = get_response
    def __call__(self, request):
        try:
            timezone.activate(ZoneInfo("Europe/Madrid"))
        except Exception:
            timezone.deactivate()
        response = self.get_response(request)
        timezone.deactivate()
        return response
