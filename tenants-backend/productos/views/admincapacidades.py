from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Q, OuterRef, Subquery
from rest_framework import generics, status
from rest_framework.decorators import api_view
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from productos.models.modelos import Modelo, Capacidad
from productos.models.precios import PrecioRecompra
from productos.models.utils import set_precio_recompra, get_precio_vigente
from productos.serializers import (
    CapacidadAdminListSerializer,
    CapacidadAdminUpsertSerializer,
    ModeloCreateSerializer,
    ModeloMiniSerializer,
    SetPrecioRecompraSerializer,
    AjusteMasivoPreciosSerializer,
)


@api_view(["GET"])
def tipos_modelo(request):
    tipos = Modelo.objects.values_list("tipo", flat=True).distinct().order_by("tipo")
    return Response(tipos)


@api_view(["GET"])
def marcas_modelo(request):
    marcas = Modelo.objects.values_list("marca", flat=True).distinct().order_by("marca")
    return Response(marcas)


class ModeloSearchView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        if len(query) < 2:
            return Response([], status=status.HTTP_200_OK)

        base_qs = Modelo.objects.all()
        tipo = (request.query_params.get("tipo") or "").strip()
        marca = (request.query_params.get("marca") or "").strip()

        filtros = {}  # exact filters
        if tipo:
            filtros["tipo__iexact"] = tipo
        if marca:
            filtros["marca__iexact"] = marca

        qs = base_qs.filter(**filtros) if filtros else base_qs
        qs = qs.filter(
            Q(descripcion__icontains=query)
            | Q(tipo__icontains=query)  # Permite buscar por tipo (ej: "iMac", "iPhone")
            | Q(likewize_modelo__icontains=query)
            | Q(pantalla__icontains=query)
            | Q(procesador__icontains=query)
        )

        if filtros and not qs.exists():
            # Fallback: si los filtros exactos no encuentran nada, buscar sin filtros
            qs = base_qs.filter(
                Q(descripcion__icontains=query)
                | Q(tipo__icontains=query)  # Permite buscar por tipo (ej: "iMac", "iPhone")
                | Q(likewize_modelo__icontains=query)
                | Q(pantalla__icontains=query)
                | Q(procesador__icontains=query)
            )

        limit = request.query_params.get("limit")
        try:
            limit_val = max(1, min(int(limit or 25), 100))
        except (TypeError, ValueError):
            limit_val = 25

        resultados = qs.order_by("marca", "descripcion")[:limit_val]
        data = ModeloMiniSerializer(resultados, many=True).data
        return Response(data, status=status.HTTP_200_OK)


class AsociarLikewizeModeloView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk: int):
        modelo = get_object_or_404(Modelo, pk=pk)
        nombre = (request.data.get("nombre") or "").strip()
        if not nombre:
            return Response({"detail": "El nombre es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)

        if getattr(modelo, "likewize_modelo", "") != nombre:
            modelo.likewize_modelo = nombre
            modelo.save(update_fields=["likewize_modelo"])

        data = ModeloMiniSerializer(modelo).data
        return Response(data, status=status.HTTP_200_OK)


class ModeloCreateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        serializer = ModeloCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        modelo = serializer.save()
        data = ModeloMiniSerializer(modelo).data
        return Response(data, status=status.HTTP_201_CREATED)


class ModelosSinCapacidadesView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = Modelo.objects.filter(capacidades__isnull=True)

        tipo = (request.query_params.get("tipo") or "").strip()
        marca = (request.query_params.get("marca") or "").strip()
        q = (request.query_params.get("q") or "").strip()

        if tipo:
            qs = qs.filter(tipo__iexact=tipo)
        if marca:
            qs = qs.filter(marca__iexact=marca)
        if q:
            qs = qs.filter(
                Q(descripcion__icontains=q)
                | Q(likewize_modelo__icontains=q)
                | Q(pantalla__icontains=q)
                | Q(procesador__icontains=q)
            )

        qs = qs.order_by("marca", "tipo", "descripcion")
        data = ModeloMiniSerializer(qs, many=True).data
        return Response(data, status=status.HTTP_200_OK)


class AdminPageNumberPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


def annotate_capacidades(qs, fecha):
    """Añade anotaciones con precios vigentes B2B/B2C."""

    vigente_base = (
        PrecioRecompra.objects
        .filter(capacidad_id=OuterRef("pk"), valid_from__lte=fecha)
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=fecha))
        .order_by("-valid_from")
    )

    b2b_qs = vigente_base.filter(canal="B2B")
    b2c_qs = vigente_base.filter(canal="B2C")

    return qs.annotate(
        _b2b=Subquery(b2b_qs.values("precio_neto")[:1]),
        _b2b_from=Subquery(b2b_qs.values("valid_from")[:1]),
        _b2b_to=Subquery(b2b_qs.values("valid_to")[:1]),
        _b2b_src=Subquery(b2b_qs.values("fuente")[:1]),
        _b2c=Subquery(b2c_qs.values("precio_neto")[:1]),
        _b2c_from=Subquery(b2c_qs.values("valid_from")[:1]),
        _b2c_to=Subquery(b2c_qs.values("valid_to")[:1]),
        _b2c_src=Subquery(b2c_qs.values("fuente")[:1]),
    )


class CapacidadAdminMixin:
    """Utilidades compartidas entre las vistas admin de capacidades."""

    def _resolve_fecha(self):
        request = getattr(self, "request", None)
        if not request:
            return timezone.now()

        raw = None
        if request.method in ("POST", "PUT", "PATCH"):
            data = getattr(request, "data", None)
            if hasattr(data, "get"):
                raw = data.get("fecha")
        if not raw and hasattr(request, "query_params"):
            raw = request.query_params.get("fecha")
        return parse_datetime(raw or "") or timezone.now()

    def _annotate_single(self, capacidad: Capacidad):
        fecha = self._resolve_fecha()
        qs = annotate_capacidades(
            Capacidad.objects.select_related("modelo").filter(pk=capacidad.pk),
            fecha,
        )
        return qs.first() or capacidad


class CapacidadAdminListView(CapacidadAdminMixin, generics.ListCreateAPIView):
    """Lista y crea capacidades administradas."""

    serializer_class = CapacidadAdminListSerializer
    permission_classes = [IsAdminUser]
    pagination_class = AdminPageNumberPagination

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CapacidadAdminUpsertSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        qs = Capacidad.objects.select_related("modelo")
        params = self.request.query_params

        modelo_id = params.get("modelo_id")
        if modelo_id:
            qs = qs.filter(modelo_id=modelo_id)

        tipo = params.get("tipo")
        if tipo:
            qs = qs.filter(modelo__tipo=tipo)

        marca = params.get("marca")
        if marca:
            qs = qs.filter(modelo__marca=marca)

        activo = params.get("activo")
        if isinstance(activo, str):
            activo_clean = activo.lower()
            if activo_clean in ("true", "1"):
                qs = qs.filter(activo=True)
            elif activo_clean in ("false", "0"):
                qs = qs.filter(activo=False)

        q = (params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(modelo__descripcion__icontains=q)
                | Q(tamaño__icontains=q)
                | Q(modelo__procesador__icontains=q)
            )

        fecha = self._resolve_fecha()
        qs = annotate_capacidades(qs, fecha)

        ordering = params.get("ordering") or "modelo__descripcion,tamaño"
        for field in [f.strip() for f in ordering.split(",") if f.strip()]:
            qs = qs.order_by(field, *qs.query.order_by) if qs.query.order_by else qs.order_by(field)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = CapacidadAdminUpsertSerializer(
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        capacidad = serializer.save()
        annotated = self._annotate_single(capacidad)
        data = CapacidadAdminListSerializer(
            annotated,
            context=self.get_serializer_context(),
        ).data
        headers = self.get_success_headers(data)
        return Response(data, status=status.HTTP_201_CREATED, headers=headers)


class CapacidadAdminDetailView(CapacidadAdminMixin, generics.RetrieveUpdateAPIView):
    queryset = Capacidad.objects.select_related("modelo")
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CapacidadAdminUpsertSerializer
        return CapacidadAdminListSerializer

    def retrieve(self, request, *args, **kwargs):
        instancia = self.get_object()
        annotated = self._annotate_single(instancia)
        data = CapacidadAdminListSerializer(
            annotated,
            context=self.get_serializer_context(),
        ).data
        return Response(data)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instancia = self.get_object()
        serializer = CapacidadAdminUpsertSerializer(
            instancia,
            data=request.data,
            partial=partial,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        capacidad = serializer.save()
        annotated = self._annotate_single(capacidad)
        data = CapacidadAdminListSerializer(
            annotated,
            context=self.get_serializer_context(),
        ).data
        return Response(data)


class SetPrecioRecompraAdminView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        ser = SetPrecioRecompraSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        row = ser.save()
        return Response({
            "id": row.id,
            "capacidad_id": row.capacidad_id,
            "canal": row.canal,
            "precio_neto": str(row.precio_neto),
            "valid_from": row.valid_from.isoformat(),
            "valid_to": row.valid_to,
            "fuente": row.fuente,
            "tenant_schema": row.tenant_schema,
        }, status=status.HTTP_201_CREATED)


class AjusteMasivoPreciosView(APIView):
    """
    Ajusta precios de forma masiva aplicando un porcentaje.

    Ejemplos de uso:
    - Quitar IVA del 21%: porcentaje_ajuste=-17.355
    - Subir 10%: porcentaje_ajuste=10
    - Bajar 5%: porcentaje_ajuste=-5
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        from decimal import Decimal

        serializer = AjusteMasivoPreciosSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = serializer.validated_data
        porcentaje = validated['porcentaje_ajuste']
        canal = validated['canal']
        tipo = validated.get('tipo', '').strip()
        marca = validated.get('marca', '').strip()
        modelo_id = validated.get('modelo_id')
        fuente = validated.get('fuente', '').strip()
        effective_at = validated.get('effective_at') or timezone.now()
        tenant_schema = validated.get('tenant_schema', '').strip() or None

        # Construir queryset de capacidades a actualizar
        capacidades_qs = Capacidad.objects.select_related('modelo').all()

        if modelo_id:
            capacidades_qs = capacidades_qs.filter(modelo_id=modelo_id)
        if tipo:
            capacidades_qs = capacidades_qs.filter(modelo__tipo__iexact=tipo)
        if marca:
            capacidades_qs = capacidades_qs.filter(modelo__marca__iexact=marca)

        # Determinar canales a procesar
        canales_a_procesar = []
        if canal == 'AMBOS':
            canales_a_procesar = ['B2B', 'B2C']
        else:
            canales_a_procesar = [canal]

        # Recolectar precios a actualizar
        actualizaciones = []
        errores = []

        for capacidad in capacidades_qs:
            for canal_actual in canales_a_procesar:
                # Obtener precio vigente
                precio_vigente = get_precio_vigente(
                    capacidad_id=capacidad.id,
                    canal=canal_actual,
                    fecha=effective_at,
                    fuente=fuente or None,
                    tenant_schema=tenant_schema
                )

                if not precio_vigente:
                    continue

                # Calcular nuevo precio
                precio_actual = Decimal(str(precio_vigente.precio_neto))
                factor = Decimal('1') + (porcentaje / Decimal('100'))
                nuevo_precio = precio_actual * factor

                # Redondear a 2 decimales
                nuevo_precio = nuevo_precio.quantize(Decimal('0.01'))

                # Validar que el precio no sea negativo o cero
                if nuevo_precio <= 0:
                    errores.append({
                        'capacidad_id': capacidad.id,
                        'canal': canal_actual,
                        'precio_actual': str(precio_actual),
                        'error': f'El precio resultante ({nuevo_precio}) no es válido'
                    })
                    continue

                actualizaciones.append({
                    'capacidad': capacidad,
                    'canal': canal_actual,
                    'precio_actual': precio_actual,
                    'precio_nuevo': nuevo_precio,
                    'fuente': precio_vigente.fuente,
                })

        # Aplicar las actualizaciones
        precios_actualizados = []
        for act in actualizaciones:
            try:
                nuevo_registro = set_precio_recompra(
                    capacidad_id=act['capacidad'].id,
                    canal=act['canal'],
                    precio_neto=act['precio_nuevo'],
                    effective_at=effective_at,
                    fuente=act['fuente'],
                    tenant_schema=tenant_schema,
                    changed_by=request.user
                )
                precios_actualizados.append({
                    'capacidad_id': act['capacidad'].id,
                    'capacidad_nombre': f"{act['capacidad'].modelo.descripcion} - {act['capacidad'].tamaño}",
                    'canal': act['canal'],
                    'precio_anterior': str(act['precio_actual']),
                    'precio_nuevo': str(act['precio_nuevo']),
                    'diferencia': str(act['precio_nuevo'] - act['precio_actual']),
                })
            except Exception as e:
                errores.append({
                    'capacidad_id': act['capacidad'].id,
                    'canal': act['canal'],
                    'precio_actual': str(act['precio_actual']),
                    'error': str(e)
                })

        return Response({
            'mensaje': f'Ajuste masivo aplicado: {len(precios_actualizados)} precios actualizados',
            'total_actualizados': len(precios_actualizados),
            'total_errores': len(errores),
            'porcentaje_aplicado': str(porcentaje),
            'effective_at': effective_at.isoformat(),
            'precios_actualizados': precios_actualizados[:50],  # Limitar a 50 para no saturar la respuesta
            'errores': errores[:20],  # Limitar errores a 20
        }, status=status.HTTP_200_OK)
