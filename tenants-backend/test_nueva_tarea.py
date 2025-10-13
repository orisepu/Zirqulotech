"""
Verificar nueva tarea 3611e4a5-b20b-4fdf-ab19-ec1dd78878a6
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging

tarea_id = "3611e4a5-b20b-4fdf-ab19-ec1dd78878a6"

print("\n" + "=" * 70)
print(f"Verificando tarea: {tarea_id}")
print("=" * 70 + "\n")

try:
    tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
    
    print(f"Tarea encontrada:")
    print(f"  Estado: {tarea.estado}")
    print(f"  Creada: {tarea.creado_en}")
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
        modelo_raw__icontains="A2816"
    ).order_by('modelo_raw')[:10]
    
    if macmini_items.exists():
        print(f"Mac mini A2816 encontrados (primeros 10):")
        print("-" * 70)
        for item in macmini_items:
            print(f"\n{item.modelo_raw}")
            print(f"  Capacidad ID: {item.capacidad_id}")
            if item.mapping_metadata:
                meta = item.mapping_metadata
                print(f"  Algorithm: {meta.get('mapping_algorithm')}")
                print(f"  Confidence: {meta.get('confidence_score')}")
                
                if meta.get('suggested_capacity'):
                    print(f"  ⚠️ Needs capacity creation: {meta.get('needs_capacity_creation', False)}")
                    sugg = meta['suggested_capacity']
                    print(f"    cpu: {sugg.get('cpu')}, cores: {sugg.get('cpu_cores')}/{sugg.get('gpu_cores')}")
    else:
        print("No se encontraron Mac mini A2816 en esta tarea")
        
except TareaActualizacionLikewize.DoesNotExist:
    print(f"⚠️ Tarea no encontrada: {tarea_id}")

print("\n" + "=" * 70 + "\n")
