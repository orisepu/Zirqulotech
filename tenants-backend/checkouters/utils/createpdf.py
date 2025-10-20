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
from productos.services.grade_mapping import (
    GRADE_LABELS, GRADE_DESCRIPTIONS, legacy_to_grade, valoracion_to_grade, format_grade_full
)

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

# Logo (candidatos) - buscar en orden hasta encontrar uno que exista
_LOGO_CANDIDATES = [
    'branding/zirqulo-logo.png',                               # vía staticfiles
    '/srv/checkouters/Partners/static/branding/zirqulo-logo.png',  # absoluta (producción)
]

# Buscar logo: primero intentar con staticfiles, luego buscar archivo que exista
LOGO_PATH = None

# 1. Intentar con staticfiles
staticfiles_path = finders.find(_LOGO_CANDIDATES[0])
if staticfiles_path and os.path.exists(staticfiles_path):
    LOGO_PATH = staticfiles_path
else:
    # 2. Buscar en candidatos manuales que existan
    for candidate in _LOGO_CANDIDATES:
        # Convertir rutas relativas a absolutas si es necesario
        check_path = candidate if os.path.isabs(candidate) else os.path.join(os.path.dirname(__file__), '..', '..', candidate)
        check_path = os.path.abspath(check_path)

        if os.path.exists(check_path):
            LOGO_PATH = check_path
            break
    else:
        # 3. Fallback al último candidato
        LOGO_PATH = _LOGO_CANDIDATES[-1]


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


def _section_divider(width=None, color=GREY_BORDER, thickness=0.8, space=10):
    """
    Crea un separador de sección con espaciado uniforme.
    
    Args:
        width: Ancho de la línea. Si es None, usa "100%" para ocupar todo el ancho
        color: Color de la línea
        thickness: Grosor de la línea
        space: Espaciado antes y después
    """
    line_width = width if width is not None else "100%"
    
    return KeepTogether([
        Spacer(1, space),
        HRFlowable(
            width=line_width,
            thickness=thickness, 
            color=color, 
            spaceBefore=0, 
            spaceAfter=0, 
            lineCap='round'
        ),
        Spacer(1, space),
    ])


# ==========================
# Generación del PDF
# ==========================
def generar_pdf_oportunidad(oportunidad, tenant=None, dispositivos_override=None):
    """
    Genera PDF de oportunidad.

    Args:
        oportunidad: Instancia de Oportunidad
        tenant: Tenant actual (para logo personalizado)
        dispositivos_override: Lista de dispositivos a usar (puede ser Dispositivo o DispositivoReal).
                              Si None, usa Dispositivo.objects.filter(oportunidad=oportunidad)
    """
    cliente = oportunidad.cliente

    # Usar dispositivos override si se proporciona, sino usar los declarados (Dispositivo)
    if dispositivos_override is not None:
        dispositivos = dispositivos_override
    else:
        dispositivos = Dispositivo.objects.filter(oportunidad=oportunidad).select_related(
            'modelo', 'capacidad', 'dispositivo_personalizado'
        )

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
        fontSize=10,
        leading=14,
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

    # Determinar logos a mostrar
    tenant_logo_path = None
    usa_logo_tenant = False

    # 1. Verificar si hay logo del tenant
    if tenant:
        tenant_logo = getattr(tenant, 'logo', None)
        if tenant_logo and getattr(tenant_logo, 'path', None):
            try:
                if os.path.exists(tenant_logo.path):
                    tenant_logo_path = tenant_logo.path
                    usa_logo_tenant = True
                    logger.info(f"✅ Usando logo del tenant: {tenant_logo_path}")
                else:
                    logger.warning(f"⚠️ Logo del tenant no existe en disco: {tenant_logo.path}")
            except Exception as e:
                logger.warning(f"⚠️ Error verificando logo del tenant: {e}")

    # 2. Mostrar un solo logo (prioridad: tenant > Zirqulo)
    logo_img = None

    # Intentar cargar logo del tenant primero
    if tenant_logo_path:
        try:
            logo_img = Image(tenant_logo_path)
            logo_img._restrictSize(240, 80)
            logger.info(f"✅ Logo del tenant cargado: {tenant_logo_path}")
        except Exception as e:
            logger.warning(f"No se pudo cargar el logo del tenant desde {tenant_logo_path}: {e}")

    # Si no hay logo del tenant, usar logo de Zirqulo
    if logo_img is None and LOGO_PATH:
        try:
            logo_img = Image(LOGO_PATH)
            logo_img._restrictSize(200, 70)
            logger.info(f"✅ Logo de Zirqulo cargado: {LOGO_PATH}")
        except Exception as e:
            diag = _logo_diagnostics_text()
            logger.warning("No se pudo cargar el logo de Zirqulo desde %s: %s\nCandidatos:\n%s",
                           LOGO_PATH, e, diag.replace("<br/>", "\n"))

    # Renderizar logo con margen izquierdo reducido (más pegado a la izquierda)
    if logo_img:
        logo_img.hAlign = 'LEFT'
        elements.append(logo_img)
        elements.append(Spacer(1, 8))

    # Determinar tipo de oferta (formal vs temporal)
    es_oferta_formal = dispositivos_override is not None
    titulo_oferta = "OFERTA RECOMPRA" if es_oferta_formal else "OFERTA ORIENTATIVA"

    # Encabezado de oferta compacto (título + metadatos en una línea)
    opp_ref = f"#{getattr(oportunidad, 'hashid', None) or getattr(oportunidad, 'uuid', 'N/A')}"

    # Título y metadatos en tabla horizontal compacta
    metadata_table_data = [[
    Paragraph(f"📅 {fecha_generacion}", header_meta),
    Paragraph(f"👤 {comercial}", header_meta),
    Paragraph(f"📄 {opp_ref}", header_meta),
    ]]

    metadata_table = Table(metadata_table_data, colWidths=[90, 140, 100])
    metadata_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    # Ahora crear la tabla principal del header
    header_data = [[
        Paragraph(f"<b>{titulo_oferta}</b>", header_title),
        metadata_table
    ]]

    header_table = Table(header_data, colWidths=[doc.width * 0.35, doc.width * 0.65])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),   # ← Añadido: eliminar padding izquierdo
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),  # ← Añadido: eliminar padding derecho
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)

    # Separador visual sutil
    elements.append(Spacer(1, 10))  # Espaciado uniforme
    elements.append(HRFlowable(
        width=doc.width, 
        thickness=1, 
        color=GREY_BORDER, 
        spaceBefore=0, 
        spaceAfter=0, 
        lineCap='round'
    ))
    elements.append(Spacer(1, 10))

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
        Paragraph("C. de la Industria, 114", p_norm),
        Paragraph("08912 Badalona", p_norm),
        Paragraph("Email: info@zirqulo.com", p_norm),
    ]

    tabla_datos = Table([[datos_cliente, datos_nuestros]], colWidths=[doc.width * 0.50, doc.width * 0.50])
    tabla_datos.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        # Columna izquierda (Datos del cliente) sin padding
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        # Columna derecha (Nuestros datos) con padding izquierdo para desplazar a la derecha
        ("LEFTPADDING", (1, 0), (1, 0), 130),  # ← Añade espacio a la izquierda
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(tabla_datos)

    elements.append(_section_divider( color=GREY_BORDER, thickness=0.8, space=8))

    # ==========================
    # Tabla principal (líneas)
    # ==========================
    # Solo mostrar "Valoración máxima" en ofertas temporales
    if not es_oferta_formal:
        elements.append(Paragraph("<b>Valoración máxima</b>", h3))

    # Headers dinámicos: agregar IMEI/SN en ofertas formales
    if es_oferta_formal:
        headers = [
            Paragraph("<b>Modelo</b>", cell_center),
            Paragraph("<b>Cap.</b>", cell_center),
            Paragraph("<b>IMEI / SN</b>", cell_center),
            Paragraph("<b>Grado</b>", cell_center),
            Paragraph("<b>Cant.</b>", cell_center),
            Paragraph("<b>Precio sin IVA</b>", cell_center),
            Paragraph("<b>Total sin IVA</b>", cell_center),
        ]
    else:
        headers = [
            Paragraph("<b>Modelo</b>", cell_center),
            Paragraph("<b>Cap.</b>", cell_center),
            Paragraph("<b>Grado</b>", cell_center),
            Paragraph("<b>Cant.</b>", cell_center),
            Paragraph("<b>Precio sin IVA</b>", cell_center),
            Paragraph("<b>Total sin IVA</b>", cell_center),
        ]

    data = [headers]
    total_general = 0

    for idx, d in enumerate(dispositivos, start=1):
        # Detectar si es dispositivo personalizado
        if hasattr(d, 'dispositivo_personalizado') and d.dispositivo_personalizado:
            # Dispositivo personalizado: usar __str__() que genera "Marca Modelo Capacidad"
            modelo = Paragraph(str(d.dispositivo_personalizado), cell_left)
            capacidad = Paragraph("—", cell_center)  # Ocultar capacidad
        else:
            # Dispositivo Apple: flujo normal
            modelo = Paragraph(d.modelo.descripcion if d.modelo else "—", cell_left)
            capacidad = Paragraph(str(d.capacidad.tamaño) if d.capacidad else "—", cell_center)

        # Mapear estado a grado oficial
        estado_valoracion_raw = getattr(d, "estado_valoracion", None)
        estado_fisico_raw = getattr(d, "estado_fisico", None)
        estado_funcional_raw = getattr(d, "estado_funcional", None)

        if estado_valoracion_raw:
            grado = valoracion_to_grade(estado_valoracion_raw)
        else:
            grado = legacy_to_grade(estado_fisico_raw, estado_funcional_raw)

        # Mostrar etiqueta española del grado
        estado_valoracion = Paragraph(GRADE_LABELS.get(grado, grado), cell_center)

        # DispositivoReal no tiene cantidad (siempre es 1)
        cantidad = getattr(d, "cantidad", 1)

        # Soportar tanto Dispositivo (precio_orientativo) como DispositivoReal (precio_final)
        precio_unitario = getattr(d, "precio_final", None) or getattr(d, "precio_orientativo", None) or 0

        total_linea = float(precio_unitario) * cantidad
        total_general += total_linea

        # Construir fila con o sin IMEI/SN según tipo de oferta
        if es_oferta_formal:
            imei = getattr(d, "imei", None) or ""
            numero_serie = getattr(d, "numero_serie", None) or ""

            # Construir texto combinado IMEI / SN
            if imei and numero_serie:
                imei_sn_text = f"{imei} / {numero_serie}"
            elif imei:
                imei_sn_text = imei
            elif numero_serie:
                imei_sn_text = numero_serie
            else:
                imei_sn_text = "—"

            data.append([
                modelo,
                capacidad,
                Paragraph(str(imei_sn_text), cell_center),
                estado_valoracion,
                Paragraph(str(cantidad), cell_center),
                Paragraph(euros(precio_unitario), cell_right),
                Paragraph(euros(total_linea), cell_right),
            ])
        else:
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

    # Ajustar columnas vacías según tipo de oferta
    empty_cols = ["", "", "", "", ""] if es_oferta_formal else ["", "", "", ""]

    data.append(empty_cols + [
        Paragraph("<b>SUBTOTAL (sin IVA)</b>", cell_right),
        Paragraph(f"<b>{euros(total_general)}</b>", cell_right),
    ])
    data.append(empty_cols + [
        Paragraph("<b>IVA (21%)</b>", cell_right),
        Paragraph(f"<b>{euros(iva_amount)}</b>", cell_right),
    ])
    data.append(empty_cols + [
        Paragraph("<b>TOTAL (con IVA)</b>", cell_right),
        Paragraph(f"<b>{euros(total_con_iva)}</b>", cell_right),
    ])

    # Anchos de columna dinámicos según tipo de oferta
    if es_oferta_formal:
        # 7 columnas: Modelo | Capacidad | IMEI | Grado | Cantidad | Precio | Total
        colWidths = [130, 50, 90, 70, 45, 70, 70]
    else:
        # 6 columnas: Modelo | Capacidad | Grado | Cantidad | Precio | Total
        colWidths = [150, 50, 80, 50, 80, 80]

    table = Table(data, repeatRows=1, colWidths=colWidths)
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

    elements.append(_section_divider(doc.width, color=GREY_BORDER, thickness=0.8, space=10))

    # ==========================
    # Tabla de precios por grado
    # Solo en ofertas temporales (dispositivos declarados)
    # ==========================
    if not es_oferta_formal:
        elements.append(Paragraph("<b>Precios por grado del dispositivo (sin IVA)</b>", h3))

        precios_headers = [
            Paragraph("<b>Modelo</b>", cell_center),
            Paragraph("<b>Capacidad</b>", cell_center),
            Paragraph(f"<b>{format_grade_full('A+')}</b>", cell_center),
            Paragraph(f"<b>{format_grade_full('A')}</b>", cell_center),
            Paragraph(f"<b>{format_grade_full('B')}</b>", cell_center),
            Paragraph(f"<b>{format_grade_full('C')}</b>", cell_center),
        ]

        precios_data = [precios_headers]
        canal_pdf = _canal_from_oportunidad(oportunidad)
        _cache_precios = {}

        elementos_mostrados = set()
        for d in dispositivos:
            # Saltar dispositivos personalizados (no tienen precios por grado de PrecioRecompra)
            if hasattr(d, 'dispositivo_personalizado') and d.dispositivo_personalizado:
                continue

            key = (getattr(d.modelo, 'descripcion', '—'), getattr(d.capacidad, 'tamaño', '—'))
            if key in elementos_mostrados:
                continue
            elementos_mostrados.add(key)

            cap_id = getattr(d.capacidad, 'id', None)
            base = _precio_recompra_vigente(cap_id, canal_pdf, cache=_cache_precios)
            precio_base = Decimal(str(base)) if base is not None else Decimal("0.00")

            # Calcular precios por grado: A+ (base), A, B, C
            factor = Decimal(str(get_factor(float(precio_base))))
            precio_a_plus = precio_base  # A+ = Como nuevo (precio base)
            precio_a = (precio_a_plus * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)  # A = Excelente
            precio_b = (precio_a * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)  # B = Muy bueno
            precio_c = (precio_b * factor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)  # C = Correcto

            precios_data.append([
                Paragraph(key[0], cell_left),
                Paragraph(str(key[1]), cell_center),
                Paragraph(euros(precio_a_plus.to_integral_value(rounding=ROUND_HALF_UP)), cell_right),
                Paragraph(euros(precio_a.to_integral_value(rounding=ROUND_HALF_UP)), cell_right),
                Paragraph(euros(precio_b.to_integral_value(rounding=ROUND_HALF_UP)), cell_right),
                Paragraph(euros(precio_c.to_integral_value(rounding=ROUND_HALF_UP)), cell_right),
            ])

        # Solo mostrar tabla si hay dispositivos Apple (precios_data tiene más de 1 fila = headers + datos)
        if len(precios_data) > 1:
            precios_table = Table(precios_data, repeatRows=1, colWidths=[150, 60, 75, 75, 75, 75])
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

            elements.append(_section_divider(doc.width, color=GREY_BORDER, thickness=0.8, space=10))

    # ==========================
    # Descripción de estados
    # ==========================
    elements.append(Paragraph("<b>Descripción de grados</b>", h3))

    # Generar descripciones desde GRADE_DESCRIPTIONS (A+ a D, omitir R en ofertas comerciales)
    desc_lines = []
    for grade in ['A+', 'A', 'B', 'C', 'D']:
        desc = GRADE_DESCRIPTIONS[grade]
        label = desc['label']
        short = desc['short']
        desc_lines.append(f"<b>{label}:</b> {short}")

    desc_text = "<br/>".join(desc_lines)

    desc_box = Table([[
        Paragraph(desc_text, p_norm)
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
