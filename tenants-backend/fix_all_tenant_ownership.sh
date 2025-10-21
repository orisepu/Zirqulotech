#!/bin/bash
# Fix table ownership for all tenant schemas

DB_NAME="zirqulotech_db"
DB_USER="zirqulotech_user"
TABLE_NAME="checkouters_dispositivoreal"

echo "Finding all schemas with the table $TABLE_NAME..."

# Get all schemas that contain the table
SCHEMAS=$(sudo -u postgres psql -d $DB_NAME -t -c "
SELECT DISTINCT schemaname
FROM pg_tables
WHERE tablename = '$TABLE_NAME'
AND schemaname NOT IN ('pg_catalog', 'information_schema');
")

echo "Found schemas: $SCHEMAS"
echo ""

# Fix ownership for each schema
for SCHEMA in $SCHEMAS; do
    SCHEMA=$(echo $SCHEMA | xargs)  # Trim whitespace
    echo "Fixing ownership for schema: $SCHEMA"

    sudo -u postgres psql -d $DB_NAME -c "ALTER TABLE $SCHEMA.$TABLE_NAME OWNER TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA $SCHEMA TO $DB_USER;"
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA $SCHEMA TO $DB_USER;"

    echo "✓ Fixed $SCHEMA"
    echo ""
done

echo "All schemas fixed. Now retry the migration:"
echo "python manage.py migrate_schemas"
