# Generated manually to move DispositivoPersonalizado to productos (SHARED_APPS)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('checkouters', '0049_alter_dispositivoreal_modelo_and_more'),
        ('productos', '0030_add_campos_faltantes_dispositivo_personalizado'),
    ]

    operations = [
        # Actualizar la ForeignKey de DispositivoReal para apuntar a productos.DispositivoPersonalizado
        migrations.AlterField(
            model_name='dispositivoreal',
            name='dispositivo_personalizado',
            field=models.ForeignKey(
                blank=True,
                help_text='Dispositivo personalizado (Samsung, Xiaomi, Dell, etc.)',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='dispositivos_reales',
                to='productos.dispositivopersonalizado'
            ),
        ),
        # Eliminar el modelo DispositivoPersonalizado de checkouters
        # (ahora está en productos como SHARED_APP)
        migrations.DeleteModel(
            name='DispositivoPersonalizado',
        ),
    ]
