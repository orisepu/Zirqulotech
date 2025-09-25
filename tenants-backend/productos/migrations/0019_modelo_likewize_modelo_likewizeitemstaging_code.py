from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0018_tareaactualizacionlikewize_meta'),
    ]

    operations = [
        migrations.AddField(
            model_name='modelo',
            name='likewize_modelo',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='likewizeitemstaging',
            name='likewize_model_code',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]
