"""
Mixins para ViewSets con filtrado basado en roles jerárquicos.
"""

from rest_framework import status
from rest_framework.response import Response
from ..utils.role_filters import filter_queryset_by_role, can_user_edit_object, get_user_rol_tenant


class RoleBasedQuerysetMixin:
    """
    Mixin para ViewSets que automáticamente filtra querysets basándose en el rol del usuario.

    Uso:
        class MiViewSet(RoleBasedQuerysetMixin, viewsets.ModelViewSet):
            # Especificar campos del modelo
            tienda_field = "tienda"  # Nombre del campo de tienda
            creador_field = "creado_por"  # Nombre del campo de creador
            ...

    El mixin sobreescribe get_queryset() para aplicar filtros automáticos según el rol:
        - Comercial: Solo ve sus propios datos
        - Store Manager: Ve todos los datos de su tienda
        - Manager: Ve datos de tiendas gestionadas (o todas si es general)
    """

    # Campos a usar para filtrado (pueden sobreescribirse en la clase hija)
    tienda_field = "tienda"
    creador_field = "creado_por"
    enable_role_filtering = True  # Flag para desactivar filtrado si es necesario

    def get_queryset(self):
        """
        Retorna queryset filtrado según el rol del usuario.
        """
        queryset = super().get_queryset()

        # Si el filtrado está desactivado, retornar queryset completo
        if not self.enable_role_filtering:
            return queryset

        # Aplicar filtrado por rol
        return filter_queryset_by_role(
            queryset=queryset,
            user=self.request.user,
            tenant_slug=self.request.query_params.get("schema"),
            tienda_field=self.tienda_field,
            creador_field=self.creador_field
        )


class RoleBasedPermissionMixin:
    """
    Mixin para ViewSets que verifica permisos de edición basándose en el rol del usuario.

    Uso:
        class MiViewSet(RoleBasedPermissionMixin, viewsets.ModelViewSet):
            tienda_field = "tienda"
            creador_field = "creado_por"
            ...

    El mixin sobreescribe métodos de actualización y eliminación para verificar permisos:
        - Comercial: Solo edita sus propios objetos
        - Store Manager: Edita objetos de su tienda
        - Manager: Edita objetos de tiendas gestionadas
    """

    tienda_field = "tienda"
    creador_field = "creado_por"

    def perform_update(self, serializer):
        """
        Verifica permisos antes de actualizar un objeto.
        """
        obj = self.get_object()
        if not can_user_edit_object(
            user=self.request.user,
            obj=obj,
            tenant_slug=self.request.query_params.get("schema"),
            tienda_field=self.tienda_field,
            creador_field=self.creador_field
        ):
            return Response(
                {"detail": "No tienes permisos para editar este objeto."},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().perform_update(serializer)

    def perform_destroy(self, instance):
        """
        Verifica permisos antes de eliminar un objeto.
        """
        if not can_user_edit_object(
            user=self.request.user,
            obj=instance,
            tenant_slug=self.request.query_params.get("schema"),
            tienda_field=self.tienda_field,
            creador_field=self.creador_field
        ):
            return Response(
                {"detail": "No tienes permisos para eliminar este objeto."},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().perform_destroy(instance)


class RoleInfoMixin:
    """
    Mixin para agregar información del rol del usuario en las respuestas.

    Agrega métodos helper para obtener información del rol:
        - get_user_role_info(): Retorna dict con información del rol
        - is_comercial(), is_store_manager(), is_manager(): Checks de rol
    """

    def get_user_role_info(self, tenant_slug=None):
        """
        Retorna información del rol del usuario en el tenant actual.

        Returns:
            dict: {
                "rol": "comercial" | "store_manager" | "manager" | "auditor",
                "rol_display": "Comercial" | "Store Manager" | "Manager" | "Auditor",
                "tienda_id": int | None,
                "managed_store_ids": list | None,
                "is_general_manager": bool,
                "can_edit_all": bool
            }
        """
        user = self.request.user
        rol_tenant = get_user_rol_tenant(user, tenant_slug or self.request.query_params.get("schema"))

        if not rol_tenant:
            return None

        return {
            "rol": rol_tenant.rol,
            "rol_display": rol_tenant.get_rol_display(),
            "tienda_id": rol_tenant.tienda_id,
            "managed_store_ids": rol_tenant.managed_store_ids if rol_tenant.rol == "manager" else None,
            "is_general_manager": rol_tenant.gestiona_todas_tiendas() if rol_tenant.rol == "manager" else False,
            "can_edit_all": rol_tenant.rol in ["manager", "store_manager"]
        }

    def is_comercial(self):
        """Retorna True si el usuario es Comercial"""
        role_info = self.get_user_role_info()
        return role_info and role_info["rol"] == "comercial"

    def is_store_manager(self):
        """Retorna True si el usuario es Store Manager"""
        role_info = self.get_user_role_info()
        return role_info and role_info["rol"] == "store_manager"

    def is_manager(self):
        """Retorna True si el usuario es Manager"""
        role_info = self.get_user_role_info()
        return role_info and role_info["rol"] == "manager"

    def is_general_manager(self):
        """Retorna True si el usuario es General Manager (gestiona todas las tiendas)"""
        role_info = self.get_user_role_info()
        return role_info and role_info.get("is_general_manager", False)
