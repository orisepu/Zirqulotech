# Generated migration to fix PrecioRecompra unique constraint
# El constraint anterior incluía 'fuente' lo que permitía múltiples precios vigentes
# El nuevo constraint solo permite UN precio vigente por (capacidad, canal, tenant_schema)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0025_add_logs_to_tarea_likewize'),
    ]

    operations = [
        # 1. Eliminar constraint antiguo que incluía 'fuente'
        migrations.RemoveConstraint(
            model_name='preciorecompra',
            name='uniq_precio_recompra_vigente_por_clave',
        ),

        # 2. Crear nuevo constraint SIN 'fuente' (fuente es solo metadata)
        # Esto garantiza que solo puede haber UN precio vigente por capacidad+canal
        migrations.AddConstraint(
            model_name='preciorecompra',
            constraint=models.UniqueConstraint(
                fields=['capacidad', 'canal', 'tenant_schema'],
                condition=models.Q(valid_to__isnull=True),
                name='uniq_precio_recompra_vigente_simple'
            ),
        ),
    ]
