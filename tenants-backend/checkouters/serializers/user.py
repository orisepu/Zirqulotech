from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django_tenants.utils import schema_context, get_public_schema_name, get_tenant_model
from progeek.models import RolPorTenant, UserGlobalRole
from tenant_users.permissions.models import UserTenantPermissions
from tenant_users.tenants.models import ExistsError
from django.db import connection

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.email
        return token


class UsuarioTenantSerializer(serializers.ModelSerializer):
    rol = serializers.CharField(write_only=True, required=False, allow_blank=True)
    tienda_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    managed_store_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    rol_lectura = serializers.SerializerMethodField(read_only=True)
    tienda_id_lectura = serializers.SerializerMethodField(read_only=True)
    managed_store_ids_lectura = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "password", "rol", "tienda_id", "managed_store_ids",
            "rol_lectura", "tienda_id_lectura", "managed_store_ids_lectura", "is_active", "uuid"
        ]

    def _resolve_tenant_slug(self):
        """
        Prioridad: context['tenant_slug'] > ?schema > Header X-Tenant > request.tenant > connection
        """
        request = self.context.get("request")
        ctx_slug = (self.context.get("tenant_slug") or "").strip().lower()
        qp_slug = ((request.query_params.get("schema") if request else None) or "").strip().lower()
        hdr_slug = ((request.headers.get("X-Tenant") if request else None) or "").strip().lower()
        req_tenant = (getattr(getattr(request, "tenant", None), "schema_name", "") if request else "").strip().lower()
        conn_slug = (connection.schema_name or "").strip().lower()
        resolved = ctx_slug or qp_slug or hdr_slug or req_tenant or conn_slug or None
        
        return resolved

    def _ensure_global_role(self, user):
        return getattr(user, "global_role", None) or UserGlobalRole.objects.create(user=user)

    def _get_role_obj(self, user, tenant_slug):
        gr = self._ensure_global_role(user)
        obj, _ = RolPorTenant.objects.get_or_create(
            user_role=gr,
            tenant_slug=tenant_slug,
            defaults={"rol": "empleado", "tienda_id": None},
        )
        return obj

    def get_rol_lectura(self, user):
            tenant_slug = self._resolve_tenant_slug()
            if not tenant_slug:
                return None
            try:
                rol = user.global_role.roles.get(tenant_slug=tenant_slug).rol
                return rol
            except (RolPorTenant.DoesNotExist, AttributeError):
                return None
            except Exception:
                # Handle case where user has no global_role
                return None
            
    def get_tienda_id_lectura(self, user):
        tenant_slug = self._resolve_tenant_slug()
        if not tenant_slug: return None
        try:
            return user.global_role.roles.get(tenant_slug=tenant_slug).tienda_id
        except (RolPorTenant.DoesNotExist, AttributeError):
            return None
        except Exception:
            return None

    def get_managed_store_ids_lectura(self, user):
        tenant_slug = self._resolve_tenant_slug()
        if not tenant_slug: return []
        try:
            return user.global_role.roles.get(tenant_slug=tenant_slug).managed_store_ids or []
        except (RolPorTenant.DoesNotExist, AttributeError):
            return []
        except Exception:
            return []

    def create(self, validated_data):
        tenant_slug = self._resolve_tenant_slug()
        if not tenant_slug:
            raise serializers.ValidationError("No se pudo resolver el tenant.")

        rol = (validated_data.pop("rol", "") or "empleado").strip()
        tienda_id = validated_data.pop("tienda_id", None)
        managed_store_ids = validated_data.pop("managed_store_ids", [])
        password = (validated_data.pop("password", "") or "").strip()

        public_schema = get_public_schema_name() if callable(get_public_schema_name) else "public"

        with schema_context(public_schema):
            user = User.objects.create(
                email=validated_data["email"],
                name=validated_data["name"],
            )
            if password:
                user.set_password(password)
            else:
                user.set_unusable_password()
            user.save()

            self._ensure_global_role(user)

        tenant_model = get_tenant_model()
        tenant = tenant_model.objects.filter(schema_name=tenant_slug).first()
        if tenant is None:
            raise serializers.ValidationError(f"Tenant '{tenant_slug}' no existe.")

        try:
            tenant.add_user(
                user,
                is_staff=(rol == "manager"),
                is_superuser=False,
            )
        except ExistsError:
            pass

        with schema_context(public_schema):
            rpt = self._get_role_obj(user, tenant_slug)
            rpt.rol = rol
            rpt.tienda_id = tienda_id
            rpt.managed_store_ids = managed_store_ids if rol == 'manager' else []
            rpt.save()

        with schema_context(tenant_slug):
            try:
                perms = UserTenantPermissions.objects.get(profile=user)
                perms.is_staff = (rol == "manager")
                perms.save(update_fields=["is_staff"])
            except UserTenantPermissions.DoesNotExist:
                UserTenantPermissions.objects.create(
                    profile=user,
                    is_staff=(rol == "manager"),
                )

        return user

    def update(self, instance, validated_data):
        tenant_slug = self._resolve_tenant_slug()
        if not tenant_slug:
            raise serializers.ValidationError("No se pudo resolver el tenant.")

        public_schema = get_public_schema_name() if callable(get_public_schema_name) else "public"

        name = validated_data.get("name", None)
        email = validated_data.get("email", None)
        password = (validated_data.get("password", "") or "").strip()
        is_active = validated_data.get("is_active", None)

        request = self.context.get("request")
        if is_active is not None and request and request.user.id == instance.id:
            raise serializers.ValidationError("No puedes cambiar tu propio estado activo.")
        
        with schema_context(public_schema):
            if name is not None: instance.name = name
            if email is not None: instance.email = email
            if password: instance.set_password(password)
            if is_active is not None: instance.is_active = bool(is_active)
            instance.save()

            touching_role = False
            rpt = self._get_role_obj(instance, tenant_slug)
            if "rol" in validated_data:
                rpt.rol = validated_data.get("rol")
                touching_role = True
            if "tienda_id" in validated_data:
                rpt.tienda_id = validated_data.get("tienda_id")
                touching_role = True
            if "managed_store_ids" in validated_data:
                # Solo actualizar si es manager
                if rpt.rol == 'manager':
                    rpt.managed_store_ids = validated_data.get("managed_store_ids", [])
                    touching_role = True
            if touching_role:
                rpt.save()

        if "rol" in validated_data:
            with schema_context(tenant_slug):
                try:
                    perms = UserTenantPermissions.objects.get(profile=instance)
                    perms.is_staff = (validated_data.get("rol") == "manager")
                    perms.save(update_fields=["is_staff"])
                except UserTenantPermissions.DoesNotExist:
                    UserTenantPermissions.objects.create(
                        profile=instance,
                        is_staff=(validated_data.get("rol") == "manager"),
                    )

        return instance
