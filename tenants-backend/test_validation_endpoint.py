"""
Script para probar el endpoint de validación con needs_capacity_creation.

Verifica que el endpoint devuelve correctamente:
- needs_capacity_creation flag
- suggested_capacity con todos los campos
- v3_skipped y v3_skip_reason cuando aplica
"""
import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django.test import RequestFactory
from productos.views.actualizador import ValidationItemsLikewizeView
from productos.models import TareaActualizacionLikewize

# Obtener la tarea
tarea_id = "5489d371-4366-4c6e-9c61-f700e9b420bb"
tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)

print("\n" + "=" * 70)
print(f"Probando endpoint de validación para tarea: {tarea_id}")
print("=" * 70 + "\n")

# Crear request fake
factory = RequestFactory()
request = factory.get(f'/api/precios/likewize/tareas/{tarea_id}/validation-items/')

# Crear vista y llamar al endpoint
view = ValidationItemsLikewizeView()
response = view.get(request, tarea_id)

# Analizar respuesta
data = response.data
total_items = data['total']
mapped_items = data['mapped']
unmapped_items = data['unmapped']

print(f"Estadísticas:")
print(f"  Total items: {total_items}")
print(f"  Mapeados: {mapped_items}")
print(f"  Sin mapear: {unmapped_items}")
print()

# Buscar items con needs_capacity_creation
items_with_suggestion = []
for item in data['items']:
    metadata = item.get('mapping_metadata', {})
    if metadata.get('needs_capacity_creation'):
        items_with_suggestion.append(item)

print(f"Items con sugerencia de crear capacidad: {len(items_with_suggestion)}")
print()

# Mostrar primeros 5 ejemplos
if items_with_suggestion:
    print("Ejemplos de items que necesitan capacidad creada:")
    print("-" * 70)

    for i, item in enumerate(items_with_suggestion[:5], 1):
        likewize_info = item['likewize_info']
        metadata = item['mapping_metadata']
        suggested = metadata.get('suggested_capacity', {})

        print(f"\n{i}. {likewize_info['modelo_raw']}")
        print(f"   needs_capacity_creation: {metadata.get('needs_capacity_creation')}")
        print(f"   v3_skipped: {metadata.get('v3_skipped', False)}")
        print(f"   v3_skip_reason: {metadata.get('v3_skip_reason', 'N/A')}")

        if suggested:
            print(f"   Suggested capacity:")
            print(f"     device_type: {suggested.get('device_type')}")
            print(f"     variant: {suggested.get('variant')}")
            print(f"     cpu: {suggested.get('cpu')}")
            print(f"     cpu_cores: {suggested.get('cpu_cores')}")
            print(f"     gpu_cores: {suggested.get('gpu_cores')}")
            print(f"     storage_gb: {suggested.get('storage_gb')}")
            print(f"     year: {suggested.get('year')}")
            print(f"     generation: {suggested.get('generation')}")
            if suggested.get('screen_size'):
                print(f"     screen_size: {suggested.get('screen_size')}")
            if suggested.get('connectivity'):
                print(f"     connectivity: {suggested.get('connectivity')}")
else:
    print("⚠️ No se encontraron items con sugerencia de crear capacidad")
    print("Esto puede significar que:")
    print("  1. El remapeo no incluyó items que necesitan capacidad")
    print("  2. Los metadatos no se guardaron correctamente")
    print()

    # Mostrar algunos items sin mapear para debug
    unmapped = [item for item in data['items'] if not item['mapping_metadata']['is_mapped']]
    if unmapped:
        print(f"\nEjemplos de items sin mapear (primeros 3):")
        for i, item in enumerate(unmapped[:3], 1):
            likewize_info = item['likewize_info']
            metadata = item['mapping_metadata']
            print(f"\n{i}. {likewize_info['modelo_raw']}")
            print(f"   algorithm: {metadata.get('mapping_algorithm')}")
            print(f"   confidence: {metadata.get('confidence_score')}")
            print(f"   needs_capacity_creation: {metadata.get('needs_capacity_creation')}")

print("\n" + "=" * 70 + "\n")
