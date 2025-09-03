from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class LoteGlobal(models.Model):
    tenant_slug = models.CharField(max_length=100, db_index=True)
    lote_id = models.IntegerField()
    nombre_lote = models.CharField(max_length=255)
    estado = models.CharField(max_length=50)
    fecha_creacion = models.DateTimeField()
    fecha_recepcion = models.DateTimeField(null=True, blank=True)
    auditado = models.BooleanField(default=False)
    precio_estimado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ("tenant_slug", "lote_id")
        verbose_name = "Lote global"
        verbose_name_plural = "Lotes globales"

    def __str__(self):
        return f"{self.tenant_slug} - Lote {self.lote_id}"
    
    
    
class Reparacion(models.Model):
    lote = models.ForeignKey(LoteGlobal, on_delete=models.CASCADE, related_name="reparaciones")
    descripcion = models.CharField(max_length=255)
    estado = models.CharField(max_length=50, choices=[
        ("pendiente", "Pendiente"),
        ("en_proceso", "En proceso"),
        ("completado", "Completado"),
        ("no_reparable", "No reparable"),
    ])
    coste = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Reparación lote {self.lote.lote_id} ({self.estado})"

class DispositivoAuditado(models.Model):
    dispositivo_id = models.IntegerField(null=True, blank=True)
    tenant_slug = models.CharField(max_length=100)
    lote = models.ForeignKey(LoteGlobal, on_delete=models.CASCADE, related_name="dispositivos_auditados", null=True, blank=True)
    tecnico = models.ForeignKey(get_user_model(), on_delete=models.SET_NULL, null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True,null=True, blank=True)
    # Datos del cliente
    estado_fisico_cliente = models.CharField(max_length=20, blank=True, null=True)
    estado_funcional_cliente = models.CharField(max_length=30, blank=True, null=True)

    # Datos reales
    estado_fisico_real = models.CharField(max_length=20, blank=True, null=True)
    estado_funcional_real = models.CharField(max_length=30, blank=True, null=True)
    comentarios_auditor = models.TextField(blank=True, null=True)
    imei_confirmado = models.BooleanField(default=False, null=True, blank=True)
    precio_estimado = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ("lote", "dispositivo_id", "tenant_slug")
        verbose_name = "Dispositivo auditado"
        verbose_name_plural = "Dispositivos auditados"

    def __str__(self):
        return f"{self.tenant_slug} - Dispositivo {self.dispositivo_id} en lote {self.lote_id}"

        
class Valoracion(models.Model):
    lote = models.OneToOneField(LoteGlobal, on_delete=models.CASCADE, related_name="valoracion")
    fecha = models.DateTimeField(auto_now_add=True)
    precio_estimado = models.DecimalField(max_digits=10, decimal_places=2)
    notas = models.TextField(blank=True)

    def __str__(self):
        return f"Valoración lote {self.lote.lote_id}: {self.precio_estimado}€"
    
class UserGlobalRole(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="global_role")
    es_superadmin = models.BooleanField(default=False)
    es_empleado_interno = models.BooleanField(default=False)

    def get_rol_para_tenant(self, tenant_slug: str):
        """Devuelve el rol asignado en un tenant concreto."""
        return self.roles_por_tenant.get(tenant_slug)

    def set_rol_para_tenant(self, tenant_slug: str, rol: str, tienda_id=None):
        """Asigna o actualiza el rol para un tenant."""
        data = {"rol": rol, "tienda_id": tienda_id}
        roles = self.roles_por_tenant
        roles[tenant_slug] = data
        self.roles_por_tenant = roles
        return data

    def eliminar_rol_para_tenant(self, tenant_slug: str):
        """Elimina la entrada de un tenant si existe."""
        roles = self.roles_por_tenant
        roles.pop(tenant_slug, None)
        self.roles_por_tenant = roles

    def __str__(self):
        return f"{self.user.email} - Global"
    
class RolPorTenant(models.Model):
    user_role = models.ForeignKey("UserGlobalRole", on_delete=models.CASCADE, related_name="roles")
    tenant_slug = models.CharField(max_length=100)
    rol = models.CharField(max_length=20, choices=[
        ("manager", "Manager"),
        ("empleado", "Empleado"),
        ("auditor", "Auditor"),
    ])
    tienda_id = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ("user_role", "tenant_slug")
        verbose_name = "Rol por tenant"
        verbose_name_plural = "Roles por tenant"

    def __str__(self):
        return f"{self.user_role.user.email} en {self.tenant_slug}: {self.rol}"
    


EVENTOS_CORREO = [
    ('recepcion_confirmada', 'Confirmación de recepción del lote'),
    ('oferta_enviada', 'Oferta enviada al cliente'),
    ('oferta_aceptada', 'Oferta aceptada'),
    ('recogida_generada', 'Recogida generada'),
    ('pago_realizado', 'Confirmación de pago'),
    ('recordatorio_pago', 'Recordatorio de pago pendiente'),
]
VARIABLES_POR_EVENTO = {
    'Recepcion confirmada': {
        'variables': ['nombre_cliente','nombre_creador',  'nombre_oportunidad', 'fecha_recepcion'],
        'destinatarios': ['cliente_email', 'responsable_tienda_email','creador_oportunidad'],
    },
    'Oferta enviada': {
        'variables': ['nombre_cliente','nombre_creador', 'nombre_oportunidad', 'precio_total', 'fecha_oferta'],
        'destinatarios': ['cliente_email','creador_oportunidad'],
    },
    'Oferta aceptada': {
        'variables': ['nombre_cliente','nombre_creador',  'nombre_oportunidad', 'fecha_aceptacion'],
        'destinatarios': ['cliente_email''creador_oportunidad'],
    },
    'Recogida generada': {
        'variables': ['nombre_cliente','nombre_creador',  'direccion_recogida', 'fecha_recogida'],
        'destinatarios': ['cliente_email', 'responsable_tienda_email','creador_oportunidad'],
    },
    'Pago realizado': {
        'variables': ['nombre_cliente','nombre_creador',  'nombre_oportunidad', 'importe_pagado', 'fecha_pago'],
        'destinatarios': ['cliente_email', 'contabilidad_email','creador_oportunidad'],
    },
    'Recordatorio pago': {
        'variables': ['nombre_cliente','nombre_creador',  'nombre_oportunidad', 'importe_pendiente', 'fecha_limite'],
        'destinatarios': ['cliente_email','creador_oportunidad',],
    },
}
class PlantillaCorreo(models.Model):
    evento = models.CharField(max_length=50, choices=EVENTOS_CORREO, unique=True)
    asunto = models.CharField(max_length=255)
    cuerpo = models.TextField(help_text="Puedes usar variables como {{ nombre_cliente }}, {{ nombre_oportunidad }}...")
    activo = models.BooleanField(default=True)
    destinatario = models.CharField(max_length=255, help_text="Puede contener variables como {{ cliente_email }} o emails fijos separados por comas.")

    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_evento_display()}"

    def get_variables_disponibles(self):
        return VARIABLES_POR_EVENTO.get(self.evento, [])
    
class B2CKycIndex(models.Model):
    token = models.UUIDField(unique=True, db_index=True)
    tenant_slug = models.CharField(max_length=64, db_index=True)
    contrato_id = models.BigIntegerField(db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "b2c_kyc_index"

class PublicLegalTemplate(models.Model):
    slug       = models.SlugField()
    namespace  = models.SlugField(default="default")  # p.ej. default | autoadmin | brand-x
    title      = models.CharField(max_length=200, blank=True)
    version    = models.CharField(max_length=20, default="v1")
    content    = models.TextField()
    is_active  = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("slug", "namespace", "is_active")]
        indexes = [models.Index(fields=["slug","namespace","is_active"])]
        ordering = ["-updated_at"]
    def __str__(self):
        return f"{self.namespace}:{self.slug} [{self.version}]{' *' if self.is_active else ''}"

class PublicLegalVariables(models.Model):
    namespace  = models.SlugField(unique=True, default="default")
    data       = models.JSONField(default=dict)  # { empresa:{...}, textos:{...}, … }
    updated_at = models.DateTimeField(auto_now=True)


