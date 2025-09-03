import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from productos.models import Modelo, Capacidad
from checkouters.models import Dispositivo

User = get_user_model()

@pytest.mark.django_db
def test_crear_dispositivo_autenticado():
    user = User.objects.create_user(email="test@example.com", password="1234")
    modelo = Modelo.objects.create(descripcion="iPhone 13")
    capacidad = Capacidad.objects.create(modelo=modelo, tamaño="128 GB", precio_b2b=500)

    client = APIClient()
    client.force_authenticate(user=user)

    data = {
        "modelo_id": modelo.id,
        "capacidad_id": capacidad.id,
        "estado_valoracion": "Excelente"
    }

    response = client.post("/api/dispositivos/", data, format="json")

    assert response.status_code == 201
    assert Dispositivo.objects.count() == 1
    dispositivo = Dispositivo.objects.first()
    assert dispositivo.modelo.descripcion == "iPhone 13"
