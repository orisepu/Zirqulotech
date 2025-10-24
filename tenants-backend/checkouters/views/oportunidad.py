import math

from rest_framework import viewsets, serializers, status
from rest_framework import generics, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django_tenants.utils import schema_context
from checkouters.mixins import SchemaAwareCreateMixin
from checkouters.mixins.role_based_viewset import RoleBasedQuerysetMixin, RoleInfoMixin
import re
from rest_framework.pagination import PageNumberPagination

from ..models.oportunidad import Oportunidad, HistorialOportunidad,ComentarioOportunidad
from ..models.dispositivo import Dispositivo, DispositivoReal
from ..serializers import OportunidadSerializer, HistorialOportunidadSerializer,ComentarioOportunidadSerializer
from ..estado_oportunidad import obtener_transiciones
from ..permissions import IsComercialOrAbove
from ..utils.role_filters import filter_queryset_by_role, can_user_edit_object
from progeek.models import RolPorTenant
from progeek.utils import enviar_correo

UUID_REGEX = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
NUM_REGEX = re.compile(r"^\d+$")




class OportunidadViewSet(RoleBasedQuerysetMixin, RoleInfoMixin, viewsets.ModelViewSet):
    serializer_class = OportunidadSerializer
    permission_classes = [IsComercialOrAbove]
    tanstack_page_index_param = "pageIndex"
    tanstack_page_size_param = "pageSize"

    # Configuración para el mixin de role-based filtering
    tienda_field = "tienda"
    creador_field = "usuario"  # Oportunidades usan 'usuario' en lugar de 'creado_por'

    def list(self, request, *args, **kwargs):
        page_index_raw = request.query_params.get(self.tanstack_page_index_param)
        page_size_raw = request.query_params.get(self.tanstack_page_size_param)

        if page_index_raw is not None or page_size_raw is not None:
            queryset = self.filter_queryset(self.get_queryset())

            try:
                page_index = max(0, int(page_index_raw)) if page_index_raw is not None else 0
            except (TypeError, ValueError):
                page_index = 0

            default_page_size = getattr(self.pagination_class, 'page_size', None) or 20
            try:
                requested_page_size = int(page_size_raw) if page_size_raw is not None else default_page_size
            except (TypeError, ValueError):
                requested_page_size = default_page_size

            page_size = max(1, requested_page_size)
            max_page_size = getattr(self.pagination_class, 'max_page_size', None)
            if max_page_size is not None:
                page_size = min(page_size, max_page_size)

            total = queryset.count()
            start = page_index * page_size
            end = start + page_size
            page_queryset = queryset[start:end]

            serializer = self.get_serializer(page_queryset, many=True)
            page_count = math.ceil(total / page_size) if page_size else 0

            return Response(
                {
                    "results": serializer.data,
                    "pageIndex": page_index,
                    "pageSize": page_size,
                    "total": total,
                    "pageCount": page_count,
                }
            )

        return super().list(request, *args, **kwargs)

    def get_object(self):
        lookup_value = self.kwargs.get(self.lookup_field)
        qs = self.get_queryset()

        if lookup_value is None:
            return super().get_object()

        s = str(lookup_value)
        if NUM_REGEX.fullmatch(s):
            return get_object_or_404(qs, pk=int(s))
        if UUID_REGEX.fullmatch(s):
            return get_object_or_404(qs, uuid=s.lower())

        return get_object_or_404(qs, pk=-1)
    
    def get_queryset(self):
        """
        Retorna queryset filtrado por rol y parámetros adicionales.
        Usa RoleBasedQuerysetMixin para filtrado automático por permisos.
        """
        user = self.request.user
        schema = self.request.query_params.get("schema")

        # Base queryset con optimizaciones
        base_qs = (
            Oportunidad.objects.select_related("cliente", "tienda", "usuario")
            .prefetch_related("comentarios", "dispositivos_oportunidad", "dispositivos_reales")
        )

        # Filtros adicionales de búsqueda
        cliente = self.request.query_params.get("cliente") or ""
        fecha_inicio = self.request.query_params.get("fecha_inicio")
        fecha_fin = self.request.query_params.get("fecha_fin")
        usuario_id = self.request.query_params.get("usuario")

        estados = self.request.query_params.getlist("estado")
        if len(estados) == 1 and "," in estados[0]:
            estados = [e.strip() for e in estados[0].split(",") if e.strip()]

        # Aplicar filtros de búsqueda
        if estados:
            base_qs = base_qs.filter(estado__in=estados)
        if cliente:
            base_qs = base_qs.filter(cliente__razon_social__icontains=cliente)
        if fecha_inicio:
            base_qs = base_qs.filter(fecha_creacion__gte=fecha_inicio)
        if fecha_fin:
            base_qs = base_qs.filter(fecha_creacion__lte=fecha_fin)
        if usuario_id:
            base_qs = base_qs.filter(usuario_id=usuario_id)

        base_qs = base_qs.order_by("-fecha_creacion")

        # Aplicar filtrado basado en roles usando el mixin
        # El mixin maneja automáticamente:
        # - Superadmin/soporte: ve todo
        # - Manager (general): ve todo
        # - Manager (regional): ve tiendas gestionadas
        # - Store Manager: ve su tienda
        # - Comercial:
        #   * Sin usuario_id: ve TODAS las oportunidades de su tienda (solo lectura)
        #   * Con usuario_id: respeta el filtro manual (ej: dashboard muestra solo las suyas)
        #   pero solo puede editar las que creó (verificado en perform_update/destroy)

        # Si se especificó usuario_id explícito, no aplicar filtro automático adicional
        # para respetar el filtro manual (importante para dashboards de comerciales)
        use_read_only_comercial = not bool(usuario_id)

        return filter_queryset_by_role(
            queryset=base_qs,
            user=user,
            tenant_slug=schema,
            tienda_field=self.tienda_field,
            creador_field=self.creador_field,
            read_only_for_comercial=use_read_only_comercial
        )

    def perform_create(self, serializer):
        """
        Crea una oportunidad asignando automáticamente usuario y tienda según el rol.

        Comportamiento por rol:
        - Comercial/Store Manager: Oportunidad asignada a su tienda
        - Manager (general): Oportunidad sin tienda específica (o seleccionada en el form)
        - Manager (regional): Oportunidad en una de sus tiendas gestionadas
        """
        user = self.request.user
        schema = self.request.data.get("schema")
        cliente_id = self.request.data.get("cliente")
        tienda_id_request = self.request.data.get("tienda")  # Tienda seleccionada en el form

        if not cliente_id:
            raise serializers.ValidationError({"cliente": "Este campo es obligatorio."})

        # Superadmin/soporte: puede crear en cualquier schema/tienda
        es_super = (
            getattr(getattr(user, "global_role", None), "es_superadmin", False)
            or getattr(getattr(user, "global_role", None), "es_empleado_interno", False)
        )

        if es_super and schema:
            with schema_context(schema):
                serializer.save(usuario=user, cliente_id=cliente_id, tienda_id=tienda_id_request)
                return

        # Obtener rol del usuario
        tenant_slug = getattr(self.request.tenant, "schema_name", "").lower()
        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug)
        except RolPorTenant.DoesNotExist:
            raise serializers.ValidationError("No tienes permisos para crear oportunidades.")

        # Auditor no puede crear (solo lectura)
        if rol.rol == "auditor":
            raise serializers.ValidationError("Los auditores solo tienen permisos de lectura.")

        # Manager (general): puede crear sin tienda específica o en cualquier tienda
        if rol.es_manager() and rol.gestiona_todas_tiendas():
            serializer.save(usuario=user, cliente_id=cliente_id, tienda_id=tienda_id_request)
            return

        # Manager (regional): puede crear en tiendas gestionadas
        if rol.es_manager():
            if tienda_id_request and tienda_id_request in rol.managed_store_ids:
                serializer.save(usuario=user, cliente_id=cliente_id, tienda_id=tienda_id_request)
                return
            # Si no especificó tienda, usar la primera gestionada
            if rol.managed_store_ids:
                serializer.save(usuario=user, cliente_id=cliente_id, tienda_id=rol.managed_store_ids[0])
                return
            raise serializers.ValidationError("No tienes tiendas asignadas para crear oportunidades.")

        # Store Manager y Comercial: oportunidad en su tienda
        if rol.es_store_manager() or rol.es_comercial():
            if not rol.tienda_id:
                raise serializers.ValidationError("Debes tener una tienda asignada para crear oportunidades.")
            serializer.save(usuario=user, tienda_id=rol.tienda_id, cliente_id=cliente_id)
            return

        raise serializers.ValidationError("No tienes permisos para crear oportunidades.")

    def perform_update(self, serializer):
        """
        Actualiza una oportunidad validando permisos de edición.

        Los comerciales solo pueden editar oportunidades que ellos crearon.
        Store Managers y Managers pueden editar cualquier oportunidad en su ámbito.
        """
        instance = self.get_object()
        user = self.request.user
        nuevo_estado = self.request.data.get("estado")
        schema = self.request.data.get("schema")
        es_super = (
            getattr(getattr(user, "global_role", None), "es_superadmin", False)
            or getattr(getattr(user, "global_role", None), "es_empleado_interno", False)
        )

        # Verificar permisos de edición (importante para comerciales)
        if not es_super:
            tenant_slug = schema or getattr(self.request.tenant, "schema_name", "").lower()
            if not can_user_edit_object(
                user=user,
                obj=instance,
                tenant_slug=tenant_slug,
                tienda_field=self.tienda_field,
                creador_field=self.creador_field
            ):
                raise serializers.ValidationError(
                    "No tienes permisos para editar esta oportunidad. "
                    "Los comerciales solo pueden editar oportunidades que ellos crearon."
                )

        def _run_update(instance, tenant_schema_name: str):
            estado_anterior = instance.estado
            tipo_cliente = getattr(getattr(instance, "cliente", None), "canal", None) or \
                getattr(getattr(instance, "cliente", None), "tipo_cliente", None)

            trans = obtener_transiciones(tipo_cliente, instance.estado, user=self.request.user)
            transiciones_validas = trans.get("transiciones", trans if isinstance(trans, list) else [])

            if nuevo_estado and nuevo_estado != instance.estado and nuevo_estado not in transiciones_validas:
                raise serializers.ValidationError({
                    "estado": [
                        f"No puedes pasar de {instance.estado} a {nuevo_estado}. "
                        f"Transiciones permitidas: {', '.join(transiciones_validas) if transiciones_validas else 'ninguna'}"
                    ]
                })

            with transaction.atomic():
                instancia = serializer.save()

                if nuevo_estado == "Pendiente de pago" and estado_anterior != nuevo_estado:
                    plazo = self.request.data.get("plazo_pago_dias", 30)
                    instancia.plazo_pago_dias = plazo
                    instancia.fecha_inicio_pago = timezone.now()
                    instancia.save(update_fields=["plazo_pago_dias", "fecha_inicio_pago"])

                if nuevo_estado and nuevo_estado != estado_anterior:
                    HistorialOportunidad.objects.create(
                        oportunidad=instancia,
                        tipo_evento="cambio_estado",
                        descripcion=f"Estado cambiado de {estado_anterior} a {nuevo_estado}",
                        estado_anterior=estado_anterior,
                        estado_nuevo=nuevo_estado,
                        usuario=self.request.user,
                    )

        if es_super and schema:
            with schema_context(schema):
                return _run_update(self.get_object(), schema)

        return _run_update(self.get_object(), self.request.tenant.schema_name)

    @action(detail=True, methods=["post"], url_path="asociar-dispositivos")
    def asociar_dispositivos(self, request, pk=None):
        dispositivos_ids = request.data.get("dispositivos", [])
        if not dispositivos_ids:
            return Response({"error": "No se proporcionaron dispositivos."}, status=status.HTTP_400_BAD_REQUEST)

        oportunidad = self.get_object()
        dispositivos = Dispositivo.objects.filter(id__in=dispositivos_ids, oportunidad__isnull=True)

        if dispositivos.count() != len(dispositivos_ids):
            return Response({"error": "Algunos dispositivos no existen o ya están asignados."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                for dispositivo in dispositivos:
                    dispositivo.oportunidad = oportunidad
                    dispositivo.save()
                oportunidad.dispositivos.add(*dispositivos)
            return Response({"detalle": "Dispositivos añadidos correctamente."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["get"], url_path="transiciones-validas")
    def transiciones_validas(self, request, pk=None):
        oportunidad = self.get_object()
        tipo_cliente = getattr(oportunidad.cliente, "canal", None) or getattr(oportunidad.cliente, "tipo_cliente", None)
        transiciones = obtener_transiciones(tipo_cliente, oportunidad.estado, user=request.user)
        return Response({"disponibles": transiciones})
    
    @action(detail=True, methods=["get"])
    def generar_oferta(self, request, pk=None):
        schema = request.query_params.get("schema")
        user = request.user
        es_super = (
            getattr(getattr(user, "global_role", None), "es_superadmin", False)
            or getattr(getattr(user, "global_role", None), "es_empleado_interno", False)
        )

        if es_super and schema:
            with schema_context(schema):
                return self._oferta(pk)
        return self._oferta(pk)

    def _oferta(self, pk):
        dispositivos = DispositivoReal.objects.select_related("modelo", "capacidad").filter(oportunidad_id=pk)
        lista = []
        total = 0

        for d in dispositivos:
            precio = d.calcular_precio_orientativo()
            lista.append({
                "modelo": d.modelo.descripcion,
                "capacidad": d.capacidad.tamaño,
                "estado": d.estado,
                "imei": d.imei,
                "numero_serie": d.numero_serie,
                "precio": round(precio or 0, 2),
            })
            total += precio or 0

        return Response({
            "oportunidad_id": pk,
            "dispositivos": lista,
            "valor_total": round(total, 2),
        })

class HistorialOportunidadViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = HistorialOportunidadSerializer

    def _get_lookup_value(self):
        return (
            self.kwargs.get("oportunidad_id")
            or self.kwargs.get("oportunidad_pk")
            or self.kwargs.get("pk")
        )

    def get_queryset(self):
        raw = str(self._get_lookup_value() or "")
        qs = HistorialOportunidad.objects.select_related("oportunidad", "usuario")

        if NUM_REGEX.fullmatch(raw):
            return qs.filter(oportunidad_id=int(raw)).order_by("-fecha")
        if UUID_REGEX.fullmatch(raw):
            return qs.filter(oportunidad__uuid=raw.lower()).order_by("-fecha")

        return qs.none()

class ComentarioOportunidadViewSet(SchemaAwareCreateMixin, viewsets.ModelViewSet):
    serializer_class = ComentarioOportunidadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        tenant_param = self.request.query_params.get("schema")
        es_super = getattr(user.global_role, "es_superadmin", False) or getattr(user.global_role, "es_empleado_interno", False)

        if es_super and tenant_param:
            try:
                with schema_context(tenant_param):
                    return ComentarioOportunidad.objects.all()
            except Exception:
                return ComentarioOportunidad.objects.none()

        # Modo normal (tenant ya activo)
        tenant_slug = self.request.tenant.schema_name.lower()

        try:
            rol = user.global_role.roles.get(tenant_slug=tenant_slug)
        except RolPorTenant.DoesNotExist:
            return ComentarioOportunidad.objects.none()

        if rol.rol == "manager":
            return ComentarioOportunidad.objects.all()
        elif rol.tienda_id:
            return ComentarioOportunidad.objects.filter(oportunidad__tienda_id=rol.tienda_id)
        else:
            return ComentarioOportunidad.objects.none()
