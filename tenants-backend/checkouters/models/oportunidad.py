from django.db import models
from django.conf import settings
import uuid
from hashids import Hashids


hashids = Hashids(
    salt=settings.SECRET_KEY,
    min_length=10,
    alphabet="0123456789ABCDEF"
)


class Oportunidad(models.Model):
    ESTADOS = [
    ('Pendiente', 'Pendiente'),
    ('Aceptado', 'Aceptado'),
    ('Cancelado', 'Cancelado'),
    ('Recogida solicitada', 'Recogida solicitada'),
    ('Recogida generada', 'Recogida generada'),
    ('En tránsito', 'En tránsito'),
    ('Recibido', 'Recibido'),
    ('Check in OK','Check in OK'),
    ('En revisión', 'En revisión'),
    ('Oferta confirmada', 'Oferta confirmada'),
    ('Pendiente factura', 'Pendiente factura'),
    ('Factura recibida', 'Factura recibida'),
    ('Pendiente de pago', 'Pendiente de pago'),
    ('Pagado', 'Pagado'),
    ('Nueva oferta enviada', 'Nueva oferta enviada'),
    ('Rechazada', 'Rechazada'),
    ('Devolución iniciada', 'Devolución iniciada'),
    ('Equipo enviado', 'Equipo enviado'),
    ('Recibido por el cliente', 'Recibido por el cliente'),
    ('Nueva oferta enviada', 'Nueva oferta enviada'),
    ('Nueva oferta confirmada', 'Nueva oferta confirmada'),
    ('Nuevo contrato', 'Nuevo contrato'),
    ('Contrato firmado', 'Contrato firmado'),
    ]

    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    tienda = models.ForeignKey('Tienda', on_delete=models.CASCADE, null=True, blank=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    cliente = models.ForeignKey("checkouters.Cliente", on_delete=models.CASCADE, related_name="oportunidades")
    nombre = models.CharField(max_length=100, blank=True, null=True)
    estado = models.CharField(max_length=50, choices=ESTADOS, default='Pendiente')
    dispositivos = models.ManyToManyField('Dispositivo', related_name='oportunidades_dispositivo')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    calle = models.CharField(max_length=255, blank=True, null=True)
    numero = models.CharField(max_length=10, blank=True, null=True)
    piso = models.CharField(max_length=20, blank=True, null=True)
    puerta = models.CharField(max_length=20, blank=True, null=True)
    codigo_postal = models.CharField(max_length=10, blank=True, null=True)
    poblacion = models.CharField(max_length=100, blank=True, null=True)
    provincia = models.CharField(max_length=100, blank=True, null=True)
    persona_contacto = models.CharField(max_length=255, blank=True, null=True)
    telefono_contacto = models.CharField(max_length=50, blank=True, null=True)
    horario_recogida = models.CharField(max_length=100, blank=True, null=True)
    instrucciones = models.TextField(blank=True, null=True)
    plazo_pago_dias = models.IntegerField(null=True, blank=True, help_text="Días máximo de pago tras cambiar a 'Pendiente de pago'")
    fecha_inicio_pago = models.DateTimeField(null=True, blank=True, help_text="Fecha en que se cambió a 'Pendiente de pago'")
    numero_seguimiento = models.CharField(max_length=100,blank=True,null=True,help_text="Número de seguimiento del envío")
    url_seguimiento = models.URLField(max_length=300,blank=True,null=True,help_text="Enlace de seguimiento proporcionado por el transportista")
    correo_recogida = models.EmailField(max_length=255, blank=True, null=True, help_text="Correo electrónico de contacto para la recogida")

    class Meta:
        db_table = 'checkouters_oportunidad'

    def __str__(self):
        return f"Oportunidad {self.id} - {self.nombre or 'Sin nombre'}"

    @property
    def hashid(self) -> str:
        return hashids.encode(self.id)


class HistorialOportunidad(models.Model):
    oportunidad = models.ForeignKey(Oportunidad, on_delete=models.CASCADE, related_name="historial")
    tipo_evento = models.CharField(max_length=50)
    descripcion = models.TextField()
    estado_anterior = models.CharField(max_length=50, blank=True, null=True)
    estado_nuevo = models.CharField(max_length=50, blank=True, null=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha = models.DateTimeField(auto_now_add=True)


class ComentarioOportunidad(models.Model):
    oportunidad = models.ForeignKey("Oportunidad", on_delete=models.CASCADE, related_name="comentarios", null=True)
    texto = models.TextField()
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comentario de {self.autor} en oportunidad {self.oportunidad.id}"
