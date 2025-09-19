from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from ..models import Objetivo, Tienda


def _parse_periodo(periodo: str, periodo_tipo: str) -> date:
    periodo_tipo = (periodo_tipo or "").lower()
    if periodo_tipo == "mes":
        try:
            year_str, month_str = periodo.split("-")
            year = int(year_str)
            month = int(month_str)
            return date(year, month, 1)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Formato de periodo mensual inválido. Use YYYY-MM.")
    elif periodo_tipo == "trimestre":
        try:
            year_part, quarter_part = periodo.split("-Q")
            year = int(year_part)
            quarter = int(quarter_part)
            if quarter not in (1, 2, 3, 4):
                raise ValueError
            month = (quarter - 1) * 3 + 1
            return date(year, month, 1)
        except (ValueError, TypeError):
            raise serializers.ValidationError("Formato de periodo trimestral inválido. Use YYYY-Q# (p.ej. 2024-Q1).")
    raise serializers.ValidationError("Tipo de periodo inválido. Use 'mes' o 'trimestre'.")


def _format_periodo(objetivo: Objetivo) -> str:
    if objetivo.periodo_tipo == "mes":
        return objetivo.periodo_inicio.strftime("%Y-%m")
    quarter = ((objetivo.periodo_inicio.month - 1) // 3) + 1
    return f"{objetivo.periodo_inicio.year}-Q{quarter}"


class ObjetivoSerializer(serializers.ModelSerializer):
    periodo = serializers.SerializerMethodField(read_only=True)
    periodo_input = serializers.CharField(write_only=True, required=False)
    tienda_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    usuario_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Objetivo
        fields = [
            "id",
            "tipo",
            "periodo_tipo",
            "periodo",
            "periodo_input",
            "tienda_id",
            "usuario_id",
            "objetivo_valor",
            "objetivo_operaciones",
        ]
        read_only_fields = ["id", "periodo"]

    def get_periodo(self, obj: Objetivo) -> str:
        return _format_periodo(obj)

    def validate(self, attrs):
        tipo = attrs.get("tipo", "")
        periodo_tipo = attrs.get("periodo_tipo", "")
        periodo_input = attrs.pop("periodo_input", None)

        if periodo_input:
            periodo_inicio = _parse_periodo(periodo_input, periodo_tipo)
        elif self.instance is not None:
            periodo_inicio = self.instance.periodo_inicio
        else:
            raise serializers.ValidationError({"periodo_input": "Debes indicar el periodo."})

        attrs["periodo_inicio"] = periodo_inicio

        if tipo == "tienda":
            tienda_id = attrs.get("tienda_id") or (self.instance.tienda_id if self.instance else None)
            if not tienda_id:
                raise serializers.ValidationError({"tienda_id": "Selecciona una tienda."})
            try:
                attrs["tienda"] = Tienda.objects.get(id=tienda_id)
            except Tienda.DoesNotExist as exc:
                raise serializers.ValidationError({"tienda_id": "Tienda no encontrada."}) from exc
            attrs["usuario"] = None
            attrs.pop("tienda_id", None)
        elif tipo == "usuario":
            usuario_id = attrs.get("usuario_id") or (self.instance.usuario_id if self.instance else None)
            if not usuario_id:
                raise serializers.ValidationError({"usuario_id": "Selecciona un usuario."})
            User = get_user_model()
            try:
                attrs["usuario"] = User.objects.get(id=usuario_id)
            except User.DoesNotExist as exc:
                raise serializers.ValidationError({"usuario_id": "Usuario no encontrado."}) from exc
            attrs["tienda"] = None
            attrs.pop("usuario_id", None)
        else:
            raise serializers.ValidationError({"tipo": "Tipo inválido."})

        attrs.setdefault("objetivo_valor", Decimal("0"))
        attrs.setdefault("objetivo_operaciones", 0)
        return attrs

    def create(self, validated_data):
        tienda = validated_data.pop("tienda", None)
        usuario = validated_data.pop("usuario", None)
        periodo_inicio = validated_data.pop("periodo_inicio")
        defaults = {
            "objetivo_valor": validated_data.get("objetivo_valor"),
            "objetivo_operaciones": validated_data.get("objetivo_operaciones"),
        }
        if validated_data["tipo"] == "tienda":
            objetivo, _ = Objetivo.objects.update_or_create(
                tipo="tienda",
                periodo_tipo=validated_data["periodo_tipo"],
                periodo_inicio=periodo_inicio,
                tienda=tienda,
                defaults=defaults,
            )
        else:
            objetivo, _ = Objetivo.objects.update_or_create(
                tipo="usuario",
                periodo_tipo=validated_data["periodo_tipo"],
                periodo_inicio=periodo_inicio,
                usuario=usuario,
                defaults=defaults,
            )
        return objetivo

    def update(self, instance: Objetivo, validated_data):
        for attr in ("objetivo_valor", "objetivo_operaciones"):
            if attr in validated_data:
                setattr(instance, attr, validated_data[attr])
        instance.save(update_fields=["objetivo_valor", "objetivo_operaciones", "actualizado_en"])
        return instance
