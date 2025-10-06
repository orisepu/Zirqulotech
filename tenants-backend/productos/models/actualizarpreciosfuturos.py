from django.db import models
from django.utils import timezone
import uuid
from decimal import Decimal

class TareaActualizacionLikewize(models.Model):
    ESTADOS = [
        ("PENDING", "PENDING"),
        ("RUNNING", "RUNNING"),
        ("SUCCESS", "SUCCESS"),
        ("ERROR",   "ERROR"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    estado = models.CharField(max_length=16, choices=ESTADOS, default="PENDING")
    creado_en = models.DateTimeField(default=timezone.now)
    iniciado_en = models.DateTimeField(null=True, blank=True)
    finalizado_en = models.DateTimeField(null=True, blank=True)
    total_modelos = models.IntegerField(null=True, blank=True)
    csv_path = models.CharField(max_length=512, blank=True, default="")
    csv_corregido_path = models.CharField(max_length=512, blank=True, default="")
    log_path = models.CharField(max_length=512, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    progreso = models.PositiveSmallIntegerField(default=0)       # 0..100
    subestado = models.CharField(max_length=120, blank=True, default="")
    meta = models.JSONField(default=dict, blank=True)
    logs = models.JSONField(default=list, blank=True)  # Lista de objetos {timestamp, level, message}

    class Meta:
        db_table = "precios_tarea_actualizacion_likewize"

    def __str__(self):
        return f"{self.id} [{self.estado}]"

    def add_log(self, message: str, level: str = 'INFO'):
        """Añade un log con timestamp a la lista de logs"""
        if not isinstance(self.logs, list):
            self.logs = []
        self.logs.append({
            'timestamp': timezone.now().isoformat(),
            'level': level,
            'message': message
        })
        self.save(update_fields=['logs'])
    
class LikewizeItemStaging(models.Model):
    """
    Lo que trajo la tarea desde Likewize (normalizado por clave).

    IMPORTANTE: Los precios se almacenan SIN IVA.
    Likewize devuelve precios CON IVA del 21%, pero el sistema los convierte
    automáticamente a precio neto (sin IVA) dividiendo por 1.21 antes de
    guardar en staging.
    """
    tarea = models.ForeignKey(TareaActualizacionLikewize, on_delete=models.CASCADE, related_name="staging")
    tipo = models.CharField(max_length=50)                # iPhone / iPad / Mac / SmartPhone
    marca = models.CharField(max_length=100, default='Apple')
    modelo_norm = models.CharField(max_length=255)        # modelo normalizado
    almacenamiento_gb = models.IntegerField(null=True)    # 64,128,256...
    precio_b2b = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))  # SIN IVA
    capacidad_id = models.IntegerField(null=True, blank=True)

    modelo_raw = models.CharField(max_length=512, blank=True, default="")   # texto original de Likewize
    likewize_model_code = models.CharField(max_length=64, blank=True, default="")
    pulgadas = models.IntegerField(null=True, blank=True)                   # 27, 24, 13...
    any = models.IntegerField(null=True, blank=True)                       # 2017, 2020...
    a_number = models.CharField(max_length=8, blank=True, default="")       # A1419, A2337...
    cpu = models.CharField(max_length=128, blank=True, default="")          # "Core i5 3.8", "M2", etc.
    disco = models.CharField(max_length=32, blank=True, default="")   

    class Meta:
        db_table = "precios_likewize_staging"
        indexes = [
            models.Index(fields=["tarea","tipo","modelo_norm","almacenamiento_gb"]),
            models.Index(fields=["tarea","capacidad_id"]),
            models.Index(fields=["tarea","a_number"]),
        ]
        unique_together = [("tarea","tipo","modelo_norm","almacenamiento_gb")]

class LikewizeCazadorTarea(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    # Conteo total de items del dump de Likewize usados en el cazado
    total_likewize = models.PositiveIntegerField(default=0)

    # Resultados
    matches = models.JSONField(default=list, blank=True)       # [{likewize_nombre, bd_modelo, bd_capacidad, capacidad_id}]
    no_cazados_bd = models.JSONField(default=list, blank=True) # [{bd_modelo, bd_capacidad, capacidad_id}]
    # Nuevos: elementos de Likewize que no cazaron con la BD
    no_cazados_likewize = models.JSONField(default=list, blank=True) # [{likewize_nombre}]

    # Información adicional opcional (logs, fichero, filtros, etc.)
    meta = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "progeek_likewize_cazador_tarea"
        verbose_name = "Tarea de Cazado Likewize"
        verbose_name_plural = "Tareas de Cazado Likewize"

    def __str__(self):
        return f"LikewizeCazadorTarea({self.id})"
