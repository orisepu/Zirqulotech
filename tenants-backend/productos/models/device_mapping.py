from django.db import models
from django.utils import timezone
from decimal import Decimal
import uuid


class DeviceMapping(models.Model):
    """
    Caché de mappings exitosos entre dispositivos de Likewize y la BD.
    Permite reutilizar mappings válidos en futuras actualizaciones.
    """

    # Identificadores únicos del mapeo
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Información del dispositivo externo (Likewize)
    source = models.CharField(max_length=32, default="likewize")  # fuente de datos
    source_brand = models.CharField(max_length=100, db_index=True)  # marca externa
    source_type = models.CharField(max_length=50, db_index=True)   # tipo de dispositivo
    source_model_raw = models.CharField(max_length=512)           # nombre original
    source_model_normalized = models.CharField(max_length=255, db_index=True)  # normalizado
    source_capacity_gb = models.IntegerField(null=True, blank=True, db_index=True)

    # Metadatos de identificación
    a_number = models.CharField(max_length=8, blank=True, default="", db_index=True)
    screen_size = models.IntegerField(null=True, blank=True)  # pulgadas
    year = models.IntegerField(null=True, blank=True, db_index=True)
    cpu = models.CharField(max_length=128, blank=True, default="")
    gpu_cores = models.IntegerField(null=True, blank=True)

    # Códigos específicos de Likewize
    likewize_model_code = models.CharField(max_length=64, blank=True, default="", db_index=True)
    likewize_master_model_id = models.CharField(max_length=50, blank=True, default="")

    # Resultado del mapeo en BD
    mapped_capacity_id = models.IntegerField(db_index=True)  # FK a Capacidad
    mapped_model_description = models.CharField(max_length=255)  # descripción del modelo
    mapped_capacity_size = models.CharField(max_length=50)      # tamaño de capacidad

    # Scoring y confianza
    confidence_score = models.IntegerField(default=0)  # 0-100
    mapping_algorithm = models.CharField(max_length=50, default="fuzzy")  # exact, fuzzy, heuristic

    # Metadatos de seguimiento
    first_mapped_at = models.DateTimeField(default=timezone.now)
    last_confirmed_at = models.DateTimeField(default=timezone.now)
    times_confirmed = models.PositiveIntegerField(default=1)

    # Estado del mapeo
    is_active = models.BooleanField(default=True, db_index=True)
    needs_review = models.BooleanField(default=False, db_index=True)  # requiere validación manual
    review_reason = models.CharField(max_length=200, blank=True, default="")

    # Invalidación y versioning
    invalidated_at = models.DateTimeField(null=True, blank=True)
    invalidation_reason = models.CharField(max_length=200, blank=True, default="")
    mapping_version = models.CharField(max_length=20, default="1.0")

    class Meta:
        db_table = "productos_device_mapping"
        indexes = [
            # Índices para búsquedas de mapeo
            models.Index(fields=["source", "source_brand", "source_type", "source_model_normalized"]),
            models.Index(fields=["source", "source_brand", "source_capacity_gb"]),
            models.Index(fields=["a_number", "screen_size", "year"]),
            models.Index(fields=["likewize_model_code", "source_brand"]),

            # Índices para consultas de gestión
            models.Index(fields=["is_active", "confidence_score"]),
            models.Index(fields=["needs_review", "last_confirmed_at"]),
            models.Index(fields=["first_mapped_at", "source_brand"]),
        ]
        unique_together = [
            # Evitar mappings duplicados para la misma configuración
            ("source", "source_brand", "source_model_normalized", "source_capacity_gb", "a_number")
        ]
        ordering = ["-last_confirmed_at"]

    def __str__(self):
        return f"{self.source_brand} {self.source_model_normalized} -> {self.mapped_model_description}"

    def mark_confirmed(self):
        """Marca el mapeo como confirmado en una nueva actualización."""
        self.last_confirmed_at = timezone.now()
        self.times_confirmed += 1
        self.save(update_fields=["last_confirmed_at", "times_confirmed"])

    def invalidate(self, reason: str = ""):
        """Invalida el mapeo por cambios en BD o errores detectados."""
        self.is_active = False
        self.invalidated_at = timezone.now()
        self.invalidation_reason = reason[:200]
        self.save(update_fields=["is_active", "invalidated_at", "invalidation_reason"])

    def flag_for_review(self, reason: str = ""):
        """Marca el mapeo para revisión manual."""
        self.needs_review = True
        self.review_reason = reason[:200]
        self.save(update_fields=["needs_review", "review_reason"])

    @classmethod
    def find_cached_mapping(cls, **kwargs):
        """
        Busca un mapeo en caché basado en criterios de búsqueda.
        Retorna el mapeo más confiable y reciente.
        """
        query = cls.objects.filter(is_active=True, **kwargs)
        return query.order_by("-confidence_score", "-last_confirmed_at").first()


class MappingFeedback(models.Model):
    """
    Sistema de feedback para validación manual de mappings dudosos.
    """

    mapping = models.ForeignKey(DeviceMapping, on_delete=models.CASCADE, related_name="feedback")
    feedback_type = models.CharField(max_length=20, choices=[
        ("correct", "Correcto"),
        ("incorrect", "Incorrecto"),
        ("needs_review", "Necesita revisión"),
        ("alternative", "Alternativa sugerida"),
    ])

    # Usuario que proporciona feedback (opcional)
    user_id = models.IntegerField(null=True, blank=True)
    user_name = models.CharField(max_length=100, blank=True, default="")

    # Feedback detallado
    comments = models.TextField(blank=True, default="")
    suggested_capacity_id = models.IntegerField(null=True, blank=True)  # mapeo alternativo

    # Metadatos
    created_at = models.DateTimeField(default=timezone.now)
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "productos_mapping_feedback"
        indexes = [
            models.Index(fields=["mapping", "feedback_type"]),
            models.Index(fields=["processed", "created_at"]),
        ]
        ordering = ["-created_at"]


class MappingMetrics(models.Model):
    """
    Métricas agregadas de rendimiento del sistema de mapeo.
    """

    # Período de la métrica
    date = models.DateField(db_index=True)
    source = models.CharField(max_length=32, default="likewize")
    brand = models.CharField(max_length=100, db_index=True)
    device_type = models.CharField(max_length=50, db_index=True)

    # Contadores de rendimiento
    total_processed = models.PositiveIntegerField(default=0)
    successfully_mapped = models.PositiveIntegerField(default=0)
    cached_mappings_used = models.PositiveIntegerField(default=0)
    new_mappings_created = models.PositiveIntegerField(default=0)

    # Métricas de calidad
    avg_confidence_score = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    mappings_needing_review = models.PositiveIntegerField(default=0)

    # Tiempos de procesamiento (en segundos)
    avg_processing_time = models.DecimalField(max_digits=8, decimal_places=3, default=Decimal("0.000"))

    # Metadatos
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "productos_mapping_metrics"
        unique_together = [("date", "source", "brand", "device_type")]
        indexes = [
            models.Index(fields=["date", "source"]),
            models.Index(fields=["brand", "device_type", "date"]),
        ]
        ordering = ["-date", "brand", "device_type"]

    def calculate_mapping_rate(self):
        """Calcula el porcentaje de mapeo exitoso."""
        if self.total_processed == 0:
            return Decimal("0.00")
        return Decimal(self.successfully_mapped / self.total_processed * 100).quantize(Decimal("0.01"))