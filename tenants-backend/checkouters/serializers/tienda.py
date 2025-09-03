from rest_framework import serializers
from ..models.tienda import Tienda
from django.contrib.auth import get_user_model

User = get_user_model()

class TiendaSerializer(serializers.ModelSerializer):
    responsable = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        allow_null=True,
        required=False
    )
    responsable_nombre = serializers.SerializerMethodField()
    responsable_email = serializers.SerializerMethodField()

    class Meta:
        model = Tienda
        fields = [
            "id", "nombre",
            "direccion_calle", "direccion_piso", "direccion_puerta",
            "direccion_cp", "direccion_poblacion", "direccion_provincia", "direccion_pais",
            "responsable", "responsable_nombre",'responsable_email'
        ]

    def get_responsable_nombre(self, obj):
        return obj.responsable.name if obj.responsable else None
    def get_responsable_email(self, obj):
        return obj.responsable.email if obj.responsable else None
