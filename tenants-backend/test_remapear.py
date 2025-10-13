"""
Script para probar el endpoint de remapeo con v4.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging
from productos.views.actualizador import RemapearTareaLikewizeView
from rest_framework.test import APIRequestFactory
from django.contrib.auth.models import User

# ID de la tarea
tarea_id = "5489d371-4366-4c6e-9c61-f700e9b420bb"

print(f"\n{'='*70}")
print(f"Remapeando tarea: {tarea_id}")
print(f"{'='*70}\n")

# Verificar que existe la tarea
try:
    tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
    print(f"✓ Tarea encontrada: {tarea.id}")
    print(f"  Estado: {tarea.estado}")
except Exception as e:
    print(f"✗ Error: {e}")
    exit(1)

# Verificar items sin mapear
unmapped = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=True)
total = LikewizeItemStaging.objects.filter(tarea=tarea).count()
mapped = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=False).count()

print(f"\nEstadísticas ANTES del remapeo:")
print(f"  Total items: {total}")
print(f"  Mapeados: {mapped}")
print(f"  Sin mapear: {unmapped.count()}")

if unmapped.count() == 0:
    print("\n✓ Todos los items ya están mapeados!")
    exit(0)

print(f"\nEjemplos de items sin mapear (primeros 5):")
for item in unmapped[:5]:
    print(f"  - {item.modelo_raw or item.modelo_norm}")

# Crear request simulado
factory = APIRequestFactory()
request = factory.post(
    f'/api/precios/likewize/tareas/{tarea_id}/remapear/',
    {'system': 'v4'},
    format='json'
)

# Crear usuario admin simulado
request.user = User(is_staff=True, is_superuser=True)

# Ejecutar la vista
view = RemapearTareaLikewizeView.as_view()
response = view(request, tarea_id=tarea_id)

print(f"\n{'='*70}")
print(f"Resultado del remapeo:")
print(f"{'='*70}\n")
print(f"Status Code: {response.status_code}")
print(f"Response Data:")
import json
print(json.dumps(response.data, indent=2))

# Verificar items después del remapeo
unmapped_after = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=True)
mapped_after = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=False).count()

print(f"\nEstadísticas DESPUÉS del remapeo:")
print(f"  Total items: {total}")
print(f"  Mapeados: {mapped_after} (antes: {mapped})")
print(f"  Sin mapear: {unmapped_after.count()} (antes: {unmapped.count()})")
print(f"  Diferencia: +{mapped_after - mapped} mapeados")

# Mostrar algunos items que se mapearon
newly_mapped = LikewizeItemStaging.objects.filter(
    tarea=tarea,
    capacidad_id__isnull=False
).exclude(
    id__in=LikewizeItemStaging.objects.filter(
        tarea=tarea,
        capacidad_id__isnull=False
    ).values_list('id', flat=True)[:mapped]
)

if newly_mapped.exists():
    print(f"\nEjemplos de items recién mapeados (primeros 5):")
    for item in newly_mapped[:5]:
        metadata = item.mapping_metadata or {}
        print(f"  - {item.modelo_raw or item.modelo_norm}")
        print(f"    → Capacidad ID: {item.capacidad_id}")
        print(f"    → Confidence: {metadata.get('confidence_score', 0):.1f}%")
        print(f"    → Algorithm: {metadata.get('mapping_algorithm', 'N/A')}")

print(f"\n{'='*70}\n")
