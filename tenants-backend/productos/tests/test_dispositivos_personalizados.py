import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()


# ===== TESTS PARA MODELO DispositivoPersonalizado =====

@pytest.mark.django_db
def test_crear_dispositivo_personalizado_basico():
    """Test creación básica de un dispositivo personalizado"""
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
def test_calcular_oferta_redondeo_euro_completo():
    """Test que la oferta se redondea a euros completos (no a múltiplos de 5€)"""
    from productos.models import DispositivoPersonalizado

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Dell",
        modelo="XPS 15",
        tipo="portatil",
        precio_base_b2b=Decimal("573.00"),  # Con ajuste 80% = 458.4 → debe redondear a 458
        precio_base_b2c=Decimal("650.00"),
        ajuste_excelente=100,
        ajuste_bueno=80,
        ajuste_malo=50,
    )

    # 573 * 80% = 458.4 → redondea a 458€ (euro completo, no múltiplo de 5)
    oferta = dispositivo.calcular_oferta('bueno', 'B2B')
    assert oferta == 458.0
    # Verificar que es un número entero (euros completos)
    assert oferta == int(oferta)
    # Verificar que NO necesariamente es múltiplo de 5 (puede ser cualquier euro)
    assert oferta % 1 == 0


@pytest.mark.django_db
def test_calcular_oferta_estado_invalido_usa_100():
    """Test que un estado inválido usa 100% por defecto"""
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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
    from productos.models import DispositivoPersonalizado

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


# ===== TESTS PARA API (Serializers y ViewSets) =====

@pytest.mark.django_db
def test_solo_admin_puede_crear_via_api():
    """Test que solo usuarios admin pueden crear dispositivos personalizados vía API"""
    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )
    partner = User.objects.create_user(
        email="partner@test.com",
        password="partner123",
        is_staff=False
    )

    client = APIClient()

    # Partner NO puede crear
    client.force_authenticate(user=partner)
    data = {
        "marca": "Samsung",
        "modelo": "Galaxy S23",
        "tipo": "movil",
        "precio_base_b2b": "450.00",
        "precio_base_b2c": "500.00",
    }
    response = client.post("/api/dispositivos-personalizados/", data, format="json")
    assert response.status_code == 403

    # Admin SÍ puede crear
    client.force_authenticate(user=admin)
    response = client.post("/api/dispositivos-personalizados/", data, format="json")
    assert response.status_code == 201
    assert response.data["marca"] == "Samsung"
    assert response.data["modelo"] == "Galaxy S23"


@pytest.mark.django_db
def test_solo_admin_puede_editar_via_api():
    """Test que solo usuarios admin pueden editar dispositivos personalizados"""
    from productos.models import DispositivoPersonalizado

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )
    partner = User.objects.create_user(
        email="partner@test.com",
        password="partner123",
        is_staff=False
    )

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Xiaomi",
        modelo="Redmi Note 12",
        tipo="movil",
        precio_base_b2b=Decimal("200.00"),
        precio_base_b2c=Decimal("250.00"),
        created_by=admin
    )

    client = APIClient()

    # Partner NO puede editar
    client.force_authenticate(user=partner)
    data = {"precio_base_b2b": "220.00"}
    response = client.patch(f"/api/dispositivos-personalizados/{dispositivo.id}/", data, format="json")
    assert response.status_code == 403

    # Admin SÍ puede editar
    client.force_authenticate(user=admin)
    response = client.patch(f"/api/dispositivos-personalizados/{dispositivo.id}/", data, format="json")
    assert response.status_code == 200
    assert float(response.data["precio_base_b2b"]) == 220.00


@pytest.mark.django_db
def test_validacion_precio_negativo():
    """Test que la API rechaza precios negativos"""
    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    client = APIClient()
    client.force_authenticate(user=admin)

    data = {
        "marca": "Test",
        "modelo": "Invalid",
        "tipo": "otro",
        "precio_base_b2b": "-100.00",  # Precio negativo
        "precio_base_b2c": "120.00",
    }

    response = client.post("/api/dispositivos-personalizados/", data, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_validacion_ajustes_fuera_rango():
    """Test que la API rechaza ajustes fuera del rango 0-100"""
    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    client = APIClient()
    client.force_authenticate(user=admin)

    # Ajuste mayor a 100
    data = {
        "marca": "Test",
        "modelo": "Invalid",
        "tipo": "otro",
        "precio_base_b2b": "100.00",
        "precio_base_b2c": "120.00",
        "ajuste_excelente": 150,  # Fuera de rango
    }

    response = client.post("/api/dispositivos-personalizados/", data, format="json")
    assert response.status_code == 400

    # Ajuste menor a 0
    data["ajuste_excelente"] = -10
    response = client.post("/api/dispositivos-personalizados/", data, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_created_by_asignado_automaticamente():
    """Test que created_by se asigna automáticamente al usuario que crea"""
    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    client = APIClient()
    client.force_authenticate(user=admin)

    data = {
        "marca": "Dell",
        "modelo": "XPS 15",
        "tipo": "portatil",
        "precio_base_b2b": "800.00",
        "precio_base_b2c": "900.00",
    }

    response = client.post("/api/dispositivos-personalizados/", data, format="json")
    assert response.status_code == 201
    assert response.data["created_by"] == admin.id
    assert response.data["created_by_name"] is not None


@pytest.mark.django_db
def test_endpoint_disponibles_todos_autenticados():
    """Test que el endpoint disponibles/ es accesible para todos los usuarios autenticados"""
    from productos.models import DispositivoPersonalizado

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )
    partner = User.objects.create_user(
        email="partner@test.com",
        password="partner123",
        is_staff=False
    )

    # Crear algunos dispositivos
    DispositivoPersonalizado.objects.create(
        marca="Samsung",
        modelo="Galaxy S23",
        tipo="movil",
        precio_base_b2b=Decimal("450.00"),
        precio_base_b2c=Decimal("500.00"),
    )
    DispositivoPersonalizado.objects.create(
        marca="Xiaomi",
        modelo="Redmi Note 12",
        tipo="movil",
        precio_base_b2b=Decimal("200.00"),
        precio_base_b2c=Decimal("250.00"),
    )

    client = APIClient()

    # Partner autenticado SÍ puede ver disponibles
    client.force_authenticate(user=partner)
    response = client.get("/api/dispositivos-personalizados/disponibles/")
    assert response.status_code == 200
    assert len(response.data) == 2

    # Admin también puede ver
    client.force_authenticate(user=admin)
    response = client.get("/api/dispositivos-personalizados/disponibles/")
    assert response.status_code == 200
    assert len(response.data) == 2


@pytest.mark.django_db
def test_endpoint_calcular_oferta():
    """Test del endpoint calcular_oferta"""
    from productos.models import DispositivoPersonalizado

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Samsung",
        modelo="Galaxy S23",
        tipo="movil",
        precio_base_b2b=Decimal("450.00"),
        precio_base_b2c=Decimal("500.00"),
        ajuste_excelente=100,
        ajuste_bueno=80,
        ajuste_malo=50,
    )

    client = APIClient()
    client.force_authenticate(user=admin)

    # Calcular oferta bueno B2B: 450 * 80% = 360€
    data = {
        "estado": "bueno",
        "canal": "B2B"
    }
    response = client.post(f"/api/dispositivos-personalizados/{dispositivo.id}/calcular_oferta/", data, format="json")
    assert response.status_code == 200
    assert response.data["oferta"] == 360.0
    assert response.data["estado"] == "bueno"
    assert response.data["canal"] == "B2B"
    assert response.data["ajuste_aplicado"] == 80


@pytest.mark.django_db
def test_listar_solo_activos():
    """Test que por defecto solo se listan dispositivos activos"""
    from productos.models import DispositivoPersonalizado

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    # Crear dispositivo activo
    DispositivoPersonalizado.objects.create(
        marca="Samsung",
        modelo="Galaxy S23",
        tipo="movil",
        precio_base_b2b=Decimal("450.00"),
        precio_base_b2c=Decimal("500.00"),
        activo=True
    )

    # Crear dispositivo inactivo
    DispositivoPersonalizado.objects.create(
        marca="Xiaomi",
        modelo="Redmi Note 12",
        tipo="movil",
        precio_base_b2b=Decimal("200.00"),
        precio_base_b2c=Decimal("250.00"),
        activo=False
    )

    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get("/api/dispositivos-personalizados/")
    assert response.status_code == 200
    # Solo debe devolver el activo
    assert len(response.data) == 1
    assert response.data[0]["marca"] == "Samsung"


@pytest.mark.django_db
def test_serializer_descripcion_completa():
    """Test que el serializer incluye descripcion_completa"""
    from productos.models import DispositivoPersonalizado

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    dispositivo = DispositivoPersonalizado.objects.create(
        marca="Dell",
        modelo="XPS 15",
        capacidad="1TB SSD",
        tipo="portatil",
        precio_base_b2b=Decimal("800.00"),
        precio_base_b2c=Decimal("900.00"),
    )

    client = APIClient()
    client.force_authenticate(user=admin)

    response = client.get(f"/api/dispositivos-personalizados/{dispositivo.id}/")
    assert response.status_code == 200
    assert response.data["descripcion_completa"] == "Dell XPS 15 1TB SSD"


# ===== TESTS PARA INTEGRACIÓN CON DispositivoReal =====

@pytest.mark.django_db
def test_dispositivo_real_con_dispositivo_personalizado():
    """Test crear DispositivoReal con dispositivo_personalizado en lugar de modelo/capacidad"""
    from productos.models import DispositivoPersonalizado
    from checkouters.models import DispositivoReal, Oportunidad, Cliente

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    # Crear cliente y oportunidad
    cliente = Cliente.objects.create(
        nombre="Test Cliente",
        tipo_cliente="empresa",
        canal="B2B"
    )
    oportunidad = Oportunidad.objects.create(
        cliente=cliente,
        estado="pendiente"
    )

    # Crear dispositivo personalizado
    dispositivo_pers = DispositivoPersonalizado.objects.create(
        marca="Samsung",
        modelo="Galaxy S23",
        tipo="movil",
        precio_base_b2b=Decimal("450.00"),
        precio_base_b2c=Decimal("500.00"),
    )

    # Crear DispositivoReal con dispositivo_personalizado
    dispositivo_real = DispositivoReal.objects.create(
        oportunidad=oportunidad,
        dispositivo_personalizado=dispositivo_pers,
        precio_final=Decimal("360.00"),
        recibido=True
    )

    assert dispositivo_real.dispositivo_personalizado == dispositivo_pers
    assert dispositivo_real.modelo is None
    assert dispositivo_real.capacidad is None


@pytest.mark.django_db
def test_dispositivo_real_validacion_debe_tener_uno():
    """Test que DispositivoReal debe tener O bien (modelo+capacidad) O bien dispositivo_personalizado"""
    from checkouters.models import DispositivoReal, Oportunidad, Cliente
    from django.core.exceptions import ValidationError

    cliente = Cliente.objects.create(
        nombre="Test Cliente",
        tipo_cliente="empresa"
    )
    oportunidad = Oportunidad.objects.create(
        cliente=cliente,
        estado="pendiente"
    )

    # Crear sin modelo, capacidad ni dispositivo_personalizado debe fallar
    dispositivo_real = DispositivoReal(
        oportunidad=oportunidad,
        precio_final=Decimal("100.00")
    )

    with pytest.raises(ValidationError):
        dispositivo_real.clean()


@pytest.mark.django_db
def test_dispositivo_real_validacion_no_ambos():
    """Test que DispositivoReal no puede tener ambos: catálogo Y personalizado"""
    from productos.models import DispositivoPersonalizado
    from checkouters.models import DispositivoReal, Oportunidad, Cliente
    from productos.models import Modelo, Capacidad
    from django.core.exceptions import ValidationError

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    cliente = Cliente.objects.create(
        nombre="Test Cliente",
        tipo_cliente="empresa"
    )
    oportunidad = Oportunidad.objects.create(
        cliente=cliente,
        estado="pendiente"
    )

    # Crear dispositivo personalizado
    dispositivo_pers = DispositivoPersonalizado.objects.create(
        marca="Samsung",
        modelo="Galaxy S23",
        tipo="movil",
        precio_base_b2b=Decimal("450.00"),
        precio_base_b2c=Decimal("500.00"),
    )

    # Crear modelo y capacidad del catálogo
    modelo = Modelo.objects.create(descripcion="iPhone 13", tipo="iPhone")
    capacidad = Capacidad.objects.create(modelo=modelo, tamaño="128GB", precio_b2b=500)

    # Intentar crear con AMBOS debe fallar
    dispositivo_real = DispositivoReal(
        oportunidad=oportunidad,
        modelo=modelo,
        capacidad=capacidad,
        dispositivo_personalizado=dispositivo_pers,
        precio_final=Decimal("100.00")
    )

    with pytest.raises(ValidationError):
        dispositivo_real.clean()


@pytest.mark.django_db
def test_dispositivo_real_serializer_acepta_personalizado_id():
    """Test que DispositivoRealSerializer acepta dispositivo_personalizado_id"""
    from productos.models import DispositivoPersonalizado
    from checkouters.models import Oportunidad, Cliente

    admin = User.objects.create_user(
        email="admin@test.com",
        password="admin123",
        is_staff=True
    )

    cliente = Cliente.objects.create(
        nombre="Test Cliente",
        tipo_cliente="empresa",
        canal="B2B"
    )
    oportunidad = Oportunidad.objects.create(
        cliente=cliente,
        estado="pendiente"
    )

    dispositivo_pers = DispositivoPersonalizado.objects.create(
        marca="Xiaomi",
        modelo="Redmi Note 12",
        tipo="movil",
        precio_base_b2b=Decimal("200.00"),
        precio_base_b2c=Decimal("250.00"),
    )

    client = APIClient()
    client.force_authenticate(user=admin)

    data = {
        "oportunidad": oportunidad.id,
        "dispositivo_personalizado_id": dispositivo_pers.id,
        "precio_final": "160.00",
        "recibido": True
    }

    response = client.post("/api/dispositivos-reales/crear/", data, format="json")
    assert response.status_code == 201
    assert response.data["dispositivo_personalizado"]["id"] == dispositivo_pers.id


@pytest.mark.django_db
def test_dispositivo_real_modelo_capacidad_opcionales_con_personalizado():
    """Test que modelo y capacidad son opcionales cuando se usa dispositivo_personalizado"""
    from productos.models import DispositivoPersonalizado
    from checkouters.models import DispositivoReal, Oportunidad, Cliente

    cliente = Cliente.objects.create(
        nombre="Test Cliente",
        tipo_cliente="empresa"
    )
    oportunidad = Oportunidad.objects.create(
        cliente=cliente,
        estado="pendiente"
    )

    dispositivo_pers = DispositivoPersonalizado.objects.create(
        marca="Dell",
        modelo="XPS 15",
        tipo="portatil",
        precio_base_b2b=Decimal("800.00"),
        precio_base_b2c=Decimal("900.00"),
    )

    # Crear con solo dispositivo_personalizado (sin modelo/capacidad)
    dispositivo_real = DispositivoReal.objects.create(
        oportunidad=oportunidad,
        dispositivo_personalizado=dispositivo_pers,
        precio_final=Decimal("640.00")
    )

    # Validar que clean() no lanza error
    dispositivo_real.clean()

    assert dispositivo_real.dispositivo_personalizado is not None
    assert dispositivo_real.modelo is None
    assert dispositivo_real.capacidad is None
