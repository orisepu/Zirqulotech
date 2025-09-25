from django.db import models



class Modelo(models.Model):
    descripcion = models.CharField(max_length=255)
    tipo = models.CharField(max_length=100)
    marca = models.CharField(max_length=100, default='Apple')
    pantalla = models.CharField(max_length=50, blank=True)
    año = models.PositiveIntegerField(null=True, blank=True)
    procesador = models.CharField(max_length=100, blank=True)
    likewize_modelo = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = ('descripcion', 'tipo', 'marca', 'pantalla', 'año', 'procesador')
        ordering = ['marca', 'tipo', 'descripcion', 'año']

    def __str__(self):
        suffix = f" ({self.año})" if self.año else ""
        return f"{self.marca} {self.descripcion}{suffix}"


class Capacidad(models.Model):
    modelo = models.ForeignKey(Modelo, on_delete=models.CASCADE, related_name="capacidades")
    tamaño = models.CharField(max_length=50)
    activo = models.BooleanField(default=True)


    class Meta:
        unique_together = ('modelo', 'tamaño')
        ordering = ['modelo', 'tamaño']

    def __str__(self):
        return f"{self.modelo.descripcion} - {self.tamaño}"
