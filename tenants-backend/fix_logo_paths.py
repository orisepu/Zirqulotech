#!/usr/bin/env python
"""Script para arreglar las rutas de los logos de los tenants."""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_test_app.settings')
django.setup()

from django_test_app.companies.models import Company
import shutil

def fix_logo_paths():
    companies = Company.objects.exclude(logo='')

    for company in companies:
        if not company.logo:
            continue

        old_path = company.logo.path
        old_name = company.logo.name

        print(f"\nCompany ID {company.id} ({company.name}):")
        print(f"  BD: {old_name}")
        print(f"  Path: {old_path}")

        if not os.path.exists(old_path):
            print(f"  ⚠️  Archivo no existe en disco")
            continue

        # Determinar extensión del archivo
        _, ext = os.path.splitext(old_path)
        new_name = f"logos/tenant-{company.id}{ext.lower()}"
        new_path = os.path.join('/var/privado_documentos', new_name)

        print(f"  Nueva ruta: {new_path}")

        # Crear directorio si no existe
        os.makedirs(os.path.dirname(new_path), exist_ok=True)

        # Copiar archivo a nueva ubicación
        if old_path != new_path:
            if os.path.exists(new_path):
                print(f"  ⚠️  El destino ya existe, eliminando...")
                os.remove(new_path)

            shutil.copy2(old_path, new_path)
            print(f"  ✅ Archivo copiado")

            # Actualizar BD
            company.logo.name = new_name
            company.save(update_fields=['logo'])
            print(f"  ✅ BD actualizada")

            # Eliminar archivo antiguo y carpeta si está vacía
            try:
                os.remove(old_path)
                old_dir = os.path.dirname(old_path)
                if os.path.isdir(old_dir) and not os.listdir(old_dir):
                    os.rmdir(old_dir)
                    print(f"  ✅ Archivo antiguo eliminado")
            except Exception as e:
                print(f"  ⚠️  No se pudo eliminar archivo antiguo: {e}")
        else:
            print(f"  ℹ️  Ya está en la ruta correcta")

if __name__ == '__main__':
    print("🔧 Arreglando rutas de logos de tenants...\n")
    fix_logo_paths()
    print("\n✅ Proceso completado")
