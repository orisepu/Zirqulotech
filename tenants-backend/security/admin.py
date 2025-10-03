from django.contrib import admin
from .models import LoginHistory


@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'get_location_display',
        'ip',
        'timestamp',
        'was_blocked',
        'alert_sent'
    ]

    list_filter = [
        'was_blocked',
        'alert_sent',
        'block_reason',
        'country',
        'timestamp'
    ]

    search_fields = [
        'user__username',
        'user__email',
        'ip',
        'city',
        'country'
    ]

    readonly_fields = [
        'user',
        'ip',
        'country',
        'city',
        'latitude',
        'longitude',
        'timestamp',
        'user_agent'
    ]

    date_hierarchy = 'timestamp'

    def has_add_permission(self, request):
        # No se pueden añadir manualmente, solo por el sistema
        return False

    def has_delete_permission(self, request, obj=None):
        # Solo superusuarios pueden borrar historial
        return request.user.is_superuser
