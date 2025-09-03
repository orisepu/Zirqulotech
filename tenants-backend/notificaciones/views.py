from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Notificacion
from .serializers import NotificacionSerializer

class MisNotificacionesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notificaciones = Notificacion.objects.filter(usuario=request.user).order_by("-creada")
        return Response(NotificacionSerializer(notificaciones, many=True).data)

    def post(self, request):
        ids = request.data.get("ids", [])
        Notificacion.objects.filter(id__in=ids, usuario=request.user).update(leida=True)
        return Response({"ok": True})
