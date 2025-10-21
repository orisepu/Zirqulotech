-- Fix table ownership for migration 0049
-- This script grants proper ownership to zirqulotech_user for all tenant schemas

-- Fix for fnac schema (from error message)
ALTER TABLE fnac.checkouters_dispositivoreal OWNER TO zirqulotech_user;

-- Fix for public schema
ALTER TABLE IF EXISTS public.checkouters_dispositivoreal OWNER TO zirqulotech_user;

-- Grant all privileges on all tables in fnac schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fnac TO zirqulotech_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fnac TO zirqulotech_user;

-- Grant all privileges on all tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zirqulotech_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zirqulotech_user;

-- List all tenant schemas and fix ownership
-- You may need to add more schemas if you have additional tenants
-- Example:
-- ALTER TABLE another_tenant.checkouters_dispositivoreal OWNER TO zirqulotech_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA another_tenant TO zirqulotech_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA another_tenant TO zirqulotech_user;
