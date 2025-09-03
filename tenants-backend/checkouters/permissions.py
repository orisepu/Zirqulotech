from rest_framework.permissions import BasePermission
from django.db import connection

class EsTecnicoOAdmin(BasePermission):
    """
    Permite acceso solo a técnicos o administradores.
    """
    def has_permission(self, request, view):
        tipo = getattr(request.user, "tipo_usuario", None)
        return tipo in ["tecnico", "admin"]
    

class IsTenantManagerOrSuper(BasePermission):
    """
    Permite la acción si:
    - el usuario es superadmin o empleado interno (soporte), o
    - el usuario es manager en el tenant actual.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        gr = getattr(user, "global_role", None)
        # superadmin o soporte interno
        if gr and (getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False)):
            return True

        # resolver tenant actual
        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            tenant_slug = (request.query_params.get("schema") or connection.schema_name or "").lower()

        # manager del tenant
        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug).rol
        except Exception:
            return False
        return rol == "manager"