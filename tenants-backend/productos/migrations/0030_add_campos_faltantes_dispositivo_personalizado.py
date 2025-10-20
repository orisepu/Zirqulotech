# Generated manually to add missing fields to DispositivoPersonalizado

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('productos', '0029_dispositivopersonalizado'),
    ]

    operations = [
        # Cambiar ajuste_* de DecimalField a IntegerField
        migrations.AlterField(
            model_name='dispositivopersonalizado',
            name='ajuste_excelente',
            field=models.IntegerField(
                default=100,
                help_text='% del precio base para estado excelente (0-100)'
            ),
        ),
        migrations.AlterField(
            model_name='dispositivopersonalizado',
            name='ajuste_bueno',
            field=models.IntegerField(
                default=80,
                help_text='% del precio base para estado bueno (0-100)'
            ),
        ),
        migrations.AlterField(
            model_name='dispositivopersonalizado',
            name='ajuste_malo',
            field=models.IntegerField(
                default=50,
                help_text='% del precio base para estado malo (0-100)'
            ),
        ),
        # Cambiar tipo default de 'movil' a 'otro'
        migrations.AlterField(
            model_name='dispositivopersonalizado',
            name='tipo',
            field=models.CharField(
                choices=[('movil', 'Móvil'), ('portatil', 'Portátil'), ('monitor', 'Monitor'), ('tablet', 'Tablet'), ('otro', 'Otro')],
                default='otro',
                help_text='Tipo de dispositivo',
                max_length=20
            ),
        ),
        # Hacer capacidad opcional (blank=True)
        migrations.AlterField(
            model_name='dispositivopersonalizado',
            name='capacidad',
            field=models.CharField(
                blank=True,
                help_text='Ej: 256GB, 1TB SSD, configuración especial',
                max_length=100
            ),
        ),
        # Agregar campo caracteristicas
        migrations.AddField(
            model_name='dispositivopersonalizado',
            name='caracteristicas',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='RAM, procesador, tamaño pantalla, etc. en formato JSON'
            ),
        ),
        # Agregar campo notas
        migrations.AddField(
            model_name='dispositivopersonalizado',
            name='notas',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Descripción adicional o detalles específicos'
            ),
        ),
        # Agregar campo created_by
        migrations.AddField(
            model_name='dispositivopersonalizado',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='dispositivos_personalizados_creados',
                to=settings.AUTH_USER_MODEL
            ),
        ),
        # Actualizar Meta: ordering
        migrations.AlterModelOptions(
            name='dispositivopersonalizado',
            options={
                'ordering': ['-created_at'],
                'verbose_name': 'Dispositivo Personalizado',
                'verbose_name_plural': 'Dispositivos Personalizados',
            },
        ),
        # Actualizar Meta: indexes
        migrations.AddIndex(
            model_name='dispositivopersonalizado',
            index=models.Index(fields=['marca', 'modelo'], name='dispositivo_marca_m_idx'),
        ),
        migrations.AddIndex(
            model_name='dispositivopersonalizado',
            index=models.Index(fields=['tipo'], name='dispositivo_tipo_idx'),
        ),
        migrations.AddIndex(
            model_name='dispositivopersonalizado',
            index=models.Index(fields=['activo'], name='dispositivo_activo_idx'),
        ),
        # Eliminar unique_together (no es necesario)
        migrations.AlterUniqueTogether(
            name='dispositivopersonalizado',
            unique_together=set(),
        ),
    ]
