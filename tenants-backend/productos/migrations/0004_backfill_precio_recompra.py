from django.db import migrations
from django.utils import timezone

def copiar_precios(apps, schema_editor):
    # ⚠️ Ajusta estos nombres si tus modelos reales difieren
    PrecioRecompra = apps.get_model('productos', 'PrecioRecompra')
    Capacidad = apps.get_model('productos', 'Capacidad')  # o 'ProductoCapacidad'

    now = timezone.now()
    rows = []

    # Si tus campos se llaman exactamente 'precio_b2b' y 'precio_b2c', perfecto.
    # Si no, cámbialos aquí.
    for cap in Capacidad.objects.all().only('id', 'precio_b2b', 'precio_b2c'):
        b2b = getattr(cap, 'precio_b2b', None)
        b2c = getattr(cap, 'precio_b2c', None)

        if b2b is not None:
            rows.append(PrecioRecompra(
                capacidad_id=cap.id,
                canal='B2B',
                fuente='manual',
                moneda='EUR',
                precio_neto=b2b,
                valid_from=now,
                valid_to=None,
                tenant_schema=None,
            ))
        if b2c is not None:
            rows.append(PrecioRecompra(
                capacidad_id=cap.id,
                canal='B2C',
                fuente='manual',
                moneda='EUR',
                precio_neto=b2c,
                valid_from=now,
                valid_to=None,
                tenant_schema=None,
            ))

    if rows:
        PrecioRecompra.objects.bulk_create(rows, batch_size=500)

def revertir(apps, schema_editor):
    PrecioRecompra = apps.get_model('productos', 'PrecioRecompra')
    # Borrado prudente: solo los creados por esta migración (fuente='manual' en este instante)
    PrecioRecompra.objects.filter(fuente='manual', valid_to__isnull=True).delete()

class Migration(migrations.Migration):

    dependencies = [
        # ⚠️ Debe depender de la migración que CREA PrecioRecompra y Capacidad
        ('productos', '0002_manoobratipo_piezatipo_costopieza_preciorecompra'),
    ]

    operations = [
        migrations.RunPython(copiar_precios, reverse_code=revertir),
    ]
