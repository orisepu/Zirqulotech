"""
Investigar por qué 512GB no se encuentra en modelo 1531
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models.modelos import Modelo, Capacidad

print("\n" + "=" * 70)
print("Investigación: ¿Por qué 512GB no se encuentra?")
print("=" * 70 + "\n")

# 1. Verificar modelos con A2816
print("1. Modelos con A2816:")
models_with_a2816 = Modelo.objects.filter(
    descripcion__icontains="A2816",
    tipo__icontains="Mac mini"
)

for modelo in models_with_a2816:
    print(f"\n  Modelo ID: {modelo.id}")
    print(f"    Descripción: {modelo.descripcion}")
    print(f"    Año: {modelo.año}")

    # Capacidades activas
    capacidades = Capacidad.objects.filter(
        modelo=modelo,
        activo=True
    )
    print(f"    Capacidades activas: {capacidades.count()}")

    for cap in capacidades:
        # Convertir tamaño a GB para comparación
        tamanio_str = cap.tamaño.upper()
        if "TB" in tamanio_str:
            valor = int(tamanio_str.replace("TB", "").strip())
            tamanio_gb = valor * 1024
        elif "GB" in tamanio_str:
            tamanio_gb = int(tamanio_str.replace("GB", "").strip())
        else:
            tamanio_gb = None

        print(f"      - {cap.tamaño} (ID: {cap.id}, tamaño_gb: {tamanio_gb})")

# 2. Verificar el query que usa ANumberMatcher
print("\n" + "=" * 70)
print("2. Query de ANumberMatcher para 512GB:")
print("=" * 70 + "\n")

# Simular el query de ANumberMatcher
from productos.mapping.core.types import DeviceType

a_number = "A2816"
device_type = DeviceType.MAC_MINI
year = 2023
storage_gb = 512

# Query base (lo que hace ANumberMatcher._get_filtered_queryset)
models_query = Modelo.objects.filter(
    descripcion__icontains=a_number,
    tipo__iexact=device_type.value,
    año=year
)

print(f"Query: descripcion__icontains='{a_number}', tipo__iexact='{device_type.value}', año={year}")
print(f"Modelos encontrados: {models_query.count()}")

for modelo in models_query:
    print(f"\n  Modelo ID: {modelo.id} - {modelo.descripcion}")

    # Ahora buscar capacidades con 512GB
    capacidades_512 = Capacidad.objects.filter(
        modelo=modelo,
        activo=True
    )

    print(f"    Capacidades activas totales: {capacidades_512.count()}")

    for cap in capacidades_512:
        tamanio_str = cap.tamaño.upper()
        if "TB" in tamanio_str:
            valor = int(tamanio_str.replace("TB", "").strip())
            tamanio_gb = valor * 1024
        elif "GB" in tamanio_str:
            tamanio_gb = int(tamanio_str.replace("GB", "").strip())
        else:
            tamanio_gb = None

        match = "✓ MATCH" if tamanio_gb == storage_gb else ""
        print(f"      {cap.tamaño} -> {tamanio_gb}GB {match}")

# 3. Verificar el filtro de capacidad
print("\n" + "=" * 70)
print("3. ¿Qué hace CapacityFilter?")
print("=" * 70 + "\n")

print("CapacityFilter debe filtrar candidatos por storage_gb")
print(f"Buscando capacidades que coincidan con {storage_gb}GB...")

# Simular lo que hace el matcher: crear candidatos
from productos.mapping.matchers.a_number_matcher import ANumberMatcher
from productos.mapping.core.types import LikewizeInput, MappingContext

input_data = LikewizeInput(
    model_name="Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD",
    m_model="",
    capacity="512GB",
    device_price=None,
    brand_name="Apple"
)

context = MappingContext(input_data=input_data)

from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
extractor = MacBookFeatureExtractor()
features = extractor.extract(input_data, context)

print(f"\nFeatures extraídas:")
print(f"  device_type: {features.device_type}")
print(f"  a_number: {features.a_number}")
print(f"  storage_gb: {features.storage_gb}")
print(f"  year: {features.year}")

# Ejecutar ANumberMatcher
matcher = ANumberMatcher()
candidates = matcher.find_candidates(features, context)

print(f"\nCandidatos encontrados por ANumberMatcher: {len(candidates)}")
for cand in candidates:
    print(f"  - Capacidad ID: {cand.capacidad_id}")
    print(f"    Modelo: {cand.modelo_descripcion}")
    print(f"    Capacidad: {cand.capacidad_tamanio}")
    print(f"    Score: {cand.match_score:.2f}")

print("\n" + "=" * 70 + "\n")
