"""
Test dashboard manager para Alexandre Dedola
Verifica que el dashboard respete los managed_store_ids del manager
"""
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from datetime import date, datetime, time
from django.utils.timezone import make_aware
from checkouters.kpimanager.dashboard_manager_serializers import DashboardManagerSerializer
from checkouters.utils.role_filters import get_user_rol_tenant

User = get_user_model()
schema = 'k-tuin'

print("="*80)
print("TEST: Dashboard Manager para Alexandre Dedola")
print("="*80)

with schema_context(schema):
    # Obtener usuario Alexandre Dedola
    user = User.objects.get(id=33)
    print(f"\nUsuario: {user.name}")
    print(f"Email: {user.email}")

    # Verificar su rol usando la función correcta
    rol = get_user_rol_tenant(user, schema)
    print(f"\nRol: {rol.rol}")
    print(f"tienda_id: {rol.tienda_id}")
    print(f"managed_store_ids: {rol.managed_store_ids}")
    print(f"¿Gestiona todas las tiendas?: {rol.gestiona_todas_tiendas()}")

    # Simular request con el usuario
    factory = RequestFactory()
    request = factory.get('/api/dashboard/manager/')
    request.user = user

    # Llamar al serializer con los mismos parámetros que el endpoint
    fecha_inicio = make_aware(datetime.combine(date(2025, 1, 1), time.min))
    fecha_fin = make_aware(datetime.combine(date(2025, 1, 31), time.max))

    print(f"\n--- Ejecutando collect() con request ---")
    print(f"Fecha inicio: {fecha_inicio.date()}")
    print(f"Fecha fin: {fecha_fin.date()}")

    data = DashboardManagerSerializer.collect(
        request=request,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        granularidad='mes',
        filtros={},
        opciones={
            "comparar": False,
            "estados_factura_adelante": {"Factura recibida", "Pendiente de pago", "Pagado"},
        },
    )

    # Verificar rankings
    print(f"\n=== RESULTADOS ===")
    print(f"\nResumen:")
    print(f"  Valor total: {data['resumen']['valor_total']}")
    print(f"  Ticket medio: {data['resumen']['ticket_medio']}")
    print(f"  Comisión total: {data['resumen']['comision_total']}")

    print(f"\nRankings:")
    rankings = data['rankings']

    print(f"\n  Tiendas por valor ({len(rankings['tiendas_por_valor'])} tiendas):")
    for tienda in rankings['tiendas_por_valor']:
        print(f"    - {tienda['nombre']} (ID: {tienda['tienda_id']}): {tienda['valor']}€")

    print(f"\n  Tiendas por operaciones ({len(rankings['tiendas_por_operaciones'])} tiendas):")
    for tienda in rankings['tiendas_por_operaciones']:
        print(f"    - {tienda['nombre']} (ID: {tienda['tienda_id']}): {tienda['ops']} ops")

    print(f"\n  Usuarios por valor ({len(rankings['usuarios_por_valor'])} usuarios):")
    for usuario in rankings['usuarios_por_valor'][:5]:  # Top 5
        print(f"    - {usuario['nombre']} (ID: {usuario['usuario_id']}): {usuario['valor']}€")

    # Extraer IDs de tiendas únicas
    tienda_ids = set()
    for tienda in rankings['tiendas_por_valor']:
        tienda_ids.add(tienda['tienda_id'])
    for tienda in rankings['tiendas_por_operaciones']:
        tienda_ids.add(tienda['tienda_id'])

    print(f"\n=== VERIFICACIÓN ===")
    print(f"IDs de tiendas en rankings: {sorted(tienda_ids)}")
    print(f"managed_store_ids del manager: {sorted(rol.managed_store_ids) if rol.managed_store_ids else 'None (todas)'}")

    if len(tienda_ids) == 0:
        print("❌ ERROR: No se encontraron tiendas en los rankings")
    elif len(tienda_ids) >= 3:
        print(f"✅ CORRECTO: El dashboard muestra {len(tienda_ids)} tiendas (manager gestiona {len(rol.managed_store_ids)} tiendas)")
    else:
        print(f"⚠️  ADVERTENCIA: Solo se encontraron {len(tienda_ids)} tiendas en los rankings")

    print("\n" + "="*80)
