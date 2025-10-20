# Generated manually for dispositivos personalizados support

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0033_dispositivopersonalizado_pp_a_and_more'),
        ('checkouters', '0050_mover_dispositivopersonalizado_a_productos'),
    ]

    operations = [
        # Hacer modelo nullable
        migrations.AlterField(
            model_name='dispositivo',
            name='modelo',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='dispositivos',
                to='productos.modelo'
            ),
        ),
        # Agregar campo dispositivo_personalizado
        migrations.AddField(
            model_name='dispositivo',
            name='dispositivo_personalizado',
            field=models.ForeignKey(
                blank=True,
                help_text='Dispositivo personalizado (Samsung, Xiaomi, Dell, etc.)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='dispositivos',
                to='productos.dispositivopersonalizado'
            ),
        ),
    ]
