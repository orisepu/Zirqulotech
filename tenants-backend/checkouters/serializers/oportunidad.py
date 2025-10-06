from rest_framework import serializers
from django.contrib.auth import get_user_model
from ..models.oportunidad import Oportunidad, ComentarioOportunidad, HistorialOportunidad
from ..models.tienda import Tienda
from .dispositivo import DispositivoSerializer
from .base import ClienteSimpleSerializer
from .documento import DocumentoSerializer
from django.db.models import Sum, F

User = get_user_model()

class TiendaMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tienda
        fields = ("id", "nombre")  # añade lo que te interese

class UsuarioMiniSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = ("id","name" )  # añade lo que te interese

    
    
class HistorialOportunidadSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = HistorialOportunidad
        fields = [
            'id',
            'tipo_evento',
            'descripcion',
            'estado_anterior',
            'estado_nuevo',
            'usuario_nombre',
            'fecha'
        ]

    def get_usuario_nombre(self, obj):
        if obj.usuario:
            return f"{obj.usuario.name} ".strip() or obj.usuario.email
        return "Sistema"


class ComentarioOportunidadSerializer(serializers.ModelSerializer):
    autor_nombre = serializers.CharField(source='autor.get_full_name', read_only=True)

    class Meta:
        model = ComentarioOportunidad
        fields = "__all__"
        read_only_fields = ['fecha', 'autor_nombre']


class OportunidadSerializer(serializers.ModelSerializer):
    facturas = serializers.SerializerMethodField()
    valor_total = serializers.SerializerMethodField()
    valor_total_final = serializers.SerializerMethodField()
    tienda = serializers.PrimaryKeyRelatedField(queryset=Tienda.objects.all(), required=False, write_only=True)
    usuario = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, write_only=True)

    # Info resuelta de salida (read-only)
    tienda_info = TiendaMiniSerializer(source="tienda", read_only=True)
    usuario_info = UsuarioMiniSerializer(source="usuario", read_only=True)

    dispositivos = DispositivoSerializer(
        many=True,
        read_only=True,
        source="dispositivos_oportunidad",
    )

    comentarios = ComentarioOportunidadSerializer(many=True, read_only=True)
    cliente = ClienteSimpleSerializer(read_only=True)
    hashid = serializers.SerializerMethodField()

    class Meta:
        model = Oportunidad
        fields = "__all__"
        read_only_fields = ["usuario", "fecha_creacion"]

    def get_hashid(self, obj):
        return obj.hashid

    def get_facturas(self, obj):
        return DocumentoSerializer(
            obj.documentos.filter(tipo="factura"), many=True, context=self.context
        ).data

    def get_valor_total(self, obj):
        """Calcula el valor total inicial (valoración del partner)"""
        agg = obj.dispositivos_oportunidad.aggregate(
            s=Sum(F('precio_orientativo') * F('cantidad'))
        )
        return float(agg["s"] or 0)

    def get_valor_total_final(self, obj):
        agg = obj.dispositivos_reales.aggregate(s=Sum("precio_final"))
        return float(agg["s"] or 0)
