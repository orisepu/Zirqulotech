from django.contrib import admin, messages
from django import forms
from django.contrib.auth import get_user_model
from django.db import connection
from django_tenants.utils import schema_context, get_public_schema_name
from tenant_users.permissions.models import UserTenantPermissions
from tenant_users.tenants.utils import get_tenant_model
from tenant_users.tenants.models import DeleteError
from tenant_users.tenants.models import ExistsError

Tenant = get_tenant_model()
User = get_user_model()


@admin.action(description="🔄 Sincronizar permisos y limpieza en tenants (incluye public)")
def sincronizar_permisos_en_tenants(modeladmin, request, queryset):
    Tenant = get_tenant_model()
    all_tenants = Tenant.objects.all()

    for user in queryset:
        for tenant in all_tenants:
            original_schema = connection.schema_name
            try:
                connection.set_schema(tenant.schema_name)

                has_perms = UserTenantPermissions.objects.filter(profile=user).exists()
                is_assigned = user.tenants.filter(id=tenant.id).exists()

                if is_assigned and not has_perms:
                    try:
                        tenant.add_user(user)
                    except ExistsError:
                        # Usuario ya vinculado, pero sin permisos → los creamos manualmente
                        UserTenantPermissions.objects.create(
                            profile=user,
                            is_staff=False,
                            is_superuser=False
                        )
                        modeladmin.message_user(
                            request,
                            f"⚠️ Reparado manualmente {user.email} en {tenant.schema_name} (ya estaba asignado)",
                            level=messages.WARNING,
                        )

            except Exception as e:
                modeladmin.message_user(
                    request,
                    f"❌ Error con {user.email} en {tenant.schema_name}: {e}",
                    level=messages.ERROR,
                )
            finally:
                connection.set_schema(original_schema)


class TenantUserForm(forms.ModelForm):
    password1 = forms.CharField(
        label="Nueva contraseña", required=False, widget=forms.PasswordInput
    )

    class Meta:
        model = User
        fields = "__all__"

    def save(self, commit=True):
        user = super().save(commit)

        password = self.cleaned_data.get("password1")
        if password:
            user.set_password(password)
            user.save()

        if commit:
            form_tenants = set(self.cleaned_data["tenants"].values_list("id", flat=True))

            for tenant_id in form_tenants:
                tenant = Tenant.objects.get(id=tenant_id)

                with tenant.context():
                    if not UserTenantPermissions.objects.filter(profile=user).exists():
                        try:
                            tenant.add_user(user)
                        except Exception as e:
                            print(f"Error añadiendo {user.email} a {tenant.schema_name}: {e}")

        return user


# Solo registrar si estamos en el esquema public
if connection.schema_name == get_public_schema_name():
    @admin.register(User)
    class CustomTenantUserAdmin(admin.ModelAdmin):
        form = TenantUserForm
        list_display = (
            "email",
            "name",
            "estado_activo",
            "tenants_con_permiso",
            "is_verified",
            "is_staff",
            "tenant_list_display",
        )
        list_filter = ("is_active", "tenants")
        search_fields = ("email",)
        ordering = ("email",)
        readonly_fields = ()
        fields = ("email","name", "is_active", "is_verified", "tenants", "password1")
        actions = [
            sincronizar_permisos_en_tenants,
            "desactivar_usuarios",
            "eliminar_completamente",
        ]

        def estado_activo(self, obj):
            return "✅ Activo" if obj.is_active else "❌ Inactivo"
        estado_activo.short_description = "Estado"

        def tenant_list_display(self, obj):
            return ", ".join(t.schema_name for t in obj.tenants.all())
        tenant_list_display.short_description = "Tenants"
        
        def tenants_con_permiso(self, obj):
            ok = 0
            total = obj.tenants.count()
            for tenant in obj.tenants.all():
                with schema_context(tenant.schema_name):
                    if UserTenantPermissions.objects.filter(profile=obj).exists():
                        ok += 1
            return f"{ok}/{total}"
        tenants_con_permiso.short_description = "Tenants OK"

        def permisos_por_tenant(self, obj):
            if not obj.pk:
                return "Usuario aún no guardado."

            output = []
            for tenant in obj.tenants.all():
                with schema_context(tenant.schema_name):
                    tiene = UserTenantPermissions.objects.filter(profile=obj).exists()
                    icono = "✅" if tiene else "❌"
                    output.append(f"{tenant.schema_name}: {icono}")
            return "\n".join(output)
        permisos_por_tenant.short_description = "Permisos por tenant"

        def delete_model(self, request, obj):
            with schema_context("public"):
                try:
                    User.objects.delete_user(obj)
                    self.message_user(
                        request,
                        f"Usuario {obj.email} desactivado correctamente.",
                        level=messages.SUCCESS,
                    )
                except DeleteError as e:
                    self.message_user(
                        request, f"No se puede borrar {obj.email}: {e}", level=messages.ERROR
                    )

        @admin.action(description="🔒 Desactivar usuario (soft delete)")
        def desactivar_usuarios(self, request, queryset):
            count = 0
            with schema_context("public"):
                for user in queryset:
                    try:
                        User.objects.delete_user(user)
                        count += 1
                    except DeleteError as e:
                        self.message_user(request, f"No se puede eliminar {user.email}: {e}", messages.ERROR)
            self.message_user(request, f"{count} usuario(s) desactivado(s)", messages.SUCCESS)

        @admin.action(description="🗑 Eliminar completamente (force drop)")
        def eliminar_completamente(self, request, queryset):
            count = 0
            with schema_context("public"):
                for user in queryset:
                    try:
                        user.delete(force_drop=True)
                        count += 1
                    except Exception as e:
                        self.message_user(request, f"No se pudo borrar {user.email}: {e}", messages.ERROR)
            self.message_user(request, f"{count} usuario(s) borrado(s) permanentemente", messages.WARNING)

        def has_delete_permission(self, request, obj=None):
            return True

        def get_deleted_objects(self, objs, request):
            # Evita errores al intentar cargar relaciones cruzadas como checkouters.Lote
            return [], {}, set(), []

        def formfield_for_manytomany(self, db_field, request, **kwargs):
            field = super().formfield_for_manytomany(db_field, request, **kwargs)
            if db_field.name == "tenants" and request.resolver_match:
                try:
                    user_id = request.resolver_match.kwargs.get("object_id")
                    if user_id:
                        user = User.objects.get(pk=user_id)
                        choices = []
                        for t in field.queryset:
                            label = f"{t.schema_name}"
                            with t.context():
                                if UserTenantPermissions.objects.filter(profile=user).exists():
                                    label += " ✅"
                            choices.append((t.pk, label))
                        field.choices = choices
                except Exception:
                    pass
            return field


    @admin.register(UserTenantPermissions)
    class UserTenantPermissionsAdmin(admin.ModelAdmin):
        list_display = ("profile", "is_staff", "is_superuser")
        search_fields = ("profile__email",)
        filter_horizontal = ("groups", "user_permissions")
        actions = ["hacer_staff", "quitar_staff"]

        @admin.action(description="✅ Dar acceso al admin (staff)")
        def hacer_staff(self, request, queryset):
            count = 0
            for perm in queryset:
                if not perm.is_staff:
                    perm.is_staff = True
                    perm.save(update_fields=["is_staff"])
                    count += 1
            self.message_user(request, f"{count} usuario(s) ahora son staff.", messages.SUCCESS)

        @admin.action(description="🚫 Quitar acceso al admin (no staff)")
        def quitar_staff(self, request, queryset):
            count = 0
            for perm in queryset:
                if perm.is_staff:
                    perm.is_staff = False
                    perm.save(update_fields=["is_staff"])
                    count += 1
            self.message_user(request, f"{count} usuario(s) ya no son staff.", messages.WARNING)
