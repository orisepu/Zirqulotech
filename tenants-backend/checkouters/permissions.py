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
    - el usuario es manager o store_manager en el tenant actual.

    NOTA: Esta clase ahora acepta tanto "manager" como "store_manager" para mantener
    compatibilidad con endpoints existentes.
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

        # manager o store_manager del tenant
        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug).rol
        except Exception:
            return False
        return rol in ["manager", "store_manager"]


class IsComercialOrAbove(BasePermission):
    """
    Permite acceso a Comercial, Store Manager, Manager, y roles superiores.
    Comercial es el nivel de acceso más bajo en la jerarquía.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        gr = getattr(user, "global_role", None)
        # superadmin o soporte interno tienen acceso
        if gr and (getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False)):
            return True

        # resolver tenant actual
        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            tenant_slug = (request.query_params.get("schema") or connection.schema_name or "").lower()

        # verificar rol en el tenant
        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug).rol
        except Exception:
            return False
        return rol in ["comercial", "store_manager", "manager"]


class IsStoreManagerOrAbove(BasePermission):
    """
    Permite acceso a Store Manager, Manager, y roles superiores.
    Excluye a Comercial.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        gr = getattr(user, "global_role", None)
        # superadmin o soporte interno tienen acceso
        if gr and (getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False)):
            return True

        # resolver tenant actual
        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            tenant_slug = (request.query_params.get("schema") or connection.schema_name or "").lower()

        # verificar rol en el tenant
        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug).rol
        except Exception:
            return False
        return rol in ["store_manager", "manager"]


class IsManagerOnly(BasePermission):
    """
    Permite acceso solo a Manager (regional o general).
    Excluye a Store Manager y Comercial.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        gr = getattr(user, "global_role", None)
        # superadmin o soporte interno tienen acceso
        if gr and (getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False)):
            return True

        # resolver tenant actual
        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            tenant_slug = (request.query_params.get("schema") or connection.schema_name or "").lower()

        # verificar rol en el tenant
        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug).rol
        except Exception:
            return False
        return rol == "manager"


class CanEditOwnDataOnly(BasePermission):
    """
    Permission para Comercial: puede editar solo sus propios datos.
    Se usa a nivel de objeto (has_object_permission).

    Verifica que el objeto pertenezca al usuario:
    - obj.creado_por == request.user (para oportunidades, clientes, etc.)
    - obj.usuario == request.user (para otros modelos)
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        gr = getattr(user, "global_role", None)
        # superadmin o soporte interno pueden editar todo
        if gr and (getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False)):
            return True

        # resolver tenant y rol
        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            tenant_slug = (request.query_params.get("schema") or connection.schema_name or "").lower()

        try:
            rol_tenant = user.global_role.roles.get(tenant_slug=tenant_slug)
        except Exception:
            return False

        # Manager y Store Manager pueden editar todo en su ámbito
        if rol_tenant.rol in ["manager", "store_manager"]:
            return True

        # Comercial solo puede editar lo suyo
        if rol_tenant.rol == "comercial":
            # Verificar ownership
            creador = getattr(obj, "creado_por", None) or getattr(obj, "usuario", None)
            return creador == user

        return False


class CanViewStoreScopeData(BasePermission):
    """
    Permission para verificar que el usuario puede ver datos de una tienda específica.
    Usado con métodos helper del modelo RolPorTenant.

    Debe usarse con filtrado adicional en el queryset del viewset.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        gr = getattr(user, "global_role", None)
        # superadmin o soporte interno pueden ver todo
        if gr and (getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False)):
            return True

        # resolver tenant actual
        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            tenant_slug = (request.query_params.get("schema") or connection.schema_name or "").lower()

        # verificar que tiene algún rol en el tenant
        try:
            user.global_role.roles.get(tenant_slug=tenant_slug)
            return True
        except Exception:
            return False