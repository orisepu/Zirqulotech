from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('progeek', '0002_userglobalrole'),
    ]

    operations = [
        migrations.AddField(
            model_name='userglobalrole',
            name='roles_por_tenant',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
