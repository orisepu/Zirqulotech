from django.db import models
from django.conf import settings
from checkouters.storage import PrivateDocumentStorage
from checkouters.utils.documentos import ruta_documento
from .dispositivo import Dispositivo
from .oportunidad import Oportunidad


class Documento(models.Model):
    TIPO_CHOICES = [
        ("factura", "Factura"),
        ("otro", "Otro"),
    ]

    dispositivo = models.ForeignKey(Dispositivo, on_delete=models.CASCADE, related_name='documentos', null=True, blank=True)
    oportunidad = models.ForeignKey(Oportunidad, on_delete=models.CASCADE, related_name="documentos", null=True, blank=True)
    archivo = models.FileField(upload_to=ruta_documento,storage=PrivateDocumentStorage())
    nombre_original = models.CharField(max_length=255, blank=True)
    descripcion = models.CharField(max_length=255, blank=True)
    tipo = models.CharField(max_length=50, choices=TIPO_CHOICES, default="factura")
    subido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha_subida = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.archivo and not self.nombre_original:
            self.nombre_original = self.archivo.name
        super().save(*args, **kwargs)
