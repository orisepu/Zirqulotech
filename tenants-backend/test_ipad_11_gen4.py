"""
Debug: ¿Existe iPad Pro 11" generación 4 en la BD?
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django.db.models import Q
from productos.models.modelos import Modelo

print("\n" + "=" * 70)
print("iPad Pro 11\" en la base de datos")
print("=" * 70 + "\n")

ipads_11 = Modelo.objects.filter(
    Q(descripcion__icontains='iPad Pro') &
    (Q(descripcion__icontains='11') | Q(descripcion__icontains='11,0'))
).order_by('descripcion')

print(f"Total: {ipads_11.count()} modelos\n")

for m in ipads_11:
    print(f"  {m.descripcion}")

print("\n" + "=" * 70 + "\n")
