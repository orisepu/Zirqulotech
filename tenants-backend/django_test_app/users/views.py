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
import logging

logger = logging.getLogger(__name__)

class TenantLoginView(APIView):
    def post(self, request):
        empresa = request.data.get("empresa")
        email = request.data.get("email")
        password = request.data.get("password")

        if not email or not password:
            return Response({"detail": "Faltan datos."}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ Login como usuario interno si empresa == 'zirqulotech''
        if empresa and empresa.lower() == "zirqulotech":
            with schema_context("public"):
                return self.login_user_in_schema(email, password, request)

        if not empresa:
            return Response({"detail": "Falta el campo empresa."}, status=status.HTTP_400_BAD_REQUEST)

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
        try:
            user = UserModel.objects.get(email=email)
        except UserModel.DoesNotExist:
            return Response({"detail": "Credenciales incorrectas."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({"detail": "Credenciales incorrectas."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({"detail": "Usuario inactivo."}, status=status.HTTP_403_FORBIDDEN)

        # 🔐 VERIFICACIÓN DE SEGURIDAD BASADA EN UBICACIÓN (GeoLite2)
        try:
            security_service = LocationSecurityService()
            security_check = security_service.check_login_security(user, request)

            if security_check == 'BLOCK':
                logger.warning(f"Login BLOCKED for {user.email} due to impossible travel")
                return Response({
                    'detail': 'Login bloqueado por razones de seguridad. '
                              'Se ha enviado un email a tu cuenta con más información.'
                }, status=status.HTTP_403_FORBIDDEN)

            elif security_check == 'REQUIRE_2FA':
                logger.info(f"Login from unusual location for {user.email}, requiring additional verification")
                return Response({
                    'detail': 'Se detectó un login desde una ubicación inusual. '
                              'Por seguridad, verifica tu email para continuar.',
                    'require_verification': True
                }, status=status.HTTP_401_UNAUTHORIZED)

            # security_check == True: Login exitoso, continuar
            logger.info(f"Successful login for {user.email}")

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
