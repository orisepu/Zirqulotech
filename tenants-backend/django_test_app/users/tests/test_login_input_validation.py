"""
SECURITY TESTS: Backend Input Validation (CRIT-03)

Tests para verificar que el backend valida inputs independientemente del frontend:
- CWE-20: Improper Input Validation
- OWASP A03:2021: Injection
- Principle: Never Trust the Client

Vulnerabilidad original: views.py solo valida existencia (truthy), no formato.

Backend DEBE validar:
1. Formato de email (RFC 5322 simplified)
2. Longitud minima de contraseña (8 caracteres)
3. Caracteres peligrosos en empresa (slug validation)
4. XSS/SQLi payloads rechazados
"""

import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django_tenants.utils import schema_context
from django_test_app.companies.models import Company
from tenant_users.permissions.models import UserTenantPermissions

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
@pytest.mark.django_db
def test_company():
    """Create a test company/tenant"""
    with schema_context("public"):
        owner = User.objects.create_user(
            email="owner@test.com",
            password="ownerpass123",
            name="Test Owner",
            is_active=True
        )

        company = Company.objects.create(
            schema_name="test_validation",
            slug="test-company",
            name="Test Company Validation",
            type="type1",
            owner=owner
        )
        return company


@pytest.fixture
@pytest.mark.django_db
def test_user(test_company):
    """Create a test user with permissions"""
    with schema_context("public"):
        user = User.objects.create_user(
            email="user@test.com",
            password="password12345678",  # 16 caracteres
            name="Test User",
            is_active=True
        )

    with schema_context(test_company.schema_name):
        tenant_user = User.objects.get(email="user@test.com")
        UserTenantPermissions.objects.create(
            profile=tenant_user,
            is_staff=False,
            is_superuser=False
        )
        tenant_user.tenants.add(test_company)

    return user


@pytest.mark.django_db
class TestBackendEmailValidation:
    """Test backend validates email format (CRIT-03)"""

    def test_rejects_xss_payloads_in_email(self, api_client, test_company):
        """Should reject emails with XSS payloads"""
        xss_payloads = [
            "<script>alert(1)</script>@x.x",
            'user<img src=x>@domain.com',
            'admin"><script>@x.x',
        ]

        for payload in xss_payloads:
            response = api_client.post("/api/login/", {
                "empresa": test_company.slug,
                "email": payload,
                "password": "password12345678"
            }, format="json")

            assert response.status_code == status.HTTP_400_BAD_REQUEST, \
                f"XSS payload '{payload}' fue aceptado (SECURITY ISSUE)"
            assert "Email invalido" in response.data.get("detail", "").lower() or \
                   "email" in response.data.get("detail", "").lower(), \
                f"Error message no menciona email: {response.data}"

    def test_rejects_sql_injection_in_email(self, api_client, test_company):
        """Should reject emails with SQL injection attempts"""
        sql_payloads = [
            "admin'--@x.x",
            "user' OR '1'='1@domain.com",
            "'; DROP TABLE users--@x.x",
        ]

        for payload in sql_payloads:
            response = api_client.post("/api/login/", {
                "empresa": test_company.slug,
                "email": payload,
                "password": "password12345678"
            }, format="json")

            assert response.status_code == status.HTTP_400_BAD_REQUEST, \
                f"SQL injection payload '{payload}' fue aceptado (SECURITY ISSUE)"

    def test_rejects_malformed_emails(self, api_client, test_company):
        """Should reject obviously malformed emails"""
        invalid_emails = [
            "not-an-email",
            "@nodomain.com",
            "missing@domain",
            "user@@domain.com",
            "",  # Empty string
        ]

        for email in invalid_emails:
            response = api_client.post("/api/login/", {
                "empresa": test_company.slug,
                "email": email,
                "password": "password12345678"
            }, format="json")

            # Empty string debe dar "Faltan datos"
            if email == "":
                assert response.status_code == status.HTTP_400_BAD_REQUEST
            else:
                assert response.status_code == status.HTTP_400_BAD_REQUEST, \
                    f"Email invalido '{email}' fue aceptado"

    def test_accepts_valid_emails(self, api_client, test_company, test_user):
        """Should accept valid emails (even if credentials are wrong)"""
        valid_emails = [
            "user@example.com",
            "admin@test.co.uk",
            "first.last@domain.com",
        ]

        for email in valid_emails:
            response = api_client.post("/api/login/", {
                "empresa": test_company.slug,
                "email": email,
                "password": "password12345678"
            }, format="json")

            # Debe fallar por credenciales incorrectas (401),
            # NO por validacion de email (400)
            assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_404_NOT_FOUND], \
                f"Email valido '{email}' fue rechazado por validacion"


@pytest.mark.django_db
class TestBackendPasswordValidation:
    """Test backend validates password length (CRIT-03)"""

    def test_rejects_short_passwords(self, api_client, test_company, test_user):
        """Should reject passwords shorter than 8 characters"""
        short_passwords = [
            "",        # 0 caracteres
            "1",       # 1 caracter
            "1234",    # 4 caracteres
            "1234567"  # 7 caracteres
        ]

        for password in short_passwords:
            response = api_client.post("/api/login/", {
                "empresa": test_company.slug,
                "email": "user@test.com",
                "password": password
            }, format="json")

            # Empty password debe dar "Faltan datos"
            if password == "":
                assert response.status_code == status.HTTP_400_BAD_REQUEST
                assert "Faltan datos" in response.data["detail"]
            else:
                assert response.status_code == status.HTTP_400_BAD_REQUEST, \
                    f"Password de {len(password)} caracteres fue aceptado"
                assert "8 caracteres" in response.data.get("detail", "").lower() or \
                       "contraseña" in response.data.get("detail", "").lower(), \
                    f"Error message no menciona longitud: {response.data}"

    def test_accepts_valid_length_passwords(self, api_client, test_company, test_user):
        """Should accept passwords with 8+ characters (even if wrong)"""
        valid_passwords = [
            "12345678",    # Exactamente 8
            "password123",  # 11 caracteres
            "P@ssw0rd!23456789",  # 18 caracteres
        ]

        for password in valid_passwords:
            response = api_client.post("/api/login/", {
                "empresa": test_company.slug,
                "email": "user@test.com",
                "password": password
            }, format="json")

            # Debe fallar por credenciales incorrectas (401),
            # NO por validacion de longitud (400)
            assert response.status_code == status.HTTP_401_UNAUTHORIZED, \
                f"Password valido de {len(password)} caracteres rechazado por validacion"


@pytest.mark.django_db
class TestBackendEmpresaValidation:
    """Test backend validates empresa (slug) format (CRIT-03)"""

    def test_rejects_empresa_with_dangerous_characters(self, api_client):
        """Should reject empresa slugs with XSS/SQLi characters"""
        dangerous_slugs = [
            "<script>alert(1)</script>",
            "empresa'; DROP TABLE--",
            "../../../etc/passwd",
            "empresa<img src=x>",
        ]

        for slug in dangerous_slugs:
            response = api_client.post("/api/login/", {
                "empresa": slug,
                "email": "user@test.com",
                "password": "password12345678"
            }, format="json")

            assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND], \
                f"Empresa slug peligroso '{slug}' no fue rechazado"

    def test_accepts_valid_empresa_slugs(self, api_client, test_company):
        """Should accept valid empresa slugs (alphanumeric + dash/underscore)"""
        valid_slugs = [
            test_company.slug,  # test-company
            "valid-slug",
            "another_company",
            "company123",
        ]

        for slug in valid_slugs:
            response = api_client.post("/api/login/", {
                "empresa": slug,
                "email": "user@test.com",
                "password": "password12345678"
            }, format="json")

            # Debe dar 404 (empresa no encontrada) o 401 (credenciales incorrectas)
            # NO 400 (validacion fallida)
            assert response.status_code in [
                status.HTTP_404_NOT_FOUND,
                status.HTTP_401_UNAUTHORIZED
            ], f"Slug valido '{slug}' fue rechazado por validacion"


@pytest.mark.django_db
class TestBackendDefenseInDepth:
    """Test defense in depth: backend NO confia en frontend"""

    def test_backend_validates_even_with_correct_frontend_format(self, api_client, test_company):
        """Backend debe validar independientemente del frontend"""
        # Simular bypass del frontend con payload que "parece valido"
        response = api_client.post("/api/login/", {
            "empresa": test_company.slug,
            "email": "admin@test.com",  # Valido en apariencia
            "password": "short"  # Solo 5 caracteres - deberia rechazar
        }, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST, \
            "Backend acepto password corto (no valida independientemente)"

    def test_backend_sanitizes_error_messages(self, api_client, test_company):
        """Error messages no deben revelar informacion sensible"""
        response = api_client.post("/api/login/", {
            "empresa": test_company.slug,
            "email": "<script>alert(1)</script>@x.x",
            "password": "password12345678"
        }, format="json")

        error_msg = response.data.get("detail", "")

        # Error message no debe incluir el payload XSS
        assert "<script>" not in error_msg, \
            "Error message incluye payload XSS sin sanitizar"
        assert "alert(" not in error_msg, \
            "Error message incluye codigo JavaScript"
