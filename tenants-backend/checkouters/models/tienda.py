from django.db import models
from django.contrib.auth import get_user_model
from tenant_users.permissions.models import UserTenantPermissions


class Tienda(models.Model):
    nombre = models.CharField(max_length=100)

    # Dirección fiscal
    direccion_calle = models.CharField(max_length=255, blank=True)
    direccion_piso = models.CharField(max_length=50, blank=True)
    direccion_puerta = models.CharField(max_length=50, blank=True)
    direccion_cp = models.CharField(max_length=10, blank=True)
    direccion_poblacion = models.CharField(max_length=100, blank=True)
    direccion_provincia = models.CharField(max_length=100, blank=True)
    direccion_pais = models.CharField(max_length=100, blank=True)

    # Responsable: usuario del tenant
    responsable = models.ForeignKey(
        get_user_model(),
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tiendas_responsables"
    )

    def __str__(self):
        return self.nombre


class UserTenantExtension(models.Model):
    user_permissions = models.OneToOneField(
        UserTenantPermissions,
        on_delete=models.CASCADE,
        related_name='extension',
    )
    tienda = models.ForeignKey(Tienda, null=True, blank=True, on_delete=models.SET_NULL)
    es_manager = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user_permissions.profile.email} ({'Manager' if self.es_manager else 'Tienda'})"
