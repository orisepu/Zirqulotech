# django_test_app/routers.py

class TenantOnlyRouter:
    """
    Evita que ciertas apps se migren en el schema public.
    """
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        from django.db import connection

        # Lista de apps que solo deben migrarse en tenants
        tenant_only_apps = {"checkouters"}

        if app_label in tenant_only_apps:
            # ❌ No migrar en public
            return connection.schema_name != "public"
        return None
