# Generated migration to populate GradingConfig with initial data

from django.db import migrations
from decimal import Decimal


def populate_grading_configs(apps, schema_editor):
    """Poblar GradingConfig con configuraciones iniciales para todos los tipos de dispositivos."""
    GradingConfig = apps.get_model('productos', 'GradingConfig')

    configs = [
        {
            'tipo_dispositivo': 'iPhone',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': 85,
            'has_battery': True,
            'has_display': True,
            'activo': True,
        },
        {
            'tipo_dispositivo': 'iPad',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': 85,
            'has_battery': True,
            'has_display': True,
            'activo': True,
        },
        {
            'tipo_dispositivo': 'MacBook Air',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': 85,
            'has_battery': True,
            'has_display': True,
            'activo': True,
        },
        {
            'tipo_dispositivo': 'MacBook Pro',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': 85,
            'has_battery': True,
            'has_display': True,
            'activo': True,
        },
        {
            'tipo_dispositivo': 'MacBook',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': 85,
            'has_battery': True,
            'has_display': True,
            'activo': True,
        },
        {
            'tipo_dispositivo': 'iMac',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': None,  # No tiene batería
            'has_battery': False,
            'has_display': True,
            'activo': True,
        },
        {
            'tipo_dispositivo': 'Mac Pro',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': None,  # No tiene batería
            'has_battery': False,
            'has_display': False,  # No tiene pantalla integrada
            'activo': True,
        },
        {
            'tipo_dispositivo': 'Mac Studio',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': None,
            'has_battery': False,
            'has_display': False,
            'activo': True,
        },
        {
            'tipo_dispositivo': 'Mac mini',
            'pp_A': Decimal('0.08'),
            'pp_B': Decimal('0.12'),
            'pp_C': Decimal('0.15'),
            'pp_funcional': Decimal('0.15'),
            'battery_health_threshold': None,
            'has_battery': False,
            'has_display': False,
            'activo': True,
        },
    ]

    for config_data in configs:
        GradingConfig.objects.get_or_create(
            tipo_dispositivo=config_data['tipo_dispositivo'],
            defaults=config_data
        )


def reverse_populate(apps, schema_editor):
    """Eliminar configuraciones creadas."""
    GradingConfig = apps.get_model('productos', 'GradingConfig')
    GradingConfig.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0023_gradingconfig_and_more'),
    ]

    operations = [
        migrations.RunPython(populate_grading_configs, reverse_populate),
    ]
