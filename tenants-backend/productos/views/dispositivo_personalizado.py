from rest_framework import viewsets, filters, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction
from productos.models import DispositivoPersonalizado, PrecioDispositivoPersonalizado
from productos.serializers import (
    DispositivoPersonalizadoSerializer,
    DispositivoPersonalizadoSimpleSerializer,
    PrecioDispositivoPersonalizadoSerializer
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
    ordering_fields = ['marca', 'modelo', 'created_at']
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
        Calcular oferta para un dispositivo personalizado usando precios versionados.

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
            "precio_vigente": 450.00,
            "ajuste_aplicado": 0.80,
            "oferta": 360.00
        }
        """
        dispositivo = self.get_object()
        estado = request.data.get('estado', 'excelente')
        canal = request.data.get('canal', 'B2B')

        # Obtener precio vigente
        precio_vigente = dispositivo.get_precio_vigente(canal)

        if not precio_vigente:
            return Response(
                {'error': f'No hay precio vigente para canal {canal}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calcular oferta usando método del modelo
        oferta = dispositivo.calcular_oferta(estado, canal)

        # Ajustes estándar por estado
        ajuste_map = {
            'excelente': 1.0,    # 100%
            'bueno': 0.80,       # 80%
            'malo': 0.50,        # 50%
        }
        ajuste_aplicado = ajuste_map.get(estado, 1.0)

        return Response({
            'dispositivo_id': dispositivo.id,
            'estado': estado,
            'canal': canal,
            'precio_vigente': float(precio_vigente),
            'ajuste_aplicado': ajuste_aplicado,
            'oferta': oferta,
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdmin])
    def set_precio(self, request, pk=None):
        """
        Crear o actualizar precio para un dispositivo personalizado.
        Invalida el precio anterior (si existe) y crea uno nuevo.

        POST /api/dispositivos-personalizados/{id}/set_precio/
        Body:
        {
            "canal": "B2B|B2C",
            "precio_neto": 450.00,
            "valid_from": "2025-01-20T00:00:00Z",  // opcional, default: now
            "fuente": "manual"  // opcional
        }

        Response: PrecioDispositivoPersonalizado creado
        """
        dispositivo = self.get_object()
        canal = request.data.get('canal')
        precio_neto = request.data.get('precio_neto')

        if not canal or precio_neto is None:
            return Response(
                {'error': 'Se requieren canal y precio_neto'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if canal not in ['B2B', 'B2C']:
            return Response(
                {'error': 'Canal debe ser B2B o B2C'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            precio_neto = float(precio_neto)
            if precio_neto < 0:
                return Response(
                    {'error': 'El precio debe ser mayor o igual a 0'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ValueError:
            return Response(
                {'error': 'Precio inválido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parsear valid_from o usar now()
        valid_from_str = request.data.get('valid_from')
        if valid_from_str:
            from dateutil import parser
            try:
                valid_from = parser.isoparse(valid_from_str)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Formato de fecha inválido. Usar ISO 8601'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            valid_from = timezone.now()

        fuente = request.data.get('fuente', 'manual')

        # Usar transacción para invalidar precio anterior y crear nuevo
        with transaction.atomic():
            # Invalidar precio anterior (si existe)
            precio_anterior = (PrecioDispositivoPersonalizado.objects
                               .filter(dispositivo_personalizado=dispositivo, canal=canal, valid_to__isnull=True)
                               .first())

            if precio_anterior:
                precio_anterior.valid_to = valid_from
                precio_anterior.save()

            # Crear nuevo precio
            nuevo_precio = PrecioDispositivoPersonalizado.objects.create(
                dispositivo_personalizado=dispositivo,
                canal=canal,
                precio_neto=precio_neto,
                valid_from=valid_from,
                fuente=fuente,
                changed_by=request.user
            )

        serializer = PrecioDispositivoPersonalizadoSerializer(nuevo_precio)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def historial_precios(self, request, pk=None):
        """
        Obtener historial completo de precios de un dispositivo personalizado.

        GET /api/dispositivos-personalizados/{id}/historial_precios/
        Query params:
        - canal: B2B|B2C (opcional, filtra por canal)

        Response: Lista de precios ordenados por valid_from desc
        """
        dispositivo = self.get_object()
        canal = request.query_params.get('canal')

        precios = PrecioDispositivoPersonalizado.objects.filter(
            dispositivo_personalizado=dispositivo
        )

        if canal:
            precios = precios.filter(canal=canal)

        precios = precios.order_by('-valid_from')

        serializer = PrecioDispositivoPersonalizadoSerializer(precios, many=True)
        return Response(serializer.data)
