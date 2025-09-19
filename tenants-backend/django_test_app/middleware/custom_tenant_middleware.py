import logging
from django.core.exceptions import PermissionDenied
from django_tenants.middleware.main import TenantMainMiddleware
from tenant_users.permissions.models import UserTenantPermissions
from django.db import connection
from django.utils import timezone
from zoneinfo import ZoneInfo


logger = logging.getLogger(__name__)

class HeaderTenantMiddleware(TenantMainMiddleware):
    """
    Middleware que permite seleccionar el tenant mediante cabecera `X-Tenant`
    y verifica que el usuario tenga permisos en ese tenant.
    """

    def process_request(self, request):
        self.request = request
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

        logger.info("🧭 Middleware activado. Cabecera schema=%s", schema)

        if schema:
            from django_tenants.utils import get_tenant_model

            TenantModel = get_tenant_model()
            try:
                tenant = TenantModel.objects.get(schema_name=schema)
                logger.debug("✅ Tenant resuelto por cabecera/schema=%s", schema)
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
