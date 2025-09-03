# checkouters/tests/test_endpoints.py

import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from django_tenants.utils import get_tenant_model, schema_context

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
@pytest.mark.django_db
def superadmin_user():
    with schema_context("public"):
        user = User.objects.create_user(
            email="superadmin@test.com",
            password="12345678",
            is_active=True,
        )
        from progeek.models import UserGlobalRole
        UserGlobalRole.objects.create(user=user, es_superadmin=True)

        get_tenant_model().objects.create(
            schema_name="public",
            name="Public Tenant",
            owner=user,
            tipo_cliente="B2B",
            type="type1",
        )
        return user

@pytest.fixture
def authenticated_client(api_client, superadmin_user):
    api_client.force_authenticate(user=superadmin_user)
    return api_client


@pytest.mark.django_db
def test_get_dispositivos(authenticated_client):
    response = authenticated_client.get("/dispositivos/")
    assert response.status_code in [200, 204, 403, 404]


@pytest.mark.django_db
def test_mi_dashboard(authenticated_client):
    response = authenticated_client.get("/mi-dashboard/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_cambiar_contraseña(authenticated_client):
    response = authenticated_client.post("/cambiar-contraseña/", {
        "current_password": "12345678",
        "new_password": "nuevo123"
    })
    assert response.status_code in [200, 400]


@pytest.mark.django_db
def test_capacidades_sin_auth(api_client):
    response = api_client.get("/capacidades-por-modelo/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_post_dispositivo_real_global(authenticated_client):
    data = {
        "tenant": "public",  # o cualquier schema válido de prueba
        "modelo": None,
        "capacidad": None,
        "estado": "excelente",
    }
    response = authenticated_client.post("/dispositivos-reales-globales/public/crear/", data)
    assert response.status_code in [201, 400]


@pytest.mark.django_db
def test_delete_dispositivo_real_global(authenticated_client):
    data = {
        "tenant": "public",
        "imei": "123456789",
        "numero_serie": "ABC123",
        "oportunidad": "00000000-0000-0000-0000-000000000000",  # UUID ficticio
    }
    response = authenticated_client.delete("/dispositivos-reales-globales/public/borrar/", data=data)
    assert response.status_code in [204, 400, 404]


@pytest.mark.django_db
def test_update_dispositivo_real_global(authenticated_client):
    data = {
        "modelo_id": None,
        "capacidad_id": None,
        "imei": "123456789",
        "numero_serie": "ABC123",
        "oportunidad": "00000000-0000-0000-0000-000000000000",
    }
    response = authenticated_client.put("/dispositivos-reales-globales/public/editar/1/", data)
    assert response.status_code in [200, 400, 403, 404]
