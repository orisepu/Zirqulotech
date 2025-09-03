from rest_framework import serializers
from ..models.documento import Documento
from ..models.oportunidad import Oportunidad
from django.conf import settings

class DocumentoSerializer(serializers.ModelSerializer):
    archivo = serializers.FileField(required=True)
    oportunidad = serializers.PrimaryKeyRelatedField(queryset=Oportunidad.objects.all())

    class Meta:
        model = Documento
        fields = [
            "id", "archivo", "tipo", "fecha_subida",
            "subido_por", "oportunidad"
        ]
        read_only_fields = ["id", "fecha_subida", "subido_por"]
    
    def get_archivo(self, obj):
        if obj.archivo:
            url = obj.archivo.url
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(url).replace('http://', 'https://')
            return settings.DOMAIN + url
        return None
