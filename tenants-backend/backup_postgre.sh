#!/bin/bash
# backup_postgres.sh - Backup completo de PostgreSQL para Django

# Configuración
DB_NAME="tenantdb"
DB_USER="tenantuser"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="backups_postgres"
FECHA=$(date +%Y%m%d_%H%M%S)

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

echo "🐘 Iniciando backup de PostgreSQL..."

# Backup completo de la BD (formato custom comprimido)
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  -F c -b -v -f "$BACKUP_DIR/db_full_$FECHA.dump"

# Backup solo de datos (formato SQL legible)
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
  --data-only -f "$BACKUP_DIR/data_only_$FECHA.sql"

# Backup con Django fixtures (sin tablas problemáticas)
python manage.py dumpdata \
  --natural-foreign \
  --natural-primary \
  --exclude auth.permission \
  --exclude contenttypes \
  --exclude admin.logentry \
  --exclude sessions.session \
  --indent 2 \
  > "$BACKUP_DIR/django_data_$FECHA.json"

echo "✅ Backup completado:"
echo "   📦 $BACKUP_DIR/db_full_$FECHA.dump"
echo "   📄 $BACKUP_DIR/data_only_$FECHA.sql"
echo "   🐍 $BACKUP_DIR/django_data_$FECHA.json"
