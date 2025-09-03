from datetime import datetime, time
from decimal import Decimal
from django.utils.timezone import make_aware
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_tenants.utils import schema_context, get_public_schema_name

  # crea/usa tu permiso
from .dashboard_manager_serializers import DashboardManagerSerializer
from ..utils.utilskpis import parse_bool, parse_date_str

FACTURA_ADELANTE_ESTADOS = {"Factura recibida", "Pendiente de pago", "Pagado"}

class DashboardManagerAPIView(APIView):
    permission_classes = [IsAuthenticated]  # y el check fino lo hace el serializer/permiso

    def get(self, request):
        params = request.query_params

        fecha_inicio = parse_date_str(params.get("fecha_inicio"))
        fecha_fin = parse_date_str(params.get("fecha_fin"))
        if not fecha_inicio or not fecha_fin:
            return Response({"error": "Parámetros 'fecha_inicio' y 'fecha_fin' son obligatorios (YYYY-MM-DD)."}, status=400)

        granularidad = params.get("granularidad") or "mes"
        tienda_id = params.get("tienda_id")
        usuario_id = params.get("usuario_id")
        comparar = parse_bool(params.get("comparar"))
        tenant_slug = params.get("tenant")

        fecha_inicio = make_aware(datetime.combine(fecha_inicio, time.min))
        fecha_fin = make_aware(datetime.combine(fecha_fin, time.max))

        def _collect():
            return DashboardManagerSerializer.collect(
                request=request,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                granularidad=granularidad,
                filtros={
                    "tienda_id": tienda_id,
                    "usuario_id": usuario_id,
                },
                opciones={
                    "comparar": comparar,
                    "estados_factura_adelante": FACTURA_ADELANTE_ESTADOS,
                },
            )

        # Soporte superadmin con tenant explícito
        if tenant_slug:
            public_schema = get_public_schema_name() if callable(get_public_schema_name) else "public"
            # Si estás en public y el usuario es superadmin, abrimos el schema del tenant:
            with schema_context(tenant_slug):
                data = _collect()
        else:
            # Tenant implícito (manager/empleado)
            data = _collect()

        return Response(data, status=200)
