from django.db.models import Q
from django.utils import timezone
from .precios import PrecioRecompra, CanalChoices


def get_precio_vigente(capacidad_id: int, canal: str, fecha=None, fuente: str | None = None, tenant_schema: str | None = None):
    """
    Devuelve el precio vigente a 'fecha' (por defecto, ahora).
    Prioriza tenant_schema si se indica; si no, busca global (tenant_schema IS NULL).
    """
    if fecha is None:
        fecha = timezone.now()

    qs = PrecioRecompra.objects.filter(
        capacidad_id=capacidad_id,
        canal=canal,
        valid_from__lte=fecha
    ).filter(Q(valid_to__isnull=True) | Q(valid_to__gt=fecha))

    if tenant_schema:
        qs = qs.filter(tenant_schema=tenant_schema)
    else:
        qs = qs.filter(tenant_schema__isnull=True)

    if fuente:
        qs = qs.filter(fuente=fuente)

    return qs.order_by('-valid_from').first()


def set_precio_recompra(*, capacidad_id: int, canal: str, precio_neto, effective_at=None,
                        fuente='manual', tenant_schema: str | None = None, changed_by=None):
    """
    Cierra el vigente (si lo hay) y crea un nuevo precio con la fecha de efecto indicada.
    Soporta cambio inmediato (effective_at=None -> ahora) y cambio programado (effective_at futuro).

    IMPORTANTE: Cierra el precio vigente sin importar su fuente, ya que el constraint
    de la DB solo permite 1 precio vigente por (capacidad, canal, tenant_schema).
    """
    now = timezone.now()
    if effective_at is None:
        effective_at = now

    # Cerrar vigente en el momento del cambio (sin filtrar por fuente)
    # Esto previene duplicados cuando diferentes fuentes actualizan la misma capacidad
    vigente = get_precio_vigente(capacidad_id, canal, fecha=effective_at, tenant_schema=tenant_schema)
    if vigente and vigente.valid_from < effective_at and (vigente.valid_to is None or vigente.valid_to > effective_at):
        vigente.valid_to = effective_at
        vigente.changed_by = changed_by
        vigente.save(update_fields=['valid_to', 'changed_by', 'updated_at'])

    # Crear el nuevo registro
    nuevo = PrecioRecompra.objects.create(
        capacidad_id=capacidad_id,
        canal=canal,
        fuente=fuente,
        moneda='EUR',
        precio_neto=precio_neto,
        valid_from=effective_at,
        valid_to=None,
        tenant_schema=tenant_schema,
        changed_by=changed_by
    )
    return nuevo
