from datetime import timedelta, date
from decimal import Decimal
from collections import defaultdict
from django.db.models import Sum, Count, F, Q, Value,DecimalField,CharField,Min
from django.db.models.functions import Coalesce, TruncDay, TruncWeek, TruncMonth,Cast, Concat
from django.core.exceptions import FieldError

# Ajusta import paths a tus modelos reales:
from ..models.dispositivo import DispositivoReal
from ..models.oportunidad import Oportunidad,HistorialOportunidad
from ..models.tienda import Tienda
# Estados pipeline abiertos y cierre:
PIPELINE_ESTADOS = [
    "Pendiente","Aceptado","Recogida solicitada", "Recogida generada", "En tránsito", "Check in OK","Recibido","Pendiente factura",
    "En revisión", "Oferta confirmada", "Pendiente factura","Nueva oferta","Nueva oferta enviada","Nueva oferta confirmada","Factura recibida"
]
CERRADA_ESTADOS = ["Pagado"]  # operaciones cerradas
DEC_ZERO = Value(Decimal("0"), output_field=DecimalField(max_digits=24, decimal_places=6))
ACCEPTED_STATES = {"Aceptada", "Oferta aceptada", "Aceptado"}
PICKUP_STATES = {"Recogida generada", "Recogida programada", "En tránsito", "Recogido", "Recibido"}

def _first_dr_date_map(opp_ids, field_name: str = "fecha_recepcion"):
    """
    Devuelve {oportunidad_id: primera fecha en DispositivoReal.<field_name>} como fallback.
    """
    if not opp_ids:
        return {}
    qs = (DispositivoReal.objects
          .filter(oportunidad_id__in=opp_ids)
          .exclude(**{f"{field_name}__isnull": True}))
    rows = (qs.values("oportunidad_id").annotate(ts=Min(field_name)))
    return {r["oportunidad_id"]: r["ts"] for r in rows}

def _first_ts_hist(opp_ids, estados_objetivo):
    """
    Devuelve {oportunidad_id: primer timestamp (fecha) cuando entra en cualquiera de 'estados_objetivo'}.
    Usa HistorialOportunidad(estado_nuevo, fecha).
    """
    if not opp_ids:
        return {}
    qs = (HistorialOportunidad.objects
          .filter(oportunidad_id__in=opp_ids, estado_nuevo__in=list(estados_objetivo))
          .values("oportunidad_id")
          .annotate(ts=Min("fecha")))
    return {r["oportunidad_id"]: r["ts"] for r in qs}

def _avg_hours_from_pairs(pairs):
    """
    pairs: iterable de (t_inicio, t_fin) -> devuelve media en horas (float con 2 decimales) o None.
    Ignora pares sin ambos hitos o con orden invertido.
    """
    valid = [(a, b) for (a, b) in pairs if a and b and b > a]
    if not valid:
        return None
    total_secs = sum((b - a).total_seconds() for (a, b) in valid)
    return round(total_secs / 3600.0 / len(valid), 2)

def parse_bool(v):
    if v is None:
        return False
    return str(v).lower() in {"1", "true", "yes", "y", "si", "sí"}

def parse_date_str(s):
    if not s:
        return None
    try:
        y, m, d = s.split("-")
        return date(int(y), int(m), int(d))
    except Exception:
        return None
def _oportunidades_ids_en_rango(fecha_inicio, fecha_fin):
    """
    Devuelve IDs de Oportunidad cuyo campo de creación esté en rango.
    Prueba varios nombres comunes del campo de fecha para ser compatible
    con esquemas distintos sin romper el QuerySet.
    """
    candidatos = ["creado_en", "creado", "created_at", "fecha_creacion"]
    for campo in candidatos:
        try:
            qs = Oportunidad.objects.filter(**{f"{campo}__range": [fecha_inicio, fecha_fin]})
            # Si el ORM acepta el lookup, devolvemos resultados (vacío o no)
            list(qs[:1])  # fuerza evaluación ligera para detectar FieldError temprano
            return qs.values_list("id", flat=True)
        except FieldError:
            continue
    # Fallback: sin filtro por fecha si ninguno coincide (mejor que romper)
    return Oportunidad.objects.all().values_list("id", flat=True)

def _base_qs(fecha_inicio, fecha_fin, filtros, opciones):
    """
    QS de DispositivoReal con join a Oportunidad, filtrando por
    estados >= factura recibida (opciones['estados_factura_adelante']).
    """
    estados_ok = set(opciones.get("estados_factura_adelante") or [])
    opp_ids = _oportunidades_ids_en_rango(fecha_inicio, fecha_fin)

    qs = (DispositivoReal.objects
          .select_related("oportunidad", "oportunidad__tienda", "oportunidad__usuario")
          .filter(
              oportunidad__estado__in=estados_ok,
              oportunidad_id__in=opp_ids
          ))

    if filtros.get("tienda_id"):
        qs = qs.filter(oportunidad__tienda_id=filtros["tienda_id"])
    if filtros.get("usuario_id"):
        qs = qs.filter(oportunidad__usuario_id=filtros["usuario_id"])
    return qs

def _valor_total_qs(qs):
    """
    Calcula el valor total de todos los DispositivoReal en el queryset.
    Suma segura en Decimal: evita errores de tipos mezclados (DecimalField vs Integer).
    """
    return qs.aggregate(
        v=Coalesce(
            Sum(
                F("precio_final"),
                output_field=DecimalField(max_digits=24, decimal_places=6)
            ),
            DEC_ZERO
        )
    )["v"]

def kpi_valor_total(fecha_inicio, fecha_fin, filtros, opciones):
    return _valor_total_qs(_base_qs(fecha_inicio, fecha_fin, filtros, opciones)) or Decimal("0")

def _ops_qs(fecha_inicio, fecha_fin, filtros, opciones):
    qs = _base_qs(fecha_inicio, fecha_fin, filtros, opciones)
    # operaciones = oportunidades distintas con al menos un DispositivoReal en el rango y estados válidos
    return qs.values("oportunidad_id").distinct()

def kpi_ticket_medio(fecha_inicio, fecha_fin, filtros, opciones):
    qs = _base_qs(fecha_inicio, fecha_fin, filtros, opciones)
    valor = _valor_total_qs(qs)
    ops = _ops_qs(fecha_inicio, fecha_fin, filtros, opciones).count() or 1
    return (valor or Decimal("0")) / Decimal(ops)

def kpi_margen_medio(fecha_inicio, fecha_fin, filtros, opciones):
    """
    Si tienes coste/venta en otra tabla, calcula margen aquí.
    Por ahora None para no inventar.
    """
    return None
def _campo_fecha_oportunidad():
    # Intenta estos nombres en orden; en tu modelo existe 'fecha_creacion'
    candidatos = ["creado_en", "creado", "created_at", "fecha_creacion"]
    for campo in candidatos:
        try:
            # Evalúa de forma ligera para detectar FieldError si el campo no existe
            list(Oportunidad.objects.filter(**{f"{campo}__isnull": True})[:1])
            return campo
        except FieldError:
            continue
    # Fallback por compatibilidad (si nada coincide)
    return "fecha_creacion"

def _trunc_by(granularidad):
    campo = _campo_fecha_oportunidad()
    path = f"oportunidad__{campo}"
    if granularidad == "dia":
        return TruncDay(path)
    if granularidad == "semana":
        return TruncWeek(path)
    return TruncMonth(path)

def _serie_vacia_desde_hasta(fecha_inicio, fecha_fin, granularidad):
    # genera claves periodo como ISO (YYYY-MM o YYYY-MM-DD) según granularidad
    puntos = []
    if granularidad == "dia":
        cur = fecha_inicio.date()
        while cur <= fecha_fin.date():
            puntos.append(cur.isoformat())
            cur += timedelta(days=1)
        return puntos
    if granularidad == "semana":
        cur_dt = fecha_inicio - timedelta(days=fecha_inicio.weekday())
        cur_dt = cur_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = fecha_fin.replace(hour=0, minute=0, second=0, microsecond=0)
        while cur_dt <= end_dt:
            puntos.append(cur_dt.date().isoformat())
            cur_dt += timedelta(days=7)
        return puntos
    # mes
    y, m = fecha_inicio.year, fecha_inicio.month
    yf, mf = fecha_fin.year, fecha_fin.month
    while (y < yf) or (y == yf and m <= mf):
        puntos.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            m, y = 1, y + 1
    return puntos

def serie_evolucion_valor(fecha_inicio, fecha_fin, granularidad, filtros, opciones):
    qs = _base_qs(fecha_inicio, fecha_fin, filtros, opciones)
    t = _trunc_by(granularidad)
    rows = (qs
            .annotate(p=t)
            .values("p")
            .annotate(v=Coalesce(
            Sum(F("precio_final"), output_field=DecimalField(max_digits=24, decimal_places=6)),
            DEC_ZERO))
            .order_by("p"))

    # map real → dict
    real = {}
    for r in rows:
        p = r["p"]
        if granularidad == "dia":
            key = p.date().isoformat()
        elif granularidad == "semana":
            key = p.date().isoformat()
        else:
            key = p.strftime("%Y-%m")
        real[key] = r["v"]

    # rellena huecos
    out = []
    for key in _serie_vacia_desde_hasta(fecha_inicio, fecha_fin, granularidad):
        out.append({"periodo": key, "valor": real.get(key, Decimal("0"))})
    return out

def _sum_evolucion(evolucion):
    return sum(Decimal(str(p["valor"])) for p in evolucion)

def _fechas_periodo_anterior(fecha_inicio, fecha_fin):
    # mismo número de días; fin anterior = día antes del inicio actual
    dias = (fecha_fin.date() - fecha_inicio.date()).days + 1
    fin_ant = fecha_inicio - timedelta(days=1)
    ini_ant = fin_ant - timedelta(days=dias - 1)
    return ini_ant, fin_ant

def comparativa_periodo(evolucion_actual, fecha_inicio, fecha_fin, granularidad, filtros, opciones, comparar: bool):
    actual = _sum_evolucion(evolucion_actual)
    if not comparar:
        return {"actual": actual, "anterior": None, "variacion_pct": None}

    ini_ant, fin_ant = _fechas_periodo_anterior(fecha_inicio, fecha_fin)
    evolucion_anterior = serie_evolucion_valor(ini_ant, fin_ant, granularidad, filtros, opciones)
    anterior = _sum_evolucion(evolucion_anterior)

    variacion = None
    if anterior and anterior != Decimal("0"):
        variacion = ( (actual - anterior) / anterior ) * Decimal("100")

    return {
        "actual": actual,
        "anterior": anterior,
        "variacion_pct": None if variacion is None else round(variacion, 2)
    }

def _rank_qs(fecha_inicio, fecha_fin, filtros, opciones):
    return _base_qs(fecha_inicio, fecha_fin, filtros, opciones)

def rank_categorias(fecha_inicio, fecha_fin, filtros, opciones, limit=10):
    qs = _rank_qs(fecha_inicio, fecha_fin, filtros, opciones)
    return list(
        qs.values(nombre=F("categoria_nombre"))  # ajusta campo
          .annotate(valor=Coalesce(
          Sum(F("precio_final"), output_field=DecimalField(max_digits=24, decimal_places=6)),
          DEC_ZERO
      ))
          .order_by("-valor")[:limit]
    )

def rank_productos(fecha_inicio, fecha_fin, filtros, opciones, limit=10):
    qs = _rank_qs(fecha_inicio, fecha_fin, filtros, opciones)

    # Agrupa por la descripción del modelo (FK a public_productos_modelo)
    return list(
        qs.values(nombre=F("modelo__descripcion"))
          .annotate(
              valor=Coalesce(
                  Sum(F("precio_final"), output_field=DecimalField(max_digits=24, decimal_places=6)),
                  DEC_ZERO
              )
          )
          .order_by("-valor")[:limit]
    )
    

def rank_tiendas_valor(fecha_inicio, fecha_fin, filtros, opciones, limit=10):
    qs = _rank_qs(fecha_inicio, fecha_fin, filtros, opciones)
    return list(
        qs.values(tienda_id=F("oportunidad__tienda_id"), nombre=F("oportunidad__tienda__nombre"))
          .annotate(valor=Coalesce(
          Sum(F("precio_final"), output_field=DecimalField(max_digits=24, decimal_places=6)),
          DEC_ZERO
      ))
          .order_by("-valor")[:limit]
    )

def rank_usuarios_valor(fecha_inicio, fecha_fin, filtros, opciones, limit=10):
    qs = _rank_qs(fecha_inicio, fecha_fin, filtros, opciones)
    # Detecta campo de nombre del usuario (name → email → id)
    try:
        list(qs.values(usuario=F("oportunidad__usuario__name"))[:1])
        campo_nombre = "oportunidad__usuario__name"
    except FieldError:
        try:
            list(qs.values(usuario=F("oportunidad__usuario__email"))[:1])
            campo_nombre = "oportunidad__usuario__email"
        except FieldError:
            campo_nombre = "oportunidad__usuario_id"  # fallback

    return list(
        qs.values(usuario_id=F("oportunidad__usuario_id"), nombre=F(campo_nombre))
          .annotate(
              valor=Coalesce(
                  Sum(F("precio_final"), output_field=DecimalField(max_digits=24, decimal_places=6)),
                  DEC_ZERO
              )
          )
          .order_by("-valor")[:limit]
    )

def rank_tiendas_ops(fecha_inicio, fecha_fin, filtros, opciones, limit=10):
    qs = _rank_qs(fecha_inicio, fecha_fin, filtros, opciones)
    return list(
        qs.values(tienda_id=F("oportunidad__tienda_id"), nombre=F("oportunidad__tienda__nombre"))
          .annotate(ops=Count("oportunidad", distinct=True))
          .order_by("-ops")[:limit]
    )

def rank_usuarios_ops(fecha_inicio, fecha_fin, filtros, opciones, limit=10):
    qs = _rank_qs(fecha_inicio, fecha_fin, filtros, opciones)
    # Detecta campo de nombre del usuario (name → email → id)
    try:
        list(qs.values(usuario=F("oportunidad__usuario__name"))[:1])
        campo_nombre = "oportunidad__usuario__name"
    except FieldError:
        try:
            list(qs.values(usuario=F("oportunidad__usuario__email"))[:1])
            campo_nombre = "oportunidad__usuario__email"
        except FieldError:
            campo_nombre = "oportunidad__usuario_id"

    return list(
        qs.values(usuario_id=F("oportunidad__usuario_id"), nombre=F(campo_nombre))
          .annotate(ops=Count("oportunidad", distinct=True))
          .order_by("-ops")[:limit]
    )

def kpi_pipeline_actual(filtros):
    qs = (Oportunidad.objects
          .select_related("tienda", "usuario")
          .filter(estado__in=PIPELINE_ESTADOS))
    if filtros.get("tienda_id"):
        qs = qs.filter(tienda_id=filtros["tienda_id"])
    if filtros.get("usuario_id"):
        qs = qs.filter(usuario_id=filtros["usuario_id"])

    # Valor estimado: si ya hay DispositivoReal auditado, sumar precio_final*cantidad; si no, 0
    dr = (DispositivoReal.objects
          .filter(oportunidad_id__in=qs.values_list("id", flat=True), auditado=True)
          .values("oportunidad_id")
          .annotate(valor=Coalesce(
          Sum(F("precio_final"), output_field=DecimalField(max_digits=24, decimal_places=6)),
          DEC_ZERO
      )))
    valor_por_opp = {r["oportunidad_id"]: r["valor"] for r in dr}

    por_estado = []
    total_abiertas = 0
    total_valor = Decimal("0")
    for est in PIPELINE_ESTADOS:
        ids = list(qs.filter(estado=est).values_list("id", flat=True))
        count = len(ids)
        valor = sum(valor_por_opp.get(i, Decimal("0")) for i in ids)
        por_estado.append({"estado": est, "count": count, "valor": valor})
        total_abiertas += count
        total_valor += valor

    return {
        "abiertas": total_abiertas,
        "valor_estimado": total_valor,
        "por_estado": por_estado
    }

def kpi_operativa(fecha_inicio, fecha_fin, filtros, opciones):
    # Recibidas = todas las Oportunidades creadas en rango (independiente del estado)
    campo_fecha = _campo_fecha_oportunidad()
    oqs = Oportunidad.objects.filter(**{f"{campo_fecha}__range": [fecha_inicio, fecha_fin]})
    if filtros.get("tienda_id"):
        oqs = oqs.filter(tienda_id=filtros["tienda_id"])
    if filtros.get("usuario_id"):
        oqs = oqs.filter(usuario_id=filtros["usuario_id"])

    recibidas = oqs.count()

    # Completadas = estado Pagado
    completadas = oqs.filter(estado__in=CERRADA_ESTADOS).count()
    conversion_pct = (completadas * 100.0 / recibidas) if recibidas else 0.0

    # Tiempos medios (requiere timestamps; ajusta campos a tus nombres)
    # placeholders seguros:
    # Tiempos medios usando HistorialOportunidad (estado_nuevo, fecha)
    opp_ids = list(oqs.values_list("id", flat=True))

    # 17) Respuesta al cliente: En tránsito -> (Oferta confirmada | Nueva oferta enviada)
    t_in_transit = _first_ts_hist(opp_ids, {"En tránsito"})
    t_offer = _first_ts_hist(opp_ids, {"Oferta confirmada", "Nueva oferta enviada"})
    tmed_respuesta_h = _avg_hours_from_pairs([(t_in_transit.get(i), t_offer.get(i)) for i in opp_ids])

    # 18) Recogida: Aceptada -> (Recogida generada | En tránsito)
    t_accepted = _first_ts_hist(opp_ids, ACCEPTED_STATES)
    t_pick_hist = _first_ts_hist(opp_ids, PICKUP_STATES)
    t_pick_dr = _first_dr_date_map(opp_ids, "fecha_recepcion")
    pairs_recogida = []
    for i in opp_ids:
        t_ini = t_accepted.get(i)
        # fin: primero historial si existe; si no, la primera fecha_recepcion en DR
        t_fin = t_pick_hist.get(i) or t_pick_dr.get(i)
        pairs_recogida.append((t_ini, t_fin))

    tmed_recogida_h = _avg_hours_from_pairs(pairs_recogida)

    # 19) Cierre completo: fecha_creación -> Pagado
    campo_fecha = _campo_fecha_oportunidad()  # ya te resuelve 'fecha_creacion'
    start_map = {r["id"]: r[campo_fecha] for r in oqs.values("id", campo_fecha)}
    t_paid = _first_ts_hist(opp_ids, {"Pagado"})
    tmed_cierre_h = _avg_hours_from_pairs([(start_map.get(i), t_paid.get(i)) for i in opp_ids])


    # Rechazos con motivo (si tienes campo motivo_rechazo)
    rechazadas = oqs.filter(estado__in=["Rechazada"]).count()
    #motivos = (oqs.filter(estado__in=["Rechazada"])
    #              .values("motivo_rechazo")
    #              .annotate(count=Count("id"))
     #             .order_by("-count"))
    #motivos = [{"motivo": m["motivo_rechazo"] or "—", "count": m["count"]} for m in motivos]

    # Abandono (heurística): estado “Cancelado” o sin movimiento X días (a definir)
    abandonadas = oqs.filter(estado__in=["Cancelado"]).count()
    abandono_pct = (abandonadas * 100.0 / recibidas) if recibidas else 0.0

    return {
        "recibidas": recibidas,
        "completadas": completadas,
        "conversion_pct": round(conversion_pct, 2),
        "tmed_respuesta_h": tmed_respuesta_h,
        "tmed_recogida_h": tmed_recogida_h,
        "tmed_cierre_h": tmed_cierre_h,
        "rechazos": {"total": rechazadas, },
        "abandono_pct": round(abandono_pct, 2),
    }
