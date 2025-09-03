from io import BytesIO
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from checkouters.models.dispositivo import Dispositivo
import locale
from reportlab.lib.enums import TA_CENTER
from django.utils import timezone
from django.db import models  # (ya estaba)
from django.db.models import Q
from productos.models.precios import PrecioRecompra


locale.setlocale(locale.LC_ALL, 'es_ES.UTF-8')  

def _canal_from_oportunidad(oportunidad):
    cliente = getattr(oportunidad, "cliente", None)
    canal = (getattr(cliente, "canal", "") or "").strip().upper()
    if canal in ("B2B", "B2C"):
        return canal
    tipo = (getattr(cliente, "tipo_cliente", "") or "").strip().lower()
    return "B2B" if tipo == "empresa" else "B2C"

def _precio_recompra_vigente(capacidad_id: int, canal: str, fecha=None, cache: dict | None = None):
    if not capacidad_id:
        return None
    if fecha is None:
        fecha = timezone.now()
    key = (capacidad_id, canal, fecha.date())
    if cache is not None and key in cache:
        return cache[key]
    precio = (PrecioRecompra.objects
              .filter(capacidad_id=capacidad_id, canal=canal, valid_from__lte=fecha)
              .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=fecha))
              .order_by('-valid_from')
              .values_list('precio_neto', flat=True)
              .first())
    if cache is not None:
        cache[key] = precio
    return precio

def euros(valor):
    return f"{int(valor):,}".replace(",", ".") + " €"

def get_factor(precio):
    if precio <= 100:
        return 0.76
    elif precio <= 200:
        return 0.77
    elif precio <= 300:
        return 0.79
    elif precio <= 400:
        return 0.81
    elif precio <= 500:
        return 0.83
    elif precio <= 750:
        return 0.85
    elif precio <= 1000:
        return 0.87
    elif precio <= 1250:
        return 0.88
    elif precio <= 1500:
        return 0.88
    else:
        return 0.89


def generar_pdf_oportunidad(oportunidad):
    cliente = oportunidad.cliente
    dispositivos = Dispositivo.objects.filter(oportunidad=oportunidad)

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    cell_style = ParagraphStyle(name="CellStyle", fontSize=8, leading=10)

    fecha_generacion = datetime.now().strftime("%d/%m/%Y")
    comercial = oportunidad.usuario.get_full_name() if hasattr(oportunidad, "usuario") else "—"

    # === Encabezado ===
    elements.append(Paragraph(f"<b>Oferta personalizada</b>", styles["Title"]))
    elements.append(Spacer(1, 12))
    elements.append(Paragraph(f"<b>Fecha de generación:</b> {fecha_generacion}", styles["Normal"]))
    elements.append(Paragraph(f"<b>Comercial:</b> {comercial}", styles["Normal"]))
    elements.append(Spacer(1, 12))

    # === Datos del cliente y nuestros datos en paralelo ===
    datos_cliente = [
        Paragraph("<b>Datos del cliente</b>", styles["Heading4"]),
        Paragraph(f"Razón social: {cliente.razon_social}", styles["Normal"]),
        Paragraph(f"CIF: {cliente.cif}", styles["Normal"]),
        Paragraph(f"Contacto: {cliente.contacto} ({cliente.posicion})", styles["Normal"]),
        Paragraph(f"Email: {cliente.correo}", styles["Normal"]),
    ]

    datos_nuestros = [
        Paragraph("<b>Nuestros datos</b>", styles["Heading4"]),
        Paragraph("Progeek ReCommerce S.L.", styles["Normal"]),
        Paragraph("CIF: B12345678", styles["Normal"]),
        Paragraph("Calle Circular, 42", styles["Normal"]),
        Paragraph("08080 Barcelona", styles["Normal"]),
        Paragraph("Email: info@progeek.es", styles["Normal"]),
    ]

    tabla_datos = Table(
        [[datos_cliente, datos_nuestros]],
        colWidths=[270, 230]  # Ajusta según ancho de A4
    )
    tabla_datos.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
    ]))
    elements.append(tabla_datos)
    elements.append(Spacer(1, 12))

    # === Tabla principal ===
    cell_style = ParagraphStyle(name="CellStyle", fontSize=8, leading=10,alignment=TA_CENTER)

    data = [[
        Paragraph("<b>Modelo</b>", cell_style),
        Paragraph("<b>Capacidad</b>", cell_style),
        Paragraph("<b>Estado equipo</b>", cell_style),
        Paragraph("<b>Cantidad</b>", cell_style),
        Paragraph("<b>Precio unitario (€)</b>", cell_style),
        Paragraph("<b>Total (€)</b>", cell_style)
    ]]

    total_general = 0

    for d in dispositivos:
        modelo = Paragraph(d.modelo.descripcion if d.modelo else "—", cell_style)
        capacidad = Paragraph(str(d.capacidad.tamaño) if d.capacidad else "—", cell_style)
        estado_valoracion = Paragraph((d.estado_valoracion or "—").replace("_", " ").capitalize(), cell_style)
        cantidad = getattr(d, "cantidad", 1)
        precio_unitario = d.precio_orientativo or 0
        total_linea = float(precio_unitario) * cantidad
        total_general += total_linea

        data.append([
            modelo,
            capacidad,
            estado_valoracion,
            cantidad,
            euros(precio_unitario),
            euros(total_linea)
        ])

    data.append(["", "", "","", "TOTAL:", f"{euros(total_general)}"])

    table = Table(data, repeatRows=1, colWidths=[160, 60, 80, 60, 80, 80])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("BACKGROUND", (-2, -1), (-1, -1), colors.lightgrey),
        ("FONTNAME", (-2, -1), (-1, -1), "Helvetica-Bold"),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 18))

    # === Tabla de precios por estado ===
    elements.append(Paragraph("<b>Precios por estado del dispositivo</b>", styles["Heading3"]))

    precios_data = [[
        Paragraph("<b>Modelo</b>", cell_style),
        Paragraph("<b>Capacidad</b>", cell_style),
        Paragraph("<b>Excelente (€)</b>", cell_style),
        Paragraph("<b>Muy bueno (€)</b>", cell_style),
        Paragraph("<b>Bueno (€)</b>", cell_style)
    ]]
    # ▸ Canal según la oportunidad
    canal_pdf = _canal_from_oportunidad(oportunidad)
    _cache_precios = {}


    elementos_mostrados = set()
    for d in dispositivos:
        key = (d.modelo.descripcion, d.capacidad.tamaño)
        if key in elementos_mostrados:
            continue
        elementos_mostrados.add(key)

        # ▸ Precio base = precio de recompra vigente por canal
        cap_id = getattr(d.capacidad, 'id', None)
        base = _precio_recompra_vigente(cap_id, canal_pdf, cache=_cache_precios)
        precio_base = Decimal(str(base)) if base is not None else Decimal("0.00")
        
        factor = Decimal(str(get_factor(float(precio_base))))
        precio_excelente = precio_base
        precio_muy_bueno = (precio_excelente * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        precio_bueno = (precio_muy_bueno * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        precios_data.append([
            Paragraph(d.modelo.descripcion, cell_style),
            Paragraph(str(d.capacidad.tamaño), cell_style),
            euros(precio_excelente.to_integral_value(rounding=ROUND_HALF_UP)),
            euros(precio_muy_bueno.to_integral_value(rounding=ROUND_HALF_UP)),
            euros(precio_bueno.to_integral_value(rounding=ROUND_HALF_UP)),
        ])

    precios_table = Table(precios_data, repeatRows=1, colWidths=[170, 70, 70, 70, 70])
    precios_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    elements.append(precios_table)
    elements.append(Spacer(1, 18))

    # === Descripción de estados ===
    elements.append(Paragraph("<b>Descripción de estados</b>", styles["Heading3"]))
    elements.append(Paragraph("<b>Excelente:</b> Sin marcas visibles, 100% funcional.", styles["Normal"]))
    elements.append(Paragraph("<b>Muy bueno:</b> Pequeños signos de uso, totalmente funcional.", styles["Normal"]))
    elements.append(Paragraph("<b>Bueno:</b> Signos visibles de uso, pero funcional.", styles["Normal"]))

    # === Renderizado final ===
    doc.build(elements)
    buffer.seek(0)
    return buffer
