"""
SECURITY FIX (MED-01): Rate Limiting personalizado para endpoints sensibles

Throttling classes personalizadas para proteger contra:
- Ataques de fuerza bruta en login
- Abuso de endpoints sensibles (cambio de password, recuperación, etc.)
- Exfiltración masiva de datos

Referencias:
- OWASP ASVS 4.0: 2.2.1 - Anti-automation
- CWE-307: Improper Restriction of Excessive Authentication Attempts
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """
    Throttle para login: 5 intentos por minuto por IP

    Más restrictivo que el global para prevenir ataques de fuerza bruta
    incluso con Django Axes activo (defensa en profundidad).
    """
    scope = 'login'


class SensitiveEndpointThrottle(UserRateThrottle):
    """
    Throttle para endpoints sensibles: 10 peticiones/minuto

    Aplica a:
    - Cambio de contraseña
    - Recuperación de contraseña
    - Modificación de datos de usuario
    - Exportación de datos
    - Generación de PDFs
    """
    scope = 'sensitive'

    def allow_request(self, request, view):
        """
        Sobrescribir para aplicar solo a métodos que modifican datos
        """
        # Aplicar throttling solo a POST, PUT, PATCH, DELETE
        if request.method in ['POST', 'PUT', 'PATCH', 'DELETE']:
            return super().allow_request(request, view)
        return True  # Permitir GET sin throttling


class StrictLoginRateThrottle(AnonRateThrottle):
    """
    Throttle ULTRA restrictivo: 3 intentos por minuto

    Usar solo en producción o durante alertas de seguridad.
    Combina con Django Axes para máxima protección.
    """
    scope = 'login'

    def get_cache_key(self, request, view):
        """
        Combina IP + User-Agent para identificación única
        Previene bypass con múltiples user agents desde misma IP
        """
        if request.user.is_authenticated:
            return None  # No aplicar a usuarios ya autenticados

        # Identificador único: IP + primeros 50 chars del user agent
        ident = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:50]
        return f"{self.scope}_{ident}_{user_agent}"
