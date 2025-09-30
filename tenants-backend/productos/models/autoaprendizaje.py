from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import json


class LikewizeKnowledgeBase(models.Model):
    """
    Base de conocimiento que almacena mapeos exitosos para autoaprendizaje
    """
    # Datos de Likewize
    likewize_model_name = models.CharField(max_length=500, db_index=True)
    likewize_m_model = models.CharField(max_length=255, db_index=True)
    likewize_capacity = models.CharField(max_length=50)
    likewize_phone_model_id = models.IntegerField(null=True, blank=True)
    likewize_full_name = models.CharField(max_length=500, blank=True)

    # Mapeo a datos locales
    local_modelo = models.ForeignKey('productos.Modelo', on_delete=models.CASCADE)
    local_capacidad = models.ForeignKey('productos.Capacidad', on_delete=models.CASCADE)

    # Métricas de confianza y uso
    confidence_score = models.FloatField(default=0.5)
    times_used = models.IntegerField(default=1)
    success_rate = models.FloatField(default=1.0)  # % de veces que fue correcto
    last_used = models.DateTimeField(auto_now=True)

    # Origen del aprendizaje
    user_validated = models.BooleanField(default=False)  # Confirmado por humano
    auto_learned = models.BooleanField(default=True)     # Aprendido automáticamente
    created_by_correction = models.BooleanField(default=False)  # Creado por corrección manual

    # Características extraídas para ML
    features = models.JSONField(default=dict)

    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "productos_likewize_knowledge_base"
        unique_together = ['likewize_model_name', 'likewize_capacity']
        indexes = [
            models.Index(fields=['likewize_m_model', 'confidence_score']),
            models.Index(fields=['last_used']),
            models.Index(fields=['user_validated', 'confidence_score']),
            models.Index(fields=['success_rate']),
        ]

    def __str__(self):
        return f"{self.likewize_model_name} → {self.local_capacidad} (conf: {self.confidence_score:.2f})"

    def update_success_rate(self, was_correct: bool):
        """Actualiza la tasa de éxito basándose en feedback"""
        total_attempts = self.times_used
        current_successes = self.success_rate * (total_attempts - 1)

        if was_correct:
            current_successes += 1

        self.success_rate = current_successes / total_attempts
        self.confidence_score = min(0.95, self.success_rate * self.confidence_score)
        self.save(update_fields=['success_rate', 'confidence_score'])


class MappingCorrection(models.Model):
    """
    Registro de correcciones manuales para auditoría y aprendizaje
    """
    # Datos originales
    likewize_data = models.JSONField()
    original_mapping = models.ForeignKey(
        'productos.Capacidad',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='original_mappings'
    )

    # Corrección aplicada
    corrected_mapping = models.ForeignKey(
        'productos.Capacidad',
        on_delete=models.CASCADE,
        related_name='corrected_mappings'
    )

    # Metadatos de la corrección
    corrected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )
    correction_reason = models.TextField(blank=True)
    kb_entry = models.ForeignKey(
        LikewizeKnowledgeBase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Confidence scores
    original_confidence = models.FloatField(null=True, blank=True)
    correction_confidence = models.FloatField(default=1.0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "productos_mapping_corrections"
        indexes = [
            models.Index(fields=['created_at']),
            models.Index(fields=['corrected_by', 'created_at']),
        ]

    def __str__(self):
        model_name = self.likewize_data.get('ModelName', 'Unknown')
        return f"Correction: {model_name} → {self.corrected_mapping}"


class LearningSession(models.Model):
    """
    Sesión de aprendizaje que agrupa múltiples operaciones
    """
    tarea = models.ForeignKey(
        'productos.TareaActualizacionLikewize',
        on_delete=models.CASCADE,
        related_name='learning_sessions'
    )

    # Métricas de la sesión
    total_items_processed = models.IntegerField(default=0)
    items_learned = models.IntegerField(default=0)
    items_predicted = models.IntegerField(default=0)
    items_corrected = models.IntegerField(default=0)

    # Métricas de precisión
    prediction_accuracy = models.FloatField(null=True, blank=True)
    avg_confidence = models.FloatField(null=True, blank=True)

    # Tiempo de procesamiento
    processing_time_seconds = models.FloatField(null=True, blank=True)

    # Metadatos
    session_metadata = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "productos_learning_sessions"
        indexes = [
            models.Index(fields=['tarea', 'created_at']),
            models.Index(fields=['prediction_accuracy']),
        ]

    def __str__(self):
        return f"Learning Session {self.id} - {self.total_items_processed} items"

    def calculate_metrics(self):
        """Calcula métricas finales de la sesión"""
        if self.total_items_processed > 0:
            self.prediction_accuracy = self.items_predicted / self.total_items_processed

        # Calcular confianza promedio de items aprendidos
        kb_entries = LikewizeKnowledgeBase.objects.filter(
            created_at__gte=self.created_at
        )
        if kb_entries.exists():
            self.avg_confidence = kb_entries.aggregate(
                models.Avg('confidence_score')
            )['confidence_score__avg']

        self.completed_at = timezone.now()
        self.save()


class FeaturePattern(models.Model):
    """
    Patrones de características aprendidos automáticamente
    """
    pattern_name = models.CharField(max_length=100, unique=True)
    pattern_type = models.CharField(max_length=50, choices=[
        ('regex', 'Regular Expression'),
        ('keyword', 'Keyword Match'),
        ('similarity', 'Similarity Score'),
        ('ml', 'Machine Learning'),
    ])

    pattern_value = models.TextField()  # El patrón en sí
    confidence_threshold = models.FloatField(default=0.7)

    # Estadísticas de uso
    times_applied = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)

    # Metadatos
    learned_from_sessions = models.ManyToManyField(LearningSession, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "productos_feature_patterns"
        indexes = [
            models.Index(fields=['pattern_type', 'is_active']),
            models.Index(fields=['confidence_threshold']),
        ]

    @property
    def success_rate(self):
        if self.times_applied == 0:
            return 0.0
        return self.success_count / self.times_applied

    def __str__(self):
        return f"{self.pattern_name} ({self.pattern_type}) - {self.success_rate:.2%}"