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
    list_display = ('nombre', 'responsable')


@admin.register(Oportunidad)
class OportunidadAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tienda', 'estado', 'fecha_creacion')
    list_filter = ('estado', 'tienda')
    search_fields = ('nombre', 'descripcion')


@admin.register(UserTenantExtension)
class UserTenantExtensionAdmin(admin.ModelAdmin):
    list_display = ('user_permissions', 'tienda', 'es_manager')
    list_filter = ('es_manager', 'tienda')
