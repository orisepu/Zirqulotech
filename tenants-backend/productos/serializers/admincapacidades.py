from rest_framework import serializers
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from productos.models.modelos import Modelo, Capacidad
from productos.models.utils import set_precio_recompra


class CapacidadAdminUpsertSerializer(serializers.ModelSerializer):
    """Serializer para crear/editar capacidades desde la consola admin."""

    modelo_id = serializers.PrimaryKeyRelatedField(
        queryset=Modelo.objects.all(),
        source="modelo",
        write_only=True,
    )

    class Meta:
        model = Capacidad
        fields = ("id", "modelo_id", "tamaño", "activo")
        read_only_fields = ("id",)

    def validate_tamaño(self, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("La capacidad es obligatoria.")
        return cleaned

    def validate(self, attrs):
        modelo = attrs.get("modelo") or getattr(self.instance, "modelo", None)
        tamaño = attrs.get("tamaño") or getattr(self.instance, "tamaño", None)
        if not modelo or not tamaño:
            return attrs

        qs = Capacidad.objects.filter(modelo=modelo, tamaño__iexact=tamaño)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe una capacidad con ese modelo y tamaño.")
        return attrs

class ModeloMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modelo
        fields = ("id", "descripcion", "tipo", "marca", "pantalla", "año", "procesador", "likewize_modelo")


class ModeloCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modelo
        fields = ("id", "descripcion", "tipo", "marca", "pantalla", "año", "procesador", "likewize_modelo")
        read_only_fields = ("id",)

    def validate_descripcion(self, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("La descripción es obligatoria.")
        return cleaned

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
            "id", "tamaño", "modelo", "activo",
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


class AjusteMasivoPreciosSerializer(serializers.Serializer):
    """
    Serializer para ajustar precios de forma masiva aplicando un porcentaje.

    Ejemplos de uso:
    - Para quitar IVA del 21%: porcentaje_ajuste = -17.355 (equivale a dividir por 1.21)
    - Para subir 10%: porcentaje_ajuste = 10
    - Para bajar 5%: porcentaje_ajuste = -5
    """
    porcentaje_ajuste = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        help_text="Porcentaje a aplicar (positivo para subir, negativo para bajar). Ej: -17.355 para quitar IVA 21%"
    )
    canal = serializers.ChoiceField(
        choices=[('B2B', 'B2B'), ('B2C', 'B2C'), ('AMBOS', 'Ambos')],
        default='AMBOS'
    )
    tipo = serializers.CharField(required=False, allow_blank=True, help_text="Filtrar por tipo de modelo (opcional)")
    marca = serializers.CharField(required=False, allow_blank=True, help_text="Filtrar por marca (opcional)")
    modelo_id = serializers.IntegerField(required=False, allow_null=True, help_text="Filtrar por modelo específico (opcional)")
    fuente = serializers.CharField(required=False, allow_blank=True, help_text="Filtrar por fuente (manual, likewize, etc)")
    effective_at = serializers.CharField(required=False, allow_blank=True, help_text="Fecha de aplicación (ISO 8601), por defecto ahora")
    tenant_schema = serializers.CharField(required=False, allow_blank=True)

    def validate_effective_at(self, value):
        if not value:
            return None
        dt = parse_datetime(value)
        if not dt:
            raise serializers.ValidationError("Fecha/hora inválida (usa ISO 8601).")
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt

    def validate_modelo_id(self, value):
        if value and not Modelo.objects.filter(id=value).exists():
            raise serializers.ValidationError("Modelo no encontrado.")
        return value
