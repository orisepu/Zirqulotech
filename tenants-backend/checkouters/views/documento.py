from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
import logging
from rest_framework.views import APIView
from rest_framework import viewsets, permissions, generics,serializers
from ..models.documento import Documento
from ..models.oportunidad import HistorialOportunidad
from ..serializers import DocumentoSerializer

logger = logging.getLogger(__name__)


class SubirFacturaView(generics.CreateAPIView):
    serializer_class = DocumentoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        oportunidad = serializer.validated_data.get("oportunidad")
        if not oportunidad:
            raise serializers.ValidationError("Se requiere una oportunidad válida.")

        serializer.save(subido_por=self.request.user, tipo="factura")
        
        HistorialOportunidad.objects.create(
            oportunidad=oportunidad,
            tipo_evento="factura_subida",
            descripcion=f"{self.request.user.get_full_name() or self.request.user.email} subió una factura",
            usuario=self.request.user
        )
        
        if oportunidad.estado == "Pendiente factura":
            estado_anterior = oportunidad.estado
            oportunidad.estado = "Factura recibida"
            oportunidad.save(update_fields=["estado"])
            
            HistorialOportunidad.objects.create(
                oportunidad=oportunidad,
                tipo_evento="cambio_estado",
                descripcion=f"Estado cambiado de {estado_anterior} a Factura recibida",
                estado_anterior=estado_anterior,
                estado_nuevo="Factura recibida",
                usuario=self.request.user
            )

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def descargar_documento(request, documento_id):
    doc = get_object_or_404(Documento, id=documento_id)

    try:
        if doc.oportunidad:
            pass
        elif doc.dispositivo and doc.dispositivo.lote:
            pass
        else:
            raise Http404("Documento sin relación válida.")
    except Exception as e:
        raise Http404("Documento inválido")

    return FileResponse(
        doc.archivo.open(),
        as_attachment=True,
        filename=doc.nombre_original
    )
