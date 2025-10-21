#!/bin/bash
# Comprehensive fix: Grant ownership of ALL tables in ALL schemas to zirqulotech_user
# This prevents permission errors during migrations

DB_NAME="zirqulotech_db"
DB_USER="zirqulotech_user"

echo "=========================================="
echo "Fixing table ownership for all schemas"
echo "=========================================="
echo ""

# Get all non-system schemas
SCHEMAS=$(sudo -u postgres psql -d $DB_NAME -t -c "
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY schema_name;
")

echo "Found schemas:"
echo "$SCHEMAS"
echo ""

# Fix ownership for each schema
for SCHEMA in $SCHEMAS; do
    SCHEMA=$(echo $SCHEMA | xargs)  # Trim whitespace

    if [ -z "$SCHEMA" ]; then
        continue
    fi

    echo "----------------------------------------"
    echo "Processing schema: $SCHEMA"
    echo "----------------------------------------"

    # Transfer ownership of ALL tables in the schema
    echo "Transferring table ownership..."
    sudo -u postgres psql -d $DB_NAME -c "
    DO \$\$
    DECLARE
        r RECORD;
    BEGIN
        FOR r IN
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = '$SCHEMA'
        LOOP
            EXECUTE 'ALTER TABLE ' || quote_ident('$SCHEMA') || '.' || quote_ident(r.tablename) || ' OWNER TO $DB_USER';
        END LOOP;
    END \$\$;
    "

    # Grant all privileges on tables and sequences
    echo "Granting privileges..."
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA \"$SCHEMA\" TO $DB_USER;" 2>/dev/null
    sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA \"$SCHEMA\" TO $DB_USER;" 2>/dev/null
    sudo -u postgres psql -d $DB_NAME -c "GRANT USAGE ON SCHEMA \"$SCHEMA\" TO $DB_USER;" 2>/dev/null

    echo "✓ Completed schema: $SCHEMA"
    echo ""
done

echo "=========================================="
echo "Verification"
echo "=========================================="
echo ""

# Verify checkouters tables ownership
echo "Checking ownership of key tables in fnac schema:"
sudo -u postgres psql -d $DB_NAME -c "
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'fnac'
AND tablename LIKE 'checkouters_%'
ORDER BY tablename
LIMIT 10;
"

echo ""
echo "=========================================="
echo "Fix completed successfully!"
echo "=========================================="
echo ""
echo "Now you can retry the migration:"
echo "  python manage.py migrate_schemas"
echo ""
