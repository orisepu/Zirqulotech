from rest_framework import serializers
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from productos.models.modelos import Modelo, Capacidad
from productos.models.utils import set_precio_recompra

class ModeloMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modelo
        fields = ("id", "descripcion", "tipo", "pantalla", "año", "procesador")

class CapacidadAdminListSerializer(serializers.ModelSerializer):
    modelo = ModeloMiniSerializer(read_only=True)
    # Campos anotados desde la vista (Subquery)
    precio_b2b = serializers.DecimalField(source="_b2b", max_digits=12, decimal_places=2, read_only=True)
    precio_b2c = serializers.DecimalField(source="_b2c", max_digits=12, decimal_places=2, read_only=True)
    b2b_valid_from = serializers.DateTimeField(source="_b2b_from", read_only=True)
    b2b_valid_to   = serializers.DateTimeField(source="_b2b_to", read_only=True)
    b2b_fuente     = serializers.CharField(source="_b2b_src", read_only=True)
    b2c_valid_from = serializers.DateTimeField(source="_b2c_from", read_only=True)
    b2c_valid_to   = serializers.DateTimeField(source="_b2c_to", read_only=True)
    b2c_fuente     = serializers.CharField(source="_b2c_src", read_only=True)

    class Meta:
        model = Capacidad
        fields = [
            "id", "tamaño", "modelo",
            "precio_b2b", "b2b_valid_from", "b2b_valid_to", "b2b_fuente",
            "precio_b2c", "b2c_valid_from", "b2c_valid_to", "b2c_fuente",
            
        ]

class SetPrecioRecompraSerializer(serializers.Serializer):
    capacidad_id = serializers.IntegerField()
    canal = serializers.ChoiceField(choices=[('B2B','B2B'), ('B2C','B2C')])
    precio_neto = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    effective_at = serializers.CharField(required=False, allow_blank=True)  # ISO8601 opcional
    fuente = serializers.CharField(required=False, default='manual', allow_blank=True)
    tenant_schema = serializers.CharField(required=False, allow_blank=True)

    def validate_capacidad_id(self, value):
        if not Capacidad.objects.filter(id=value).exists():
            raise serializers.ValidationError("Capacidad no encontrada.")
        return value

    def validate_effective_at(self, value):
        if not value:
            return None
        dt = parse_datetime(value)
        if not dt:
            raise serializers.ValidationError("Fecha/hora inválida (usa ISO 8601).")
        if timezone.is_naive(dt):
            # Asume timezone del proyecto
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt

    def create(self, validated):
        request = self.context.get("request")
        return set_precio_recompra(
            capacidad_id=validated["capacidad_id"],
            canal=validated["canal"],
            precio_neto=validated["precio_neto"],
            effective_at=validated.get("effective_at"),
            fuente=validated.get("fuente") or "manual",
            tenant_schema=(validated.get("tenant_schema") or None),
            changed_by=getattr(request, "user", None),
        )