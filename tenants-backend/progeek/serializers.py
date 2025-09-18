from rest_framework import serializers
from django_tenants.utils import get_tenant_model, schema_context
from .models import LoteGlobal, Reparacion, Valoracion, DispositivoAuditado,PlantillaCorreo,VARIABLES_POR_EVENTO
from checkouters.models.oportunidad import Oportunidad
from checkouters.models.tienda import Tienda
from django.contrib.auth import get_user_model
import json
from decimal import Decimal
User = get_user_model()



class FlexibleJSONField(serializers.JSONField):
    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Debe ser JSON válido.")
        return super().to_internal_value(data)

class TenantUpdateSerializer(serializers.ModelSerializer):
    # Validaciones concretas
    comision_pct = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0"), max_value=Decimal("100"),
        required=False
    )
    management_mode = serializers.ChoiceField(choices=[("default","default"),("autoadmin","autoadmin")], required=False)
    legal_overrides = FlexibleJSONField(required=False)
    acuerdo_empresas_pdf = serializers.FileField(required=False, allow_null=True)

    class Meta:
        model = get_tenant_model()
        fields = [
            'contacto_comercial', 'telefono_comercial', 'correo_comercial',
            'contacto_financiero', 'telefono_financiero', 'correo_financiero',
            'direccion_calle', 'direccion_piso', 'direccion_puerta',
            'direccion_cp', 'direccion_poblacion', 'direccion_provincia', 'direccion_pais',
            'numero_empleados', 'vertical', 'vertical_secundaria',
            'web_corporativa', 'facturacion_anual', 'numero_tiendas_oficiales',
            'goal', 'acuerdo_empresas', 'acuerdo_empresas_pdf', 'cif', 'management_mode', 'legal_namespace', 'legal_slug',
            'legal_overrides', 'comision_pct', 'solo_empresas',
        ]
        extra_kwargs = {f: {"required": False} for f in fields}

       
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email']  # Ajusta según tus campos

class LoteGlobalSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoteGlobal
        fields = "__all__"

class ReparacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reparacion
        fields = "__all__"

class ValoracionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Valoracion
        fields = "__all__"
        
class DispositivoAuditadoSerializer(serializers.ModelSerializer):
    fecha = serializers.DateTimeField(source="auditoria.fecha", read_only=True)
    tecnico_nombre = serializers.SerializerMethodField()

    class Meta:
        model = DispositivoAuditado
        fields = [
            "id",
            "dispositivo_id",
            "tenant_slug",
            "estado_fisico_cliente",
            "estado_funcional_cliente",
            "estado_fisico_real",
            "estado_funcional_real",
            "comentarios_auditor",
            "precio_estimado",
            "imei_confirmado",
            "auditoria",
            "fecha",
            "tecnico_nombre",
        ]

    def get_tecnico_nombre(self, obj):
        tecnico = getattr(obj.auditoria, "tecnico", None)
        return tecnico.get_full_name() if tecnico else "Desconocido"
    
class DatosRecogidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Oportunidad
        fields = [
            "calle", "numero", "piso", "puerta",
            "codigo_postal", "poblacion", "provincia",
            "persona_contacto", "telefono_contacto",
            "horario_recogida", "instrucciones","numero_seguimiento", "url_seguimiento"
        ]    
class ClienteMiniSerializer(serializers.Serializer):
    razon_social = serializers.CharField()
class TiendaMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tienda
        fields = ["nombre"]


class OportunidadPublicaSerializer(serializers.ModelSerializer):
    cliente = ClienteMiniSerializer()
    tienda =  TiendaMiniSerializer()
    valor_total = serializers.SerializerMethodField()
    valor_total_final = serializers.SerializerMethodField()

    class Meta:
        model = Oportunidad
        fields = ["id","uuid","hashid","nombre", "fecha_creacion", "estado", "cliente","tienda","valor_total","nombre","valor_total_final","numero_seguimiento"]

    def get_valor_total(self, obj):
        return sum(
        (d.precio_orientativo or 0) * (d.cantidad or 1)
        for d in obj.dispositivos_oportunidad.all()
    )
    def get_valor_total_final(self, obj):
        return sum(
            d.precio_final or 0
            for d in obj.dispositivos_reales.all()
        )


class PlantillaCorreoSerializer(serializers.ModelSerializer):
    variables_disponibles = serializers.SerializerMethodField()

    class Meta:
        model = PlantillaCorreo
        fields = ['id', 'evento', 'asunto', 'cuerpo', 'activo', 'variables_disponibles','destinatario']

    def get_variables_disponibles(self, obj):
        return VARIABLES_POR_EVENTO.get(obj.evento, [])
