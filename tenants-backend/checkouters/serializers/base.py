from rest_framework import serializers
from ..models.cliente import Cliente

class ClienteSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'
