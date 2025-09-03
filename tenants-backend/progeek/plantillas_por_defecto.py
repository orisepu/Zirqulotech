PLANTILLAS_POR_DEFECTO = {
    'Recepcion confirmada': {
        'asunto': 'Hemos recibido tu lote',
        'cuerpo': 'Hola {{ nombre_cliente }}, hemos recibido el lote {{ nombre_oportunidad }} el día {{ fecha_recepcion }}.',
    },
    'Oferta enviada': {
        'asunto': 'Tu oferta está lista',
        'cuerpo': 'Hola {{ nombre_cliente }}, la oferta por tu lote {{ nombre_oportunidad }} asciende a {{ precio_total }} €.',
    },
    'Oferta aceptada': {
        'asunto': '¡Gracias por aceptar la oferta!',
        'cuerpo': 'Hola {{ nombre_cliente }}, has aceptado la oferta por {{ nombre_oportunidad }} el día {{ fecha_aceptacion }}.',
    },
    'Recogida generada': {
        'asunto': 'Recogida programada',
        'cuerpo': 'Hola {{ nombre_cliente }}, hemos programado la recogida en {{ direccion_recogida }} para el día {{ fecha_recogida }}.',
    },
    'Pago realizado': {
        'asunto': 'Pago realizado',
        'cuerpo': 'Hola {{ nombre_cliente }}, hemos realizado el pago de {{ importe_pagado }} € el día {{ fecha_pago }}.',
    },
    'Recordatorio pago': {
        'asunto': 'Recordatorio de pago pendiente',
        'cuerpo': 'Hola {{ nombre_cliente }}, tienes un pago pendiente por {{ importe_pendiente }} €. Fecha límite: {{ fecha_limite }}.',
    },
}
