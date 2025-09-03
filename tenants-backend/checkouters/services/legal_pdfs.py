from django.template.loader import render_to_string
from weasyprint import HTML
from io import BytesIO
from hashlib import sha256
from django.core.files.base import ContentFile
from django.utils import timezone
from django.conf import settings
import io
# pypdf (fallback a PyPDF2 si no está)
try:
    from pypdf import PdfReader, PdfWriter
except Exception:
    try:
        from PyPDF2 import PdfReader, PdfWriter  # fallback
    except Exception:
        PdfReader = PdfWriter = None

def build_condiciones_b2c_pdf(tenant, version="v1.3", lang="es", extra_ctx=None):
    tpl = f"legal/condiciones_b2c_{version.replace('.','_')}_{lang}.html"
    ctx = {
        "tenant": {"slug": tenant.schema_name, "nombre": tenant.name},
        "empresa": {
            "nombre": settings.LEGAL_COMPANY_NAME,
            "cif":     settings.LEGAL_COMPANY_TAXID,
            "direccion": settings.LEGAL_COMPANY_ADDRESS,
            "email":   settings.LEGAL_SUPPORT_EMAIL,
            "telefono": settings.LEGAL_SUPPORT_PHONE,
        },
        "hoy": timezone.localdate().strftime("%d/%m/%Y"),
        **(extra_ctx or {}),
    }
    html = render_to_string(tpl, ctx)
    pdf_bytes = HTML(string=html, base_url=settings.BASE_DIR).write_pdf()
    digest = sha256(pdf_bytes).hexdigest()
    path = f"legal/condiciones-b2c/{tenant.schema_name}/{version}/condiciones-b2c-{version}-{lang}-{digest[:8]}.pdf"
    if not default_storage.exists(path):
        default_storage.save(path, ContentFile(pdf_bytes))
    return {"bytes": pdf_bytes, "sha256": digest, "path": path, "url": default_storage.url(path)}

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

def _combinar_pdfs(base_bytes: bytes, anexos_bytes: list[bytes]) -> bytes:
    """
    Concatena base + anexos. Si no hay PdfReader (no instalado), devuelve base tal cual.
    """
    if not PdfReader:
        return base_bytes
    writer = PdfWriter()
    for blob in [base_bytes, *anexos_bytes]:
        r = PdfReader(io.BytesIO(blob))
        for p in r.pages:
            writer.add_page(p)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()

def persistir_pdf_final(contrato, incluir_condiciones: bool = None, version_condiciones: str = "v1.3", guardar_condiciones: bool = False):
    """
    Genera el PDF final. Si incluir_condiciones es None:
    - contratos marco → incluye condiciones
    - actas → no incluye condiciones
    """
    # 1) PDF principal
    cf_main, _ = generar_pdf_contrato(contrato, preview=False)
    main_bytes = cf_main.read()

    # 2) ¿Incluimos condiciones?
    es_acta = bool(getattr(contrato, "es_acta", False) or getattr(contrato, "tipo", "") == "acta")
    if incluir_condiciones is None:
        incluir_condiciones = not es_acta  # por defecto: marco sí, acta no

    cond_cf = None
    anexos = []
    if incluir_condiciones:
        cond_cf, _ = generar_pdf_condiciones_b2c(contrato, version_condiciones)
        anexos.append(cond_cf.read())

    # 3) Mezcla y persistencia
    final_bytes = _combinar_pdfs(main_bytes, anexos) if anexos else main_bytes
    final_cf = ContentFile(final_bytes, name=f"contrato_{getattr(contrato,'id','') or 'b2c'}.pdf")

    contrato.pdf.save(final_cf.name, final_cf, save=False)
    contrato.pdf_sha256 = hashlib.sha256(final_bytes).hexdigest()
    # contrato.pdf_generado_en = timezone.now()  # si tienes el campo
    contrato.save(update_fields=["pdf", "pdf_sha256"])  # añade pdf_generado_en si procede

    # 4) Opcional: guardar condiciones aparte si tienes un FileField específico
    if guardar_condiciones and cond_cf and hasattr(contrato, "pdf_condiciones"):
        cond_cf.seek(0)
        contrato.pdf_condiciones.save(cond_cf.name, cond_cf, save=False)
        contrato.save(update_fields=["pdf_condiciones"])

    try:
        return contrato.pdf.url
    except Exception:
        return None
