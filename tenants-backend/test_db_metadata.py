"""
Script para verificar directamente la metadata en la base de datos.
"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models import LikewizeItemStaging, TareaActualizacionLikewize

# Obtener la tarea
tarea_id = "5489d371-4366-4c6e-9c61-f700e9b420bb"
tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)

print("\n" + "=" * 70)
print(f"Verificando metadata en DB para tarea: {tarea_id}")
print("=" * 70 + "\n")

# Obtener items sin mapear
unmapped_items = LikewizeItemStaging.objects.filter(
    tarea=tarea,
    capacidad_id__isnull=True
).order_by('id')[:10]

print(f"Items sin mapear encontrados: {unmapped_items.count()}")
print()

for i, item in enumerate(unmapped_items, 1):
    print(f"{i}. {item.modelo_raw}")
    print(f"   ID: {item.id}")
    print(f"   capacidad_id: {item.capacidad_id}")
    print(f"   mapping_metadata: {json.dumps(item.mapping_metadata, indent=4) if item.mapping_metadata else 'None'}")
    print()

print("=" * 70 + "\n")
