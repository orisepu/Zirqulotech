from rest_framework import serializers
from ..models.cliente import Cliente, ComentarioCliente
from .oportunidad import OportunidadSerializer


class ComentarioClienteSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.CharField(source="autor.get_full_name", read_only=True)

    class Meta:
        model = ComentarioCliente
        fields = ["id", "texto", "autor", "autor_nombre", "fecha", "cliente"]
        read_only_fields = ["autor", "fecha"]

    def validate_cliente(self, value):
        if not value:
            raise serializers.ValidationError("El cliente es obligatorio.")
        return value


class ClienteSerializer(serializers.ModelSerializer):
    comentarios = ComentarioClienteSerializer(many=True, read_only=True)
    oportunidades = OportunidadSerializer(many=True, read_only=True)
    tienda_nombre = serializers.CharField(source="tienda.nombre", read_only=True)
    display_name = serializers.SerializerMethodField(read_only=True)
    identificador_fiscal = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Cliente
        fields = [
            "id", "canal", "tipo_cliente", "razon_social", "cif", "contacto", 
            "posicion", "nombre", "apellidos", "dni_nie", "nif", "nombre_comercial",
            "correo", "telefono", "tienda", "tienda_nombre", "contacto_financiero",
            "telefono_financiero", "correo_financiero", "numero_empleados",
            "direccion_calle", "direccion_piso", "direccion_puerta", "direccion_cp",
            "direccion_poblacion", "direccion_provincia", "direccion_pais",
            "aceptaciones", "vertical", "vertical_secundaria", "comentarios",
            "oportunidades", "display_name", "identificador_fiscal",
        ]
        read_only_fields = ["tienda_nombre", "comentarios", "oportunidades"]

    def validate(self, attrs):
        tipo = attrs.get("tipo_cliente") or getattr(self.instance, "tipo_cliente", None)
        canal = attrs.get("canal") or getattr(self.instance, "canal", None)

        requeridos = []
        if tipo == Cliente.TipoCliente.EMPRESA:
            requeridos = ["razon_social", "cif"]
        elif tipo == Cliente.TipoCliente.AUTONOMO:
            requeridos = ["nombre", "apellidos", "nif"]
        elif tipo == Cliente.TipoCliente.PARTICULAR:
            requeridos = ["nombre", "apellidos", "dni_nie"]

        missing = [f for f in requeridos if not (attrs.get(f) or getattr(self.instance, f, None))]
        if missing:
            raise serializers.ValidationError({f: "Campo obligatorio para este tipo de cliente." for f in missing})

        esperado = "b2c" if tipo == Cliente.TipoCliente.PARTICULAR else "b2b"
        if canal and canal != esperado:
            raise serializers.ValidationError({"canal": f"Para tipo_cliente={tipo}, el canal debe ser {esperado}."})
        attrs["canal"] = canal or esperado

        return attrs

    def get_display_name(self, obj: Cliente) -> str:
        if obj.tipo_cliente == Cliente.TipoCliente.EMPRESA and obj.razon_social:
            return obj.razon_social
        base = f"{(obj.nombre or '').strip()} {(obj.apellidos or '').strip()}".strip()
        if obj.tipo_cliente == Cliente.TipoCliente.AUTONOMO and obj.nombre_comercial:
            base = f"{base} · {obj.nombre_comercial}".strip(" ·")
        return base or "—"

    def get_identificador_fiscal(self, obj: Cliente) -> str:
        return obj.cif or obj.nif or obj.dni_nie or ""

class ClienteListSerializer(serializers.ModelSerializer):
    tienda_nombre = serializers.CharField(source="tienda.nombre", read_only=True)
    display_name = serializers.SerializerMethodField(read_only=True)
    identificador_fiscal = serializers.SerializerMethodField(read_only=True)
    oportunidades_count = serializers.IntegerField(read_only=True)
    valor_total_final = serializers.DecimalField(max_digits=24, decimal_places=0, read_only=True)

    class Meta:
        model = Cliente
        fields = [
            "id", "canal", "tipo_cliente", "display_name", "identificador_fiscal","contacto","posicion",
            "correo", "telefono", "tienda", "tienda_nombre","oportunidades_count", "valor_total_final",
        ]

    def get_display_name(self, obj: Cliente) -> str:
        if obj.tipo_cliente == Cliente.TipoCliente.EMPRESA and obj.razon_social:
            return obj.razon_social
        base = f"{(obj.nombre or '').strip()} {(obj.apellidos or '').strip()}".strip()
        if obj.tipo_cliente == Cliente.TipoCliente.AUTONOMO and obj.nombre_comercial:
            base = f"{base} · {obj.nombre_comercial}".strip(" ·")
        return base or "—"

    def get_identificador_fiscal(self, obj: Cliente) -> str:
        return obj.cif or obj.nif or obj.dni_nie or ""
