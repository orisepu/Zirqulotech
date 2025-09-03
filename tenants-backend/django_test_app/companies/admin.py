from django.contrib import admin
from django_test_app.companies.models import Company
from django_test_app.users.models import TenantUser
from tenant_users.permissions.models import UserTenantPermissions  
from tenant_users.tenants.models import ExistsError
from django_tenants.utils import schema_context
from django_test_app.companies.models import Domain

@admin.action(description="Asignar admin@progeek.es como superusuario del tenant")
def asignar_admin_global(modeladmin, request, queryset):
    try:
        user = TenantUser.objects.get(email="admin@progeek.es")
    except TenantUser.DoesNotExist:
        modeladmin.message_user(request, "⚠️ El usuario admin@progeek.es no existe.", level="error")
        return

    count = 0
    for tenant in queryset:
        try:
            tenant.add_user(user, is_staff=True, is_superuser=True)
            count += 1
        except ExistsError:
            with schema_context(tenant.schema_name):
                # Crea o actualiza el objeto de permisos
                perms, created = UserTenantPermissions.objects.get_or_create(profile=user)
                perms.is_staff = True
                perms.is_superuser = True
                perms.save()
                count += 1

    modeladmin.message_user(request, f"✅ Usuario actualizado/asignado como admin en {count} tenant(s).")


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("schema_name", "slug", "owner")
    actions = [asignar_admin_global]

@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ("domain", "tenant", "is_primary")
    list_filter = ("is_primary",)
    search_fields = ("domain", "tenant__schema_name")