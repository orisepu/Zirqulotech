from django.db import models
from django.utils import timezone
from django.conf import settings


class CanalChoices(models.TextChoices):
    B2B = 'B2B', 'B2B (recompra)'
    B2C = 'B2C', 'B2C (recompra)'


class PrecioRecompra(models.Model):
    """
    Precio de recompra versionado por capacidad y canal.
    Sin IVA siempre. Rango semiabierto [valid_from, valid_to).
    """
    capacidad = models.ForeignKey(
        'productos.Capacidad',
        on_delete=models.CASCADE,
        related_name='precios_recompra'
    )
    canal = models.CharField(max_length=3, choices=CanalChoices.choices)
    fuente = models.CharField(max_length=50, default='manual')  # p.ej. manual, likewize
    moneda = models.CharField(max_length=3, default='EUR')
    precio_neto = models.DecimalField(max_digits=12, decimal_places=2)

    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField(null=True, blank=True)  # NULL = vigente

    # Si algún día quieres overrides por tenant sin FK, guarda el schema/tenant aquí:
    tenant_schema = models.CharField(max_length=64, null=True, blank=True)

    # Auditoría ligera
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # Garantiza un único precio vigente por (capacidad, canal, tenant_schema)
            # NOTA: 'fuente' NO está en el constraint - es solo metadata informativa
            # Esto permite que solo exista 1 precio vigente, sin importar la fuente
            models.UniqueConstraint(
                fields=['capacidad', 'canal', 'tenant_schema'],
                condition=models.Q(valid_to__isnull=True),
                name='uniq_precio_recompra_vigente_simple'
            ),
        ]
        indexes = [
            models.Index(fields=['capacidad', 'canal', 'valid_from']),
            models.Index(fields=['valid_to']),
        ]

    def __str__(self):
        return f'{self.capacidad_id} {self.canal} {self.precio_neto} {self.valid_from}..{self.valid_to or "∞"}'


class PrecioDispositivoPersonalizado(models.Model):
    """
    Precio de recompra versionado para dispositivos personalizados (non-Apple).
    Estructura idéntica a PrecioRecompra para mantener consistencia en el sistema.

    Permite:
    - Precios diferenciados por canal (B2B/B2C)
    - Versionado temporal con valid_from/valid_to
    - Historial completo de cambios de precio
    - Soporte multi-tenant opcional
    """
    dispositivo_personalizado = models.ForeignKey(
        'productos.DispositivoPersonalizado',
        on_delete=models.CASCADE,
        related_name='precios',
        help_text="Dispositivo personalizado al que pertenece este precio"
    )
    canal = models.CharField(
        max_length=3,
        choices=CanalChoices.choices,
        help_text="Canal de venta (B2B o B2C)"
    )
    fuente = models.CharField(
        max_length=50,
        default='manual',
        help_text="Origen del precio: manual, api, importación"
    )
    moneda = models.CharField(max_length=3, default='EUR')
    precio_neto = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Precio sin IVA"
    )

    # Versionado temporal
    valid_from = models.DateTimeField(
        help_text="Fecha/hora desde la cual este precio es válido"
    )
    valid_to = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha/hora hasta la cual este precio es válido. NULL = vigente indefinidamente"
    )

    # Soporte multi-tenant (opcional)
    tenant_schema = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        help_text="Schema del tenant (para overrides específicos por tenant)"
    )

    # Auditoría
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text="Usuario que creó/modificó este precio"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'precios_dispositivos_personalizados'
        verbose_name = 'Precio Dispositivo Personalizado'
        verbose_name_plural = 'Precios Dispositivos Personalizados'

        constraints = [
            # Garantiza un único precio vigente por (dispositivo, canal, tenant)
            models.UniqueConstraint(
                fields=['dispositivo_personalizado', 'canal', 'tenant_schema'],
                condition=models.Q(valid_to__isnull=True),
                name='uniq_precio_dispositivo_personalizado_vigente'
            ),
        ]

        indexes = [
            models.Index(fields=['dispositivo_personalizado', 'canal', 'valid_from']),
            models.Index(fields=['valid_to']),
            models.Index(fields=['tenant_schema']),
        ]

        ordering = ['-valid_from']

    def __str__(self):
        disp = f"{self.dispositivo_personalizado.marca} {self.dispositivo_personalizado.modelo}"
        return f'{disp} | {self.canal} | €{self.precio_neto} | {self.valid_from.strftime("%Y-%m-%d")}..{self.valid_to.strftime("%Y-%m-%d") if self.valid_to else "∞"}'


class PiezaTipo(models.Model):
    """
    Catálogo de tipos de pieza: pantalla, batería, cámara trasera, chasis/tapa, etc.
    """
    nombre = models.CharField(max_length=64, unique=True)
    categoria = models.CharField(max_length=64, blank=True, default='')
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


class ManoObraTipo(models.Model):
    """
    Tipos de MO: MO1, MO2... con tarifa por minuto (o por hora si prefieres).
    """
    nombre = models.CharField(max_length=32, unique=True)  # MO1, MO2
    descripcion = models.CharField(max_length=128, blank=True, default='')
    coste_por_hora = models.DecimalField(max_digits=10, decimal_places=4)  

    def __str__(self):
        return f'{self.nombre} ({self.coste_por_minuto}/min)'


class CostoPieza(models.Model):
    """
    Coste de pieza por modelo (opcional por capacidad), versionado.
    Permite decidir si 'batería' usa MO1 o MO2 y cuántos minutos lleva en ese modelo.
    """
    modelo = models.ForeignKey(
        'productos.Modelo',
        on_delete=models.CASCADE,
        related_name='costes_piezas'
    )
    capacidad = models.ForeignKey(
        'productos.Capacidad',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='costes_piezas'
    )  # normalmente NULL; déjalo por si alguna pieza varía por capacidad

    pieza_tipo = models.ForeignKey(PiezaTipo, on_delete=models.CASCADE, related_name='costes')
    coste_neto = models.DecimalField(max_digits=12, decimal_places=2)  # sin IVA

    # Mano de obra
    mano_obra_tipo = models.ForeignKey(ManoObraTipo, on_delete=models.PROTECT)
    horas = models.DecimalField(max_digits=10, decimal_places=4, default=0)  # duración en horas
    mano_obra_fija_neta = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    proveedor = models.CharField(max_length=64, blank=True, default='')  # opcional
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField(null=True, blank=True)  # NULL = vigente

    class Meta:
        indexes = [
            models.Index(fields=['modelo', 'pieza_tipo', 'valid_from']),
            models.Index(fields=['valid_to']),
        ]

    def __str__(self):
        return f'{self.modelo_id}:{self.pieza_tipo} {self.coste_neto} ({self.mano_obra_tipo}/{self.minutos}m) {self.valid_from}..{self.valid_to or "∞"}'
