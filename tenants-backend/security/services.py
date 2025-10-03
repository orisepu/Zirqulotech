import geoip2.database
import geoip2.errors
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from datetime import datetime, timedelta
import json
from math import radians, sin, cos, sqrt, atan2
import logging

from .models import LoginHistory

logger = logging.getLogger(__name__)


class LocationSecurityService:
    """
    Servicio para detectar logins sospechosos basados en geolocalización.

    Funcionalidades:
    - Obtener ubicación de una IP usando GeoLite2
    - Detectar logins desde países diferentes
    - Detectar viajes físicamente imposibles
    - Enviar alertas por email
    - Mantener historial de logins
    """

    # Umbrales configurables
    ALERT_THRESHOLD_KM = getattr(settings, 'LOCATION_ALERT_THRESHOLD_KM', 500)
    ALERT_THRESHOLD_HOURS = getattr(settings, 'LOCATION_ALERT_THRESHOLD_HOURS', 4)
    GEOIP_PATH = getattr(settings, 'GEOIP_PATH', '/usr/share/GeoIP')
    ENABLED = getattr(settings, 'LOCATION_SECURITY_ENABLED', True)

    def __init__(self):
        """Inicializa el lector de GeoIP2"""
        if not self.ENABLED:
            logger.info("Location security is disabled")
            return

        try:
            geoip_db_path = f"{self.GEOIP_PATH}/GeoLite2-City.mmdb"
            self.reader = geoip2.database.Reader(geoip_db_path)
            logger.info(f"GeoIP2 database loaded from {geoip_db_path}")
        except FileNotFoundError:
            logger.error(f"GeoIP2 database not found at {geoip_db_path}")
            self.reader = None
        except Exception as e:
            logger.error(f"Error loading GeoIP2 database: {e}")
            self.reader = None

    def get_location(self, ip):
        """
        Obtiene la ubicación geográfica de una IP.

        Args:
            ip (str): Dirección IP

        Returns:
            dict: Diccionario con country, city, latitude, longitude, ip
                  None si no se puede obtener la ubicación
        """
        if not self.ENABLED or not self.reader:
            return None

        try:
            response = self.reader.city(ip)
            return {
                'country': response.country.name or 'Unknown',
                'city': response.city.name or None,
                'latitude': response.location.latitude,
                'longitude': response.location.longitude,
                'ip': ip
            }
        except geoip2.errors.AddressNotFoundError:
            logger.warning(f"IP {ip} not found in GeoIP database (possibly private IP)")
            return None
        except Exception as e:
            logger.error(f"Error getting location for IP {ip}: {e}")
            return None

    def check_login_security(self, user, request):
        """
        Verifica la seguridad del login basándose en la ubicación.

        Args:
            user: Usuario que intenta hacer login
            request: HttpRequest object

        Returns:
            - True: Login permitido
            - 'REQUIRE_2FA': Requiere verificación adicional
            - 'BLOCK': Login bloqueado
        """
        if not self.ENABLED:
            return True

        current_ip = self.get_client_ip(request)
        current_location = self.get_location(current_ip)

        # Si no hay geolocalización (localhost, VPN, Tor), usar valores por defecto
        if not current_location:
            logger.info(f"Cannot geolocate IP {current_ip} for user {user.email} (localhost/VPN/private IP)")
            current_location = {
                'country': 'Unknown',
                'city': None,
                'latitude': None,
                'longitude': None,
                'ip': current_ip
            }

        # Obtener último login conocido del usuario
        last_login = self._get_last_login(user)

        if not last_login:
            # Primer login o no hay historial, guardar y permitir
            self.save_login(user, current_ip, current_location, request)
            return True

        # Verificar si podemos comparar ubicaciones de forma confiable
        # Solo comparar si AMBOS tienen country válido (no None, no 'Unknown')
        current_has_location = (current_location.get('country') and
                               current_location['country'] != 'Unknown')
        last_has_location = (last_login.get('country') and
                            last_login.get('country') != 'Unknown')

        if not current_has_location or not last_has_location:
            # No podemos verificar ubicación de forma confiable
            logger.info(
                f"Skipping location check for {user.email}: "
                f"current={current_location.get('country')}, last={last_login.get('country')} "
                f"(one or both IPs not geolocatable)"
            )
            self.save_login(user, current_ip, current_location, request)
            return True

        # Aquí ya sabemos que AMBOS tienen ubicación válida
        # Verificar si es país diferente
        if current_location['country'] != last_login.get('country'):
            logger.warning(
                f"User {user.email} login from different country: "
                f"{last_login.get('country')} → {current_location['country']}"
            )
            self.alert_different_country(user, current_location, last_login)
            self.save_login(
                user, current_ip, current_location, request,
                was_blocked=False, block_reason='DIFFERENT_COUNTRY', alert_sent=True
            )
            return 'REQUIRE_2FA'

        # Verificar viaje imposible (solo si AMBOS tienen lat/lon)
        if (last_login.get('latitude') and last_login.get('longitude') and
            current_location.get('latitude') and current_location.get('longitude')):

            distance_km = self.calculate_distance(
                last_login['latitude'], last_login['longitude'],
                current_location['latitude'], current_location['longitude']
            )

            time_diff = datetime.now() - datetime.fromisoformat(last_login['timestamp'])
            hours_diff = time_diff.total_seconds() / 3600

            if distance_km > self.ALERT_THRESHOLD_KM and hours_diff < self.ALERT_THRESHOLD_HOURS:
                logger.error(
                    f"IMPOSSIBLE TRAVEL detected for {user.email}: "
                    f"{distance_km:.0f} km in {hours_diff:.1f} hours"
                )
                self.alert_impossible_travel(user, current_location, last_login, distance_km, hours_diff)
                self.save_login(
                    user, current_ip, current_location, request,
                    was_blocked=True, block_reason='IMPOSSIBLE_TRAVEL', alert_sent=True
                )
                return 'BLOCK'

        # Login parece legítimo
        self.save_login(user, current_ip, current_location, request)
        return True

    def _get_last_login(self, user):
        """Obtiene el último login del usuario desde caché o DB"""
        cache_key = f'last_login:{user.id}'
        cached_data = cache.get(cache_key)

        if cached_data:
            return json.loads(cached_data)

        # Buscar en base de datos
        last_login_obj = LoginHistory.objects.filter(
            user=user,
            was_blocked=False
        ).first()

        if last_login_obj:
            return {
                'country': last_login_obj.country,
                'city': last_login_obj.city,
                'latitude': float(last_login_obj.latitude) if last_login_obj.latitude else None,
                'longitude': float(last_login_obj.longitude) if last_login_obj.longitude else None,
                'timestamp': last_login_obj.timestamp.isoformat(),
                'ip': last_login_obj.ip
            }

        return None

    def save_login(self, user, ip, location, request, was_blocked=False, block_reason=None, alert_sent=False):
        """
        Guarda el historial de login en caché y base de datos.

        Args:
            user: Usuario
            ip: IP de origen
            location: Diccionario con ubicación
            request: HttpRequest object
            was_blocked: Si el login fue bloqueado
            block_reason: Razón del bloqueo
            alert_sent: Si se envió alerta
        """
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        # Guardar en base de datos
        LoginHistory.objects.create(
            user=user,
            ip=ip,
            country=location.get('country'),
            city=location.get('city'),
            latitude=location.get('latitude'),
            longitude=location.get('longitude'),
            was_blocked=was_blocked,
            block_reason=block_reason,
            alert_sent=alert_sent,
            user_agent=user_agent
        )

        # Solo guardar en caché si no fue bloqueado
        if not was_blocked:
            login_data = {
                **location,
                'timestamp': datetime.now().isoformat()
            }
            cache.set(f'last_login:{user.id}', json.dumps(login_data), timeout=86400 * 30)  # 30 días

        logger.info(
            f"Login saved for {user.email} from {location.get('city', 'Unknown')}, "
            f"{location.get('country', 'Unknown')} (blocked: {was_blocked})"
        )

    def alert_different_country(self, user, current, last):
        """Envía alerta de login desde país diferente"""
        try:
            context = {
                'user_name': user.name or user.email,
                'current_city': current.get('city', 'Desconocida'),
                'current_country': current.get('country', 'Desconocido'),
                'current_ip': current['ip'],
                'current_time': datetime.now().strftime('%d/%m/%Y %H:%M'),
                'last_city': last.get('city', 'Desconocida'),
                'last_country': last.get('country', 'Desconocido')
            }

            html_message = render_to_string('security/alert_different_country.html', context)
            plain_message = strip_tags(html_message)

            send_mail(
                subject='⚠️ Login desde ubicación inusual - Zirqulo Partners',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False
            )

            logger.info(f"Different country alert sent to {user.email}")

        except Exception as e:
            logger.error(f"Error sending different country alert: {e}")

    def alert_impossible_travel(self, user, current, last, distance, hours):
        """Bloquea y alerta de viaje imposible"""
        try:
            context = {
                'user_name': user.name or user.email,
                'current_city': current.get('city', 'Desconocida'),
                'current_country': current.get('country', 'Desconocido'),
                'current_ip': current['ip'],
                'distance_km': f"{distance:.0f}",
                'hours': f"{hours:.1f}",
                'last_city': last.get('city', 'Desconocida'),
                'last_country': last.get('country', 'Desconocido')
            }

            html_message = render_to_string('security/alert_impossible_travel.html', context)
            plain_message = strip_tags(html_message)

            send_mail(
                subject='🚨 ALERTA DE SEGURIDAD - Acceso bloqueado - Zirqulo Partners',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False
            )

            logger.warning(f"Impossible travel alert sent to {user.email}")

        except Exception as e:
            logger.error(f"Error sending impossible travel alert: {e}")

    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """
        Calcula la distancia en kilómetros entre dos puntos usando la fórmula de Haversine.

        Args:
            lat1, lon1: Latitud y longitud del primer punto
            lat2, lon2: Latitud y longitud del segundo punto

        Returns:
            float: Distancia en kilómetros
        """
        R = 6371  # Radio de la Tierra en km

        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))

        return R * c

    def get_client_ip(self, request):
        """
        Obtiene la IP real del cliente, considerando proxies y load balancers.

        Args:
            request: HttpRequest object

        Returns:
            str: Dirección IP del cliente
        """
        # Intentar obtener IP de headers de proxy
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            # Tomar la primera IP (cliente original)
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')

        return ip

    def __del__(self):
        """Cierra el lector de GeoIP2"""
        if hasattr(self, 'reader') and self.reader:
            self.reader.close()
