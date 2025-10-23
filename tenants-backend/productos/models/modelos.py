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
        ('pc', 'PC (Desktop/Torre)'),
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

    # Sistema de grading (consistente con dispositivos Apple)
    pp_A = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.08,
        help_text="Penalización de A+ a A (0.08 = 8%)"
    )
    pp_B = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.12,
        help_text="Penalización de A a B (0.12 = 12%)"
    )
    pp_C = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=0.15,
        help_text="Penalización de B a C (0.15 = 15%)"
    )
    precio_suelo = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Precio mínimo ofertable (V_SUELO)"
    )

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

    def get_precio_vigente(self, canal: str):
        """
        Obtiene el precio vigente actual para este dispositivo y canal.

        Args:
            canal: 'B2B' o 'B2C'

        Returns:
            Decimal con el precio vigente, o None si no hay precio activo.
        """
        from django.utils import timezone
        from django.db.models import Q

        now = timezone.now()
        precio = (self.precios
                  .filter(canal=canal, valid_from__lte=now)
                  .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=now))
                  .order_by('-valid_from')
                  .first())

        return precio.precio_neto if precio else None

    def calcular_oferta(self, grado: str, canal: str) -> float:
        """
        Calcula la oferta según grado estético y canal usando precios versionados.
        Sistema consistente con dispositivos Apple (A+, A, B, C, V_SUELO).

        Args:
            grado: 'A+', 'A', 'B', 'C', 'V_SUELO'
            canal: 'B2B', 'B2C'

        Returns:
            Precio calculado redondeado a euros completos (1€).
            Mínimo precio_suelo.
            Retorna 0 si no hay precio vigente.
        """
        # Obtener precio vigente del sistema de precios versionado
        precio_base = self.get_precio_vigente(canal)

        if not precio_base:
            return 0.0

        # Caso especial: precio suelo
        if grado == 'V_SUELO':
            return float(self.precio_suelo)

        # Cálculo de grados según documento oficial (mismo que Apple devices)
        precio_base_float = float(precio_base)

        if grado == 'A+':
            # A+ = 100% del precio base (V_Aplus)
            precio_calculado = precio_base_float
        elif grado == 'A':
            # A = precio_base * (1 - pp_A)
            precio_calculado = precio_base_float * (1 - float(self.pp_A))
        elif grado == 'B':
            # B = V_A * (1 - pp_B)
            V_A = precio_base_float * (1 - float(self.pp_A))
            precio_calculado = V_A * (1 - float(self.pp_B))
        elif grado == 'C':
            # C = V_B * (1 - pp_C)
            V_A = precio_base_float * (1 - float(self.pp_A))
            V_B = V_A * (1 - float(self.pp_B))
            precio_calculado = V_B * (1 - float(self.pp_C))
        else:
            # Grado inválido: retornar precio base
            precio_calculado = precio_base_float

        # Redondear a euros completos (1€)
        precio_redondeado = round(precio_calculado)

        # Aplicar precio suelo como mínimo
        precio_suelo_float = float(self.precio_suelo)
        return max(precio_redondeado, precio_suelo_float)


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
