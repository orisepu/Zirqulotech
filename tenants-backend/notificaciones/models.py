from django.db import models
from django.conf import settings

class Notificacion(models.Model):
    TIPO_CHOICES = [
        ('estado_cambiado', 'Cambio de estado'),
        ('plazo_pago', 'Plazo de pago'),
        ('estado_prolongado', 'Estado prolongado'),
        ('otro', 'Otro'),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notificaciones'
    )
    schema = models.CharField(max_length=100, help_text="Schema donde se generó")
    mensaje = models.TextField()
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES)
    leida = models.BooleanField(default=False)
    url_relacionada = models.CharField(max_length=300, blank=True)
    creada = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-creada']
