from rest_framework import viewsets, status
from rest_framework.response import Response
from django_tenants.utils import schema_context
from django.contrib.auth import authenticate
from ..models.tienda import Tienda, UserTenantExtension
from ..serializers import TiendaSerializer


class TiendaViewSet(viewsets.ModelViewSet):
    serializer_class = TiendaSerializer

    def get_queryset(self):
        tenant_slug = self.request.query_params.get("schema") or getattr(getattr(self.request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            return Tienda.objects.none()

        with schema_context(tenant_slug):
            return Tienda.objects.all()
    
    def list(self, request, *args, **kwargs):
        tenant_slug = request.query_params.get("schema") or getattr(getattr(request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            return Response([], status=200)

        with schema_context(tenant_slug):
            queryset = self.filter_queryset(Tienda.objects.all())
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        
    def create(self, request, *args, **kwargs):
        tenant_slug = request.query_params.get("schema")
        if not tenant_slug:
            return Response({"detail": "Debe proporcionar el parámetro ?schema="}, status=400)

        with schema_context(tenant_slug):
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return Response(serializer.data, status=201)

    def update(self, request, *args, **kwargs):
        tenant_slug = request.query_params.get("schema")
        if not tenant_slug:
            return Response({"detail": "Debe proporcionar el parámetro ?schema="}, status=400)

        with schema_context(tenant_slug):
            return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        tenant_slug = request.query_params.get("schema")
        if not tenant_slug:
            return Response({"detail": "Debe proporcionar el parámetro ?schema="}, status=status.HTTP_400_BAD_REQUEST)

        # Verificar contraseña del usuario
        password = request.data.get('password')
        if not password:
            return Response(
                {"detail": "Se requiere contraseña para eliminar tienda"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Autenticar usuario con su contraseña
        user = authenticate(request, username=request.user.email, password=password)
        if not user:
            return Response(
                {"detail": "Contraseña incorrecta"},
                status=status.HTTP_403_FORBIDDEN
            )

        with schema_context(tenant_slug):
            instance = self.get_object()

            # Verificar que no tenga usuarios asignados
            usuarios_asignados = UserTenantExtension.objects.filter(tienda=instance).count()
            if usuarios_asignados > 0:
                return Response(
                    {"detail": "No se puede eliminar una tienda con usuarios asignados"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            instance.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
