from django_tenants.utils import schema_context
from rest_framework.response import Response
from rest_framework import status

import logging

logger = logging.getLogger(__name__)  # Usa logging en vez de print

class SchemaAwareCreateMixin:
    def get_schema_context(self):
        user = self.request.user
        tenant_param = self.request.data.get("schema")
        es_super = getattr(user.global_role, "es_superadmin", False) or getattr(user.global_role, "es_empleado_interno", False)

        logger.info(f"[SCHEMA] Usuario: {user}, es_super: {es_super}, schema: {tenant_param}")

        return tenant_param if es_super and tenant_param else None

    def create(self, request, *args, **kwargs):
        schema = self.get_schema_context()

        def do_create():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(autor=request.user)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        if schema:
            with schema_context(schema):
                return do_create()
        else:
            return do_create()