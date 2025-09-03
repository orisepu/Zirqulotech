from rest_framework import serializers
from decimal import Decimal
from ..utils import utilskpis as kpis

COMISION_PCT = Decimal("0.10")  # 10% fijo (tu #90)

class DashboardManagerSerializer(serializers.Serializer):
    @staticmethod
    def collect(request, fecha_inicio, fecha_fin, granularidad, filtros, opciones):
        # 1) Bloque negocio (factura adelante)
        valor_total = kpis.kpi_valor_total(fecha_inicio, fecha_fin, filtros, opciones)
        ticket_medio = kpis.kpi_ticket_medio(fecha_inicio, fecha_fin, filtros, opciones)
        comision_total = (valor_total or Decimal("0")) * COMISION_PCT
        comision_media = (ticket_medio or Decimal("0")) * COMISION_PCT

        margen_medio = kpis.kpi_margen_medio(fecha_inicio, fecha_fin, filtros, opciones)  # si procede (puede ser None)

        evolucion = kpis.serie_evolucion_valor(fecha_inicio, fecha_fin, granularidad, filtros, opciones)
        comparativa = kpis.comparativa_periodo(evolucion, fecha_inicio, fecha_fin, granularidad, filtros, opciones, opciones.get("comparar", False))
        
        rankings = {
            "productos": kpis.rank_productos(fecha_inicio, fecha_fin, filtros, opciones, limit=10),
            "tiendas_por_valor": kpis.rank_tiendas_valor(fecha_inicio, fecha_fin, filtros, opciones, limit=10),
            "usuarios_por_valor": kpis.rank_usuarios_valor(fecha_inicio, fecha_fin, filtros, opciones, limit=10),
            "tiendas_por_operaciones": kpis.rank_tiendas_ops(fecha_inicio, fecha_fin, filtros, opciones, limit=10),
            "usuarios_por_operaciones": kpis.rank_usuarios_ops(fecha_inicio, fecha_fin, filtros, opciones, limit=10),
        }

        pipeline = kpis.kpi_pipeline_actual(filtros)

        operativa = kpis.kpi_operativa(fecha_inicio, fecha_fin, filtros, opciones)

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
