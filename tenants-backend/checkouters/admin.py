from django.contrib import admin
from .models.dispositivo import Dispositivo, Reparacion, NotaInterna, HistorialCambio
from .models.documento import Documento
from .models.cliente import ConsultaCliente
from .models.tienda import Tienda, UserTenantExtension
from .models.oportunidad import Oportunidad
from productos.models.modelos import Modelo, Capacidad
from productos.models.precios import PrecioRecompra
from django.db.models import Q, OuterRef, Subquery
from django.utils import timezone



class CapacidadInline(admin.TabularInline):
    model = Capacidad
    extra = 0
    fields = ("tamaño", "precio_b2b_vigente", "precio_b2c_vigente")
    readonly_fields = ("precio_b2b_vigente", "precio_b2c_vigente")
    show_change_link = True

    def _precio(self, capacidad_id: int, canal: str):
        now = timezone.now()
        return (PrecioRecompra.objects
                .filter(capacidad_id=capacidad_id, canal=canal, valid_from__lte=now)
                .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
                .order_by('-valid_from')
                .values_list('precio_neto', flat=True)
                .first())

    def precio_b2b_vigente(self, obj):
        return self._precio(obj.id, 'B2B')

    def precio_b2c_vigente(self, obj):
        return self._precio(obj.id, 'B2C')

    precio_b2b_vigente.short_description = "B2B vigente"
    precio_b2c_vigente.short_description = "B2C vigente"

@admin.register(Modelo)
class ModeloAdmin(admin.ModelAdmin):
    list_display = ("descripcion", "tipo", "pantalla", "año", "procesador")
    list_filter = ("tipo", "pantalla", "año", "procesador")
    search_fields = ("descripcion", "procesador")
    ordering = ("tipo", "descripcion", "año")
    inlines = [CapacidadInline]

@admin.register(Capacidad)
class CapacidadAdmin(admin.ModelAdmin):
    list_display = ("modelo", "tamaño", "precio_b2b_vig", "precio_b2c_vig")
    list_filter = ("tamaño", "modelo__tipo")
    search_fields = ("modelo__descripcion", "tamaño")
    ordering = ("modelo", "tamaño")

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related("modelo")
        now = timezone.now()
        vigente_base = (PrecioRecompra.objects
                        .filter(capacidad_id=OuterRef('pk'), valid_from__lte=now)
                        .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
                        .order_by('-valid_from'))
        qs = qs.annotate(
            _b2b=Subquery(vigente_base.filter(canal='B2B').values('precio_neto')[:1]),
            _b2c=Subquery(vigente_base.filter(canal='B2C').values('precio_neto')[:1]),
        )
        return qs

    def precio_b2b_vig(self, obj):
        return getattr(obj, "_b2b", None)
    precio_b2b_vig.short_description = "B2B vigente"
    precio_b2b_vig.admin_order_field = "_b2b"

    def precio_b2c_vig(self, obj):
        return getattr(obj, "_b2c", None)
    precio_b2c_vig.short_description = "B2C vigente"
    precio_b2c_vig.admin_order_field = "_b2c"
    
@admin.register(Dispositivo)
class DispositivoAdmin(admin.ModelAdmin):
    list_display = ('tipo', 'modelo', 'usuario', 'estado_valoracion', 'precio_orientativo')
    search_fields = ('modelo__descripcion', 'usuario__email', 'imei', 'numero_serie')
    list_filter = ('tipo', 'estado_valoracion')


@admin.register(Reparacion)
class ReparacionAdmin(admin.ModelAdmin):
    list_display = ('dispositivo', 'estado', 'costo_estimado')
    list_filter = ('estado',)

@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ('dispositivo', 'archivo', 'subido_por', 'fecha_subida')

@admin.register(ConsultaCliente)
class ConsultaClienteAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'asunto', 'estado', 'fecha_envio')
    list_filter = ('estado',)

@admin.register(NotaInterna)
class NotaInternaAdmin(admin.ModelAdmin):
    list_display = ('dispositivo', 'autor', 'fecha')

@admin.register(HistorialCambio)
class HistorialCambioAdmin(admin.ModelAdmin):
    list_display = ('dispositivo', 'usuario', 'accion', 'fecha')
    search_fields = ('accion', 'usuario__email')

@admin.register(Tienda)
class TiendaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'is_active', 'responsable', 'get_usuarios_asignados_count', 'direccion_completa')
    list_filter = ('is_active',)
    search_fields = ('nombre', 'direccion_poblacion', 'direccion_provincia')
    readonly_fields = ('get_usuarios_asignados_detail',)

    def get_usuarios_asignados_count(self, obj):
        """Cuenta de usuarios asignados a esta tienda"""
        from django.db import connection
        from django_tenants.utils import schema_context, get_public_schema_name
        from progeek.models import RolPorTenant

        tenant_slug = connection.schema_name
        if not tenant_slug or tenant_slug == 'public':
            return '-'

        public_schema = get_public_schema_name() if callable(get_public_schema_name) else "public"
        with schema_context(public_schema):
            count = RolPorTenant.objects.filter(
                tenant_slug=tenant_slug,
                tienda_id=obj.id
            ).count()
        return count
    get_usuarios_asignados_count.short_description = 'Usuarios Asignados'

    def get_usuarios_asignados_detail(self, obj):
        """Lista detallada de usuarios asignados"""
        from django.db import connection
        from django_tenants.utils import schema_context, get_public_schema_name
        from progeek.models import RolPorTenant
        from django.utils.html import format_html

        tenant_slug = connection.schema_name
        if not tenant_slug or tenant_slug == 'public':
            return '-'

        public_schema = get_public_schema_name() if callable(get_public_schema_name) else "public"
        with schema_context(public_schema):
            roles = RolPorTenant.objects.filter(
                tenant_slug=tenant_slug,
                tienda_id=obj.id
            ).select_related('user_role__user')

        if not roles.exists():
            return format_html('<em>No hay usuarios asignados</em>')

        usuarios_html = '<ul>'
        for rol in roles:
            user = rol.user_role.user
            usuarios_html += f'<li><strong>{user.name}</strong> ({user.email}) - Rol: {rol.rol}</li>'
        usuarios_html += '</ul>'

        return format_html(usuarios_html)
    get_usuarios_asignados_detail.short_description = 'Detalle de Usuarios Asignados'

    def direccion_completa(self, obj):
        """Dirección completa de la tienda"""
        partes = []
        if obj.direccion_calle:
            partes.append(obj.direccion_calle)
        if obj.direccion_cp:
            partes.append(obj.direccion_cp)
        if obj.direccion_poblacion:
            partes.append(obj.direccion_poblacion)
        return ', '.join(partes) if partes else '-'
    direccion_completa.short_description = 'Dirección'


@admin.register(Oportunidad)
class OportunidadAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tienda', 'estado', 'fecha_creacion')
    list_filter = ('estado', 'tienda')
    search_fields = ('nombre', 'descripcion')


@admin.register(UserTenantExtension)
class UserTenantExtensionAdmin(admin.ModelAdmin):
    list_display = ('user_permissions', 'tienda', 'es_manager')
    list_filter = ('es_manager', 'tienda')
