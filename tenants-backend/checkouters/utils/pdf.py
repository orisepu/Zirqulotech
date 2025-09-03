# utils/pdf.py
import io, hashlib, datetime, logging, re,json
from decimal import Decimal
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from django.utils import timezone
from django.utils.html import strip_tags
from checkouters.legal.resolver import resolve_legal_template
from checkouters.utils.legal_render import render_blocklist
from django_tenants.utils import get_tenant_model
from checkouters.utils.legal_context import build_legal_context
from django.db import connection
from markdown import markdown
from django.template import engines
from reportlab.lib.enums import TA_RIGHT
from xml.sax.saxutils import escape as xesc

logger = logging.getLogger(__name__)
ALLOWED_TAGS = {"b","i","u","br","font","a"}
def _capfirst(s) -> str:
    s = str(s or "").strip()
    return s[:1].upper() + s[1:]  # (si prefieres forzar minúsculas en el resto: s[:1].upper() + s[1:].lower())

try:
    from pypdf import PdfReader, PdfWriter
except Exception:
    try:
        from PyPDF2 import PdfReader, PdfWriter  # fallback
    except Exception:
        PdfReader = PdfWriter = None


def build_contract_ctx(contrato) -> dict:
    """
    Normaliza contrato.contrato_datos a ctx {'operador','cliente','contrato','dispositivos'}.
    Campo-compat forward: admite claves antiguas como 'empresa', 'dni' etc.
    """
    datos = getattr(contrato, "contrato_datos", {}) or {}
    empresa = datos.get("empresa", {}) or {}
    cliente = datos.get("cliente", {}) or {}
    dispositivos = (datos.get("dispositivos_estimados") or
                    datos.get("dispositivos") or [])
    numero = datos.get("numero") or datos.get("contrato", {}).get("numero") or getattr(contrato, "codigo", "")
    fecha  = datos.get("fecha")  or datos.get("contrato", {}).get("fecha")  or timezone.now().date().isoformat()

    ctx = {
        "operador": {
            "nombre":   empresa.get("nombre")   or empresa.get("razon_social") or "—",
            "cif":      empresa.get("cif")      or empresa.get("nif") or "—",
            "direccion":empresa.get("direccion") or "",
            "email":    empresa.get("email")    or "",
            "telefono": empresa.get("telefono") or "",
            "web":      empresa.get("web")      or "",
            "direccion_logistica": empresa.get("direccion_logistica") or "",
        },
        "cliente": {
            "nombre":   cliente.get("nombre")   or "—",
            "apellidos":cliente.get("apellidos") or "",
            "dni_nie":  cliente.get("dni_nie")  or cliente.get("dni") or cliente.get("documento") or "",
            "email":    cliente.get("email")    or "",
            "telefono": cliente.get("telefono") or "",
            "direccion":cliente.get("direccion") or "",
            "canal":    cliente.get("canal") or ( "b2c" if not getattr(contrato, "es_b2b", False) else "b2b" ),
        },
        "contrato": {
            "numero": numero,
            "fecha":  fecha,
            "otp_hash": datos.get("otp_hash") or "",
            "kyc_ref":  datos.get("kyc_ref")  or "",
            "importe_total": datos.get("total") or 0,
            "validez_dias": datos.get("validez_dias") or 14,
        },
        "dispositivos": dispositivos,
    }
    return ctx

def _strip_html_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "").strip()

def _parse_html_table(html: str):
    """
    Extrae la primera tabla simple <table><tr><td>...</td>...</tr>...</table>.
    Devuelve list[list[str]] (celdas en texto plano).
    """
    m = re.search(r"<table[^>]*>(.*?)</table>", html, flags=re.I|re.S)
    if not m:
        return None
    table_html = m.group(1)
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, flags=re.I|re.S)
    data = []
    for r in rows:
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, flags=re.I|re.S)
        data.append([_strip_html_tags(c) or " " for c in cells])
    return data if any(data) else None

def _html_to_story(html: str, styles):
    """
    Convierte un HTML “de editor” a Flowables:
      - <p>, <br>, <b>, <i>, <u>
      - <ul>/<ol> planos
      - <table> simple → ReportLab Table
    Si hay varias tablas, renderiza solo la primera (suficiente para tu cabecera).
    """
    from reportlab.platypus import Paragraph, Table, TableStyle, Spacer
    parts = []

    if not html:
        return parts

    # 1) Tabla (si existe), la recortamos y renderizamos
    table_data = _parse_html_table(html)
    if table_data:
        # Antes de la tabla, imprimimos el texto que vaya antes de <table>
        before = html.split("<table", 1)[0]
        if _strip_html_tags(before):
            parts.append(Paragraph(_markdown_to_rl(_strip_html_tags(before)), styles["Small"]))
            parts.append(Spacer(1, 4))

        t = Table(table_data, hAlign="LEFT")
        t.setStyle(TableStyle([
            ("GRID", (0,0), (-1,-1), 0.25, colors.grey),
            ("BACKGROUND", (0,0), (-1,0), colors.whitesmoke),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        parts.append(t)
        parts.append(Spacer(1, 6))

        # Después de la tabla
        after = html.split("</table>", 1)[-1]
        if _strip_html_tags(after):
            parts.append(Paragraph(_markdown_to_rl(_strip_html_tags(after)), styles["Small"]))
            parts.append(Spacer(1, 4))
        return parts

    # 2) Sin tabla: troceo simple por <p> y <br/>
    # Sustituimos <br> por saltos para Paragraph
    norm = (html or "").replace("\r\n", "\n").replace("<br>", "<br/>").replace("<BR>", "<br/>")
    # Quita <p> contenedores para no duplicar márgenes
    norm = re.sub(r"</?p[^>]*>", "", norm, flags=re.I)
    chunks = re.split(r"<br\s*/?>", norm, flags=re.I)
    for ch in chunks:
        text = _strip_html_tags(ch)
        if not text:
            continue
        # Permitimos los estilos simples transformando a pseudo-markdown y luego a RL
        parts.append(Paragraph(_markdown_to_rl(text), styles["Small"]))
        parts.append(Spacer(1, 2))
    return parts

def _render_cabecera_html(tenant, contrato, *, override_cabecera_html: str | None = None) -> str:
    """
    Intenta cargar la plantilla activa de 'b2c-contrato-cabecera' (namespace 'default'),
    la renderiza con el contexto del contrato y devuelve HTML. Si pasas override_cabecera_html,
    usa ese contenido directamente.
    """
    raw = (override_cabecera_html or "").strip()
    if not raw:
        # TODO: implementa aquí la lectura de tu modelo de plantillas “texto”
        # p.ej.: from ajustes.legales.models import TextTemplate
        # tpl = TextTemplate.objects.filter(namespace='default', slug='b2c-contrato-cabecera', is_active=True).last()
        # raw = (tpl.content or "") if tpl else ""
        raw = ""

    ctx = build_contract_ctx(contrato)
    try:
        tpl = engines["django"].from_string(raw)
        return tpl.render(ctx)
    except Exception as e:
        logger.warning("[PDF] cabecera: fallo render HTML, causa=%r", e, exc_info=True)
        return ""
# --- FIN helpers nuevos -------------------------------------------------------


def _short(obj, maxlen: int = 180):
    try:
        s = json.dumps(obj, ensure_ascii=False)
    except Exception:
        s = str(obj)
    return (s if len(s) <= maxlen else s[:maxlen] + "…")

def _markdown_to_rl(text: str) -> str:
    """
    Convierte markdown → HTML → HTML “seguro” para ReportLab Paragraph.
    - h1..h6 → <b>...</b><br/>
    - strong/em → b/i
    - ul/ol → '• item<br/>' / '1) item<br/>'
    - links → 'texto (URL)'
    - elimina tags desconocidos
    """
    if not text:
        return ""
    try:
        html = markdown(text, extensions=["extra", "sane_lists"])  # md → html
    except Exception:
        logger.warning("[MD] fallo al parsear markdown, usando texto plano")
        html = text

    # headings → bold + salto
    html = re.sub(r"</?h[1-6]>", "", html, flags=re.I)  # quitamos tags y
    html = re.sub(r"<h[1-6][^>]*>(.*?)</h[1-6]>", r"<b>\1</b><br/>", html, flags=re.I|re.S)

    # strong/em
    html = re.sub(r"<(/?)strong>", r"<\1b>", html, flags=re.I)
    html = re.sub(r"<(/?)em>", r"<\1i>", html, flags=re.I)

    # listas no anidadas (soporte simple y robusto)
    def _ul_to_text(m):
        inner = m.group(1)
        items = re.findall(r"<li[^>]*>(.*?)</li>", inner, flags=re.I|re.S)
        return "".join([f"• {re.sub('<[^>]+>', '', it).strip()}<br/>" for it in items])

    def _ol_to_text(m):
        inner = m.group(1)
        items = re.findall(r"<li[^>]*>(.*?)</li>", inner, flags=re.I|re.S)
        out = []
        for i, it in enumerate(items, 1):
            it = re.sub(r"<[^>]+>", "", it).strip()
            out.append(f"{i}) {it}<br/>")
        return "".join(out)

    html = re.sub(r"<ul[^>]*>(.*?)</ul>", _ul_to_text, html, flags=re.I|re.S)
    html = re.sub(r"<ol[^>]*>(.*?)</ol>", _ol_to_text, html, flags=re.I|re.S)

    # enlaces → "texto (url)"
    def _a_to_text(m):
        href = m.group(1) or ""
        txt  = re.sub(r"<[^>]+>", "", m.group(2) or "").strip()
        if txt and href:
            return f"{txt} ({href})"
        return txt or href

    html = re.sub(r'<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)</a>', _a_to_text, html, flags=re.I|re.S)

    # p → nada (ReportLab ya separa con <br/> si lo dejamos así)
    html = re.sub(r"</?p[^>]*>", "", html, flags=re.I)

    # limpiar cualquier otro tag (dejar solo br, b, i, u, font)
    def _strip_unknown_tags(h: str) -> str:
        # elimina cualquier <tag ...> que no sea allowed
        def repl(m):
            tag = (m.group(1) or "").lower().strip("/")
            if tag in ALLOWED_TAGS:
                return m.group(0)  # dejamos tal cual
            return ""  # lo quitamos
        return re.sub(r"<\s*/?\s*([a-z0-9]+)(\s+[^>]*)?>", repl, h, flags=re.I)

    html = _strip_unknown_tags(html)

    # normaliza saltos
    html = html.replace("\r\n", "\n").replace("\n", "<br/>")
    return html.strip()

def _money(v) -> str:
    try:
        return f"{Decimal(v):,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return f"{v} €"


def _snip(s: str, n: int = 160) -> str:
    try:
        s = str(s)
    except Exception:
        return "<no-str>"
    s = s.replace("\n", " ").replace("\r", " ")
    return (s[:n] + "…") if len(s) > n else s


def _render_condiciones_b2c(tenant, contrato, *, debug: bool = True):
    """
    Devuelve (lista_de_parrafos, metas_usadas)
    - Gestionado: base = tenant.legal_slug o 'b2c-condiciones'
    - Autoadmin: base = 'b2c-condiciones-autoadmin' + anexo 'b2c-mandatorio-operador'
    Con trazas detalladas para diagnóstico.
    """
    logs = []
    def log(msg, level="info", exc=None):
        logs.append(str(msg))
        fn = getattr(logger, level, logger.info)
        fn(f"[COND] {msg}", exc_info=exc)

    try:
        namespaces = list(tenant.effective_legal_namespaces() or [])
    except Exception as e:
        namespaces = []
        log(f"effective_legal_namespaces() error: {e}", "warning", exc=True)

    if "default" not in namespaces:
        namespaces.append("default")

    try:
        overlay = tenant.legal_overlay()
        overlay_keys = list((overlay or {}).keys())
    except Exception as e:
        overlay = {}
        overlay_keys = []
        log(f"legal_overlay() error: {e}", "warning", exc=True)

    ctx = build_legal_context(contrato, overlay)
    is_autoadmin = bool(getattr(tenant, "is_autoadmin", False))
    configured_slug = getattr(tenant, "legal_slug", None)
    base_slug = "b2c-condiciones-autoadmin" if is_autoadmin else (configured_slug or "b2c-condiciones")

    log(f"tenant={getattr(tenant,'schema_name','?')} mode={'autoadmin' if is_autoadmin else 'gestionado'} "
        f"namespaces={namespaces} base_slug={base_slug} overlay_keys={overlay_keys}")

    out, metas = [], []

    # --- BASE ---
    try:
        tpl_blocks, meta = resolve_legal_template(base_slug, namespaces=namespaces)
        rendered = render_blocklist(tpl_blocks, ctx) or []
        out.extend(rendered); metas.append(meta or {})
        log(f"OK base slug={meta.get('slug')} ns={meta.get('namespace')} ver={meta.get('version')} bloques={len(rendered)}")
    except Exception as e:
        log(f"Fallo base slug={base_slug} en namespaces={namespaces}", "warning", exc=True)
        # fallback duro
        try:
            tpl_blocks, meta = resolve_legal_template(base_slug, namespaces=["default"])
            rendered = render_blocklist(tpl_blocks, ctx) or []
            out.extend(rendered); metas.append(meta or {})
            log(f"OK base (fallback default) slug={meta.get('slug')} ver={meta.get('version')} bloques={len(rendered)}")
        except Exception as e2:
            log(f"Fallo base fallback default slug={base_slug}", "error", exc=True)

    # --- MANDATORIO (solo autoadmin) ---
    if is_autoadmin:
        slug_mand = "b2c-mandatorio-operador"
        try:
            tpl_blocks, meta = resolve_legal_template(slug_mand, namespaces=namespaces)
            rendered = render_blocklist(tpl_blocks, ctx) or []
            out.extend(rendered); metas.append(meta or {})
            log(f"OK mandatorio slug={meta.get('slug')} ns={meta.get('namespace')} ver={meta.get('version')} bloques={len(rendered)}")
        except Exception as e:
            log(f"Fallo mandatorio slug={slug_mand} en namespaces={namespaces}", "warning", exc=True)
            try:
                tpl_blocks, meta = resolve_legal_template(slug_mand, namespaces=["default"])
                rendered = render_blocklist(tpl_blocks, ctx) or []
                out.extend(rendered); metas.append(meta or {})
                log(f"OK mandatorio (fallback default) slug={meta.get('slug')} ver={meta.get('version')} bloques={len(rendered)}")
            except Exception as e2:
                log(f"Fallo mandatorio fallback default slug={slug_mand}", "error", exc=True)

    log(f"TOTAL bloques condiciones={len(out)}")
    if debug and out:
        log(f"Preview bloque[0]: {_snip(out[0])}")

    return out, metas


def generar_pdf_contrato(contrato, preview: bool = False, override_cuerpo_html: str | None = None):
    logger.info(
        "[PDF] Generar contrato id=%s schema=%s es_acta=%s estado=%s",
        getattr(contrato, "id", None),
        getattr(connection, "schema_name", None),
        bool(getattr(contrato, "es_acta", False) or getattr(contrato, "tipo", "") == "acta"),
        getattr(contrato, "estado", None),
    )

    # Datos base (por si necesitas algún fallback)
    datos = getattr(contrato, "contrato_datos", {}) or {}
    empresa = datos.get("empresa", {}) or {}
    cliente = datos.get("cliente", {}) or {}
    es_acta = bool(getattr(contrato, "es_acta", False) or getattr(contrato, "tipo", "") == "acta")
    if es_acta:
        dispositivos = datos.get("dispositivos", []) or datos.get("dispositivos_estimados", []) or []
    else:
        dispositivos = datos.get("dispositivos_estimados", []) or datos.get("dispositivos", []) or []

    # 1) Resuelve CONDICIONES (las imprimimos SIEMPRE al final del cuerpo)
    condiciones = []
    try:
        tenant = get_tenant_model().objects.get(schema_name=connection.schema_name)
        rendered_cond, metas = _render_condiciones_b2c(tenant, contrato, debug=True)
        condiciones = rendered_cond or []
    except Exception:
        logger.error("[PDF] Error resolviendo condiciones", exc_info=True)
        condiciones = []

    if isinstance(condiciones, str):
        condiciones = [condiciones]

    firmado = bool(getattr(contrato, "firmado_en", None)) and getattr(contrato, "estado", "") == "firmado"

    # 2) Documento
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Small", fontSize=9, leading=12))
    styles.add(ParagraphStyle(name="Tiny", fontSize=8, leading=10, textColor=colors.grey))
    H1 = styles["Heading1"]; H2 = styles["Heading2"]; P = styles["Small"]

    story = []

    # Cabecera mínima (título + fecha)
    es_acta = bool(getattr(contrato, "es_acta", False) or getattr(contrato, "tipo", "") == "acta")
    titulo = "Acta de recepción" if es_acta else "Contrato de compra-venta (B2C)"
    story.append(Paragraph(titulo, H1))
    fecha_txt = (getattr(contrato, "firmado_en", None) or datetime.datetime.now()).strftime("%d/%m/%Y %H:%M")
    story.append(Paragraph(f"Fecha: {fecha_txt}", styles["Small"]))
    if es_acta:
        ref_sha = datos.get("ref_sha256") or getattr(getattr(contrato, "principal", None), "pdf_sha256", "")
        if ref_sha:
            story.append(Paragraph(f"Referencia contrato marco (SHA-256): {ref_sha}", styles["Small"]))
    story.append(Spacer(1, 8))

    # 3) CUERPO DEL CONTRATO = HTML DEL EDITOR (ya renderizado)
    #    Si override_cuerpo_html es None, intentamos un fallback básico.
    cuerpo_html = (override_cuerpo_html or "").strip()

    if cuerpo_html:
        # Render del cuerpo (ya viene con variables resueltas → aquí solo convertimos a flowables)
        for flow in _html_to_story(cuerpo_html, styles):
            story.append(flow)
    else:
        # --- Fallback MUY básico (por si aún no has cableado el HTML del editor en producción) ---
        logger.warning("[PDF] No se recibió override_cuerpo_html; usando fallback básico.")
        # Partes
        comprador_lines = list(filter(bool, [
            empresa.get("nombre", "—"),
            f"CIF/NIF: {empresa.get('cif','—')}",
            empresa.get("direccion", ""),
            " · ".join(filter(bool, [
                f"Email: {empresa.get('email','')}" if empresa.get("email") else "",
                f"Tel: {empresa.get('telefono','')}" if empresa.get("telefono") else "",
                empresa.get("web",""),
            ])),
        ]))
        vendedor_lines = list(filter(bool, [
            " ".join(filter(bool, [cliente.get("nombre", "—"), cliente.get("apellidos", "")])).strip() or "—",
            f"DNI/NIE: {cliente.get('dni','') or cliente.get('dni_nie','—')}",
            cliente.get("direccion", ""),
            " · ".join(filter(bool, [
                f"Email: {cliente.get('email','')}" if cliente.get("email") else "",
                f"Tel: {cliente.get('telefono','')}" if cliente.get("telefono") else "",
            ])),
        ]))
        left_html  = "<br/>".join(comprador_lines) or "—"
        right_html = "<br/>".join(vendedor_lines)  or "—"
        partes_table = Table(
            [
                [Paragraph("<b>Comprador</b>", H2), Paragraph("<b>Vendedor</b>", H2)],
                [Paragraph(left_html, P), Paragraph(right_html, P)],
            ],
            colWidths=[87*mm, 87*mm],
            hAlign="LEFT",
        )
        partes_table.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 4),
            ("RIGHTPADDING", (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LINEBEFORE", (1,0), (1,-1), 0.25, colors.lightgrey),
        ]))
        story.append(partes_table)
        story.append(Spacer(1, 8))
        
        # Dispositivos (si no los traes ya en el cuerpo del editor)
        if dispositivos:
            story.append(Paragraph("<b>Relación de dispositivos</b>", H2))
            
            styles.add(ParagraphStyle(name="CellWrap", parent=styles["Small"], wordWrap="CJK"))   # permite corte por caracteres si no hay espacios
            styles.add(ParagraphStyle(name="CellRight", parent=styles["Small"], alignment=TA_RIGHT))

            data = [["Dispositivo", "IMEIs / Nº Serie", "Estado", "Precio"]]
            total = 0
            def _precio_linea(d: dict) -> float:
                # Marco → provisional / estimado; Acta → precio snapshot o sus sinónimos
                claves = (
                    ("precio", "precio_final", "precio_acordado", "precio_unitario")
                    if es_acta else
                    ("precio_provisional", "precio_estimado", "precio", "precio_unitario")
                )
                for k in claves:
                    v = d.get(k, None)
                    if v is not None:
                        try:
                            return float(v) or 0.0
                        except Exception:
                            pass
                return 0.0
            for d in dispositivos:
                desc = d.get("descripcion") or d.get("modelo") or "—"
                imei = d.get("imei") or d.get("serie") or "—"
                if es_acta:
                    est_txt = d.get("estado") or d.get("estado_funcional") or d.get("estado_fisico") or "—"
                else:
                    est_txt = d.get("estado_declarado") or d.get("estado_funcional") or d.get("estado_fisico") or "—"
                precio = _precio_linea(d)
                total += precio
                
                desc_p   = Paragraph(xesc(desc), styles["CellWrap"])
                imei_p   = Paragraph(xesc(imei), styles["CellWrap"])       # wrap también aquí por si es largo
                est_p    = Paragraph(xesc(est_txt), styles["Small"])
                precio_p = Paragraph(_money(precio), styles["CellRight"])

                data.append([desc_p, imei_p, est_p, precio_p])
            data.append(["", "", Paragraph("<b>Total</b>", P), Paragraph(_money(total), styles["CellRight"])])
            t = Table(data, colWidths=[80*mm, 45*mm, 30*mm, 25*mm])
            t.setStyle(TableStyle([
                ("GRID", (0,0), (-1,-1), 0.25, colors.grey),
                ("BACKGROUND", (0,0), (-1,0), colors.whitesmoke),
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                ("ALIGN", (3,1), (3,-1), "RIGHT"),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("LEFTPADDING", (0,0), (-1,-1), 4),
                ("RIGHTPADDING", (0,0), (-1,-1), 4),
            ]))
            story.append(t)
            story.append(Spacer(1, 8))

    # 4) LEGALES DESPUÉS DEL CUERPO
    if condiciones:
        story.append(Spacer(1, 6))
        story.append(Paragraph("<b>Términos y condiciones</b>", H2))
        for idx, p in enumerate(condiciones):
            if not p:
                continue
            try:
                safe = _markdown_to_rl(str(p))
                story.append(Paragraph(safe or "&nbsp;", P))
            except Exception:
                story.append(Paragraph(strip_tags(str(p)), P))
            story.append(Spacer(1, 2))
        story.append(Spacer(1, 6))
    else:
        logger.warning("[PDF] condiciones vacío: no se imprimirá bloque de condiciones")

    # 5) Firma
    story.append(Paragraph("<b>Firma</b>", H2))
    if firmado and not preview:
        info_firma = (
            f"Firmado digitalmente por: {getattr(contrato,'firmado_por','')} · "
            f"IP: {getattr(contrato,'ip_firmante','')} · Fecha: {fecha_txt}"
        )
    else:
        info_firma = "Pendiente de firma digital por OTP."
    story.append(Paragraph(info_firma, P))
    story.append(Spacer(1, 6))
    story.append(Paragraph("Este documento incorpora una huella criptográfica SHA-256 para verificar su integridad.", styles["Tiny"]))

    # Pie de página
    def _footer(canvas, doc_):
        canvas.setFont("Helvetica", 8)
        canvas.drawString(18*mm, 10*mm, f"Página {doc_.page}")

    # Build
    try:
        doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    except Exception:
        logger.error("[PDF] Error construyendo ReportLab story", exc_info=True)
        raise

    pdf_bytes = buf.getvalue()
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    logger.info("[PDF] Generado OK bytes=%d sha256=%s", len(pdf_bytes), sha[:12])
    return ContentFile(pdf_bytes, name=f"contrato_{getattr(contrato,'id','') or 'b2c'}.pdf"), sha


def generar_pdf_condiciones_b2c(contrato, version: str = "v1.3"):
    """
    Devuelve (ContentFile, sha) con el PDF de condiciones v1.3.
    Puedes inyectar variables básicas desde contrato.contrato_datos.
    """
    datos = getattr(contrato, "contrato_datos", {}) or {}
    empresa = datos.get("empresa", {}) or {}
    cliente = datos.get("cliente", {}) or {}

    # Campos dinámicos "amables" (si faltan, dejamos "—")
    comprador = empresa.get("nombre") or "—"
    buyer_nif = empresa.get("cif") or "—"
    vendedor = cliente.get("nombre") or "—"
    vendedor_doc = cliente.get("dni") or "—"
    vendedor_dom = cliente.get("direccion") or "—"

    # Intento de ciudad desde la dirección del cliente (muy laxo)
    ciudad = "—"
    if isinstance(vendedor_dom, str) and "," in vendedor_dom:
        ciudad = vendedor_dom.split(",")[1].strip() or "—"

    fecha_txt = timezone.localtime(timezone.now()).strftime("%d/%m/%Y")

    # ---- Render con ReportLab (mismo estilo que tu contrato) ----
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Small", fontSize=9, leading=12))
    styles.add(ParagraphStyle(name="Tiny", fontSize=8, leading=10, textColor=colors.grey))
    H1 = styles["Heading1"]; H2 = styles["Heading2"]; P = styles["Small"]

    story = []
    story.append(Paragraph(f"CONDICIONES GENERALES B2C – Versión {version}", H1))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"En {ciudad}, a {fecha_txt}", P))
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>REUNIDOS</b>", H2))
    story.append(Paragraph(f"De una parte, {comprador}, con NIF {buyer_nif}, en adelante, “El Comprador”.", P))
    story.append(Paragraph(f"Y de otra, {vendedor}, con DNI/NIE {vendedor_doc} y domicilio en {vendedor_dom}, en adelante, “El Vendedor”.", P))
    story.append(Spacer(1, 10))

    # Aquí pegamos tu texto (resumido a lo esencial para no alargar), puedes copiar el íntegro:
    bloques = [
        ("1. Objeto", [
            "La compraventa queda condicionada a la verificación técnica y física realizada por el Comprador.",
            "Los Dispositivos y su precio provisional constan en el Anexo I del contrato."
        ]),
        ("2. Precio provisional y verificación", [
            "El precio provisional se basa en lo declarado por el Vendedor.",
            "Tras la recepción, se verifican identidad del equipo (marca/modelo/IMEI/SN), estado real, bloqueos y originalidad.",
            "Resultados: (a) precio confirmado; (b) Segunda Oferta; (c) rechazo si no conforme."
        ]),
        ("3. Plazos y segunda oferta", [
            "El Vendedor dispone de 10 días naturales para aceptar la Segunda Oferta por OTP o firma electrónica.",
            "La falta de respuesta equivale a rechazo; el Dispositivo se devuelve en 5 días hábiles."
        ]),
        ("4. Obligaciones del Vendedor", [
            "Propiedad legítima, mayor de edad, dispositivo no robado ni bloqueado, piezas originales salvo declaración en contra.",
            "Borrado de datos, desvinculación de cuentas y retirada de SIM/microSD."
        ]),
        ("5. Estados y exclusiones", [
            "Casi nuevo / Usado / Dañado / Reciclable (ver Anexo II).",
            "Exclusiones: robado, falsificado, bloqueado, FMI activo, piezas críticas no originales no declaradas, daños estructurales graves."
        ]),
        ("6. Envío y riesgo", [
            "Embalaje seguro; envío asegurado hasta el precio provisional.",
            "No incluir accesorios salvo acuerdo; no se garantiza devolución."
        ]),
        ("7. Transmisión y pago", [
            "La propiedad se transfiere con la aceptación definitiva.",
            "Pago por transferencia o saldo digital en ≤ 5 días hábiles desde la aceptación."
        ]),
        ("8. Responsabilidad", [
            "El Comprador responde solo por daños posteriores por negligencia propia; no responde de pérdidas indirectas ni de datos."
        ]),
        ("9. Protección de datos", [
            "RGPD/LOPDGDD aplicables. El Comprador trata los datos para ejecutar este contrato.",
            "Derechos en el correo informado por El Comprador."
        ]),
        ("10. Legislación y fuero", [
            "Ley española. Juzgados del domicilio del Vendedor."
        ])
    ]

    for titulo, puntos in bloques:
        story.append(Paragraph(f"<b>{titulo}</b>", H2))
        for p in puntos:
            story.append(Paragraph(p, P))
            story.append(Spacer(1, 2))
        story.append(Spacer(1, 6))

    story.append(Spacer(1, 8))
    story.append(Paragraph("Este documento forma parte inseparable del contrato marco o acta vinculados.", styles["Tiny"]))

    def _footer(canvas, doc_):
        canvas.setFont("Helvetica", 8)
        canvas.drawString(18*mm, 10*mm, f"Condiciones B2C v{version} · Página {doc_.page}")

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    pdf_bytes = buf.getvalue()
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    return ContentFile(pdf_bytes, name=f"condiciones_b2c_{version}.pdf"), sha

def persistir_pdf_final(contrato, incluir_condiciones: bool = None, version_condiciones: str = "v1.3", guardar_condiciones: bool = False):
    logger.info("[PDF_FINAL] id=%s incluir_condiciones=%s version=%s", getattr(contrato,"id",None), incluir_condiciones, version_condiciones)

    cf_main, _ = generar_pdf_contrato(contrato, preview=False)
    main_bytes = cf_main.read()
    logger.info("[PDF_FINAL] main_bytes=%d", len(main_bytes))

    es_acta = bool(getattr(contrato, "es_acta", False) or getattr(contrato, "tipo", "") == "acta")
    if incluir_condiciones is None:
        incluir_condiciones = not es_acta
    logger.info("[PDF_FINAL] es_acta=%s -> incluir_condiciones=%s", es_acta, incluir_condiciones)

    cond_cf = None
    anexos = []
    if incluir_condiciones:
        try:
            cond_cf, _ = generar_pdf_condiciones_b2c(contrato, version_condiciones)
            cb = cond_cf.read()
            anexos.append(cb)
            logger.info("[PDF_FINAL] condiciones anexadas bytes=%d", len(cb))
        except Exception as e:
            logger.error("[PDF_FINAL] Error generando condiciones anexas", exc_info=True)

    final_bytes = _combinar_pdfs(main_bytes, anexos) if anexos else main_bytes
    logger.info("[PDF_FINAL] final_bytes=%d anexos=%d", len(final_bytes), len(anexos))

    final_cf = ContentFile(final_bytes, name=f"contrato_{getattr(contrato,'id','') or 'b2c'}.pdf")
    contrato.pdf.save(final_cf.name, final_cf, save=False)
    contrato.pdf_sha256 = hashlib.sha256(final_bytes).hexdigest()
    contrato.save(update_fields=["pdf", "pdf_sha256"])

    try:
        url = contrato.pdf.url
        logger.info("[PDF_FINAL] url=%s sha256=%s", url, contrato.pdf_sha256[:12])
        return url
    except Exception as e:
        logger.warning("[PDF_FINAL] Storage sin URL pública", exc_info=True)
        return None