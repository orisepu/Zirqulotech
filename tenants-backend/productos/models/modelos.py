from django.db import models



class Modelo(models.Model):
    descripcion = models.CharField(max_length=255)
    tipo = models.CharField(max_length=100)
    pantalla = models.CharField(max_length=50, blank=True)
    año = models.PositiveIntegerField(null=True, blank=True)
    procesador = models.CharField(max_length=100, blank=True)

    class Meta:
        unique_together = ('descripcion', 'tipo', 'pantalla', 'año', 'procesador')
        ordering = ['tipo', 'descripcion', 'año']

    def __str__(self):
        return f"{self.descripcion} ({self.año})"


class Capacidad(models.Model):
    modelo = models.ForeignKey(Modelo, on_delete=models.CASCADE, related_name="capacidades")
    tamaño = models.CharField(max_length=50)
    precio_b2b = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True)
    precio_b2c = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True)

    class Meta:
        unique_together = ('modelo', 'tamaño')
        ordering = ['modelo', 'tamaño']

    def __str__(self):
        return f"{self.modelo.descripcion} - {self.tamaño}"
