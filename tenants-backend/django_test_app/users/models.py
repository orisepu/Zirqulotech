import uuid
from django.db import models
from tenant_users.tenants.models import UserProfile
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from datetime import timedelta

_NameFieldLength = 64


class TenantUser(UserProfile):
    """Simple user model definition for testing."""

    name = models.CharField(max_length=_NameFieldLength, blank=True)


class GuidUser(UserProfile):
    guid = models.UUIDField(default=uuid.uuid4, primary_key=True)
    tenants = models.ManyToManyField(
        settings.TENANT_MODEL,
        verbose_name=_("tenants"),
        blank=True,
        help_text=_("The tenants this user belongs to."),
        related_name="guid_users_set",
    )


# SECURITY FIX (MED-03): Password Reset Token Model
class PasswordResetToken(models.Model):
    """
    Token de recuperación de contraseña con expiración y un solo uso

    Features:
    - Tokens únicos y aleatorios (UUID4)
    - Expiración configurable (default: 1 hora)
    - Un solo uso (se elimina tras uso exitoso)
    - Metadata de seguridad (IP, user agent)

    Referencias:
    - OWASP ASVS 4.0: 2.1.11 - Password reset functionality
    - CWE-640: Weak Password Recovery Mechanism
    - NIST SP 800-63B: Password recovery best practices
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    is_used = models.BooleanField(default=False)

    # Metadata de seguridad
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'password_reset_tokens'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token', 'is_used']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f"Reset token for {self.user.email} - {'Used' if self.is_used else 'Active'}"

    def save(self, *args, **kwargs):
        """Establecer expiración si no está definida"""
        if not self.expires_at:
            # Default: 1 hora de validez
            expiry_hours = getattr(settings, 'PASSWORD_RESET_TIMEOUT_HOURS', 1)
            self.expires_at = timezone.now() + timedelta(hours=expiry_hours)
        super().save(*args, **kwargs)

    def is_valid(self):
        """Verifica si el token es válido (no usado y no expirado)"""
        if self.is_used:
            return False
        if timezone.now() > self.expires_at:
            return False
        return True

    def mark_as_used(self):
        """Marca el token como usado"""
        self.is_used = True
        self.used_at = timezone.now()
        self.save(update_fields=['is_used', 'used_at'])

    @classmethod
    def create_token(cls, user, request):
        """
        Crea un nuevo token de reset para el usuario

        Invalidación automática:
        - Tokens previos no usados del mismo usuario se invalidan
        - Previene acumulación de tokens válidos
        """
        # Invalidar tokens previos no usados
        cls.objects.filter(user=user, is_used=False).update(is_used=True)

        # Generar token aleatorio seguro
        token = uuid.uuid4().hex  # 32 caracteres hexadecimales

        # Extraer metadata de seguridad
        ip_address = request.META.get('REMOTE_ADDR', '') if request else ''
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:255] if request else ''

        # Crear nuevo token
        reset_token = cls.objects.create(
            user=user,
            token=token,
            ip_address=ip_address,
            user_agent=user_agent
        )

        return reset_token

    @classmethod
    def cleanup_expired(cls):
        """
        Limpieza de tokens expirados (ejecutar en cron job)

        Elimina tokens:
        - Expirados hace más de 7 días
        - Usados hace más de 7 días
        """
        cutoff = timezone.now() - timedelta(days=7)
        expired_count = cls.objects.filter(expires_at__lt=cutoff).delete()[0]
        used_count = cls.objects.filter(is_used=True, used_at__lt=cutoff).delete()[0]
        return expired_count + used_count
