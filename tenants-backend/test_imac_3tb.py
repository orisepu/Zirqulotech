"""
Test: Investigar por qué iMac A2115 3TB mapea a 1TB
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.mapping import map_device
from productos.models.modelos import Modelo, Capacidad

print("\n" + "=" * 70)
print("Investigación: iMac A2115 3TB → 1TB (incorrecto)")
print("=" * 70 + "\n")

# 1. Verificar modelos con A2115
print("1. Modelos con A2115 en la BD:")
models_a2115 = Modelo.objects.filter(
    descripcion__icontains="A2115",
    tipo__icontains="iMac"
)

for modelo in models_a2115:
    print(f"\n  Modelo ID: {modelo.id}")
    print(f"    Descripción: {modelo.descripcion}")
    print(f"    Año: {modelo.año}")

    # Capacidades activas
    capacidades = Capacidad.objects.filter(modelo=modelo, activo=True)
    print(f"    Capacidades activas: {capacidades.count()}")

    for cap in capacidades:
        # Convertir tamaño a GB
        tamanio_str = cap.tamaño.upper()
        if "TB" in tamanio_str:
            valor = float(tamanio_str.replace("TB", "").replace("FUSION DRIVE", "").replace("SSD", "").strip())
            tamanio_gb = int(valor * 1024)
        elif "GB" in tamanio_str:
            tamanio_gb = int(tamanio_str.replace("GB", "").replace("FUSION DRIVE", "").replace("SSD", "").strip())
        else:
            tamanio_gb = None

        has_3tb = "✓ 3TB" if tamanio_gb == 3072 else ""
        print(f"      - {cap.tamaño} (ID: {cap.id}, {tamanio_gb}GB) {has_3tb}")

# 2. Probar mapeo con 3TB
print("\n" + "=" * 70)
print("2. Probar mapeo de iMac A2115 3TB Fusion Drive:")
print("=" * 70 + "\n")

input_data = {
    'FullName': 'iMac19 1 Core i9 3.6 27 inch A2115 3/2019 3TB Fusion Drive',
    'MModel': 'A2115'
}

result = map_device(input_data, system='v4')

print(f"success: {result['success']}")
if result['success']:
    print(f"✗ Mapeó a: {result.get('modelo_descripcion')}")
    print(f"  Capacidad: {result.get('capacidad_tamanio')}")
    print(f"  Capacidad ID: {result.get('capacidad_id')}")
    print(f"  Confidence: {result.get('confidence') * 100:.1f}%")

    # Verificar si la capacidad mapeada es 3TB
    cap_tamanio = result.get('capacidad_tamanio', '')
    if '3 TB' in cap_tamanio or '3TB' in cap_tamanio:
        print(f"  ✓ Capacidad CORRECTA (3TB)")
    elif '1 TB' in cap_tamanio or '1TB' in cap_tamanio:
        print(f"  ✗ Capacidad INCORRECTA (mapeó a 1TB en lugar de 3TB)")
        print(f"  Problema: El modelo A2115 NO tiene capacidad 3TB configurada en BD")
else:
    print(f"No match")
    print(f"  needs_capacity_creation: {result.get('needs_capacity_creation')}")
    if result.get('suggested_capacity'):
        sugg = result['suggested_capacity']
        print(f"  Sugerencia: crear {sugg.get('storage_gb')}GB para modelo {sugg.get('model_ids')}")

# 3. Verificar extracción de features
print("\n" + "=" * 70)
print("3. Verificar extracción de storage:")
print("=" * 70 + "\n")

from productos.mapping.adapters.v3_compatibility import V3CompatibilityAdapter
adapter = V3CompatibilityAdapter()
input_v4 = adapter._dict_to_likewize_input(input_data)
result_obj = adapter._service.map(input_v4)

print(f"Features extraídas:")
print(f"  storage_gb: {result_obj.features.storage_gb}GB")
print(f"  a_number: {result_obj.features.a_number}")
print(f"  device_type: {result_obj.features.device_type}")
print(f"  year: {result_obj.features.year}")

expected_storage = 3072  # 3TB = 3072GB
if result_obj.features.storage_gb == expected_storage:
    print(f"  ✓ Storage extraído correctamente (3072GB)")
else:
    print(f"  ✗ Storage extraído incorrectamente")
    print(f"    Esperado: {expected_storage}GB")
    print(f"    Obtenido: {result_obj.features.storage_gb}GB")

print("\n" + "=" * 70 + "\n")
