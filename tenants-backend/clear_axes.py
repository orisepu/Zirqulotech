#!/usr/bin/env python
"""
Script para limpiar completamente django-axes y reiniciar secuencias.
"""
from django.db import connection

def clear_and_reset_axes():
    """Limpia todas las tablas de django-axes y reinicia secuencias"""
    with connection.cursor() as cursor:
        tables = [
            'axes_accesslog',
            'axes_accessattempt',
            'axes_accessfailurelog'
        ]

        for table in tables:
            try:
                # Eliminar todos los registros
                cursor.execute(f"DELETE FROM {table};")
                print(f"✓ Tabla {table} limpiada")

                # Reiniciar secuencia a 1
                cursor.execute(f"ALTER SEQUENCE {table}_id_seq RESTART WITH 1;")
                print(f"✓ Secuencia {table}_id_seq reiniciada a 1")
            except Exception as e:
                print(f"✗ Error en {table}: {e}")

    print("\n✓ Django-axes completamente limpiado y reiniciado")
    print("Intenta iniciar sesión de nuevo en /admin/")

if __name__ == '__main__':
    clear_and_reset_axes()
