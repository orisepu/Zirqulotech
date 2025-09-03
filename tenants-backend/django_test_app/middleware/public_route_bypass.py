import logging
from django_tenants.middleware.main import TenantMainMiddleware
from django.db import connection
from django_tenants.utils import get_public_schema_name, get_tenant_model
from django.core.exceptions import PermissionDenied
from tenant_users.permissions.models import UserTenantPermissions

logger = logging.getLogger(__name__)

PUBLIC_PREFIXES = [
    "/api/oportunidades/resumen-global/",
    "/api/yo/",
]

class UnifiedTenantMiddleware(TenantMainMiddleware):
    """
    Middleware unificado que:
    - Usa X-Tenant si está presente
    - Usa schema público para rutas públicas
    - Usa lógica original de django-tenants si no hay X-Tenant
    """

    def process_request(self, request):
        self.request = request

        if any(request.path.startswith(prefix) for prefix in PUBLIC_PREFIXES):
            logger.info("🌐 Ruta pública detectada: %s → usando esquema público", request.path)
            connection.set_schema_to_public()
            request.tenant = get_tenant_model().objects.get(schema_name=get_public_schema_name())
            return

        response = super().process_request(request)

        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            try:
                _ = user.usertenantpermissions
            except UserTenantPermissions.DoesNotExist:
                raise PermissionDenied("No tienes permisos en este tenant.")

        return response

    def get_tenant(self, domain_model, hostname):
        tenant_header = getattr(self, "request", None)
        schema = tenant_header.headers.get("X-Tenant") if tenant_header else None

        logger.info("🔎 get_tenant() - X-Tenant: %s | Hostname: %s", schema, hostname)

        if schema:
            try:
                return domain_model.objects.get(tenant__schema_name=schema).tenant
            except domain_model.DoesNotExist:
                logger.warning("❌ Tenant no encontrado: %s", schema)

        return super().get_tenant(domain_model, hostname)
