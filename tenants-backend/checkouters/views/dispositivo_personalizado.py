from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from ..models import DispositivoPersonalizado
from ..serializers.dispositivo_personalizado import (
    DispositivoPersonalizadoSerializer,
    DispositivoPersonalizadoSimpleSerializer
)


class IsAdmin(permissions.BasePermission):
    """
    Permiso personalizado: solo usuarios admin pueden crear/editar/eliminar.
    Usuarios no-admin pueden leer (GET, HEAD, OPTIONS).
    """
    def has_permission(self, request, view):
        # Métodos seguros (GET, HEAD, OPTIONS) permitidos para todos autenticados
        if request.method in permissions.SAFE_METHODS:
            return True
        # Métodos de escritura (POST, PUT, PATCH, DELETE) solo para admin
        return request.user and request.user.is_staff


class DispositivoPersonalizadoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de dispositivos personalizados (no-Apple).

    Endpoints:
    - GET /api/dispositivos-personalizados/ - Listar todos (solo activos)
    - POST /api/dispositivos-personalizados/ - Crear (solo admin)
    - GET /api/dispositivos-personalizados/{id}/ - Detalle
    - PUT/PATCH /api/dispositivos-personalizados/{id}/ - Actualizar (solo admin)
    - DELETE /api/dispositivos-personalizados/{id}/ - Eliminar (solo admin)
    - GET /api/dispositivos-personalizados/disponibles/ - Listado simple (todos autenticados)
    - POST /api/dispositivos-personalizados/{id}/calcular_oferta/ - Calcular oferta
    """

    queryset = DispositivoPersonalizado.objects.filter(activo=True)
    serializer_class = DispositivoPersonalizadoSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['tipo', 'marca']
    search_fields = ['marca', 'modelo', 'capacidad', 'notas']
    ordering_fields = ['marca', 'modelo', 'created_at', 'precio_base_b2b']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def disponibles(self, request):
        """
        Listado simplificado para formularios.
        Accesible para todos los usuarios autenticados (no solo admin).

        GET /api/dispositivos-personalizados/disponibles/
        """
        queryset = self.get_queryset()
        serializer = DispositivoPersonalizadoSimpleSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def calcular_oferta(self, request, pk=None):
        """
        Calcular oferta para un dispositivo personalizado.

        POST /api/dispositivos-personalizados/{id}/calcular_oferta/
        Body:
        {
            "estado": "excelente|bueno|malo",
            "canal": "B2B|B2C"
        }

        Response:
        {
            "dispositivo_id": 1,
            "estado": "bueno",
            "canal": "B2B",
            "precio_base": 450.00,
            "ajuste_aplicado": 80,
            "oferta": 360.00
        }
        """
        dispositivo = self.get_object()
        estado = request.data.get('estado', 'excelente')
        canal = request.data.get('canal', 'B2B')

        # Calcular oferta usando método del modelo
        oferta = dispositivo.calcular_oferta(estado, canal)

        # Obtener precio base y ajuste aplicado
        precio_base = float(dispositivo.precio_base_b2b) if canal == 'B2B' else float(dispositivo.precio_base_b2c)

        ajuste_map = {
            'excelente': dispositivo.ajuste_excelente,
            'bueno': dispositivo.ajuste_bueno,
            'malo': dispositivo.ajuste_malo,
        }
        ajuste_aplicado = ajuste_map.get(estado, 100)

        return Response({
            'dispositivo_id': dispositivo.id,
            'estado': estado,
            'canal': canal,
            'precio_base': precio_base,
            'ajuste_aplicado': ajuste_aplicado,
            'oferta': oferta,
        })
