from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0014_remove_capacidad_precio_b2b_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='capacidad',
            name='activo',
            field=models.BooleanField(default=True),
        ),
    ]
