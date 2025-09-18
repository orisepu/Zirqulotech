# Generated manually to align cliente correo optional requirements
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("checkouters", "0046_dispositivo_ciclos_bateria_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="cliente",
            name="correo",
            field=models.EmailField(blank=True, null=True, verbose_name="Correo electrónico"),
        ),
    ]
