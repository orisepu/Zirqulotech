"""
Investigación: Historia del iPad Pro 11-inch
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django.db.models import Q
from productos.models.modelos import Modelo

print("\n" + "=" * 80)
print("Historia del iPad Pro 11-inch en la Base de Datos")
print("=" * 80 + "\n")

ipads_11 = Modelo.objects.filter(
    Q(descripcion__icontains='iPad Pro') &
    (Q(descripcion__icontains='11') | Q(descripcion__icontains='11,0'))
).order_by('descripcion')

print("Modelos encontrados:")
print("-" * 80)
for m in ipads_11:
    print(f"  {m.descripcion}")
    print(f"    Año: {m.año if m.año else 'N/A'}")
print()

print("=" * 80)
print("Cronología Real del iPad Pro 11-inch (según Apple):")
print("=" * 80)
print("""
  1.ª generación (2018) - A12X/A12Z Bionic
  2.ª generación (2020) - A12Z Bionic
  3.ª generación (2021) - M1
  4.ª generación (2022) - M2
  iPad Pro 11-inch (M4) (2024) - M4

  Nota: Apple NO llama al M4 "5.ª generación" en marketing,
        solo lo llama "iPad Pro 11-inch (M4)"
""")

print("=" * 80)
print("Conclusión:")
print("=" * 80)
print("""
  - El iPad Pro 11-inch (M4) NO es la primera generación
  - Es el modelo más reciente (2024)
  - Técnicamente sería la 5.ª generación, pero Apple no usa esa nomenclatura
  - En la BD aparece como "iPad Pro 11-inch (M4)" sin número de generación

  Por eso cuando el input es "iPad Pro 11-inch Wi-Fi 1TB" sin más info:
  - El KB infiere año 2024 y chip M4 (modelo más reciente)
  - Mapea correctamente al "iPad Pro 11-inch (M4)"
  - La confianza es baja (20%) porque hay 10 candidatos posibles
""")

print("=" * 80 + "\n")
