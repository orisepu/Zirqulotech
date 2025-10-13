"""
Verificar la nueva tarea a4196d9b-cb1c-416e-9bf3-f287d5d791fe
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging
import json

tarea_id = "a4196d9b-cb1c-416e-9bf3-f287d5d791fe"

print("\n" + "=" * 70)
print(f"Verificando tarea: {tarea_id}")
print("=" * 70 + "\n")

try:
    tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)

    print(f"Tarea encontrada:")
    print(f"  Estado: {tarea.estado}")
    print(f"  Creada: {tarea.creado_en}")
    print(f"  Iniciada: {tarea.iniciado_en}")
    print(f"  Finalizada: {tarea.finalizado_en}")
    print()

    # Estadísticas
    total = LikewizeItemStaging.objects.filter(tarea=tarea).count()
    mapped = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=False).count()
    unmapped = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=True).count()

    print(f"Estadísticas:")
    print(f"  Total items: {total}")
    print(f"  Mapeados: {mapped}")
    print(f"  Sin mapear: {unmapped}")
    print()

    # Buscar Mac mini A2816
    macmini_items = LikewizeItemStaging.objects.filter(
        tarea=tarea,
        modelo_raw__icontains="Macmini14"
    ).order_by('modelo_raw')[:10]

    if macmini_items.exists():
        print(f"Mac mini encontrados (primeros 10):")
        print("-" * 70)
        for item in macmini_items:
            print(f"\n{item.modelo_raw}")
            print(f"  Capacidad ID: {item.capacidad_id}")
            if item.mapping_metadata:
                meta = item.mapping_metadata
                print(f"  Algorithm: {meta.get('mapping_algorithm')}")
                print(f"  Confidence: {meta.get('confidence_score')}")
                print(f"  Needs capacity creation: {meta.get('needs_capacity_creation', False)}")

                if meta.get('suggested_capacity'):
                    print(f"  Suggested capacity:")
                    sugg = meta['suggested_capacity']
                    print(f"    cpu: {sugg.get('cpu')}")
                    print(f"    cpu_cores: {sugg.get('cpu_cores')}")
                    print(f"    gpu_cores: {sugg.get('gpu_cores')}")
                    print(f"    storage_gb: {sugg.get('storage_gb')}")
    else:
        print("No se encontraron Mac mini en esta tarea")

    # Buscar items con needs_capacity_creation
    needs_capacity = LikewizeItemStaging.objects.filter(
        tarea=tarea,
        capacidad_id__isnull=True,
        mapping_metadata__needs_capacity_creation=True
    ).count()

    print(f"\n{'=' * 70}")
    print(f"Items que necesitan capacidad creada: {needs_capacity}")
    print(f"{'=' * 70}")

    if needs_capacity > 0:
        examples = LikewizeItemStaging.objects.filter(
            tarea=tarea,
            capacidad_id__isnull=True,
            mapping_metadata__needs_capacity_creation=True
        )[:5]

        print(f"\nEjemplos (primeros 5):")
        for item in examples:
            print(f"\n  {item.modelo_raw}")
            if item.mapping_metadata and item.mapping_metadata.get('suggested_capacity'):
                sugg = item.mapping_metadata['suggested_capacity']
                print(f"    → {sugg.get('device_type')} {sugg.get('cpu')} {sugg.get('storage_gb')}GB")
                print(f"    → CPU cores: {sugg.get('cpu_cores')}, GPU cores: {sugg.get('gpu_cores')}")

except TareaActualizacionLikewize.DoesNotExist:
    print(f"⚠️ Tarea no encontrada: {tarea_id}")

print("\n" + "=" * 70 + "\n")
