import uuid
from django.db import migrations, models

def fill_user_uuids(apps, schema_editor):
    GuidUser = apps.get_model('users', 'GuidUser')
    TenantUser = apps.get_model('users', 'TenantUser')

    for user in GuidUser.objects.filter(uuid__isnull=True):
        user.uuid = uuid.uuid4()
        user.save(update_fields=["uuid"])

    for user in TenantUser.objects.filter(uuid__isnull=True):
        user.uuid = uuid.uuid4()
        user.save(update_fields=["uuid"])

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='guiduser',
            name='uuid',
            field=models.UUIDField(null=True, db_index=True, editable=False, unique=True),
        ),
        migrations.AddField(
            model_name='tenantuser',
            name='uuid',
            field=models.UUIDField(null=True, db_index=True, editable=False, unique=True),
        ),
        migrations.RunPython(fill_user_uuids, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name='guiduser',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, db_index=True, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name='tenantuser',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, db_index=True, editable=False, unique=True),
        ),
    ]
