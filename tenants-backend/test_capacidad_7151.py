"""
Verificar qué capacidad es 7151 que se asignó al Mac mini M2 base
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django.apps import apps
from django.conf import settings

CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
rel_field = getattr(settings, 'CAPACIDAD_REL_MODEL_FIELD', 'modelo')
rel_name = getattr(settings, 'REL_MODELO_NAME_FIELD', 'descripcion')
gb_field = getattr(settings, 'CAPACIDAD_GB_FIELD', 'tamaño')

print("\n" + "=" * 70)
print("Verificando capacidades mapeadas a Mac mini M2 base")
print("=" * 70 + "\n")

capacidades = [7151, 7152, 7150, 6910, 6913]

for cap_id in capacidades:
    try:
        cap = CapacidadModel.objects.select_related(rel_field).get(id=cap_id)
        modelo = getattr(cap, rel_field, None)
        modelo_desc = getattr(modelo, rel_name, '') if modelo else ''
        almacenamiento = getattr(cap, gb_field, '')

        print(f"Capacidad ID {cap_id}:")
        print(f"  Modelo: {modelo_desc}")
        print(f"  Almacenamiento: {almacenamiento}")
        print()
    except CapacidadModel.DoesNotExist:
        print(f"Capacidad ID {cap_id}: NO ENCONTRADA")
        print()

print("=" * 70 + "\n")
