from rest_framework import serializers
from ..models import DispositivoPersonalizado


class DispositivoPersonalizadoSerializer(serializers.ModelSerializer):
    """
    Serializer completo para dispositivos personalizados.
    Incluye validaciones y asignación automática de created_by.
    """
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    descripcion_completa = serializers.SerializerMethodField()

    class Meta:
        model = DispositivoPersonalizado
        fields = [
            'id',
            'marca',
            'modelo',
            'capacidad',
            'tipo',
            'precio_base_b2b',
            'precio_base_b2c',
            'ajuste_excelente',
            'ajuste_bueno',
            'ajuste_malo',
            'caracteristicas',
            'notas',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'activo',
            'descripcion_completa',
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_descripcion_completa(self, obj):
        """Retorna la representación string del modelo"""
        return str(obj)

    def validate(self, data):
        """
        Validaciones personalizadas:
        - Precios deben ser mayores o iguales a 0
        - Ajustes deben estar entre 0 y 100
        """
        # Validar precios positivos
        precio_b2b = data.get('precio_base_b2b', 0)
        precio_b2c = data.get('precio_base_b2c', 0)

        if precio_b2b < 0:
            raise serializers.ValidationError(
                {"precio_base_b2b": "El precio B2B debe ser mayor o igual a 0"}
            )
        if precio_b2c < 0:
            raise serializers.ValidationError(
                {"precio_base_b2c": "El precio B2C debe ser mayor o igual a 0"}
            )

        # Validar ajustes entre 0-100
        ajustes = {
            'ajuste_excelente': data.get('ajuste_excelente', 100),
            'ajuste_bueno': data.get('ajuste_bueno', 80),
            'ajuste_malo': data.get('ajuste_malo', 50),
        }

        for field_name, valor in ajustes.items():
            if not (0 <= valor <= 100):
                raise serializers.ValidationError(
                    {field_name: f"{field_name} debe estar entre 0 y 100"}
                )

        return data

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
