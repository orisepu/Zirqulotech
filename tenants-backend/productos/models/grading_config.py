# productos/models/grading_config.py
"""
Configuración de parámetros de grading por tipo de dispositivo.
Almacena los porcentajes de penalización por grado (A, B, C) que son
específicos para cada categoría de dispositivo.
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class GradingConfig(models.Model):
    """
    Parámetros de grading específicos por tipo de dispositivo.

    Los precios máximos (V_Aplus) vienen de PrecioRecompra.
    Los costes de reparación (pr_bateria, pr_pantalla, pr_chasis) vienen de CostoPieza.
    Aquí solo almacenamos los parámetros de penalización por grado estético.
    """
    tipo_dispositivo = models.CharField(
        max_length=100,
        unique=True,
        help_text="Tipo de dispositivo (iPhone, iPad, MacBook Air, MacBook Pro, iMac, etc.)"
    )

    # Porcentajes de penalización por grado estético
    # pp_A: penalización de A+ a A (típicamente 0.08 = 8%)
    # pp_B: penalización de A a B (típicamente 0.12 = 12%)
    # pp_C: penalización de B a C (típicamente 0.15 = 15%)
    pp_A = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        default=0.08,
        help_text="Penalización de A+ a A (0.08 = 8%)"
    )
    pp_B = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        default=0.12,
        help_text="Penalización de A a B (0.12 = 12%)"
    )
    pp_C = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        default=0.15,
        help_text="Penalización de B a C (0.15 = 15%)"
    )

    # Penalización funcional por defecto (cuando hay fallo funcional)
    pp_funcional = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        default=0.15,
        help_text="Penalización funcional (0.15 = 15%)"
    )

    # Umbral de salud de batería (solo para dispositivos con batería)
    battery_health_threshold = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        default=85,
        help_text="Umbral de salud de batería para aplicar deducción (85%)"
    )

    # Configuración de gates (comportamiento específico por tipo)
    has_battery = models.BooleanField(
        default=True,
        help_text="¿El dispositivo tiene batería? (True para iPhone, iPad, MacBook; False para iMac, Mac Pro, etc.)"
    )
    has_display = models.BooleanField(
        default=True,
        help_text="¿El dispositivo tiene pantalla integrada? (True para iPhone, iPad, MacBook, iMac; False para Mac Pro, Mac Studio, Mac mini)"
    )

    # Metadata
    activo = models.BooleanField(
        default=True,
        help_text="¿Esta configuración está activa?"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'productos_grading_config'
        verbose_name = 'Configuración de Grading'
        verbose_name_plural = 'Configuraciones de Grading'
        ordering = ['tipo_dispositivo']

    def __str__(self):
        return f"{self.tipo_dispositivo} (A:{self.pp_A}, B:{self.pp_B}, C:{self.pp_C})"
