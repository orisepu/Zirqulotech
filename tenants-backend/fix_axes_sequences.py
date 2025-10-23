#!/usr/bin/env python
"""
Script para arreglar las secuencias de django-axes desincronizadas.
Ejecutar con: python manage.py shell < fix_axes_sequences.py
"""
from django.db import connection

def fix_axes_sequences():
    """Reinicia las secuencias de autoincremento de django-axes"""
    with connection.cursor() as cursor:
        # Tablas de django-axes
        tables = [
            'axes_accesslog',
            'axes_accessattempt',
            'axes_accessfailurelog'
        ]

        for table in tables:
            try:
                # Reiniciar secuencia al valor máximo actual + 1
                cursor.execute(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', 'id'),
                        COALESCE(MAX(id), 1),
                        MAX(id) IS NOT NULL
                    ) FROM {table};
                """)
                result = cursor.fetchone()
                print(f"✓ Secuencia de {table} reiniciada a: {result[0]}")
            except Exception as e:
                print(f"✗ Error en {table}: {e}")

    print("\n✓ Secuencias de django-axes corregidas")
    print("Ahora puedes intentar iniciar sesión de nuevo en /admin/")

if __name__ == '__main__':
    fix_axes_sequences()
