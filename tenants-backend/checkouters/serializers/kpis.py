from rest_framework import serializers
from rest_framework import serializers
from decimal import Decimal
from django.db import connection
from ..utils import utilskpis as kpis

from ..kpisutils  import (
    calcular_valores_por_usuario,
    calcular_valores_por_tienda,
    calcular_totales_generales,
    calcular_tasa_conversion,
    calcular_tiempo_respuesta,
    calcular_tiempo_hasta_recogida,
    obtener_pipeline,
    obtener_rechazos,
    obtener_ranking_productos,
    calcular_resumen_por_usuario,
    calcular_resumen_por_tienda,
    calcular_porcentaje_rechazo,
    calcular_series_temporales,
    calcular_total_pagado,
)

DEFAULT_COMISION_PCT = Decimal("0.10")  # fallback 10%

class DashboardManagerSerializer(serializers.Serializer):
    @staticmethod
    def collect(request, fecha_inicio, fecha_fin, granularidad, filtros, opciones):
        # Porcentaje de comisión del tenant (fallback 10%)
        pct = DEFAULT_COMISION_PCT
        try:
            tenant = getattr(connection, "tenant", None) or getattr(connection, "get_tenant", lambda: None)()
            raw_pct = getattr(tenant, "comision_pct", None)
            if raw_pct is not None:
                pct = (Decimal(str(raw_pct)) / Decimal("100"))
        except Exception:
            pass
        # 1) Bloque negocio (factura adelante)
        valor_total = kpis.kpi_valor_total(fecha_inicio, fecha_fin, filtros, opciones)
        ticket_medio = kpis.kpi_ticket_medio(fecha_inicio, fecha_fin, filtros, opciones)
        comision_total = (valor_total or Decimal("0")) * pct
        comision_media = (ticket_medio or Decimal("0")) * pct

        margen_medio = kpis.kpi_margen_medio(fecha_inicio, fecha_fin, filtros, opciones)  # si procede (puede ser None)

        evolucion = kpis.serie_evolucion_valor(fecha_inicio, fecha_fin, granularidad, filtros, opciones)
        comparativa = kpis.comparativa_periodo(evolucion, fecha_inicio, fecha_fin, granularidad)

        rankings = {
            "categorias": kpis.rank_categorias(fecha_inicio, fecha_fin, filtros, opciones, limit=10),
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
