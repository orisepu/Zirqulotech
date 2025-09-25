from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0017_likewizeitemstaging_marca'),
    ]

    operations = [
        migrations.AddField(
            model_name='tareaactualizacionlikewize',
            name='meta',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
