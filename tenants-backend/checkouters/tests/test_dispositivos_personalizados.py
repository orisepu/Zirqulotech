import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()


# ===== TESTS PARA MODELO DispositivoPersonalizado =====

@pytest.mark.django_db
def test_crear_dispositivo_personalizado_basico():
    """Test creación básica de un dispositivo personalizado"""
    from checkouters.models import DispositivoPersonalizado

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Samsung",
        modelo="Galaxy S23",
        capacidad="256GB",
        tipo="movil",
        precio_base_b2b=Decimal("450.00"),
        precio_base_b2c=Decimal("500.00"),
        created_by=admin
    )

    assert dispositivo.id is not None
    assert dispositivo.marca == "Samsung"
    assert dispositivo.modelo == "Galaxy S23"
    assert dispositivo.tipo == "movil"
    assert dispositivo.activo is True


@pytest.mark.django_db
def test_str_dispositivo_personalizado_con_capacidad():
    """Test método __str__ con capacidad"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Xiaomi",
        modelo="Redmi Note 12",
        capacidad="128GB",
        tipo="movil",
        precio_base_b2b=Decimal("200.00"),
        precio_base_b2c=Decimal("250.00"),
    )

    assert str(dispositivo) == "Xiaomi Redmi Note 12 128GB"


@pytest.mark.django_db
def test_str_dispositivo_personalizado_sin_capacidad():
    """Test método __str__ sin capacidad"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="LG",
        modelo="UltraWide 34",
        tipo="monitor",
        precio_base_b2b=Decimal("300.00"),
        precio_base_b2c=Decimal("350.00"),
    )

    assert str(dispositivo) == "LG UltraWide 34"


@pytest.mark.django_db
def test_calcular_oferta_excelente_b2b():
    """Test cálculo de oferta para estado excelente en canal B2B"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Xiaomi",
        modelo="Redmi Note 12",
        tipo="movil",
        precio_base_b2b=Decimal("200.00"),
        precio_base_b2c=Decimal("250.00"),
        ajuste_excelente=100,
        ajuste_bueno=80,
        ajuste_malo=50,
    )

    # Excelente B2B: 200 * 100% = 200€
    oferta = dispositivo.calcular_oferta('excelente', 'B2B')
    assert oferta == 200.0


@pytest.mark.django_db
def test_calcular_oferta_bueno_b2b():
    """Test cálculo de oferta para estado bueno en canal B2B"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Xiaomi",
        modelo="Redmi Note 12",
        tipo="movil",
        precio_base_b2b=Decimal("200.00"),
        precio_base_b2c=Decimal("250.00"),
        ajuste_excelente=100,
        ajuste_bueno=80,
        ajuste_malo=50,
    )

    # Bueno B2B: 200 * 80% = 160€
    oferta = dispositivo.calcular_oferta('bueno', 'B2B')
    assert oferta == 160.0


@pytest.mark.django_db
def test_calcular_oferta_malo_b2c():
    """Test cálculo de oferta para estado malo en canal B2C"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Xiaomi",
        modelo="Redmi Note 12",
        tipo="movil",
        precio_base_b2b=Decimal("200.00"),
        precio_base_b2c=Decimal("250.00"),
        ajuste_excelente=100,
        ajuste_bueno=80,
        ajuste_malo=50,
    )

    # Malo B2C: 250 * 50% = 125€
    oferta = dispositivo.calcular_oferta('malo', 'B2C')
    assert oferta == 125.0


@pytest.mark.django_db
def test_calcular_oferta_redondeo_multiplo_5():
    """Test que la oferta se redondea a múltiplos de 5€"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Dell",
        modelo="XPS 15",
        tipo="portatil",
        precio_base_b2b=Decimal("573.00"),  # Con ajuste 80% = 458.4 → debe redondear a 460
        precio_base_b2c=Decimal("650.00"),
        ajuste_excelente=100,
        ajuste_bueno=80,
        ajuste_malo=50,
    )

    # 573 * 80% = 458.4 → redondea a 460 (múltiplo de 5)
    oferta = dispositivo.calcular_oferta('bueno', 'B2B')
    assert oferta == 460.0
    assert oferta % 5 == 0


@pytest.mark.django_db
def test_calcular_oferta_estado_invalido_usa_100():
    """Test que un estado inválido usa 100% por defecto"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Samsung",
        modelo="Galaxy Tab",
        tipo="tablet",
        precio_base_b2b=Decimal("300.00"),
        precio_base_b2c=Decimal("350.00"),
        ajuste_excelente=100,
        ajuste_bueno=80,
        ajuste_malo=50,
    )

    # Estado inválido debe usar 100% (default)
    oferta = dispositivo.calcular_oferta('estado_invalido', 'B2B')
    assert oferta == 300.0


@pytest.mark.django_db
def test_calcular_oferta_minimo_cero():
    """Test que la oferta mínima es 0€ (no puede ser negativa)"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Dispositivo",
        modelo="Roto",
        tipo="otro",
        precio_base_b2b=Decimal("10.00"),
        precio_base_b2c=Decimal("15.00"),
        ajuste_excelente=100,
        ajuste_bueno=80,
        ajuste_malo=0,  # 0% = 0€
    )

    oferta = dispositivo.calcular_oferta('malo', 'B2B')
    assert oferta == 0.0
    assert oferta >= 0


@pytest.mark.django_db
def test_valores_default_ajustes():
    """Test que los valores por defecto de ajustes son correctos"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Test",
        modelo="Default",
        tipo="otro",
        precio_base_b2b=Decimal("100.00"),
        precio_base_b2c=Decimal("120.00"),
    )

    assert dispositivo.ajuste_excelente == 100
    assert dispositivo.ajuste_bueno == 80
    assert dispositivo.ajuste_malo == 50


@pytest.mark.django_db
def test_caracteristicas_json_default():
    """Test que características tiene default dict vacío"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Test",
        modelo="JSON",
        tipo="otro",
        precio_base_b2b=Decimal("100.00"),
        precio_base_b2c=Decimal("120.00"),
    )

    assert dispositivo.caracteristicas == {}
    assert isinstance(dispositivo.caracteristicas, dict)


@pytest.mark.django_db
def test_caracteristicas_json_personalizado():
    """Test que características acepta JSON personalizado"""
    from checkouters.models import DispositivoPersonalizado

    caracteristicas = {
        "RAM": "16GB",
        "Procesador": "i7-11800H",
        "Pantalla": "15.6 pulgadas"
    }

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Dell",
        modelo="XPS 15",
        tipo="portatil",
        precio_base_b2b=Decimal("800.00"),
        precio_base_b2c=Decimal("900.00"),
        caracteristicas=caracteristicas,
    )

    assert dispositivo.caracteristicas == caracteristicas
    assert dispositivo.caracteristicas["RAM"] == "16GB"


@pytest.mark.django_db
def test_dispositivo_activo_por_default():
    """Test que dispositivos se crean activos por defecto"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Test",
        modelo="Activo",
        tipo="otro",
        precio_base_b2b=Decimal("100.00"),
        precio_base_b2c=Decimal("120.00"),
    )

    assert dispositivo.activo is True


@pytest.mark.django_db
def test_soft_delete_inactivo():
    """Test que se puede marcar como inactivo (soft delete)"""
    from checkouters.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Test",
        modelo="Delete",
        tipo="otro",
        precio_base_b2b=Decimal("100.00"),
        precio_base_b2c=Decimal("120.00"),
    )

    dispositivo.activo = False
    dispositivo.save()

    assert dispositivo.activo is False
    # El dispositivo sigue existiendo en la base de datos
    assert DispositivoPersonalizado.objects.filter(id=dispositivo.id).exists()
