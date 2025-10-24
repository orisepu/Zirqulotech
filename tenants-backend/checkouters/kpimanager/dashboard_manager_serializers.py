from rest_framework import serializers
from decimal import Decimal
from ..utils import utilskpis as kpis
from django.db import connection

class DashboardManagerSerializer(serializers.Serializer):
    @staticmethod
    def collect(request, fecha_inicio, fecha_fin, granularidad, filtros, opciones):
        # Porcentaje de comisión del tenant (fallback 10%)
        pct = Decimal("0.10")
        try:
            tenant = getattr(connection, "tenant", None) or getattr(connection, "get_tenant", lambda: None)()
            raw_pct = getattr(tenant, "comision_pct", None)
            if raw_pct is not None:
                pct = (Decimal(str(raw_pct)) / Decimal("100"))
        except Exception:
            pass
        # 1) Bloque negocio (factura adelante)
        valor_total = kpis.kpi_valor_total(fecha_inicio, fecha_fin, filtros, opciones, request)
        ticket_medio = kpis.kpi_ticket_medio(fecha_inicio, fecha_fin, filtros, opciones, request)
        comision_total = (valor_total or Decimal("0")) * pct
        comision_media = (ticket_medio or Decimal("0")) * pct

        margen_medio = kpis.kpi_margen_medio(fecha_inicio, fecha_fin, filtros, opciones, request)  # si procede (puede ser None)

        evolucion = kpis.serie_evolucion_valor(fecha_inicio, fecha_fin, granularidad, filtros, opciones, request)
        comparativa = kpis.comparativa_periodo(evolucion, fecha_inicio, fecha_fin, granularidad, filtros, opciones, opciones.get("comparar", False), request)

        rankings = {
            "productos": kpis.rank_productos(fecha_inicio, fecha_fin, filtros, opciones, limit=10, request=request),
            "tiendas_por_valor": kpis.rank_tiendas_valor(fecha_inicio, fecha_fin, filtros, opciones, limit=10, request=request),
            "usuarios_por_valor": kpis.rank_usuarios_valor(fecha_inicio, fecha_fin, filtros, opciones, limit=10, request=request),
            "tiendas_por_operaciones": kpis.rank_tiendas_ops(fecha_inicio, fecha_fin, filtros, opciones, limit=10, request=request),
            "usuarios_por_operaciones": kpis.rank_usuarios_ops(fecha_inicio, fecha_fin, filtros, opciones, limit=10, request=request),
        }

        pipeline = kpis.kpi_pipeline_actual(filtros)

        operativa = kpis.kpi_operativa(fecha_inicio, fecha_fin, filtros, opciones, request)

        return {
            "resumen": {
                "valor_total": valor_total,
                "ticket_medio": ticket_medio,
                "comision_total": comision_total,
                "comision_media": comision_media,
                "margen_medio": margen_medio,
            },
            "evolucion": evolucion,
            "comparativa": comparativa,
            "rankings": rankings,
            "pipeline": pipeline,
            "operativa": operativa,
        }
