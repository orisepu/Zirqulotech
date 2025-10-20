from rest_framework import serializers
from productos.models import DispositivoPersonalizado, PrecioDispositivoPersonalizado


class PrecioDispositivoPersonalizadoSerializer(serializers.ModelSerializer):
    """
    Serializer para precios versionados de dispositivos personalizados.
    """
    class Meta:
        model = PrecioDispositivoPersonalizado
        fields = [
            'id',
            'dispositivo_personalizado',
            'canal',
            'precio_neto',
            'valid_from',
            'valid_to',
            'fuente',
            'tenant_schema',
            'changed_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class DispositivoPersonalizadoSerializer(serializers.ModelSerializer):
    """
    Serializer completo para dispositivos personalizados.
    Incluye precios vigentes del sistema de precios versionado.
    """
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    descripcion_completa = serializers.SerializerMethodField()

    # Precios vigentes actuales
    precio_b2b_vigente = serializers.SerializerMethodField()
    precio_b2c_vigente = serializers.SerializerMethodField()

    # Historial de precios (read-only)
    precios = PrecioDispositivoPersonalizadoSerializer(many=True, read_only=True)

    class Meta:
        model = DispositivoPersonalizado
        fields = [
            'id',
            'marca',
            'modelo',
            'capacidad',
            'tipo',
            'caracteristicas',
            'notas',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'activo',
            'descripcion_completa',
            'precio_b2b_vigente',
            'precio_b2c_vigente',
            'precios',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'precio_b2b_vigente', 'precio_b2c_vigente', 'precios']

    def get_descripcion_completa(self, obj):
        """Retorna la representación string del modelo"""
        return str(obj)

    def get_precio_b2b_vigente(self, obj):
        """Obtiene el precio B2B vigente actual"""
        precio = obj.get_precio_vigente('B2B')
        return float(precio) if precio else None

    def get_precio_b2c_vigente(self, obj):
        """Obtiene el precio B2C vigente actual"""
        precio = obj.get_precio_vigente('B2C')
        return float(precio) if precio else None

    def create(self, validated_data):
        """Asignar usuario que crea automáticamente"""
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class DispositivoPersonalizadoSimpleSerializer(serializers.ModelSerializer):
    """
    Versión simplificada para listados y selección en formularios.
    Solo incluye campos esenciales para identificación.
    """
    descripcion_completa = serializers.SerializerMethodField()

    class Meta:
        model = DispositivoPersonalizado
        fields = ['id', 'marca', 'modelo', 'capacidad', 'tipo', 'descripcion_completa']

    def get_descripcion_completa(self, obj):
        """Retorna la representación string del modelo"""
        return str(obj)
