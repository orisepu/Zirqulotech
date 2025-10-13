"""
Verificar modelos con A2816 y sus capacidades
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from productos.models.modelos import Modelo

print("\n" + "=" * 70)
print("Modelos con A2816 en la descripción")
print("=" * 70 + "\n")

models_with_a2816 = Modelo.objects.filter(descripcion__icontains="A2816", tipo__icontains="Mac mini")

for modelo in models_with_a2816:
    print(f"Modelo ID: {modelo.id}")
    print(f"  Descripción: {modelo.descripcion}")
    print(f"  Año: {modelo.año}")
    
    # Obtener capacidades activas
    capacidades = modelo.capacidades.filter(activo=True)
    print(f"  Capacidades activas: {capacidades.count()}")
    
    for cap in capacidades[:5]:
        print(f"    - {cap.tamaño} (ID: {cap.id})")
    
    print()

print("=" * 70 + "\n")
