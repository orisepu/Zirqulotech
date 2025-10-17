"""
AUTHENTICATION TESTS (Backend)

These tests cover the authentication system including:
- Login with valid/invalid credentials
- Multi-tenant login (schema resolution)
- Django Axes brute force protection
- Location-based security checks
- Token generation and management
- Special cases (zirqulotech → public schema)
"""

import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django_tenants.utils import get_tenant_model, schema_context
from django_test_app.companies.models import Company
from progeek.models import UserGlobalRole
from tenant_users.permissions.models import UserTenantPermissions
from axes.models import AccessAttempt
from unittest.mock import patch, MagicMock

User = get_user_model()
TenantModel = get_tenant_model()


@pytest.fixture
def api_client():
    """Create an API client for testing"""
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def test_company():
    """Create a test company/tenant"""
    with schema_context("public"):
        # Create an owner user first
        owner = User.objects.create_user(
            email="owner@test.com",
            password="ownerpass",
            name="Test Owner",
            is_active=True
        )

        company = Company.objects.create(
            schema_name="test_tenant",
            slug="test-company",
            name="Test Company",
            type="type1",
            owner=owner
        )
        return company


@pytest.fixture
@pytest.mark.django_db
def test_user_in_tenant(test_company):
    """Create a test user with permissions in a tenant"""
    # Users must be created in public schema
    with schema_context("public"):
        user = User.objects.create_user(
            email="user@test.com",
            password="password123",
            name="Test User",
            is_active=True
        )

    # Add user to tenant (this creates UserTenantPermissions)
    with schema_context(test_company.schema_name):
        # Get the TenantUser instance in this schema
        tenant_user = User.objects.get(email="user@test.com")

        # Create UserTenantPermissions pointing to the TenantUser
        UserTenantPermissions.objects.create(
            profile=tenant_user,
            is_staff=False,
            is_superuser=False
        )

        # Link user to tenant
        tenant_user.tenants.add(test_company)

    return user


@pytest.fixture
@pytest.mark.django_db
def internal_user():
    """Create an internal user (for 'zirqulotech' login)"""
    with schema_context("public"):
        user = User.objects.create_user(
            email="admin@zirqulotech.com",
            password="adminpass123",
            name="Internal Admin",
            is_active=True
        )

        # Create global role
        UserGlobalRole.objects.create(
            user=user,
            es_superadmin=True,
            es_empleado_interno=True
        )

        return user


@pytest.mark.django_db
class TestLoginEndpoint:
    """Test cases for /api/login/ endpoint"""

    def test_successful_login_in_tenant(self, api_client, test_company, test_user_in_tenant):
        """Should login successfully with valid credentials in tenant"""
        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data
        assert "schema" in response.data
        assert "user" in response.data
        assert "tenantAccess" in response.data
        assert response.data["schema"] == test_company.schema_name

    def test_login_with_nonexistent_tenant(self, api_client):
        """Should return 404 when tenant does not exist"""
        data = {
            "empresa": "progeek",  # Tenant that doesn't exist
            "email": "user@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Empresa no encontrada" in response.data["detail"]

    def test_login_with_invalid_credentials(self, api_client, test_company, test_user_in_tenant):
        """Should return 401 with incorrect password"""
        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "wrongpassword"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Credenciales incorrectas" in response.data["detail"]

    def test_login_with_nonexistent_user(self, api_client, test_company):
        """Should return 401 when user does not exist"""
        data = {
            "empresa": test_company.slug,
            "email": "nonexistent@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Credenciales incorrectas" in response.data["detail"]

    def test_login_with_inactive_user(self, api_client, test_company):
        """Should return 403 when user is inactive"""
        # Create user in public schema
        with schema_context("public"):
            inactive_user = User.objects.create_user(
                email="inactive@test.com",
                password="password123",
                is_active=False
            )

        # Create permissions in tenant schema
        with schema_context(test_company.schema_name):
            tenant_user = User.objects.get(email="inactive@test.com")
            UserTenantPermissions.objects.create(
                profile=tenant_user,
                is_staff=False,
                is_superuser=False
            )
            tenant_user.tenants.add(test_company)

        data = {
            "empresa": test_company.slug,
            "email": "inactive@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "inactivo" in response.data["detail"]

    def test_login_without_tenant_permissions(self, api_client, test_company):
        """Should return 403 when user has no permissions in tenant"""
        # Create user in public schema but don't give tenant permissions
        with schema_context("public"):
            user_without_perms = User.objects.create_user(
                email="noperms@test.com",
                password="password123",
                is_active=True
            )
        # Don't create UserTenantPermissions

        data = {
            "empresa": test_company.slug,
            "email": "noperms@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "permisos" in response.data["detail"]

    def test_login_with_missing_fields(self, api_client):
        """Should return 400 when required fields are missing"""
        # Missing password
        response = api_client.post("/api/login/", {
            "empresa": "test",
            "email": "user@test.com"
        }, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Faltan datos" in response.data["detail"]

        # Missing email
        response = api_client.post("/api/login/", {
            "empresa": "test",
            "password": "pass123"
        }, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_without_empresa(self, api_client):
        """Should return 400 when empresa field is missing"""
        response = api_client.post("/api/login/", {
            "email": "user@test.com",
            "password": "password123"
        }, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "empresa" in response.data["detail"]


@pytest.mark.django_db
class TestZirqulotechSpecialCase:
    """Test cases for 'zirqulotech' login to public schema"""

    def test_zirqulotech_login_to_public_schema(self, api_client, internal_user):
        """Should login to public schema when empresa='zirqulotech'"""
        data = {
            "empresa": "zirqulotech",
            "email": "admin@zirqulotech.com",
            "password": "adminpass123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["schema"] == "public"
        assert response.data["user"]["global_role"]["es_empleado_interno"] is True

    def test_zirqulotech_case_insensitive(self, api_client, internal_user):
        """Should work with different capitalizations of 'zirqulotech'"""
        for empresa_value in ["ZirquloTech", "ZIRQULOTECH", "zirqulotech"]:
            data = {
                "empresa": empresa_value,
                "email": "admin@zirqulotech.com",
                "password": "adminpass123"
            }

            response = api_client.post("/api/login/", data, format="json")

            assert response.status_code == status.HTTP_200_OK
            assert response.data["schema"] == "public"

    def test_zirqulotech_requires_internal_role(self, api_client):
        """Should return 403 if user doesn't have internal role"""
        with schema_context("public"):
            regular_user = User.objects.create_user(
                email="regular@zirqulotech.com",
                password="password123",
                is_active=True
            )
            # Don't create UserGlobalRole

        data = {
            "empresa": "zirqulotech",
            "email": "regular@zirqulotech.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "usuario interno" in response.data["detail"]


@pytest.mark.django_db
class TestDjangoAxesBruteForceProtection:
    """Test cases for Django Axes brute force protection"""

    def setup_method(self):
        """Clear AccessAttempt records before each test"""
        AccessAttempt.objects.all().delete()

    def test_axes_blocks_after_multiple_failed_attempts(self, api_client, test_company, test_user_in_tenant):
        """Should block login after 5 failed attempts (blocks on 6th attempt)"""
        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "wrongpassword"
        }

        # Make 6 attempts - first 5 fail with 401, 6th is blocked with 403
        # This is because the check happens BEFORE incrementing the counter:
        # Attempt 1-5: counter is 0-4, check passes, password fails, counter becomes 1-5
        # Attempt 6: counter is 5, check 5>=5 passes, blocked with 403
        for i in range(6):
            response = api_client.post("/api/login/", data, format="json")
            if i < 5:
                assert response.status_code == status.HTTP_401_UNAUTHORIZED
            else:
                # 6th attempt should be blocked (after 5 failures recorded)
                assert response.status_code == status.HTTP_403_FORBIDDEN
                assert "bloqueada" in response.data["detail"]

    def test_axes_resets_counter_after_successful_login(self, api_client, test_company, test_user_in_tenant):
        """Should reset Axes counter after successful login"""
        # Make 3 failed attempts
        for _ in range(3):
            response = api_client.post("/api/login/", {
                "empresa": test_company.slug,
                "email": "user@test.com",
                "password": "wrongpassword"
            }, format="json")
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Successful login
        response = api_client.post("/api/login/", {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }, format="json")

        assert response.status_code == status.HTTP_200_OK

        # Verify counter was reset
        attempts = AccessAttempt.objects.filter(username="user@test.com")
        assert attempts.count() == 0

    def test_axes_tracks_by_ip_and_user_agent(self, api_client, test_company, test_user_in_tenant):
        """Should track attempts by IP + email + user agent"""
        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "wrongpassword"
        }

        # Make 3 attempts from "first IP"
        for _ in range(3):
            api_client.post("/api/login/", data, format="json", REMOTE_ADDR="192.168.1.1")

        # Different IP should have separate counter
        response = api_client.post("/api/login/", data, format="json", REMOTE_ADDR="192.168.1.2")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED  # Not blocked yet


@pytest.mark.django_db
class TestLocationBasedSecurity:
    """Test cases for location-based security (GeoLite2)"""

    @patch('security.services.LocationSecurityService.check_login_security')
    def test_location_security_blocks_suspicious_login(self, mock_security_check, api_client, test_company, test_user_in_tenant):
        """Should block login when location security detects threat"""
        mock_security_check.return_value = 'BLOCK'

        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "seguridad" in response.data["detail"]

    @patch('security.services.LocationSecurityService.check_login_security')
    def test_location_security_requires_2fa(self, mock_security_check, api_client, test_company, test_user_in_tenant):
        """Should require 2FA when login from unusual location"""
        mock_security_check.return_value = 'REQUIRE_2FA'

        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "ubicación inusual" in response.data["detail"]
        assert response.data.get("require_verification") is True

    @patch('security.services.LocationSecurityService.check_login_security')
    def test_location_security_allows_normal_login(self, mock_security_check, api_client, test_company, test_user_in_tenant):
        """Should allow login when location security passes"""
        mock_security_check.return_value = True

        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_200_OK

    @patch('security.services.LocationSecurityService.check_login_security')
    def test_location_security_error_allows_fallback(self, mock_security_check, api_client, test_company, test_user_in_tenant):
        """Should allow login if location security check fails"""
        mock_security_check.side_effect = Exception("GeoIP database error")

        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        # Should still allow login despite security check error
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTokenGeneration:
    """Test cases for JWT token generation"""

    def test_tokens_are_different(self, api_client, test_company, test_user_in_tenant):
        """Should generate different access and refresh tokens"""
        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["access"] != response.data["refresh"]
        assert len(response.data["access"]) > 50  # JWT tokens are long
        assert len(response.data["refresh"]) > 50

    def test_tenant_access_list(self, api_client, test_user_in_tenant):
        """Should return list of tenants user has access to"""
        # Create multiple tenants
        with schema_context("public"):
            owner_a = User.objects.create_user(
                email="owner_a@test.com",
                password="ownerpass",
                is_active=True
            )
            owner_b = User.objects.create_user(
                email="owner_b@test.com",
                password="ownerpass",
                is_active=True
            )

            company_a = Company.objects.create(
                schema_name="tenant_a",
                slug="tenant-a",
                name="Company A",
                owner=owner_a
            )
            company_b = Company.objects.create(
                schema_name="tenant_b",
                slug="tenant-b",
                name="Company B",
                owner=owner_b
            )

        # Create user in public schema
        with schema_context("public"):
            multi_user = User.objects.create_user(
                email="multiuser@test.com",
                password="password123",
                is_active=True
            )

        # Give user access to multiple tenants
        with schema_context("tenant_a"):
            tenant_user_a = User.objects.get(email="multiuser@test.com")
            UserTenantPermissions.objects.create(
                profile=tenant_user_a,
                is_staff=False,
                is_superuser=False
            )
            tenant_user_a.tenants.add(company_a)

        with schema_context("tenant_b"):
            tenant_user_b = User.objects.get(email="multiuser@test.com")
            UserTenantPermissions.objects.create(
                profile=tenant_user_b,
                is_staff=False,
                is_superuser=False
            )
            tenant_user_b.tenants.add(company_b)

        data = {
            "empresa": "tenant-a",
            "email": "multiuser@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert "tenantAccess" in response.data
        assert isinstance(response.data["tenantAccess"], list)

    def test_user_data_structure(self, api_client, test_company, test_user_in_tenant):
        """Should return user object with correct structure"""
        data = {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }

        response = api_client.post("/api/login/", data, format="json")

        assert response.status_code == status.HTTP_200_OK
        user_data = response.data["user"]

        assert "id" in user_data
        assert "email" in user_data
        assert "name" in user_data
        assert user_data["email"] == "user@test.com"


@pytest.mark.django_db
class TestTokenRefresh:
    """Test cases for token refresh endpoint"""

    def test_refresh_token_returns_new_access(self, api_client, test_company, test_user_in_tenant):
        """Should return new access token with valid refresh token"""
        # First login to get tokens
        login_response = api_client.post("/api/login/", {
            "empresa": test_company.slug,
            "email": "user@test.com",
            "password": "password123"
        }, format="json")

        refresh_token = login_response.data["refresh"]

        # Use refresh token to get new access token
        refresh_response = api_client.post("/api/token/refresh/", {
            "refresh": refresh_token
        }, format="json")

        assert refresh_response.status_code == status.HTTP_200_OK
        assert "access" in refresh_response.data
        assert refresh_response.data["access"] != login_response.data["access"]

    def test_refresh_with_invalid_token(self, api_client):
        """Should return 401 with invalid refresh token"""
        response = api_client.post("/api/token/refresh/", {
            "refresh": "invalid-token-string"
        }, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
