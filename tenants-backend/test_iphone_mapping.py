"""
Test: Investigar por qué no mapea iPhones
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device
from productos.models.actualizarpreciosfuturos import TareaActualizacionLikewize, LikewizeItemStaging

print("\n" + "=" * 70)
print("Investigación: ¿Por qué no mapea iPhones?")
print("=" * 70 + "\n")

# Obtener la última tarea
ultima_tarea = TareaActualizacionLikewize.objects.order_by('-creado_en').first()

if not ultima_tarea:
    print("❌ No hay tareas en la BD")
    exit(1)

# Buscar algunos iPhones en la tarea
iphones = LikewizeItemStaging.objects.filter(
    tarea=ultima_tarea,
    tipo__icontains='iPhone'
)[:10]

print(f"Tarea: {ultima_tarea.id}")
print(f"iPhones encontrados en staging: {iphones.count()}")
print()

if iphones.count() == 0:
    print("⚠️ No hay iPhones en la tarea")
    exit(0)

# Probar mapeo de los primeros 5 iPhones
print("Probando mapeo de iPhones:")
print("=" * 70 + "\n")

for i, item in enumerate(iphones[:5], 1):
    print(f"{i}. {item.modelo_raw or item.modelo_norm}")
    print(f"   A-number: {item.a_number or 'N/A'}")
    print(f"   Storage: {item.almacenamiento_gb}GB")
    print(f"   Capacidad mapeada en staging: {item.capacidad_id or 'NO MAPEADO'}")

    # Intentar mapear con v4
    input_data = {
        'FullName': item.modelo_raw or item.modelo_norm,
        'MModel': item.likewize_model_code or item.a_number or ''
    }

    result = map_device(input_data, system='v4')

    if result.get('success'):
        print(f"   ✓ v4 mapea a: {result.get('modelo_descripcion')}")
        print(f"     Capacidad: {result.get('capacidad_tamanio')}")
        print(f"     Strategy: {result.get('strategy')}")
        print(f"     Confidence: {result.get('confidence') * 100:.1f}%")
    else:
        print(f"   ✗ v4 NO mapea")
        print(f"     Error: {result.get('error_message')}")
        if result.get('needs_capacity_creation'):
            print(f"     Sugiere crear capacidad: {result.get('suggested_capacity', {}).get('storage_gb')}GB")

    print()

# Estadísticas de mapeo de iPhones
print("=" * 70)
print("Estadísticas de iPhones en la tarea:")
print("=" * 70 + "\n")

total_iphones = LikewizeItemStaging.objects.filter(tarea=ultima_tarea, tipo__icontains='iPhone').count()
mapped_iphones = LikewizeItemStaging.objects.filter(tarea=ultima_tarea, tipo__icontains='iPhone', capacidad_id__isnull=False).count()
unmapped_iphones = total_iphones - mapped_iphones

print(f"Total iPhones: {total_iphones}")
print(f"Mapeados: {mapped_iphones} ({mapped_iphones/total_iphones*100:.1f}%)")
print(f"Sin mapear: {unmapped_iphones} ({unmapped_iphones/total_iphones*100:.1f}%)")

print("\n" + "=" * 70 + "\n")
