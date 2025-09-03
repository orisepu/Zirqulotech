from django.contrib import admin
from .models import LoteGlobal, DispositivoAuditado, UserGlobalRole,RolPorTenant
from django_tenants.utils import get_tenant_model
from django import forms
from checkouters.models.tienda import Tienda
from django_tenants.utils import schema_context

@admin.register(LoteGlobal)
class LoteGlobalAdmin(admin.ModelAdmin):
    list_display = ("tenant_slug", "lote_id", "nombre_lote", "estado", "fecha_creacion", "auditado", "precio_estimado")
    list_filter = ("estado", "auditado")
    search_fields = ("tenant_slug", "nombre_lote", "lote_id")

class DispositivoAuditadoInline(admin.StackedInline):
    model = DispositivoAuditado
    extra = 1  # Muestra un formulario vacío adicional por defecto
    fieldsets = (
        (None, {
            "fields": (
                "dispositivo_id",
                "estado_fisico_cliente",
                "estado_funcional_cliente",
                "estado_fisico_real",
                "estado_funcional_real",
                "imei_confirmado",
                "precio_estimado",
                "comentarios_auditor",
            )
        }),
    )
class RolPorTenantForm(forms.ModelForm):
    class Meta:
        model = RolPorTenant
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        TenantModel = get_tenant_model()
        tenants = TenantModel.objects.exclude(schema_name="public")
        self.fields["tenant_slug"].widget = forms.Select(choices=[
            (t.schema_name, t.name or t.schema_name) for t in tenants
        ])


        tenant_slug = None
        if self.instance and self.instance.pk:
            tenant_slug = self.instance.tenant_slug

        if tenant_slug:
            try:
                with schema_context(tenant_slug.lower()):
                    tiendas = Tienda.objects.all()
                    self.fields["tienda_id"].widget = forms.Select(choices=[
                        (t.id, t.nombre) for t in tiendas
                    ])
            except Exception as e:
                self.fields["tienda_id"].widget = forms.Select(choices=[])
                self.fields["tienda_id"].help_text = f"⚠️ Error al cargar tiendas: {e}"
        else:
            self.fields["tienda_id"].widget = forms.Select(choices=[("", "Selecciona un tenant")])
            self.fields["tienda_id"].help_text = "Selecciona un tenant primero o guarda para continuar"


# Inline para mostrar roles por tenant dentro de UserGlobalRole
class RolPorTenantInline(admin.StackedInline):
    model = RolPorTenant
    form = RolPorTenantForm
    extra = 1

# Admin de UserGlobalRole con inlines
@admin.register(UserGlobalRole)
class UserGlobalRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "es_superadmin", "es_empleado_interno")
    search_fields = ("user__email",)
    inlines = [RolPorTenantInline]
