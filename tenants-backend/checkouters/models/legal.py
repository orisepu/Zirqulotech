from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import RegexValidator
from .utils import upload_path_anverso, upload_path_reverso


try:
    from checkouters.storage_backends import PrivateMediaStorage
    PRIVATE_STORAGE = PrivateMediaStorage()
except Exception:
    PRIVATE_STORAGE = None


class B2CContrato(models.Model):
    ESTADO = (
        ("pendiente", "Pendiente"),
        ("otp_enviado", "OTP enviado"),
        ("firmado", "Firmado"),
        ("expirado", "Expirado"),
        ("cancelado", "Cancelado"),
    )
    # Relación opcional con Oportunidad/Cliente si aplica en tu dominio
    TIPO = (("marco", "Contrato marco"), ("acta", "Acta de recepción"))
    tipo = models.CharField(max_length=10, choices=TIPO, default="marco")
    principal = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="anexos"
    )
    oportunidad_id = models.UUIDField(null=True, blank=True)
    email = models.EmailField()
    telefono = models.CharField(max_length=32, blank=True)
    dni = models.CharField(
        max_length=16,
        validators=[RegexValidator(r"^[0-9XYZxyz][0-9]{7}[A-Za-z]$|^[A-Za-z0-9\-\.]{5,}$", "DNI/NIE no válido")]
    )
    dni_anverso = models.ImageField(
        upload_to=upload_path_anverso,
        storage=PRIVATE_STORAGE,
        blank=True,
        null=True,
    )
    dni_reverso = models.ImageField(
        upload_to=upload_path_reverso,
        storage=PRIVATE_STORAGE,
        blank=True,
        null=True,
    )
    kyc_token = models.UUIDField(unique=True, null=True, blank=True)
    kyc_expires_at = models.DateTimeField(null=True, blank=True)
    kyc_completado = models.BooleanField(default=False)           
    kyc_completed_at = models.DateTimeField(null=True, blank=True)
    kyc_revocado_at = models.DateTimeField(null=True, blank=True)
    kyc_estado = models.CharField(
        max_length=20,
        choices=[
            ("pendiente", "Pendiente"),
            ("docs_recibidos", "Docs recibidos"),
            ("verificado", "Verificado"),
            ("mismatch", "No coincide"),
            ("rechazado", "Rechazado"),
        ],
        default="pendiente",
        db_index=True,
    )
    kyc_motivo = models.TextField(blank=True, default="")
    kyc_verificado_en = models.DateTimeField(null=True, blank=True)
    kyc_verificado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="kyc_verificados"
    )
    pago_bloqueado_por_kyc = models.BooleanField(default=True)  
    # flags opcionales
    tiene_dni_anverso = models.BooleanField(default=False)         
    tiene_dni_reverso = models.BooleanField(default=False)        
    kyc_retenido_hasta = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha hasta la que se retiene la documentación KYC."
    )

    def marcar_retencion(self, dias=1825):
        self.kyc_retenido_hasta = timezone.now() + timezone.timedelta(days=dias)

    contrato_datos = models.JSONField(default=dict, blank=True)

    # OTP
    otp_hash = models.CharField(max_length=128, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    otp_intentos = models.PositiveSmallIntegerField(default=0)
    otp_max_intentos = models.PositiveSmallIntegerField(default=5)
    estado = models.CharField(max_length=16, choices=ESTADO, default="pendiente")
    ultimo_envio_otp = models.DateTimeField(null=True, blank=True)

    # Firma
    firmado_en = models.DateTimeField(null=True, blank=True)
    firmado_por = models.CharField(max_length=255, blank=True)
    ip_firmante = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    # PDF
    pdf = models.FileField(storage=PRIVATE_STORAGE, upload_to="contratos/", blank=True)
    pdf_sha256 = models.CharField(max_length=64, blank=True)
    pdf_generado_en = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    @property
    def es_marco(self): return self.tipo == "marco"

    @property
    def es_acta(self):  return self.tipo == "acta"
    
    def otp_vigente(self):
        return self.otp_expires_at and timezone.now() < self.otp_expires_at
    
    @property
    def pdf_listo(self) -> bool:
        return bool(self.pdf)

    def marcar_firmado(self, firmante: str = "", ip: str = "", ua: str = ""):
        self.estado = "firmado"
        self.firmado_en = timezone.now()
        self.firmado_por = firmante or self.firmado_por
        self.ip_firmante = ip or self.ip_firmante
        self.user_agent = ua or self.user_agent


class LegalTemplate(models.Model):
    namespace  = models.SlugField(default="default", help_text='p.ej. "default" o "tenant:<uuid>"', db_index=True)
    slug       = models.SlugField()
    title      = models.CharField(max_length=200, blank=True)
    version    = models.CharField(max_length=20, default="v1")
    content    = models.TextField(help_text="Markdown/HTML simple con {{ variables }}")
    is_active  = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("namespace", "slug", "is_active")]
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.namespace}:{self.slug} [{self.version}]{' *' if self.is_active else ''}"
