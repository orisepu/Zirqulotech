"""
Utilities para filtrado de querysets basado en roles jerárquicos.

Roles (de menor a mayor rango):
- Comercial: Solo ve/edita sus propios datos
- Store Manager: Ve/edita todos los datos de su tienda
- Manager: Ve/edita datos de tiendas gestionadas (regional o todas si es general)
"""

from django.db.models import Q, QuerySet
from django.db import connection


def get_user_rol_tenant(user, tenant_slug=None):
    """
    Obtiene el RolPorTenant del usuario para un tenant específico.

    Args:
        user: Usuario autenticado
        tenant_slug: Schema del tenant (si no se proporciona, usa el actual)

    Returns:
        RolPorTenant object o None
    """
    if not user or not user.is_authenticated:
        return None

    gr = getattr(user, "global_role", None)
    if not gr:
        return None

    # Resolver tenant actual si no se especifica
    if not tenant_slug:
        tenant_slug = connection.schema_name

    try:
        return gr.roles.get(tenant_slug=tenant_slug)
    except Exception:
        return None


def filter_queryset_by_role(queryset: QuerySet, user, tenant_slug=None, tienda_field="tienda", creador_field="creado_por", read_only_for_comercial=False):
    """
    Filtra un queryset basándose en el rol del usuario y sus permisos.

    Args:
        queryset: QuerySet a filtrar
        user: Usuario autenticado
        tenant_slug: Schema del tenant (opcional, usa el actual si no se especifica)
        tienda_field: Nombre del campo de tienda en el modelo (default: "tienda")
        creador_field: Nombre del campo de creador en el modelo (default: "creado_por")
        read_only_for_comercial: Si True, comercial ve TODO en su tienda (read-only).
                                  Si False, comercial solo ve sus propios datos (default: False)

    Returns:
        QuerySet filtrado según el rol del usuario

    Comportamiento por rol:
        - Superadmin/Soporte: Ve todo (sin filtrar)
        - Manager (general): Ve todo (sin filtrar)
        - Manager (regional): Solo tiendas gestionadas
        - Store Manager: Solo su tienda
        - Comercial (read_only=True): Ve todo en su tienda (solo lectura)
        - Comercial (read_only=False): Solo sus propios datos en su tienda
        - Auditor: Ve todo (read-only, pero sin filtrar)
    """
    if not user or not user.is_authenticated:
        return queryset.none()

    gr = getattr(user, "global_role", None)
    if not gr:
        return queryset.none()

    # Superadmin o soporte interno: acceso total
    if getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False):
        return queryset

    # Obtener rol en tenant
    rol_tenant = get_user_rol_tenant(user, tenant_slug)
    if not rol_tenant:
        return queryset.none()

    rol = rol_tenant.rol

    # Auditor: ve todo (read-only)
    if rol == "auditor":
        return queryset

    # Manager: depende si es general o regional
    if rol == "manager":
        # General Manager (sin tiendas específicas): ve todo
        if rol_tenant.gestiona_todas_tiendas():
            return queryset
        # Regional Manager: solo tiendas gestionadas
        managed_ids = rol_tenant.managed_store_ids or []
        return queryset.filter(**{f"{tienda_field}__in": managed_ids})

    # Store Manager: solo su tienda
    if rol == "store_manager":
        if not rol_tenant.tienda_id:
            return queryset.none()
        return queryset.filter(**{tienda_field: rol_tenant.tienda_id})

    # Comercial: comportamiento depende de read_only_for_comercial
    if rol == "comercial":
        if not rol_tenant.tienda_id:
            return queryset.none()

        # Si read_only_for_comercial=True: ve TODO en su tienda (para lectura)
        if read_only_for_comercial:
            return queryset.filter(**{tienda_field: rol_tenant.tienda_id})

        # Si read_only_for_comercial=False: solo ve sus propios datos (para escritura)
        filters = Q(**{tienda_field: rol_tenant.tienda_id})
        if creador_field:
            filters &= Q(**{creador_field: user})
        return queryset.filter(filters)

    # Por defecto, sin acceso
    return queryset.none()


def can_user_edit_object(user, obj, tenant_slug=None, tienda_field="tienda", creador_field="creado_por"):
    """
    Verifica si un usuario puede editar un objeto específico basándose en su rol.

    Args:
        user: Usuario autenticado
        obj: Objeto a verificar
        tenant_slug: Schema del tenant (opcional)
        tienda_field: Nombre del campo de tienda en el modelo
        creador_field: Nombre del campo de creador en el modelo

    Returns:
        bool: True si puede editar, False si no

    Comportamiento por rol:
        - Superadmin/Soporte: Edita todo
        - Manager (general): Edita todo
        - Manager (regional): Edita objetos de tiendas gestionadas
        - Store Manager: Edita objetos de su tienda
        - Comercial: Edita solo sus propios objetos de su tienda
        - Auditor: No edita (read-only)
    """
    if not user or not user.is_authenticated:
        return False

    gr = getattr(user, "global_role", None)
    if not gr:
        return False

    # Superadmin o soporte interno: puede editar todo
    if getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False):
        return True

    # Obtener rol en tenant
    rol_tenant = get_user_rol_tenant(user, tenant_slug)
    if not rol_tenant:
        return False

    rol = rol_tenant.rol

    # Auditor: solo lectura
    if rol == "auditor":
        return False

    # Manager: depende si es general o regional
    if rol == "manager":
        # General Manager: edita todo
        if rol_tenant.gestiona_todas_tiendas():
            return True
        # Regional Manager: edita objetos de tiendas gestionadas
        obj_tienda = getattr(obj, tienda_field, None)
        if obj_tienda:
            tienda_id = obj_tienda.id if hasattr(obj_tienda, 'id') else obj_tienda
            return tienda_id in (rol_tenant.managed_store_ids or [])
        return False

    # Store Manager: edita objetos de su tienda
    if rol == "store_manager":
        if not rol_tenant.tienda_id:
            return False
        obj_tienda = getattr(obj, tienda_field, None)
        if obj_tienda:
            tienda_id = obj_tienda.id if hasattr(obj_tienda, 'id') else obj_tienda
            return tienda_id == rol_tenant.tienda_id
        return False

    # Comercial: edita solo sus propios objetos
    if rol == "comercial":
        # Verificar tienda
        if rol_tenant.tienda_id:
            obj_tienda = getattr(obj, tienda_field, None)
            if obj_tienda:
                tienda_id = obj_tienda.id if hasattr(obj_tienda, 'id') else obj_tienda
                if tienda_id != rol_tenant.tienda_id:
                    return False

        # Verificar ownership
        if creador_field:
            creador = getattr(obj, creador_field, None)
            return creador == user

        return False

    # Por defecto, sin acceso
    return False


def get_tienda_ids_for_user(user, tenant_slug=None):
    """
    Retorna la lista de IDs de tiendas a las que el usuario tiene acceso.

    Args:
        user: Usuario autenticado
        tenant_slug: Schema del tenant (opcional)

    Returns:
        list: Lista de IDs de tiendas, o None si tiene acceso a todas

    Retorna None para indicar "acceso a todas las tiendas" (superadmin, general manager)
    Retorna [] para "sin acceso"
    Retorna [ids] para acceso limitado
    """
    if not user or not user.is_authenticated:
        return []

    gr = getattr(user, "global_role", None)
    if not gr:
        return []

    # Superadmin o soporte interno: acceso a todas
    if getattr(gr, "es_superadmin", False) or getattr(gr, "es_empleado_interno", False):
        return None

    # Obtener rol en tenant
    rol_tenant = get_user_rol_tenant(user, tenant_slug)
    if not rol_tenant:
        return []

    rol = rol_tenant.rol

    # Auditor: acceso a todas (read-only)
    if rol == "auditor":
        return None

    # Manager: depende si es general o regional
    if rol == "manager":
        # General Manager: acceso a todas
        if rol_tenant.gestiona_todas_tiendas():
            return None
        # Regional Manager: lista de tiendas gestionadas
        return rol_tenant.managed_store_ids or []

    # Store Manager: solo su tienda
    if rol == "store_manager":
        return [rol_tenant.tienda_id] if rol_tenant.tienda_id else []

    # Comercial: solo su tienda
    if rol == "comercial":
        return [rol_tenant.tienda_id] if rol_tenant.tienda_id else []

    # Por defecto, sin acceso
    return []
