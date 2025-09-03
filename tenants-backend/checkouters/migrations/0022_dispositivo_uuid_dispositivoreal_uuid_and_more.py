import uuid
from django.db import migrations, models

def fill_uuids(apps, schema_editor):
    Oportunidad = apps.get_model('checkouters', 'Oportunidad')
    Dispositivo = apps.get_model('checkouters', 'Dispositivo')
    DispositivoReal = apps.get_model('checkouters', 'DispositivoReal')

    for model in [Oportunidad, Dispositivo, DispositivoReal]:
        for obj in model.objects.filter(uuid__isnull=True):
            obj.uuid = uuid.uuid4()
            obj.save(update_fields=["uuid"])

class Migration(migrations.Migration):

    dependencies = [
        ('checkouters', '0021_remove_tienda_ubicacion_tienda_direccion_calle_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='dispositivo',
            name='uuid',
            field=models.UUIDField(null=True, editable=False, unique=True, db_index=True),
        ),
        migrations.AddField(
            model_name='dispositivoreal',
            name='uuid',
            field=models.UUIDField(null=True, editable=False, unique=True, db_index=True),
        ),
        migrations.AddField(
            model_name='oportunidad',
            name='uuid',
            field=models.UUIDField(null=True, editable=False, unique=True, db_index=True),
        ),

        migrations.RunPython(fill_uuids, reverse_code=migrations.RunPython.noop),

        migrations.AlterField(
            model_name='dispositivo',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True),
        ),
        migrations.AlterField(
            model_name='dispositivoreal',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True),
        ),
        migrations.AlterField(
            model_name='oportunidad',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True),
        ),
    ]
