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
        tenant_header = getattr(self, "request", None)
        schema = tenant_header.headers.get("X-Tenant") if tenant_header else None
        logger.info(f"🧭 Middleware activado. Cargando tenant: {schema}")
        

        if schema:
            try:
                return domain_model.objects.get(tenant__schema_name=schema).tenant
            except domain_model.DoesNotExist:
                logger.warning("❌ Tenant no encontrado para schema_name='%s'", schema)
        else:
            # ⚠️ Si no se envía X-Tenant, usar esquema público
            from django_tenants.utils import get_public_schema_name
            from django_test_app.companies.models import Company  # Ajusta si tu modelo real tiene otro nombre
            return Company.objects.get(schema_name="public")

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