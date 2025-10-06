# Generated manually
from django.db import migrations, models
import django_test_app.companies.models
from checkouters.storage import PrivateDocumentStorage


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0014_add_es_demo_to_company'),
    ]

    operations = [
        migrations.AlterField(
            model_name='company',
            name='logo',
            field=models.ImageField(
                blank=True,
                null=True,
                help_text='Logo del partner usado en PDFs y documentación.',
                storage=PrivateDocumentStorage(),
                upload_to=django_test_app.companies.models.logo_upload_path
            ),
        ),
    ]
