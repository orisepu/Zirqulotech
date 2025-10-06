from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class LoginHistory(models.Model):
    """
    Historial de inicios de sesión con información de geolocalización.

    Registra cada intento de login (exitoso o bloqueado) con:
    - Ubicación geográfica (país, ciudad/región, coordenadas)
    - IP de origen
    - Si fue bloqueado por razones de seguridad
    - Si se envió alerta al usuario

    Fallback de ubicación:
    - Prioridad 1: Ciudad (precisión alta)
    - Prioridad 2: Región/Provincia (precisión media)
    - Prioridad 3: País (precisión baja)
    - Prioridad 4: IP (sin geolocalización)
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='login_history',
        verbose_name='Usuario'
    )

    ip = models.CharField(
        max_length=45,
        verbose_name='Dirección IP',
        help_text='IPv4 o IPv6'
    )

    country = models.CharField(
        max_length=100,
        verbose_name='País',
        null=True,
        blank=True
    )

    city = models.CharField(
        max_length=100,
        verbose_name='Ciudad',
        null=True,
        blank=True
    )

    region = models.CharField(
        max_length=100,
        verbose_name='Región/Provincia',
        null=True,
        blank=True,
        help_text='Provincia o estado (fallback cuando no hay ciudad)'
    )

    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        verbose_name='Latitud',
        null=True,
        blank=True
    )

    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        verbose_name='Longitud',
        null=True,
        blank=True
    )

    timestamp = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha y hora'
    )

    was_blocked = models.BooleanField(
        default=False,
        verbose_name='Fue bloqueado',
        help_text='Si el login fue bloqueado por razones de seguridad'
    )

    block_reason = models.CharField(
        max_length=100,
        verbose_name='Razón de bloqueo',
        null=True,
        blank=True,
        choices=[
            ('IMPOSSIBLE_TRAVEL', 'Viaje físicamente imposible'),
            ('DIFFERENT_COUNTRY', 'País diferente'),
            ('SUSPICIOUS_IP', 'IP sospechosa'),
            ('VPN_DETECTED', 'VPN detectada'),
        ]
    )

    alert_sent = models.BooleanField(
        default=False,
        verbose_name='Alerta enviada',
        help_text='Si se envió email de alerta al usuario'
    )

    user_agent = models.TextField(
        verbose_name='User Agent',
        null=True,
        blank=True,
        help_text='Navegador y dispositivo usado'
    )

    class Meta:
        verbose_name = 'Historial de Login'
        verbose_name_plural = 'Historial de Logins'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['ip']),
            models.Index(fields=['was_blocked']),
        ]

    def __str__(self):
        # Usar ciudad, o región como fallback, o IP
        display_location = self.city or self.region or self.ip
        location = f"{display_location}, {self.country}" if self.country else display_location
        status = " (BLOQUEADO)" if self.was_blocked else ""
        return f"{self.user.email} desde {location} - {self.timestamp.strftime('%d/%m/%Y %H:%M')}{status}"

    def get_location_display(self):
        """
        Retorna ubicación formateada para mostrar.
        Prioridad: ciudad > región > país > IP
        """
        if self.city:
            # Ciudad conocida
            return f"{self.city}, {self.country}" if self.country else self.city
        elif self.region:
            # No hay ciudad, pero sí región/provincia
            return f"{self.region}, {self.country}" if self.country else self.region
        elif self.country:
            # Solo país conocido
            return f"{self.country} (ubicación aproximada)"
        else:
            # Sin geolocalización (IP privada)
            return f"IP: {self.ip}"
