from django.db import models
from django.conf import settings


class DispositivoPersonalizado(models.Model):
    """
    Modelo para dispositivos personalizados (no-Apple) que pueden ser de cualquier marca.
    Permite al admin crear dispositivos de Samsung, Xiaomi, Dell, LG, etc. para ofertas
    personalizadas cuando los partners envían dispositivos poco comunes.

    SHARED APP: Este modelo está en productos (SHARED_APPS) y es compartido por todos los tenants.
    """

    TIPO_CHOICES = [
        ('movil', 'Móvil'),
        ('portatil', 'Portátil'),
        ('monitor', 'Monitor'),
        ('tablet', 'Tablet'),
        ('otro', 'Otro'),
    ]

    # Identificación básica
    marca = models.CharField(max_length=100, help_text="Marca del dispositivo (Samsung, Xiaomi, Dell, LG, etc.)")
    modelo = models.CharField(max_length=255, help_text="Modelo específico del dispositivo")
    capacidad = models.CharField(
        max_length=100,
        blank=True,
        help_text="Ej: 256GB, 1TB SSD, configuración especial"
    )
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default='otro',
        help_text="Tipo de dispositivo"
    )

    # Precios base por canal
    precio_base_b2b = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Precio base para canal B2B"
    )
    precio_base_b2c = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Precio base para canal B2C"
    )

    # Ajustes por estado (porcentajes 0-100)
    ajuste_excelente = models.IntegerField(
        default=100,
        help_text="% del precio base para estado excelente (0-100)"
    )
    ajuste_bueno = models.IntegerField(
        default=80,
        help_text="% del precio base para estado bueno (0-100)"
    )
    ajuste_malo = models.IntegerField(
        default=50,
        help_text="% del precio base para estado malo (0-100)"
    )

    # Metadata flexible
    caracteristicas = models.JSONField(
        default=dict,
        blank=True,
        help_text="RAM, procesador, tamaño pantalla, etc. en formato JSON"
    )
    notas = models.TextField(
        blank=True,
        help_text="Descripción adicional o detalles específicos"
    )

    # Descripción auto-generada
    descripcion_completa = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Descripción auto-generada: Marca Modelo Capacidad"
    )

    # Auditoría y control
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dispositivos_personalizados_creados'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    activo = models.BooleanField(default=True, help_text="Soft delete: False para desactivar")

    class Meta:
        db_table = 'dispositivos_personalizados'
        ordering = ['-created_at']
        verbose_name = 'Dispositivo Personalizado'
        verbose_name_plural = 'Dispositivos Personalizados'
        indexes = [
            models.Index(fields=['marca', 'modelo']),
            models.Index(fields=['tipo']),
            models.Index(fields=['activo']),
        ]

    def __str__(self):
        """
        Representación string del dispositivo.
        Incluye capacidad solo si está definida.
        """
        capacidad_str = f" {self.capacidad}" if self.capacidad else ""
        return f"{self.marca} {self.modelo}{capacidad_str}"

    def calcular_oferta(self, estado: str, canal: str) -> float:
        """
        Calcula la oferta según estado y canal.

        Args:
            estado: 'excelente', 'bueno', 'malo'
            canal: 'B2B', 'B2C'

        Returns:
            Precio calculado redondeado a múltiplos de 5€.
            Mínimo 0€ (no puede ser negativo).
        """
        # Seleccionar precio base según canal
        precio_base = self.precio_base_b2b if canal == 'B2B' else self.precio_base_b2c

        # Mapear estado a ajuste porcentual
        ajuste_map = {
            'excelente': self.ajuste_excelente,
            'bueno': self.ajuste_bueno,
            'malo': self.ajuste_malo,
        }

        # Obtener ajuste (default 100% si estado inválido)
        ajuste_pct = ajuste_map.get(estado, 100) / 100
        precio_calculado = float(precio_base) * ajuste_pct

        # Redondear a múltiplos de 5€
        precio_redondeado = round(precio_calculado / 5) * 5

        # Asegurar que no sea negativo
        return max(precio_redondeado, 0)


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
