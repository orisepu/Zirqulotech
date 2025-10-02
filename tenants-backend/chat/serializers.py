from rest_framework import serializers
from .models import Chat
from django.db import connection

class ChatSerializer(serializers.ModelSerializer):
    cliente = serializers.SerializerMethodField()
    cliente_nombre = serializers.CharField(source='cliente.name', read_only=True)
    schema = serializers.SerializerMethodField()
    ultimo_mensaje = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ['id', 'creado', 'cerrado', 'cliente', 'cliente_nombre', 'schema', 'ultimo_mensaje', 'ultimo_mensaje_fecha']

    def get_cliente(self, obj):
        return {
            "id": obj.cliente.id,
            "email": obj.cliente.email,
            "name": obj.cliente.name,
        }

    def get_schema(self, obj):
        return connection.schema_name  # ← esto devuelve el schema actual

    def get_ultimo_mensaje(self, obj):
        ultimo = obj.mensajes.order_by('-enviado').first()
        if ultimo:
            return ultimo.texto[:50] + ('...' if len(ultimo.texto) > 50 else '')
        return "Sin mensajes"