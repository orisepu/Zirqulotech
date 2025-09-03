# notificaciones/utils.py

from .models import Notificacion
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def emitir_notificacion(usuario, mensaje, tipo='otro', url=''):
    """
    Crea una notificación persistente y la envía por WebSocket si hay conexión activa.
    """
    from django_tenants.utils import get_tenant
    from django.db import connection

    # Persistente en base de datos
    noti = Notificacion.objects.create(
        usuario=usuario,
        mensaje=mensaje,
        tipo=tipo,
        url_relacionada=url,
        schema=connection.tenant.schema_name
    )

    # Enviar por WebSocket
    channel_layer = get_channel_layer()
    group_name = f"user_{usuario.id}"
    print(f"📡 Enviando notificación a grupo: {group_name}"),
    async_to_sync(channel_layer.group_send)(  
        group_name,
        {
            "type": "nueva_notificacion",
            "mensaje": mensaje,
            "tipo": tipo,
            "url": url,
            "id": noti.id,
            "creada": noti.creada.isoformat(),
        }
    )

    return noti

def construir_url_oportunidad(usuario, oportunidad, schema):
    """
    Retorna la URL apropiada según el tipo de usuario.
    `oportunidad` debe tener el campo `.uuid`
    """
    es_interno = getattr(usuario.global_role, 'es_superadmin', False) or getattr(usuario.global_role, 'es_empleado_interno', False)

    uuid = getattr(oportunidad, "uuid", None)
    if not uuid:
        raise ValueError("La oportunidad no tiene UUID")

    if es_interno:
        return f"/oportunidades/global/{schema}/{uuid}"
    else:
        return f"/oportunidades/{uuid}"
