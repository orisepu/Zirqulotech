from rest_framework import serializers
from productos.models.precios import PiezaTipo, ManoObraTipo

class PiezaTipoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PiezaTipo
        fields = ["id", "nombre", "categoria", "activo"]

    def validate_nombre(self, v: str):
        v = (v or "").strip()
        if not v:
            raise serializers.ValidationError("El nombre es obligatorio.")
        return v


class ManoObraTipoSerializer(serializers.ModelSerializer):
    # coste_por_hora se maneja como Decimal nativo
    class Meta:
        model = ManoObraTipo
        fields = ["id", "nombre", "descripcion", "coste_por_hora"]

    def validate_nombre(self, v: str):
        v = (v or "").strip()
        if not v:
            raise serializers.ValidationError("El nombre es obligatorio.")
        return v
