import uuid
from django.db import migrations, models

def fill_company_uuids(apps, schema_editor):
    Company = apps.get_model('companies', 'Company')
    for obj in Company.objects.filter(uuid__isnull=True):
        obj.uuid = uuid.uuid4()
        obj.save(update_fields=["uuid"])

class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0007_company_tier'),
    ]

    operations = [
        migrations.AddField(
            model_name='company',
            name='uuid',
            field=models.UUIDField(null=True, db_index=True, editable=False, unique=True),
        ),
        migrations.RunPython(fill_company_uuids, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name='company',
            name='uuid',
            field=models.UUIDField(default=uuid.uuid4, db_index=True, editable=False, unique=True),
        ),
    ]
