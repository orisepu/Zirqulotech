# productos/serializers/costespiezas.py
from rest_framework import serializers
from productos.models.precios import CostoPieza

class CostoPiezaListSerializer(serializers.ModelSerializer):
    modelo_id = serializers.IntegerField(read_only=True)
    capacidad_id = serializers.IntegerField(allow_null=True, required=False)
    pieza_tipo_id = serializers.IntegerField(source="pieza_tipo.id", read_only=True)
    pieza_tipo_nombre = serializers.CharField(source="pieza_tipo.nombre", read_only=True)
    mano_obra_tipo_id = serializers.IntegerField(source="mano_obra_tipo.id", read_only=True)
    mano_obra_tipo_nombre = serializers.CharField(source="mano_obra_tipo.nombre", read_only=True)
    mano_obra_tarifa_h = serializers.DecimalField(source="mano_obra_tipo.coste_por_hora", max_digits=10, decimal_places=4, read_only=True)

    class Meta:
        model = CostoPieza
        fields = [
            "id", "modelo_id", "capacidad_id",
            "pieza_tipo_id", "pieza_tipo_nombre",
            "mano_obra_tipo_id", "mano_obra_tipo_nombre", "mano_obra_tarifa_h",
            "coste_neto", "horas", "mano_obra_fija_neta",
            "proveedor", "valid_from", "valid_to",
        ]

class CostoPiezaSetSerializer(serializers.Serializer):
    modelo_id = serializers.IntegerField()
    capacidad_id = serializers.IntegerField(required=False, allow_null=True)
    pieza_tipo_id = serializers.IntegerField()
    mano_obra_tipo_id = serializers.IntegerField()
    horas = serializers.DecimalField(max_digits=10, decimal_places=4, required=False)  # 👈 ahora horas
    coste_neto = serializers.DecimalField(max_digits=12, decimal_places=2)
    mano_obra_fija_neta = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    proveedor = serializers.CharField(max_length=64, required=False, allow_blank=True)
    effective_at = serializers.DateTimeField(required=False)

    # Compat: acepta 'minutos' y lo convierte a horas si llega
    minutos = serializers.IntegerField(required=False)

    def validate(self, attrs):
        if "horas" not in attrs:
            mins = attrs.get("minutos")
            if mins is None:
                attrs["horas"] = 0
            else:
                from decimal import Decimal
                attrs["horas"] = (Decimal(mins) / Decimal("60"))
        return attrs
