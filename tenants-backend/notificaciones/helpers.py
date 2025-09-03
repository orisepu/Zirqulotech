

def notificar_internos_aceptacion(oportunidad, schema):
    from progeek.models import UserGlobalRole
    from notificaciones.utils import emitir_notificacion
    from checkouters.models import Oportunidad
    from django_tenants.utils import schema_context
    from notificaciones.utils import construir_url_oportunidad

    
        # Si recibes el ID, recupera la instancia
    if isinstance(oportunidad, str) or isinstance(oportunidad, int):
        with schema_context(schema):
            oportunidad = Oportunidad.objects.get(id=oportunidad)
    mensaje = f"La oportunidad '{oportunidad.nombre}' ha sido aceptada."
    url = f"/oportunidades/global/{schema}/{oportunidad.id}/"

    usuarios_internos = UserGlobalRole.objects.filter(es_empleado_interno=True).select_related('user')
    
    for ugr in usuarios_internos:
        usuario = ugr.user
        url = construir_url_oportunidad(usuario, oportunidad, schema)

        emitir_notificacion(
            usuario=usuario,
            mensaje=mensaje,
            tipo="estado_cambiado",
            url=url
        )