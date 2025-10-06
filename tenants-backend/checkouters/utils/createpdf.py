from io import BytesIO
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image,
    HRFlowable, KeepTogether
)
from django.contrib.staticfiles import finders
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from checkouters.models.dispositivo import Dispositivo
import locale
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from django.utils import timezone
from django.db import models  # (ya estaba)
from django.db.models import Q
from productos.models.precios import PrecioRecompra

import os, logging
logger = logging.getLogger(__name__)

# ==========================
# Localización y branding
# ==========================
locale.setlocale(locale.LC_ALL, 'es_ES.UTF-8')

# Paleta/tema
BRAND_PRIMARY = colors.HexColor("#0E7C66")  # verde oscuro marca
BRAND_ACCENT  = colors.HexColor("#14B8A6")  # turquesa acento
BRAND_DARK    = colors.HexColor("#0B3D3A")
GREY_SOFT     = colors.HexColor("#F5F7FA")
GREY_ROW      = colors.HexColor("#FAFBFC")
GREY_BORDER   = colors.HexColor("#E5E7EB")

# Logo (candidatos)
_LOGO_CANDIDATES = [
    'branding/zirqulo-logo.png',                               # vía staticfiles
    '/srv/checkouters/Partners/static/branding/zirqulo-logo.png',  # absoluta
]
LOGO_PATH = finders.find(_LOGO_CANDIDATES[0]) or _LOGO_CANDIDATES[1]


# ==========================
# Utilidades de dominio
# ==========================
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
    # Mantengo tu formato entero + € (puedes cambiarlo a 2 decimales si quieres)
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


# ==========================
# Helpers visuales
# ==========================
def _logo_diagnostics_text():
    lines = []
    try:
        candidates = _LOGO_CANDIDATES if '_LOGO_CANDIDATES' in globals() else [LOGO_PATH] if LOGO_PATH else []
        for p in candidates:
            abs_p = os.path.abspath(p)
            exists = os.path.exists(p)
            lines.append(f"- {abs_p}  (existe: {'sí' if exists else 'no'})")
    except Exception as e:
        lines.append(f"(error recolectando diagnóstico: {e})")
    return "<br/>".join(lines) if lines else "(sin candidatos)"


def _draw_footer(canvas, doc):
    """
    Pie de página con numeración y línea sutil.
    """
    canvas.saveState()
    width, height = A4
    footer_y = 20  # desde el borde inferior
    # línea separadora
    canvas.setStrokeColor(GREY_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, footer_y + 10, width - doc.rightMargin, footer_y + 10)
    # texto: página X
    canvas.setFillColor(colors.gray)
    canvas.setFont("Helvetica", 8)
    page_txt = f"Página {canvas.getPageNumber()}"
    canvas.drawRightString(width - doc.rightMargin, footer_y, page_txt)
    # texto: marca
    canvas.drawString(doc.leftMargin, footer_y, "Zirqulo S.L. — Oferta de recompra")
    canvas.restoreState()


def _section_divider(color=GREY_BORDER, thickness=0.8, space=6):
    return KeepTogether([
        Spacer(1, space),
        HRFlowable(width="100%", thickness=thickness, color=color, spaceBefore=0, spaceAfter=0, lineCap='round'),
        Spacer(1, space),
    ])


# ==========================
# Generación del PDF
# ==========================
def generar_pdf_oportunidad(oportunidad, tenant=None):
    cliente = oportunidad.cliente
    dispositivos = Dispositivo.objects.filter(oportunidad=oportunidad)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=24,      # compactado
        bottomMargin=36,   # un poco más para el footer
        leftMargin=36,
        rightMargin=36,
    )
    elements = []

    # Estilos base
    styles = getSampleStyleSheet()
    styles["Title"].spaceBefore = 0
    styles["Title"].spaceAfter = 6
    styles["Title"].textColor = BRAND_DARK

    h3 = ParagraphStyle(
        "H3",
        parent=styles["Heading3"],
        textColor=BRAND_DARK,
        spaceBefore=6,
        spaceAfter=6
    )
    h4 = ParagraphStyle(
        "H4",
        parent=styles["Heading4"],
        textColor=BRAND_PRIMARY,
        spaceBefore=0,
        spaceAfter=4
    )
    p_norm = ParagraphStyle(
        "P",
        parent=styles["Normal"],
        fontSize=9,
        leading=12
    )
    cell_center = ParagraphStyle(
        "CellCenter",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        alignment=TA_CENTER
    )
    cell_right = ParagraphStyle(
        "CellRight",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        alignment=TA_RIGHT
    )
    cell_left = ParagraphStyle(
        "CellLeft",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        alignment=TA_LEFT
    )
    badge_style = ParagraphStyle(
        "Badge",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#6B7280"),  # Gris medio más sutil
        alignment=TA_RIGHT,
        fontName="Helvetica"
    )
    header_title = ParagraphStyle(
        "HeaderTitle",
        parent=styles["Normal"],
        fontSize=16,
        leading=20,
        textColor=BRAND_DARK,
        fontName="Helvetica-Bold",
        spaceBefore=0,
        spaceAfter=0
    )
    header_meta = ParagraphStyle(
        "HeaderMeta",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#6B7280")
    )

    # Encabezado superior (logo)
    fecha_generacion = datetime.now().strftime("%d/%m/%Y")
    comercial = oportunidad.usuario.get_full_name() if hasattr(oportunidad, "usuario") else "—"

    # Determinar qué logo usar: primero el del tenant, luego el default
    logo_path = LOGO_PATH
    if tenant:
        tenant_logo = getattr(tenant, 'logo', None)
        if tenant_logo and getattr(tenant_logo, 'path', None):
            try:
                if os.path.exists(tenant_logo.path):
                    logo_path = tenant_logo.path
                    logger.info(f"✅ Usando logo del tenant: {logo_path}")
                else:
                    logger.warning(f"⚠️ Logo del tenant no existe en disco: {tenant_logo.path}")
            except Exception as e:
                logger.warning(f"⚠️ Error verificando logo del tenant: {e}")

    if logo_path:
        try:
            im = Image(logo_path)
            im.hAlign = 'LEFT'
            im._restrictSize(220, 72)  # tamaño máximo
            elements.append(im)
        except Exception as e:
            diag = _logo_diagnostics_text()
            logger.warning("No se pudo cargar el logo desde %s: %s\nCandidatos:\n%s",
                           logo_path, e, diag.replace("<br/>", "\n"))
            elements.append(
                Paragraph(
                    f"<font color='red'><b>Advertencia:</b> no se pudo cargar el logo.</font><br/>"
                    f"<b>Ruta seleccionada:</b> {os.path.abspath(logo_path) if logo_path else '(vacía)'}<br/>"
                    f"<b>Rutas probadas:</b><br/>{diag}",
                    p_norm
                )
            )

    # Badge de branding Zirqulo (sutil, alineado a la derecha)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph("Trade-in powered by Zirqulo", badge_style))
    elements.append(Spacer(1, 8))

    # Encabezado de oferta compacto (título + metadatos en una línea)
    opp_ref = f"#{getattr(oportunidad, 'hashid', None) or getattr(oportunidad, 'uuid', 'N/A')}"

    # Título y metadatos en tabla horizontal compacta
    header_data = [[
        Paragraph("<b>OFERTA DE RECOMPRA</b>", header_title),
        Table([
            [
                Paragraph(f"📅 {fecha_generacion}", header_meta),
                Paragraph(f"👤 {comercial}", header_meta),
                Paragraph(f"📄 {opp_ref}", header_meta),
            ]
        ], colWidths=[90, 140, 100])
    ]]

    header_table = Table(header_data, colWidths=[180, 340])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)

    # Separador visual sutil
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1, color=GREY_BORDER, spaceBefore=0, spaceAfter=0, lineCap='round'))
    elements.append(Spacer(1, 8))

    # Datos del cliente / nuestros datos (2 columnas)
    datos_cliente = [
        Paragraph("<b>Datos del cliente</b>", h4),
        Paragraph(f"Razón social: {cliente.razon_social}", p_norm),
        Paragraph(f"CIF: {cliente.cif}", p_norm),
        Paragraph(f"Contacto: {cliente.contacto} ({cliente.posicion})", p_norm),
        Paragraph(f"Email: {cliente.correo}", p_norm),
    ]

    datos_nuestros = [
        Paragraph("<b>Nuestros datos</b>", h4),
        Paragraph("Zirqulo S.L.", p_norm),
        Paragraph("CIF: B12345678", p_norm),
        Paragraph("Santa María, 153, 5º 4ª", p_norm),
        Paragraph("08340 Vilassar de Mar", p_norm),
        Paragraph("Email: info@zirqulo.com", p_norm),
    ]

    tabla_datos = Table([[datos_cliente, datos_nuestros]], colWidths=[doc.width * 0.55, doc.width * 0.45])
    tabla_datos.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    elements.append(tabla_datos)

    elements.append(_section_divider(color=GREY_BORDER, thickness=0.8, space=8))

    # ==========================
    # Tabla principal (líneas)
    # ==========================
    elements.append(Paragraph("<b>Detalle de equipos</b>", h3))

    headers = [
        Paragraph("<b>Modelo</b>", cell_center),
        Paragraph("<b>Capacidad</b>", cell_center),
        Paragraph("<b>Estado equipo</b>", cell_center),
        Paragraph("<b>Cantidad</b>", cell_center),
        Paragraph("<b>Precio unit. sin IVA (€)</b>", cell_center),
        Paragraph("<b>Total sin IVA (€)</b>", cell_center),
    ]

    data = [headers]
    total_general = 0

    for idx, d in enumerate(dispositivos, start=1):
        modelo = Paragraph(d.modelo.descripcion if d.modelo else "—", cell_left)
        capacidad = Paragraph(str(d.capacidad.tamaño) if d.capacidad else "—", cell_center)
        estado_valoracion = Paragraph((d.estado_valoracion or "—").replace("_", " ").capitalize(), cell_center)
        cantidad = getattr(d, "cantidad", 1)
        precio_unitario = d.precio_orientativo or 0
        total_linea = float(precio_unitario) * cantidad
        total_general += total_linea

        data.append([
            modelo,
            capacidad,
            estado_valoracion,
            Paragraph(str(cantidad), cell_center),
            Paragraph(euros(precio_unitario), cell_right),
            Paragraph(euros(total_linea), cell_right),
        ])

    # Filas de totales con IVA desglosado
    iva_rate = Decimal("0.21")  # 21% IVA
    subtotal = Decimal(str(total_general))
    iva_amount = (subtotal * iva_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_con_iva = subtotal + iva_amount

    data.append([
        "", "", "", "",
        Paragraph("<b>SUBTOTAL (sin IVA)</b>", cell_right),
        Paragraph(f"<b>{euros(total_general)}</b>", cell_right),
    ])
    data.append([
        "", "", "", "",
        Paragraph("<b>IVA (21%)</b>", cell_right),
        Paragraph(f"<b>{euros(iva_amount)}</b>", cell_right),
    ])
    data.append([
        "", "", "", "",
        Paragraph("<b>TOTAL (con IVA)</b>", cell_right),
        Paragraph(f"<b>{euros(total_con_iva)}</b>", cell_right),
    ])

    table = Table(data, repeatRows=1, colWidths=[160, 60, 80, 60, 90, 90])
    # Estilos con filas alternas y caja de totales resaltada
    ts = [
    # Encabezado sutil
    ("BACKGROUND", (0, 0), (-1, 0), colors.white),
    ("TEXTCOLOR", (0, 0), (-1, 0), BRAND_DARK),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 8),
    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LINEBELOW", (0, 0), (-1, 0), 0.8, GREY_BORDER),

    # Cuerpo con filas alternas (excluyendo las 3 últimas filas de totales)
    ("GRID", (0, 1), (-1, -4), 0.25, GREY_BORDER),
    ("ROWBACKGROUNDS", (0, 1), (-1, -4), [colors.white, GREY_ROW]),

    # Filas de totales (3 últimas filas)
    ("LINEABOVE", (0, -3), (-1, -3), 1.2, GREY_BORDER),  # Línea antes del subtotal
    ("TEXTCOLOR", (-2, -3), (-2, -1), BRAND_DARK),
    ("FONTNAME", (-2, -3), (-1, -1), "Helvetica-Bold"),
    ("BACKGROUND", (0, -1), (-1, -1), GREY_SOFT),  # Fondo sutil para total final
    ("LINEABOVE", (0, -1), (-1, -1), 1.5, BRAND_PRIMARY),  # Línea destacada antes del total
]
    table.setStyle(TableStyle(ts))
    elements.append(table)

    elements.append(_section_divider(color=GREY_BORDER, thickness=0.8, space=10))

    # ==========================
    # Tabla de precios por estado
    # ==========================
    elements.append(Paragraph("<b>Precios por estado del dispositivo</b>", h3))

    precios_headers = [
        Paragraph("<b>Modelo</b>", cell_center),
        Paragraph("<b>Capacidad</b>", cell_center),
        Paragraph("<b>Excelente (€, sin IVA)</b>", cell_center),
        Paragraph("<b>Muy bueno (€, sin IVA)</b>", cell_center),
        Paragraph("<b>Bueno (€, sin IVA)</b>", cell_center),
    ]

    precios_data = [precios_headers]
    canal_pdf = _canal_from_oportunidad(oportunidad)
    _cache_precios = {}

    elementos_mostrados = set()
    for d in dispositivos:
        key = (getattr(d.modelo, 'descripcion', '—'), getattr(d.capacidad, 'tamaño', '—'))
        if key in elementos_mostrados:
            continue
        elementos_mostrados.add(key)

        cap_id = getattr(d.capacidad, 'id', None)
        base = _precio_recompra_vigente(cap_id, canal_pdf, cache=_cache_precios)
        precio_base = Decimal(str(base)) if base is not None else Decimal("0.00")

        factor = Decimal(str(get_factor(float(precio_base))))
        precio_excelente = precio_base
        precio_muy_bueno = (precio_excelente * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        precio_bueno = (precio_muy_bueno * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        precios_data.append([
            Paragraph(key[0], cell_left),
            Paragraph(str(key[1]), cell_center),
            Paragraph(euros(precio_excelente.to_integral_value(rounding=ROUND_HALF_UP)), cell_right),
            Paragraph(euros(precio_muy_bueno.to_integral_value(rounding=ROUND_HALF_UP)), cell_right),
            Paragraph(euros(precio_bueno.to_integral_value(rounding=ROUND_HALF_UP)), cell_right),
        ])

    precios_table = Table(precios_data, repeatRows=1, colWidths=[170, 70, 80, 80, 80])
    precios_table.setStyle(TableStyle([
        # Encabezado sutil
        ("BACKGROUND", (0, 0), (-1, 0), colors.white),
        ("TEXTCOLOR", (0, 0), (-1, 0), BRAND_DARK),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, GREY_BORDER),

        # Cuerpo
        ("GRID", (0, 1), (-1, -1), 0.25, GREY_BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GREY_ROW]),
    ]))
    elements.append(precios_table)

    elements.append(_section_divider(color=GREY_BORDER, thickness=0.8, space=10))

    # ==========================
    # Descripción de estados
    # ==========================
    elements.append(Paragraph("<b>Descripción de estados</b>", h3))
    desc_box = Table([[
        Paragraph(
            "<b>Excelente:</b> Sin marcas visibles, 100% funcional.<br/>"
            "<b>Muy bueno:</b> Pequeños signos de uso, totalmente funcional.<br/>"
            "<b>Bueno:</b> Signos visibles de uso, pero funcional.",
            p_norm
        )
    ]], colWidths=[doc.width])
    desc_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREY_SOFT),
        ("BOX", (0, 0), (-1, -1), 0.5, GREY_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(desc_box)

    # Render final con pie de página en todas las páginas
    doc.build(elements, onFirstPage=_draw_footer, onLaterPages=_draw_footer)
    buffer.seek(0)
    return buffer
