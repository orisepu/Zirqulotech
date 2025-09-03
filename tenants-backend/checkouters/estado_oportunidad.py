TRANSICIONES_B2B = {
    "Pendiente": ["Aceptado", "Cancelado"],
    "Aceptado": ["Recogida solicitada"],
    "Recogida solicitada" : ["Recogida generada"],
    "Recogida generada": ["En tránsito"],
    "En tránsito": ["Recibido"],
    "Recibido": ["Check in OK"],
    "Check in OK": ["En revisión"],
    "En revisión": ["Oferta confirmada", "Nueva oferta enviada"],
    "Oferta confirmada": ["Pendiente factura"],
    "Pendiente factura": ["Factura recibida"],
    "Factura recibida": ["Pendiente de pago"],
    "Pendiente de pago": ["Pagado"],
    "Nueva oferta enviada": ["Nueva oferta confirmada","Rechazada"],
    "Nueva oferta confirmada": ["Pendiente factura"],
    "Rechazada": ["Devolución iniciada"],
    "Devolución iniciada": ["Equipo enviado"],
    "Equipo enviado": ["Recibido por el cliente"],
}

TRANSICIONES_B2C = {
    "Pendiente": ["Aceptado","Cancelado"],
    "Aceptado": ["Contrato firmado"],
    "Contrato firmado": ["Recogida solicitada"],
    "Recogida solicitada": ["Recogida generada"],
    "Recogida generada": ["En tránsito"],
    "En tránsito": ["Recibido"],
    "Recibido": ["Check in OK"],
    "Check in OK": ["En revisión"],
    "En revisión": ["Oferta confirmada","Nueva oferta enviada"],
    "Oferta confirmada": ["Pendiente de pago",],
    "Pendiente de pago": ["Pagado"],
    "Nueva oferta enviada": ["Nueva oferta confirmada","Rechazada"],
    "Nueva oferta confirmada": ["Nuevo contrato"],
    "Nuevo contrato":["Pendiente de pago"],
    "Rechazada": ["Devolución iniciada"],
    "Devolución iniciada": ["Equipo enviado"],
    "Equipo enviado": ["Recibido por el cliente"],
}

def obtener_transiciones(tipo_cliente: str, estado_actual: str, user=None) -> dict:
    # normaliza tipo cliente por si nos llega 'canal b2b'
    tc = (tipo_cliente or "").casefold().strip().replace("_", " ").replace("-", " ")
    if "b2b" in tc:
        tc = "b2b"
    elif "b2c" in tc:
        tc = "b2c"
    else:
        tc = "b2c"  # fallback

    estado = (estado_actual or "").strip()

    mapa = TRANSICIONES_B2B if tc == "b2b" else TRANSICIONES_B2C
    siguientes = list(mapa.get(estado, []))  # copia
    anteriores = [k for k, destinos in mapa.items() if estado in destinos]

    # 🔄 Todos los posibles (únicos, conservando orden: primero siguientes, luego anteriores)
    transiciones = [*dict.fromkeys([*siguientes, *anteriores])]

    # ✅ Permisos: superadmin o empleado interno ven todo
    gr = getattr(user, "global_role", None)
    es_interno = bool(getattr(gr, "es_empleado_interno", False))
    es_super = bool(getattr(gr, "es_superadmin", False))

    if user and not (es_interno or es_super):
        # Estados desde los que un usuario normal puede avanzar
        estados_permitidos = {"Pendiente", "Aceptado", "Nueva oferta enviada","Contrato firmado"}
        if estado in estados_permitidos:
            return {"anteriores": [], "siguientes": siguientes, "transiciones": siguientes}
        return {"anteriores": [], "siguientes": [], "transiciones": []}

    return {"anteriores": anteriores, "siguientes": siguientes, "transiciones": transiciones}


