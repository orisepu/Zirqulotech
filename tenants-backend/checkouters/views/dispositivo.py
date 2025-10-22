from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework import filters
from django.utils import timezone
from datetime import timedelta
from django_filters.rest_framework import DjangoFilterBackend
from django_tenants.utils import schema_context
from rest_framework import viewsets, permissions, generics,serializers
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from productos.models.modelos import Modelo, Capacidad
from productos.models.precios import PrecioRecompra
from django.db.models import Q
from django.utils import timezone  # ya lo usas más abajo; si ya estaba, ignora esta línea
from ..models.dispositivo import Dispositivo, DispositivoReal
from ..models.oportunidad import Oportunidad,HistorialOportunidad
from ..serializers import DispositivoSerializer, DispositivoRealSerializer
from ..permissions import IsComercialOrAbove
from ..mixins.role_based_viewset import RoleBasedQuerysetMixin, RoleInfoMixin
from ..utils.role_filters import filter_queryset_by_role
from django.shortcuts import get_object_or_404
from ..serializers.producto import ModeloSerializer, CapacidadSerializer
import re
from rest_framework.pagination import PageNumberPagination

UUID_REGEX = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
NUM_REGEX = re.compile(r"^\d+$")

class ModeloPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 200

class DispositivoViewSet(RoleBasedQuerysetMixin, RoleInfoMixin, viewsets.ModelViewSet):
    serializer_class = DispositivoSerializer
    permission_classes = [IsComercialOrAbove]

    # Configuración para role-based filtering
    # Los dispositivos se filtran por la oportunidad a la que pertenecen
    enable_role_filtering = False  # Usaremos filtrado custom basado en oportunidad

    def get_queryset(self):
        """
        Retorna dispositivos filtrados por rol del usuario.
        Los dispositivos se filtran indirectamente a través de las oportunidades.
        """
        user = self.request.user
        schema = self.request.query_params.get("schema")

        # Base queryset
        base_qs = Dispositivo.objects.select_related('oportunidad', 'oportunidad__tienda', 'oportunidad__usuario')

        # Para dispositivos, filtramos por las oportunidades que el usuario puede ver
        # Esto es más complejo porque necesitamos filtrar por oportunidad
        from ..models.oportunidad import Oportunidad

        # Obtener IDs de oportunidades accesibles
        oportunidades_qs = Oportunidad.objects.all()
        oportunidades_filtradas = filter_queryset_by_role(
            queryset=oportunidades_qs,
            user=user,
            tenant_slug=schema,
            tienda_field="tienda",
            creador_field="usuario"
        )

        oportunidad_ids = oportunidades_filtradas.values_list('id', flat=True)

        # Filtrar dispositivos por oportunidades accesibles
        return base_qs.filter(oportunidad_id__in=oportunidad_ids)

    @staticmethod
    def _get_b2x_from_oportunidad(oportunidad):
        try:
            cliente = getattr(oportunidad, "cliente", None)
            canal = (getattr(cliente, "canal", None) or "").strip().upper()
            if canal in ("B2B", "B2C"):
                return canal
            tipo_cliente = (getattr(cliente, "tipo_cliente", None) or "").strip().lower()
            if tipo_cliente == "empresa":
                return "B2B"
            if tipo_cliente == "particular":
                return "B2C"
        except Exception:
            pass
        return "B2B"

    def _precio_recompra_vigente(self, capacidad_id: int, canal: str, fecha=None):
            """
            Devuelve el precio_neto vigente en PrecioRecompra para (capacidad, canal) a 'fecha'.
            Rango semiabierto [valid_from, valid_to).
            """
            if fecha is None:
                fecha = timezone.now()

            return (PrecioRecompra.objects
                    .filter(capacidad_id=capacidad_id, canal=canal, valid_from__lte=fecha)
                    .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=fecha))
                    .order_by('-valid_from')
                    .values_list('precio_neto', flat=True)
                    .first())

    def _asignar_precio_excelente_por_cliente(self, dispositivo, capacidad, tipo_cliente):
        """
        Asigna precio_orientativoexcelente leyendo del histórico PrecioRecompra.
        tipo_cliente: 'B2B' | 'B2C' (cualquier otro -> 'B2B' por defecto)
        """
        if not capacidad:
            return
        canal = 'B2B' if (tipo_cliente or '').strip().upper() == 'B2B' else 'B2C'
        precio = self._precio_recompra_vigente(capacidad.id, canal)
        if precio is not None:
            dispositivo.precio_orientativoexcelente = precio

    def get_queryset(self):
        return Dispositivo.objects.all()

    def perform_create(self, serializer):
        # Soporta tanto catálogo Apple (modelo+capacidad) como dispositivos personalizados
        modelo_id = self.request.data.get("modelo_id")
        capacidad_id = self.request.data.get("capacidad_id")
        dispositivo_personalizado_id = self.request.data.get("dispositivo_personalizado_id")

        # Obtener tenant del header X-Tenant para multi-tenancy
        tenant_slug = self.request.headers.get('X-Tenant')

        # Resolver oportunidad manualmente (puede ser ID numérico o UUID en multi-tenancy)
        oportunidad_value = self.request.data.get("oportunidad")
        oportunidad = None

        if oportunidad_value:

            # Si es numérico, buscar directamente en el schema del tenant
            if NUM_REGEX.match(str(oportunidad_value)):
                try:
                    if tenant_slug:
                        # En modo global admin, usar schema_context para acceder al tenant correcto
                        with schema_context(tenant_slug):
                            oportunidad = Oportunidad.objects.get(pk=int(oportunidad_value))
                    else:
                        # Modo tenant normal, el schema ya está configurado
                        oportunidad = Oportunidad.objects.get(pk=int(oportunidad_value))
                except Oportunidad.DoesNotExist:
                    raise ValidationError({"oportunidad": "Oportunidad no encontrada."})
            # Si es UUID, buscar por uuid field en el schema del tenant
            elif UUID_REGEX.match(str(oportunidad_value)):
                try:
                    if tenant_slug:
                        # En modo global admin, usar schema_context para acceder al tenant correcto
                        with schema_context(tenant_slug):
                            oportunidad = Oportunidad.objects.get(uuid=str(oportunidad_value))
                    else:
                        # Modo tenant normal, el schema ya está configurado
                        oportunidad = Oportunidad.objects.get(uuid=str(oportunidad_value))
                except Oportunidad.DoesNotExist:
                    raise ValidationError({"oportunidad": "Oportunidad no encontrada por UUID."})
            else:
                raise ValidationError({"oportunidad": "Formato de oportunidad inválido (debe ser ID o UUID)."})

        # Función interna para crear el dispositivo (se ejecutará en el schema correcto)
        def _crear_dispositivo():
            # Determinar si es Apple o personalizado
            es_apple = modelo_id and capacidad_id
            es_personalizado = dispositivo_personalizado_id

            if es_apple:
                # Flujo original Apple
                try:
                    modelo = Modelo.objects.get(id=modelo_id)
                    capacidad = Capacidad.objects.get(id=capacidad_id)
                except (Modelo.DoesNotExist, Capacidad.DoesNotExist):
                    raise ValidationError("Modelo o capacidad no encontrados.")

                # Guardar con oportunidad resuelta
                dispositivo = serializer.save(usuario=self.request.user, oportunidad=oportunidad)

                # Asignar precio_orientativoexcelente solo para Apple
                if oportunidad:
                    tipo_cliente = self._get_b2x_from_oportunidad(oportunidad)
                else:
                    tipo_cliente = "B2B"
                self._asignar_precio_excelente_por_cliente(dispositivo, capacidad, tipo_cliente)

            elif es_personalizado:
                # Flujo dispositivos personalizados
                # El serializer ya maneja dispositivo_personalizado_id
                # El precio_orientativo ya viene en el payload del frontend
                dispositivo = serializer.save(usuario=self.request.user, oportunidad=oportunidad)
            else:
                # No debería llegar aquí por validación del serializer, pero por si acaso
                raise ValidationError("Debe especificar modelo+capacidad o dispositivo_personalizado_id")

            # Establecer fecha de caducidad (común para ambos)
            if not dispositivo.fecha_caducidad:
                dispositivo.fecha_caducidad = dispositivo.fecha_creacion + timedelta(days=7)
            dispositivo.save()

            return dispositivo

        # Ejecutar la creación en el schema correcto
        if oportunidad_value and tenant_slug:
            # En modo global admin, ejecutar en el schema del tenant
            with schema_context(tenant_slug):
                dispositivo = _crear_dispositivo()
        else:
            # Modo tenant normal o sin oportunidad
            dispositivo = _crear_dispositivo()

    @action(detail=True, methods=['POST'])
    def recalcular_precio(self, request, pk=None):
        dispositivo = self.get_object()

        def get_factor(precio):
            if precio <= 100: return 0.76
            elif precio <= 200: return 0.77
            elif precio <= 300: return 0.79
            elif precio <= 400: return 0.81
            elif precio <= 500: return 0.83
            elif precio <= 750: return 0.85
            elif precio <= 1000: return 0.87
            elif precio <= 1250: return 0.88
            elif precio <= 1500: return 0.88
            else: return 0.89

        capacidad = dispositivo.capacidad
        if not capacidad or not capacidad.precio_estimado:
            return Response({"error": "No se puede calcular el precio sin capacidad o precio base."}, status=400)

        precio_base = capacidad.precio_estimado
        factor = get_factor(precio_base)
        if dispositivo.estado_valoracion == 'excelente':
            precio_orientativo = precio_base
        elif dispositivo.estado_valoracion == 'muy_bueno':
            precio_orientativo = round(precio_base * factor, 2)
        elif dispositivo.estado_valoracion == 'bueno':
            muy_bueno = precio_base * factor
            precio_orientativo = round(muy_bueno * factor, 2)
        else:
            precio_orientativo = None

        dias_caducidad = 7
        dispositivo.precio_orientativo = precio_orientativo
        dispositivo.fecha_valoracion = timezone.now()
        dispositivo.fecha_caducidad = dispositivo.fecha_valoracion + timedelta(days=dias_caducidad)
        dispositivo.save()

        return Response({
            "precio_orientativo": dispositivo.precio_orientativo,
            "fecha_valoracion": dispositivo.fecha_valoracion,
            "fecha_caducidad": dispositivo.fecha_caducidad
        })

    def actualizar_precio_excelente(self, dispositivo):
        capacidad = dispositivo.capacidad
        if not capacidad:
            return
        oportunidad = getattr(dispositivo, "oportunidad", None)
        tipo_cliente = self._get_b2x_from_oportunidad(oportunidad) if oportunidad else "B2B"
        self._asignar_precio_excelente_por_cliente(dispositivo, capacidad, tipo_cliente)
        dispositivo.save()

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        self.actualizar_precio_excelente(self.get_object())
        return response

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        self.actualizar_precio_excelente(self.get_object())
        return response

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return Response({"detail": "Autenticación requerida."}, status=status.HTTP_401_UNAUTHORIZED)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['GET'], permission_classes=[IsAuthenticated])
    def para_crear_oportunidad(self, request):
        dispositivos = Dispositivo.objects.filter(
            usuario=request.user,
            oportunidad__isnull=True,
            fecha_caducidad__gte=timezone.now()
        )
        serializer = self.get_serializer(dispositivos, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def crearvarios(self, request):
        dispositivos_data = request.data.get('dispositivos', [])
        oportunidad_global_id = request.data.get('oportunidad')
        oportunidad_global = None

        if oportunidad_global_id:
            try:
                oportunidad_global = Oportunidad.objects.get(id=oportunidad_global_id)
            except Oportunidad.DoesNotExist:
                return Response({"error": "Oportunidad global no encontrada."}, status=status.HTTP_400_BAD_REQUEST)

        if not dispositivos_data:
            return Response({"error": "No se proporcionaron dispositivos."}, status=status.HTTP_400_BAD_REQUEST)

        dispositivos = []
        for dispositivo_data in dispositivos_data:
            modelo_id = dispositivo_data.get("modelo")
            capacidad_id = dispositivo_data.get("capacidad")
            oportunidad_id = dispositivo_data.get("oportunidad") or (oportunidad_global.id if oportunidad_global else None)

            try:
                modelo = Modelo.objects.get(id=modelo_id)
                capacidad = Capacidad.objects.get(id=capacidad_id)
            except (Modelo.DoesNotExist, Capacidad.DoesNotExist):
                return Response({"error": "Modelo o capacidad no encontrados."}, status=status.HTTP_400_BAD_REQUEST)

            oportunidad = None
            if oportunidad_id:
                try:
                    oportunidad = Oportunidad.objects.get(id=oportunidad_id)
                except Oportunidad.DoesNotExist:
                    return Response({"error": f"Oportunidad {oportunidad_id} no encontrada."}, status=status.HTTP_400_BAD_REQUEST)

            payload = {
                "modelo": modelo,
                "capacidad": capacidad,
                "usuario": request.user,
            }
            for k in ("estado_valoracion", "imei", "numero_serie", "cantidad", "oportunidad"):
                if k in dispositivo_data:
                    payload[k] = dispositivo_data[k]
            if oportunidad:
                payload["oportunidad"] = oportunidad

            dispositivo = Dispositivo.objects.create(**payload)

            tipo_cliente = self._get_b2x_from_oportunidad(oportunidad) if oportunidad else "B2B"
            self._asignar_precio_excelente_por_cliente(dispositivo, capacidad, tipo_cliente)
            dispositivo.save()
            dispositivos.append(dispositivo)

        return Response(DispositivoSerializer(dispositivos, many=True).data, status=status.HTTP_201_CREATED)



class DispositivoRealCreateAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        tenant = request.data.get("tenant")
        if not tenant:
            return Response({"detail": "Schema (tenant) requerido"}, status=400)

        with schema_context(tenant):
            serializer = DispositivoRealSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
   
class DispositivosRealesDeOportunidadView(ListAPIView):
    serializer_class = DispositivoRealSerializer

    def get_queryset(self):
        raw = str(self.kwargs.get("oportunidad_id", "")).strip()
        qs = DispositivoReal.objects.select_related("modelo", "capacidad")

        if NUM_REGEX.fullmatch(raw):
            return qs.filter(oportunidad_id=int(raw))
        elif UUID_REGEX.fullmatch(raw):
            return qs.filter(oportunidad__uuid=raw.lower())

        return qs.none()
    
@permission_classes([IsAuthenticated])
class DispositivosRealesDeOportunidadGlobalView(ListAPIView):
    serializer_class = DispositivoRealSerializer

    def list(self, request, *args, **kwargs):
        tenant = self.kwargs["tenant"]
        uuid = self.kwargs["oportunidad_id"]
        user = request.user

        global_role = getattr(user, "global_role", None)
        if not global_role or not (global_role.es_superadmin or global_role.es_empleado_interno):
            return Response([], status=403)

        with schema_context(tenant):
            try:
                oportunidad = Oportunidad.objects.get(uuid=uuid)
            except Oportunidad.DoesNotExist:
                return Response({"detail": "Oportunidad no encontrada"}, status=404)
            
            queryset = DispositivoReal.objects.filter(oportunidad=oportunidad)
            serializer = self.get_serializer(queryset, many=True)
            return Response({
                "dispositivos": serializer.data,
                "estado": oportunidad.estado
            })
    
class ConfirmarRecepcionGlobalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, schema, oportunidad_id):
        user = request.user
        role = getattr(user, "global_role", None)

        if not role or not role.es_empleado_interno:
            return Response(
                {"detail": "Solo usuarios internos pueden confirmar recepción"},
                status=status.HTTP_403_FORBIDDEN
            )

        with schema_context(schema):
            oportunidad = get_object_or_404(Oportunidad, uuid=oportunidad_id)

            if not DispositivoReal.objects.filter(oportunidad=oportunidad).exists():
                return Response(
                    {"detail": "No se ha registrado ningún dispositivo real"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            estado_anterior = oportunidad.estado
            oportunidad.estado = "Check in OK"
            oportunidad.save()

            HistorialOportunidad.objects.create(
                oportunidad=oportunidad,
                tipo_evento="confirmacion",
                descripcion="Recepción confirmada por el usuario.",
                estado_anterior=oportunidad.estado,
                estado_nuevo="Check in OK",
                usuario=request.user
            )

            return Response({
                "detail": "Recepción confirmada correctamente en el tenant.",
                "nuevo_estado": oportunidad.estado
            })
    
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def borrar_dispositivo_real(request, tenant):
    imei = request.data.get("imei")
    numero_serie = request.data.get("numero_serie")
    oportunidad_id = request.data.get("oportunidad")

    if not oportunidad_id:
        return Response({"error": "Oportunidad requerida"}, status=400)

    with schema_context(tenant):
        oportunidad = get_object_or_404(Oportunidad, uuid=oportunidad_id)
        query = DispositivoReal.objects.filter(oportunidad=oportunidad)
        if imei:
            query = query.filter(imei=imei)
        if numero_serie:
            query = query.filter(numero_serie=numero_serie)

        eliminados, _ = query.delete()

        if eliminados == 0:
            return Response({"error": "No se encontró ningún dispositivo a eliminar"}, status=404)

        return Response({"detail": "Dispositivo eliminado"}, status=204)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_dispositivo_real_global(request, tenant):
    if not (
        getattr(request.user.global_role, "es_superadmin", False)
        or getattr(request.user.global_role, "es_empleado_interno", False)
    ):
        return Response({"error": "No autorizado"}, status=403)

    with schema_context(tenant):
        serializer = DispositivoRealSerializer(data=request.data)
        if serializer.is_valid():
            dispositivo = serializer.save()
            return Response(DispositivoRealSerializer(dispositivo).data, status=201)
        else:
            return Response(serializer.errors, status=400)

@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def actualizar_dispositivo_real_global(request, tenant, id):
    if not (
        getattr(request.user.global_role, "es_superadmin", False)
        or getattr(request.user.global_role, "es_empleado_interno", False)
    ):
        return Response({"error": "No autorizado"}, status=403)

    with schema_context(tenant):
        try:
            dispositivo = DispositivoReal.objects.get(id=id)
        except DispositivoReal.DoesNotExist:
            return Response({"detail": "Dispositivo no encontrado"}, status=404)

        serializer = DispositivoRealSerializer(dispositivo, data=request.data, partial=True)
        if serializer.is_valid():
            dispositivo = serializer.save()
            return Response(DispositivoRealSerializer(dispositivo).data)
        else:
            return Response(serializer.errors, status=400)
        
@api_view(['GET'])
def capacidades_por_modelo(request):
    modelo_id = request.GET.get('modelo')
    if modelo_id:
        capacidades = Capacidad.objects.filter(modelo_id=modelo_id)
    else:
        capacidades = Capacidad.objects.all()
    serializer = CapacidadSerializer(capacidades, many=True, context={"request": request})
    return Response(serializer.data)

class ModeloViewSet(viewsets.ModelViewSet):
    queryset = Modelo.objects.all()
    serializer_class = ModeloSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['tipo', 'marca']
    search_fields = ['descripcion', 'tipo', 'marca']
    pagination_class = ModeloPagination
    ordering_fields = '__all__'   # o lista de campos reales del modelo
    ordering = ['descripcion']
    
class CapacidadViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Capacidad.objects.all()
    serializer_class = CapacidadSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['modelo__descripcion']  # Esto es para búsqueda por texto

    def get_queryset(self):
        queryset = super().get_queryset()
        include_inactivos = self.request.query_params.get("include_inactive")
        if not (isinstance(include_inactivos, str) and include_inactivos.lower() in ("1", "true", "yes")):
            queryset = queryset.filter(activo=True)
        modelo_id = self.request.query_params.get("modelo")
        if modelo_id:
            queryset = queryset.filter(modelo_id=modelo_id)
        return queryset
