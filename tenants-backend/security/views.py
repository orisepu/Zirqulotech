from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.views import TokenObtainPairView
import logging

from .services import LocationSecurityService

logger = logging.getLogger(__name__)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vista de login personalizada con verificación de ubicación.

    Extiende la vista estándar de JWT para añadir:
    - Verificación de ubicación geográfica
    - Detección de logins sospechosos
    - Alertas de seguridad automáticas
    - Bloqueo de viajes imposibles
    """

    def post(self, request, *args, **kwargs):
        """
        Procesa el login con verificación de seguridad adicional.

        Flow:
        1. Intenta autenticar con JWT (usuario/contraseña)
        2. Si autenticación exitosa, verifica ubicación
        3. Retorna token si todo OK, o error si bloqueado/sospechoso
        """
        # Primero intentar login normal
        response = super().post(request, *args, **kwargs)

        # Si el login fue exitoso (status 200), verificar ubicación
        if response.status_code == status.HTTP_200_OK:
            try:
                # Obtener usuario autenticado
                # El serializer ya validó las credenciales
                from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid()
                user = serializer.user

                # Verificar ubicación
                security_service = LocationSecurityService()
                security_check = security_service.check_login_security(user, request)

                if security_check == 'BLOCK':
                    logger.warning(
                        f"Login BLOCKED for {user.email} due to impossible travel"
                    )
                    return Response(
                        {
                            'detail': 'Login bloqueado por razones de seguridad. '
                                      'Se ha enviado un email a tu cuenta con más información.'
                        },
                        status=status.HTTP_403_FORBIDDEN
                    )

                elif security_check == 'REQUIRE_2FA':
                    logger.info(
                        f"Login from unusual location for {user.email}, requiring additional verification"
                    )
                    return Response(
                        {
                            'detail': 'Se detectó un login desde una ubicación inusual. '
                                      'Por seguridad, verifica tu email para continuar.',
                            'require_verification': True
                        },
                        status=status.HTTP_401_UNAUTHORIZED
                    )

                # Login exitoso y ubicación verificada
                logger.info(f"Successful login for {user.email}")

            except Exception as e:
                # Si hay error en la verificación de ubicación, permitir login
                # pero registrar el error
                logger.error(f"Error in location security check: {e}")
                # Continuar con el response exitoso original

        return response
