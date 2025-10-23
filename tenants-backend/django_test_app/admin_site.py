from django.contrib import admin
from django.urls import reverse
from django.utils.http import urlencode


class TenantAwareAdminSite(admin.AdminSite):
    """Admin site que preserva el parámetro schema en todas las URLs"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._registry = {}  # Evitar conflictos con el admin site por defecto
    
    def each_context(self, request):
        context = super().each_context(request)
        # Agregar schema al contexto para que esté disponible en templates
        schema = request.GET.get('schema')
        if schema:
            context['current_schema'] = schema
        return context
    
    def index(self, request, extra_context=None):
        # Agregar schema al contexto
        schema = request.GET.get('schema')
        if not extra_context:
            extra_context = {}
        if schema:
            extra_context['preserve_schema'] = schema
        return super().index(request, extra_context)


# Crear instancia del admin site personalizado
tenant_admin_site = TenantAwareAdminSite(name='tenant_admin')
