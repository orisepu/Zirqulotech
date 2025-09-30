"""
Sistema de Mapeo de Dispositivos V2
Estrategia híbrida optimizada por tipo de dispositivo con documentación completa.
"""

from django.db import models
from django.utils import timezone
from decimal import Decimal
import uuid
import json


class DeviceMappingV2(models.Model):
    """
    Sistema de mapeo V2 con estrategia híbrida por tipo de dispositivo.
    Mantiene documentación completa de decisiones y permite aprendizaje automático.
    """

    # Identificación única
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_signature = models.CharField(
        max_length=512,
        unique=True,
        db_index=True,
        help_text="Hash único del dispositivo basado en datos clave"
    )

    # Datos fuente completos
    source_data = models.JSONField(
        help_text="JSON completo de Likewize tal como se recibió"
    )
    source_type = models.CharField(
        max_length=20,
        choices=[
            ('mac', 'Mac Desktop/Laptop'),
            ('iphone', 'iPhone'),
            ('ipad', 'iPad'),
            ('watch', 'Apple Watch'),
            ('other', 'Otros dispositivos Apple')
        ],
        db_index=True
    )

    # Metadatos extraídos automáticamente
    extracted_a_number = models.CharField(
        max_length=8,
        blank=True,
        db_index=True,
        help_text="A-number extraído de los datos (ej: A2348)"
    )
    extracted_model_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Nombre del modelo normalizado"
    )
    extracted_cpu = models.CharField(
        max_length=100,
        blank=True,
        help_text="CPU/Procesador extraído"
    )
    extracted_year = models.IntegerField(
        null=True,
        db_index=True,
        help_text="Año de lanzamiento extraído"
    )
    extracted_month = models.IntegerField(
        null=True,
        help_text="Mes de lanzamiento extraído"
    )
    extracted_capacity_gb = models.IntegerField(
        null=True,
        db_index=True,
        help_text="Capacidad en GB extraída"
    )
    extracted_screen_size = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        help_text="Tamaño de pantalla en pulgadas"
    )

    # Resultado del mapeo
    mapped_capacity = models.ForeignKey(
        'Capacidad',
        on_delete=models.CASCADE,
        help_text="Capacidad mapeada en nuestra BD"
    )
    confidence_score = models.IntegerField(
        help_text="Puntuación de confianza 0-100"
    )
    mapping_algorithm = models.CharField(
        max_length=50,
        choices=[
            ('a_number_direct', 'Mapeo directo por A-number'),
            ('exact_name_match', 'Coincidencia exacta de nombre'),
            ('tech_specs_match', 'Coincidencia por especificaciones'),
            ('fuzzy_similarity', 'Similitud difusa'),
            ('ml_prediction', 'Predicción por ML'),
            ('heuristic_rules', 'Reglas heurísticas'),
            ('manual_override', 'Mapeo manual'),
        ]
    )

    # Seguimiento y aprendizaje
    decision_path = models.JSONField(
        help_text="Pasos detallados del algoritmo de decisión"
    )
    candidates_considered = models.JSONField(
        help_text="Todas las opciones de mapeo consideradas"
    )
    rejection_reasons = models.JSONField(
        help_text="Por qué se rechazaron otras opciones"
    )

    # Métricas de rendimiento
    processing_time_ms = models.IntegerField(
        help_text="Tiempo de procesamiento en milisegundos"
    )
    memory_usage_mb = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        help_text="Uso de memoria durante el procesamiento"
    )

    # Validación y feedback
    validated_by_user = models.BooleanField(
        default=False,
        help_text="Si un usuario ha validado este mapeo"
    )
    validation_feedback = models.CharField(
        max_length=20,
        choices=[
            ('correct', 'Correcto'),
            ('incorrect', 'Incorrecto'),
            ('partial', 'Parcialmente correcto'),
            ('needs_review', 'Necesita revisión'),
        ],
        blank=True
    )
    user_notes = models.TextField(
        blank=True,
        help_text="Notas del usuario sobre el mapeo"
    )

    # Control de calidad
    needs_review = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Marcado para revisión manual"
    )
    review_reason = models.CharField(
        max_length=200,
        blank=True,
        help_text="Razón por la que necesita revisión"
    )

    # Versioning y experimentación
    algorithm_version = models.CharField(
        max_length=20,
        default="2.0",
        help_text="Versión del algoritmo usado"
    )
    experiment_group = models.CharField(
        max_length=50,
        blank=True,
        help_text="Grupo experimental para A/B testing"
    )

    # Metadatos temporales
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "productos_device_mapping_v2"
        indexes = [
            # Búsquedas por tipo y A-number
            models.Index(fields=['source_type', 'extracted_a_number']),
            models.Index(fields=['extracted_a_number', 'confidence_score']),

            # Análisis de calidad
            models.Index(fields=['confidence_score', 'created_at']),
            models.Index(fields=['needs_review', 'validation_feedback']),

            # Análisis de rendimiento
            models.Index(fields=['algorithm_version', 'source_type']),
            models.Index(fields=['mapping_algorithm', 'confidence_score']),

            # Seguimiento temporal
            models.Index(fields=['created_at', 'source_type']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.source_type}: {self.extracted_model_name} -> {self.mapped_capacity}"

    def get_confidence_level(self):
        """Retorna nivel de confianza cualitativo."""
        if self.confidence_score >= 90:
            return "muy_alta"
        elif self.confidence_score >= 75:
            return "alta"
        elif self.confidence_score >= 60:
            return "media"
        elif self.confidence_score >= 40:
            return "baja"
        else:
            return "muy_baja"

    def mark_for_review(self, reason: str):
        """Marca el mapeo para revisión manual."""
        self.needs_review = True
        self.review_reason = reason[:200]
        self.save(update_fields=['needs_review', 'review_reason'])

    def add_user_feedback(self, feedback: str, notes: str = ""):
        """Añade feedback de usuario al mapeo."""
        self.validation_feedback = feedback
        self.user_notes = notes
        self.validated_by_user = True
        self.save(update_fields=['validation_feedback', 'user_notes', 'validated_by_user'])


class AppleDeviceKnowledgeBase(models.Model):
    """
    Base de conocimiento de dispositivos Apple con A-numbers y especificaciones.
    Fuente de verdad para mapeo de dispositivos Apple.
    """

    # Identificación del dispositivo
    device_family = models.CharField(
        max_length=50,
        choices=[
            ('iPhone', 'iPhone'),
            ('iPad', 'iPad'),
            ('iPad Pro', 'iPad Pro'),
            ('iPad Air', 'iPad Air'),
            ('iPad mini', 'iPad mini'),
            ('Mac mini', 'Mac mini'),
            ('iMac', 'iMac'),
            ('iMac Pro', 'iMac Pro'),
            ('MacBook Air', 'MacBook Air'),
            ('MacBook Pro', 'MacBook Pro'),
            ('Mac Pro', 'Mac Pro'),
            ('Mac Studio', 'Mac Studio'),
            ('Apple Watch', 'Apple Watch'),
        ],
        db_index=True
    )
    model_name = models.CharField(
        max_length=100,
        help_text="Nombre comercial del modelo (ej: iPhone 15 Pro)"
    )
    a_number = models.CharField(
        max_length=8,
        unique=True,
        db_index=True,
        help_text="A-number oficial de Apple (ej: A3108)"
    )

    # Especificaciones técnicas
    release_date = models.DateField(
        help_text="Fecha de lanzamiento oficial"
    )
    cpu_family = models.CharField(
        max_length=50,
        blank=True,
        help_text="Familia de CPU (ej: A17 Pro, M2 Pro)"
    )
    cpu_cores = models.CharField(
        max_length=100,
        blank=True,
        help_text="Configuración de cores (ej: 8 Core CPU 10 Core GPU)"
    )
    screen_size = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        null=True,
        help_text="Tamaño de pantalla en pulgadas"
    )
    available_capacities = models.JSONField(
        help_text="Capacidades disponibles en GB [128, 256, 512, 1024]"
    )

    # Mapeo con Likewize
    likewize_model_names = models.JSONField(
        help_text="Nombres que aparecen en M_Model de Likewize"
    )
    likewize_master_patterns = models.JSONField(
        help_text="Patrones que aparecen en MasterModelName"
    )
    likewize_full_patterns = models.JSONField(
        default=list,
        help_text="Patrones completos en ModelName/FullName"
    )

    # Metadatos de confianza
    confidence_level = models.CharField(
        max_length=20,
        choices=[
            ('verified', 'Verificado oficialmente'),
            ('high_confidence', 'Alta confianza'),
            ('inferred', 'Inferido de fuentes múltiples'),
            ('estimated', 'Estimado'),
            ('needs_verification', 'Necesita verificación'),
        ],
        default='needs_verification'
    )
    source = models.CharField(
        max_length=50,
        help_text="Fuente de la información (apple_official, everymac, manual, etc.)"
    )
    verification_notes = models.TextField(
        blank=True,
        help_text="Notas sobre la verificación de la información"
    )

    # Metadatos de gestión
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.CharField(
        max_length=100,
        blank=True,
        help_text="Usuario que creó esta entrada"
    )

    class Meta:
        db_table = "productos_apple_device_knowledge"
        unique_together = [('device_family', 'model_name', 'a_number')]
        indexes = [
            models.Index(fields=['device_family', 'a_number']),
            models.Index(fields=['model_name', 'device_family']),
            models.Index(fields=['confidence_level', 'device_family']),
            models.Index(fields=['release_date', 'device_family']),
        ]
        ordering = ['device_family', 'release_date', 'model_name']

    def __str__(self):
        return f"{self.device_family} {self.model_name} ({self.a_number})"

    def get_likewize_patterns_combined(self):
        """Retorna todos los patrones de Likewize combinados."""
        patterns = []
        patterns.extend(self.likewize_model_names)
        patterns.extend(self.likewize_master_patterns)
        patterns.extend(self.likewize_full_patterns)
        return list(set(patterns))  # Eliminar duplicados


class MappingAuditLog(models.Model):
    """
    Log de auditoría completo para cada decisión de mapeo.
    Permite análisis detallado y debugging del sistema.
    """

    # Identificación
    tarea_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="ID de la tarea de actualización"
    )
    device_signature = models.CharField(
        max_length=512,
        db_index=True,
        help_text="Signature del dispositivo procesado"
    )
    mapping_v2 = models.ForeignKey(
        DeviceMappingV2,
        on_delete=models.CASCADE,
        null=True,
        help_text="Referencia al mapeo V2 creado"
    )

    # Contexto de la decisión
    algorithm_used = models.CharField(
        max_length=50,
        help_text="Algoritmo que produjo el resultado final"
    )
    confidence_score = models.IntegerField(
        help_text="Puntuación de confianza final"
    )
    mapping_result = models.ForeignKey(
        'Capacidad',
        null=True,
        on_delete=models.SET_NULL,
        help_text="Resultado del mapeo (null si falló)"
    )

    # Análisis detallado de la decisión
    available_candidates = models.JSONField(
        help_text="Todas las opciones de mapeo disponibles con scores"
    )
    decision_factors = models.JSONField(
        help_text="Factores que influyeron en la decisión final"
    )
    rejected_candidates = models.JSONField(
        help_text="Candidatos rechazados con razones específicas"
    )
    algorithm_chain = models.JSONField(
        help_text="Secuencia de algoritmos intentados con resultados"
    )

    # Datos técnicos del procesamiento
    processing_time_ms = models.IntegerField(
        help_text="Tiempo total de procesamiento"
    )
    memory_usage_mb = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        help_text="Pico de uso de memoria"
    )
    database_queries = models.IntegerField(
        default=0,
        help_text="Número de queries a BD ejecutadas"
    )

    # Control de calidad automático
    automatic_quality_score = models.IntegerField(
        null=True,
        help_text="Score automático de calidad del mapeo"
    )
    quality_flags = models.JSONField(
        default=list,
        help_text="Flags automáticos de calidad detectados"
    )
    needs_review = models.BooleanField(
        default=False,
        db_index=True
    )
    review_reason = models.CharField(
        max_length=200,
        blank=True
    )

    # Seguimiento de validación humana
    user_validation = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pendiente de validación'),
            ('correct', 'Validado como correcto'),
            ('incorrect', 'Marcado como incorrecto'),
            ('partially_correct', 'Parcialmente correcto'),
            ('disputed', 'En disputa'),
        ],
        default='pending'
    )
    validator_user = models.CharField(
        max_length=100,
        blank=True,
        help_text="Usuario que validó el mapeo"
    )
    validation_notes = models.TextField(
        blank=True,
        help_text="Notas de validación del usuario"
    )
    validation_date = models.DateTimeField(
        null=True,
        help_text="Fecha de validación por usuario"
    )

    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "productos_mapping_audit_log"
        indexes = [
            # Análisis por tarea
            models.Index(fields=['tarea_id', 'algorithm_used']),
            models.Index(fields=['tarea_id', 'confidence_score']),

            # Control de calidad
            models.Index(fields=['needs_review', 'user_validation']),
            models.Index(fields=['automatic_quality_score', 'created_at']),

            # Análisis de rendimiento
            models.Index(fields=['algorithm_used', 'processing_time_ms']),
            models.Index(fields=['created_at', 'processing_time_ms']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        status = "✓" if self.mapping_result else "✗"
        return f"{status} {self.device_signature[:50]} ({self.algorithm_used})"


class MappingSessionReport(models.Model):
    """
    Reporte agregado de una sesión completa de mapeo (por tarea).
    """

    tarea_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True
    )

    # Estadísticas generales
    total_devices_processed = models.IntegerField(default=0)
    successfully_mapped = models.IntegerField(default=0)
    failed_mappings = models.IntegerField(default=0)
    high_confidence_mappings = models.IntegerField(default=0)  # >= 80
    medium_confidence_mappings = models.IntegerField(default=0)  # 60-79
    low_confidence_mappings = models.IntegerField(default=0)  # < 60

    # Por tipo de dispositivo
    devices_by_type = models.JSONField(
        default=dict,
        help_text="Estadísticas por source_type"
    )

    # Por algoritmo
    algorithms_used = models.JSONField(
        default=dict,
        help_text="Conteo por algoritmo usado"
    )

    # Rendimiento
    total_processing_time_ms = models.IntegerField(default=0)
    avg_processing_time_ms = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('0.00')
    )
    peak_memory_usage_mb = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True
    )

    # Calidad y problemas
    mappings_needing_review = models.IntegerField(default=0)
    new_knowledge_discovered = models.JSONField(
        default=list,
        help_text="Nuevos A-numbers o patrones descubiertos"
    )
    problematic_patterns = models.JSONField(
        default=list,
        help_text="Patrones que causaron problemas"
    )

    # Recomendaciones automáticas
    recommendations = models.JSONField(
        default=list,
        help_text="Recomendaciones generadas automáticamente"
    )

    # Metadatos
    created_at = models.DateTimeField(auto_now_add=True)
    generation_time_ms = models.IntegerField(
        default=0,
        help_text="Tiempo para generar este reporte"
    )

    class Meta:
        db_table = "productos_mapping_session_report"
        ordering = ['-created_at']

    def __str__(self):
        success_rate = (self.successfully_mapped / max(self.total_devices_processed, 1)) * 100
        return f"Tarea {self.tarea_id}: {success_rate:.1f}% éxito ({self.total_devices_processed} dispositivos)"