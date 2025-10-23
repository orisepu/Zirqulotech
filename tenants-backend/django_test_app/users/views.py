from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from django_tenants.utils import schema_context
from rest_framework_simplejwt.tokens import RefreshToken
from django_test_app.companies.models import Company
from tenant_users.permissions.models import UserTenantPermissions
from checkouters.models.tienda import UserTenantExtension
from progeek.models import UserGlobalRole
from security.services import LocationSecurityService
from axes.models import AccessAttempt
from django_test_app.throttling import LoginRateThrottle, SensitiveEndpointThrottle  # SECURITY FIX (MED-01)
from django_test_app.users.models import PasswordResetToken  # SECURITY FIX (MED-03)
from django.core.mail import send_mail
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
import logging

logger = logging.getLogger(__name__)

class TenantLoginView(APIView):
    # SECURITY FIX (MED-01): Rate limiting en login - 5 intentos/minuto
    throttle_classes = [LoginRateThrottle]

    # SECURITY FIX (MED-04): Helper para contexto de seguridad en logs
    def _get_security_context(self, request, email=None, tenant=None):
        """Extrae contexto de seguridad para logging estructurado"""
        ip = request.META.get('REMOTE_ADDR', 'unknown')
        user_agent = request.META.get('HTTP_USER_AGENT', 'unknown')[:50]  # Primeros 50 chars
        tenant_name = tenant.schema_name if tenant else 'public'
        context = f"[IP:{ip}] [UA:{user_agent}] [Tenant:{tenant_name}]"
        if email:
            context = f"{context} [Email:{email}]"
        return context

    def post(self, request):
        empresa = request.data.get("empresa")
        email = request.data.get("email")
        password = request.data.get("password")

        # SECURITY FIX (CRIT-03): Validacion de campos obligatorios
        if not email or not password:
            return Response({"detail": "Faltan datos."}, status=status.HTTP_400_BAD_REQUEST)

        # SECURITY FIX (CRIT-03): Validacion de formato de email
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError
        try:
            validate_email(email)
        except ValidationError:
            # SECURITY FIX (MED-04): Logging mejorado con contexto
            ctx = self._get_security_context(request, email=email[:20] + '...')
            logger.warning(f"SECURITY_EVENT: Invalid email format {ctx}")
            return Response({"detail": "Email invalido."}, status=status.HTTP_400_BAD_REQUEST)

        # SECURITY FIX (CRIT-03): Validacion de longitud minima de contraseña (OWASP ASVS 2.1.1)
        if len(password) < 8:
            # SECURITY FIX (MED-04): Logging mejorado con contexto
            ctx = self._get_security_context(request, email=email)
            logger.warning(f"SECURITY_EVENT: Short password attempt (len:{len(password)}) {ctx}")
            return Response(
                {"detail": "La contraseña debe tener al menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ✅ Login como usuario interno si empresa == 'zirqulotech''
        if empresa and empresa.lower() == "zirqulotech":
            with schema_context("public"):
                return self.login_user_in_schema(email, password, request)

        if not empresa:
            return Response({"detail": "Falta el campo empresa."}, status=status.HTTP_400_BAD_REQUEST)

        # SECURITY FIX (CRIT-03): Validacion de formato de empresa (slug)
        # Solo permitir alphanumeric, guion y underscore para prevenir path traversal y XSS
        import re
        if not re.match(r'^[a-zA-Z0-9_-]+$', empresa):
            # SECURITY FIX (MED-04): Logging mejorado con contexto
            ctx = self._get_security_context(request, email=email)
            logger.warning(f"SECURITY_EVENT: Invalid empresa format '{empresa[:20]}...' {ctx}")
            return Response({"detail": "Empresa invalida."}, status=status.HTTP_400_BAD_REQUEST)

        # 🔍 Buscar tenant por slug
        try:
            tenant = Company.objects.get(slug=empresa)
        except Company.DoesNotExist:
            return Response({"detail": "Empresa no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        # 🏗 Login en schema del tenant
        with schema_context(tenant.schema_name):
            return self.login_user_in_schema(email, password, request, tenant)

    def login_user_in_schema(self, email, password, request, tenant=None):
        UserModel = get_user_model()

        # 🛡️ VERIFICAR BLOQUEO DE DJANGO AXES ANTES DE INTENTAR LOGIN
        from django.utils import timezone
        from datetime import timedelta
        from django.conf import settings

        failure_limit = getattr(settings, 'AXES_FAILURE_LIMIT', 5)
        ip_address = request.META.get('REMOTE_ADDR', '0.0.0.0')
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        # Buscar el registro de intentos para esta combinación específica
        cutoff_time = timezone.now() - timedelta(hours=settings.AXES_COOLOFF_TIME or 1)

        try:
            attempt = AccessAttempt.objects.get(
                username=email,
                ip_address=ip_address,
                user_agent=user_agent,
                attempt_time__gte=cutoff_time
            )

            if attempt.failures_since_start >= failure_limit:
                # SECURITY FIX (MED-04): Logging mejorado con contexto
                ctx = self._get_security_context(request, email=email, tenant=tenant)
                logger.warning(f"SECURITY_EVENT: BLOCKED by Django Axes (attempts:{attempt.failures_since_start}) {ctx}")
                return Response({
                    'detail': 'Cuenta bloqueada por demasiados intentos de inicio de sesión. '
                              'Por favor, inténtelo de nuevo más tarde.'
                }, status=status.HTTP_403_FORBIDDEN)
        except AccessAttempt.DoesNotExist:
            # No hay intentos previos, continuar normalmente
            pass

        try:
            user = UserModel.objects.get(email=email)
        except UserModel.DoesNotExist:
            # 🛡️ Registrar intento fallido en Axes
            self._log_failed_attempt(request, email)
            return Response({"detail": "Credenciales incorrectas."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            # 🛡️ Registrar intento fallido en Axes
            self._log_failed_attempt(request, email)
            return Response({"detail": "Credenciales incorrectas."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({"detail": "Usuario inactivo."}, status=status.HTTP_403_FORBIDDEN)

        # 🔐 VERIFICACIÓN DE SEGURIDAD BASADA EN UBICACIÓN (GeoLite2)
        try:
            security_service = LocationSecurityService()
            security_check = security_service.check_login_security(user, request)

            if security_check == 'BLOCK':
                # SECURITY FIX (MED-04): Logging mejorado con contexto
                ctx = self._get_security_context(request, email=user.email, tenant=tenant)
                logger.warning(f"SECURITY_EVENT: BLOCKED by impossible travel detection {ctx}")
                return Response({
                    'detail': 'Login bloqueado por razones de seguridad. '
                              'Se ha enviado un email a tu cuenta con más información.'
                }, status=status.HTTP_403_FORBIDDEN)

            elif security_check == 'REQUIRE_2FA':
                # SECURITY FIX (MED-04): Logging mejorado con contexto
                ctx = self._get_security_context(request, email=user.email, tenant=tenant)
                logger.info(f"SECURITY_EVENT: Unusual location detected, requiring 2FA {ctx}")
                return Response({
                    'detail': 'Se detectó un login desde una ubicación inusual. '
                              'Por seguridad, verifica tu email para continuar.',
                    'require_verification': True
                }, status=status.HTTP_401_UNAUTHORIZED)

            # security_check == True: Login exitoso, continuar
            # SECURITY FIX (MED-04): Logging mejorado con contexto
            ctx = self._get_security_context(request, email=user.email, tenant=tenant)
            logger.info(f"SECURITY_EVENT: Successful login {ctx}")

        except Exception as e:
            # Si hay error en la verificación de ubicación, permitir login pero registrar el error
            logger.error(f"Error in location security check for {user.email}: {e}")
            # Continuar con el login normal

        # ⛔ Validar permisos solo si estamos en un schema de tenant
        if tenant:
            try:
                _ = user.usertenantpermissions
            except UserTenantPermissions.DoesNotExist:
                return Response({"detail": "No tienes permisos en esta empresa."}, status=status.HTTP_403_FORBIDDEN)
        # Si estamos en el schema 'public', asegurarnos que sea usuario interno
        if not tenant:
            try:
                global_role = user.global_role
                if not (global_role.es_superadmin or global_role.es_empleado_interno):
                    return Response({"detail": "No tienes permisos como usuario interno."}, status=status.HTTP_403_FORBIDDEN)
            except UserGlobalRole.DoesNotExist:
                return Response({"detail": "No tienes permisos como usuario interno."}, status=status.HTTP_403_FORBIDDEN)


        # 🛡️ Solo intentar acceder a la extensión si estamos en un schema de tenant
        tienda_nombre = None
        es_manager = False
        if tenant:
            try:
                extension = user.usertenantpermissions.extension
                tienda_nombre = extension.tienda.nombre if extension.tienda else None
                es_manager = extension.es_manager
            except UserTenantExtension.DoesNotExist:
                pass

        # 💡 Schemas a los que tiene acceso este usuario
        tenant_schemas = list(user.tenants.values_list("schema_name", flat=True))

        # 🎟️ Emitir tokens
        refresh = RefreshToken.for_user(user)

        # 🛡️ LOGIN EXITOSO - Resetear contador de Axes (eliminar intentos fallidos previos)
        AccessAttempt.objects.filter(username=user.email).delete()
        # SECURITY FIX (MED-04): Logging mejorado con contexto
        ctx = self._get_security_context(request, email=user.email, tenant=tenant)
        logger.info(f"SECURITY_EVENT: Django Axes reset after successful login {ctx}")

        user_data = {
            "id": user.id,
            "email": user.email,
            "tipo_usuario": getattr(user, "tipo_usuario", None),
            "name": getattr(user, "name", ""),
        }

        # 🌍 Cargar roles globales
        try:
            global_role = user.global_role
            roles_por_tenant = {
                r.tenant_slug: {
                    "rol": r.rol,
                    "tienda_id": r.tienda_id
                }
                for r in global_role.roles.all()
            }

            user_data["global_role"] = {
                "es_superadmin": global_role.es_superadmin,
                "es_empleado_interno": global_role.es_empleado_interno,
                "roles_por_tenant": roles_por_tenant,
            }

            user_data["rol_actual"] = (
                roles_por_tenant.get(tenant.schema_name.lower()) if tenant else None
            )
        except UserGlobalRole.DoesNotExist:
            user_data["global_role"] = None
            user_data["rol_actual"] = None
        

        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "schema": tenant.schema_name if tenant else "public",
            "tenantAccess": tenant_schemas,
            "user": user_data,
        })

    def _log_failed_attempt(self, request, email):
        """Registra un intento fallido de login en Django Axes"""
        from django.utils import timezone

        # Obtener IP del request
        ip_address = request.META.get('REMOTE_ADDR', '0.0.0.0')
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        # Actualizar o crear registro de intento fallido
        attempt, created = AccessAttempt.objects.get_or_create(
            username=email,
            ip_address=ip_address,
            user_agent=user_agent,
            defaults={
                'attempt_time': timezone.now(),
                'get_data': '',
                'post_data': '',
                'http_accept': request.META.get('HTTP_ACCEPT', ''),
                'path_info': request.path,
                'failures_since_start': 1
            }
        )

        if not created:
            # Si ya existía, incrementar contador y actualizar timestamp
            attempt.failures_since_start += 1
            attempt.attempt_time = timezone.now()
            attempt.save()

        # SECURITY FIX (MED-04): Logging mejorado con contexto
        logger.warning(f"SECURITY_EVENT: Failed login attempt #{attempt.failures_since_start} [Email:{email}] [IP:{ip_address}] [UA:{user_agent[:50]}]")


# SECURITY FIX (MED-03): Password Reset Views
class PasswordResetRequestView(APIView):
    """
    Solicitud de reset de contraseña

    POST /api/password-reset/request/
    Body: { "email": "user@example.com" }

    Rate limiting: 10 intentos/minuto (protección contra enumeración de usuarios)
    """
    throttle_classes = [SensitiveEndpointThrottle]
    authentication_classes = []  # Endpoint público
    permission_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip()

        # Validación de email
        if not email:
            return Response(
                {"detail": "El campo email es requerido."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_email(email)
        except ValidationError:
            # SECURITY: No revelar si el email existe o no (prevenir enumeración)
            # Siempre retornar 200 con mensaje genérico
            return Response({
                "detail": "Si el email existe en nuestro sistema, recibirás un enlace de recuperación."
            })

        UserModel = get_user_model()

        try:
            user = UserModel.objects.get(email=email)

            # Verificar que el usuario esté activo
            if not user.is_active:
                # SECURITY: No revelar que el usuario existe pero está inactivo
                logger.warning(f"SECURITY_EVENT: Password reset attempt for inactive user [Email:{email}]")
                return Response({
                    "detail": "Si el email existe en nuestro sistema, recibirás un enlace de recuperación."
                })

            # Crear token de reset
            reset_token = PasswordResetToken.create_token(user, request)

            # Enviar email con enlace de reset
            reset_url = f"{settings.FRONTEND_BASE_URL}/reset-password/{reset_token.token}"

            try:
                send_mail(
                    subject='Recuperación de contraseña - Checkouters Partners',
                    message=f'''
Hola,

Has solicitado recuperar tu contraseña.

Para establecer una nueva contraseña, haz clic en el siguiente enlace:
{reset_url}

Este enlace es válido por {getattr(settings, 'PASSWORD_RESET_TIMEOUT_HOURS', 1)} hora(s).

Si no solicitaste este cambio, puedes ignorar este mensaje.

Saludos,
Equipo de Checkouters Partners
''',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )

                # Logging de seguridad
                ip = request.META.get('REMOTE_ADDR', 'unknown')
                logger.info(f"SECURITY_EVENT: Password reset requested [Email:{email}] [IP:{ip}] [Token:{reset_token.id}]")

            except Exception as e:
                logger.error(f"Error sending password reset email to {email}: {e}")
                return Response(
                    {"detail": "Error al enviar el email de recuperación. Intenta de nuevo más tarde."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except UserModel.DoesNotExist:
            # SECURITY: No revelar que el usuario no existe (prevenir enumeración)
            # Log para auditoría
            ip = request.META.get('REMOTE_ADDR', 'unknown')
            logger.warning(f"SECURITY_EVENT: Password reset attempt for non-existent user [Email:{email}] [IP:{ip}]")

        # Siempre retornar respuesta genérica (prevenir enumeración de usuarios)
        return Response({
            "detail": "Si el email existe en nuestro sistema, recibirás un enlace de recuperación."
        })


class PasswordResetConfirmView(APIView):
    """
    Confirmación de reset de contraseña con token

    POST /api/password-reset/confirm/
    Body: {
        "token": "abc123...",
        "new_password": "NewSecurePassword123!"
    }

    Rate limiting: 10 intentos/minuto
    """
    throttle_classes = [SensitiveEndpointThrottle]
    authentication_classes = []  # Endpoint público
    permission_classes = []

    def post(self, request):
        token_str = request.data.get('token', '').strip()
        new_password = request.data.get('new_password', '')

        # Validaciones
        if not token_str or not new_password:
            return Response(
                {"detail": "Token y nueva contraseña son requeridos."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validar longitud mínima de contraseña (OWASP ASVS 2.1.1)
        if len(new_password) < 8:
            return Response(
                {"detail": "La contraseña debe tener al menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Buscar token
            reset_token = PasswordResetToken.objects.select_related('user').get(token=token_str)

            # Verificar validez del token
            if not reset_token.is_valid():
                if reset_token.is_used:
                    error_detail = "Este enlace ya ha sido utilizado."
                else:
                    error_detail = "Este enlace ha expirado. Solicita uno nuevo."

                logger.warning(f"SECURITY_EVENT: Invalid password reset token used [Token:{reset_token.id}] [Reason:{error_detail}]")
                return Response(
                    {"detail": error_detail},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Cambiar contraseña
            user = reset_token.user
            user.set_password(new_password)
            user.save(update_fields=['password'])

            # Marcar token como usado
            reset_token.mark_as_used()

            # Logging de seguridad
            ip = request.META.get('REMOTE_ADDR', 'unknown')
            logger.info(f"SECURITY_EVENT: Password reset successful [Email:{user.email}] [IP:{ip}] [Token:{reset_token.id}]")

            return Response({
                "detail": "Contraseña actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña."
            })

        except PasswordResetToken.DoesNotExist:
            # SECURITY: No revelar detalles sobre tokens inválidos
            logger.warning(f"SECURITY_EVENT: Password reset with non-existent token [Token:{token_str[:16]}...]")
            return Response(
                {"detail": "El enlace de recuperación es inválido o ha expirado."},
                status=status.HTTP_400_BAD_REQUEST
            )
