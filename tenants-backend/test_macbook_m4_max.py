"""
Test: Modelos M4 Max en BD - ¿Cómo diferenciar configuraciones?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models.modelos import Modelo

print("\n" + "=" * 80)
print("Modelos MacBook Pro M4 Max en BD")
print("=" * 80 + "\n")

# Buscar por descripción (contains both "M4 Max" and "A3185")
from django.db.models import Q

modelos = Modelo.objects.filter(
    Q(descripcion__icontains='MacBook Pro') &
    Q(descripcion__icontains='M4 Max') &
    Q(descripcion__icontains='A3185')
).order_by('descripcion')

print(f"Encontrados: {modelos.count()} modelos\n")

for m in modelos:
    print(f"Descripción: {m.descripcion}")
    print(f"  Procesador: {m.procesador}")
    print(f"  Año: {m.año}")
    print(f"  Tipo: {m.tipo}")
    print(f"  Pantalla: {m.pantalla}")

    # Ver atributos del modelo
    print(f"  Atributos disponibles: {[f.name for f in m._meta.fields]}")
    print()

print("=" * 80 + "\n")
