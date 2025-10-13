"""
Verificar si los modelos tienen campo a_number configurado
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models.modelos import Modelo

print("\n" + "=" * 70)
print("Verificando campo a_number en modelos Mac mini")
print("=" * 70 + "\n")

# Buscar Mac mini en la BD
mac_mini_models = Modelo.objects.filter(tipo__icontains="Mac mini")

print(f"Total Mac mini models encontrados: {mac_mini_models.count()}\n")

# Mostrar primeros 10
for modelo in mac_mini_models[:10]:
    print(f"ID: {modelo.id}")
    print(f"  Descripción: {modelo.descripcion}")
    print(f"  A-number: {modelo.a_number if hasattr(modelo, 'a_number') else 'Campo no existe'}")
    print(f"  Año: {modelo.año}")
    print()

print("=" * 70 + "\n")
