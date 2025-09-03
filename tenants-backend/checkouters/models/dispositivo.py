from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from productos.models.modelos import Modelo, Capacidad
from django.core.validators import MinValueValidator
from django.db.models import Q
from .oportunidad import Oportunidad
from ..utils.utilidades import validar_imei
from django.core.validators import MinValueValidator, MaxValueValidator

class Dispositivo(models.Model):
    TIPO_EQUIPO = [
        ('iPhone', 'iPhone'),
        ('MacBook Air', 'MacBook Air'),
        ('MacBook Pro', 'MacBook Pro'),
        ('iMac', 'iMac'),
        ('iPad', 'iPad'),
        ('Mac Pro','Mac Pro'),
        ('Mac Studio', 'Mac Studio'),
        ('Mac mini','Mac mini'),
        ('Otro', 'Otro'),
    ]
    ESTADOS_FISICOS = [
        ('perfecto', 'Perfecto'),
        ('bueno', 'Bueno'),
        ('regular', 'Regular'),
        ('dañado', 'Dañado'),
    ]
    ESTETICA_CHOICES = [
        ('sin_signos', 'Sin signos'),
        ('minimos', 'Mínimos'),
        ('algunos', 'Algunos'),
        ('desgaste_visible', 'Desgaste visible'),
        ('agrietado_roto', 'Agrietado/roto'),
    ]
    ESTADOS_FUNCIONALES = [
        ('funciona', 'Funciona correctamente'),
        ('no_enciende', 'No enciende'),
        ('pantalla_rota', 'Pantalla rota'),
        ('error_hardware', 'Error de hardware'),
    ]
    ESTADOS_VALORACION = [
        ('excelente', 'Excelente'),
        ('muy_bueno', 'Muy bueno'),
        ('bueno', 'Bueno'),
        ("a_revision", "A revisión"),
    ]

    imei = models.CharField(max_length=15, blank=True, null=True, db_index=True,help_text="IMEI declarado por el cliente.")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='dispositivos')
    tipo = models.CharField(max_length=20, choices=TIPO_EQUIPO)
    modelo = models.ForeignKey("productos.Modelo", on_delete=models.CASCADE, related_name="dispositivos")
    capacidad = models.ForeignKey(Capacidad, on_delete=models.SET_NULL, null=True, blank=True, related_name='dispositivos')
    año = models.IntegerField(blank=True, null=True)
    numero_serie = models.CharField(max_length=100, blank=True, null=True)

    estado_fisico = models.CharField(max_length=20, choices=ESTADOS_FISICOS, blank=True, null=True)
    estado_funcional = models.CharField(max_length=30, choices=ESTADOS_FUNCIONALES, blank=True, null=True)

    comentarios_cliente = models.TextField(blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    oportunidad = models.ForeignKey(Oportunidad, null=True, blank=True, on_delete=models.SET_NULL, related_name='dispositivos_oportunidad')

    estado_valoracion = models.CharField(max_length=20, choices=ESTADOS_VALORACION, blank=True, null=True)
    precio_orientativo = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    fecha_valoracion = models.DateTimeField(blank=True, null=True)
    fecha_caducidad = models.DateTimeField(blank=True, null=True)
    cantidad = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])
    precio_orientativoexcelente = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    salud_bateria_pct = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    ciclos_bateria = models.PositiveIntegerField(null=True, blank=True)

    FUNC_BASICA_CHOICES = [
        ('ok', 'Todo funciona'),
        ('parcial', 'No totalmente funcional'),
    ]
    funcionalidad_basica = models.CharField(
        max_length=10, choices=FUNC_BASICA_CHOICES, blank=True, null=True
    )

    pantalla_funcional_puntos_bril = models.BooleanField(default=False)
    pantalla_funcional_pixeles_muertos = models.BooleanField(default=False)
    pantalla_funcional_lineas_quemaduras = models.BooleanField(default=False)

    estado_pantalla = models.CharField(max_length=20, choices=ESTETICA_CHOICES, blank=True, null=True)
    estado_lados    = models.CharField(max_length=20, choices=ESTETICA_CHOICES, blank=True, null=True)
    estado_espalda  = models.CharField(max_length=20, choices=ESTETICA_CHOICES, blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.modelo and not self.tipo:
            self.tipo = self.modelo.tipo
        if not self.fecha_creacion:
            self.fecha_creacion = timezone.now()
        if not self.fecha_caducidad:
            self.fecha_caducidad = self.fecha_creacion + timedelta(days=7)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tipo} {self.modelo.descripcion} de {self.usuario}"
    def clean(self):
        super().clean()
        if self.imei:
            validar_imei(self.imei)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['oportunidad', 'imei'],
                name='uniq_imei_por_oportunidad_plan',
                condition=Q(imei__isnull=False) & ~Q(imei=''),
            ),
        ]


class DispositivoReal(models.Model):
    
    oportunidad = models.ForeignKey(Oportunidad, on_delete=models.CASCADE, related_name='dispositivos_reales')
    origen = models.ForeignKey(Dispositivo, null=True, blank=True, on_delete=models.SET_NULL, related_name='dispositivo_real')
    
    modelo = models.ForeignKey("productos.Modelo", on_delete=models.CASCADE, related_name="dispositivos_reales")
    capacidad = models.ForeignKey(Capacidad, on_delete=models.SET_NULL, null=True, blank=True, related_name='dispositivos_reales')
    año = models.IntegerField(blank=True, null=True)
    imei = models.CharField(max_length=15, blank=True, null=True)
    numero_serie = models.CharField(max_length=100, blank=True, null=True)

    estado_fisico = models.CharField(max_length=20, choices=Dispositivo.ESTADOS_FISICOS, blank=True, null=True)
    estado_funcional = models.CharField(max_length=30, choices=Dispositivo.ESTADOS_FUNCIONALES, blank=True, null=True)
    observaciones = models.TextField(blank=True, null=True)
    precio_final = models.DecimalField(max_digits=10, decimal_places=2,blank=True, null=True)
    recibido = models.BooleanField(default=True)
    auditado = models.BooleanField(default=False)
    fecha_recepcion = models.DateTimeField(auto_now_add=True)
    fecha_auditoria = models.DateTimeField(null=True, blank=True)
    usuario_auditor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='auditorias_realizadas'
    )
    def __str__(self):
        return f"{self.modelo.descripcion} (Real)"
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['oportunidad', 'imei'],
                name='uniq_imei_por_oportunidad_real',
                condition=Q(imei__isnull=False) & ~Q(imei=''),
            ),
        ]


class Valoracion(models.Model):
    ESTADO_CHOICES = [
        ('Pendiente', 'Pendiente'),
        ('en_proceso', 'En Proceso'),
        ('valorado', 'Valorado'),
        ('aceptado', 'Aceptado'),
        ('rechazado', 'Rechazado'),
    ]

    dispositivo = models.ForeignKey(Dispositivo, on_delete=models.CASCADE, related_name='valoraciones')
    tecnico = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    precio_final = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    comentarios_tecnico = models.TextField(blank=True, null=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    fecha_valoracion = models.DateTimeField(blank=True, null=True)
    fecha_respuesta_cliente = models.DateTimeField(blank=True, null=True)


class Reparacion(models.Model):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('en_proceso', 'En Proceso'),
        ('finalizada', 'Finalizada'),
        ('cancelada', 'Cancelada'),
    ]

    dispositivo = models.ForeignKey(Dispositivo, on_delete=models.CASCADE, related_name='reparaciones')
    descripcion_problema = models.TextField()
    partes_necesarias = models.TextField(blank=True, null=True)
    costo_estimado = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='Pendiente')
    fecha_inicio = models.DateTimeField(blank=True, null=True)
    fecha_fin = models.DateTimeField(blank=True, null=True)


class NotaInterna(models.Model):
    dispositivo = models.ForeignKey(Dispositivo, on_delete=models.CASCADE, related_name='notas_internas')
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    nota = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)


class HistorialCambio(models.Model):
    dispositivo = models.ForeignKey(Dispositivo, on_delete=models.CASCADE, related_name='historial')
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    accion = models.CharField(max_length=100)
    detalle = models.TextField()
    fecha = models.DateTimeField(default=timezone.now)
