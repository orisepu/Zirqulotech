# progeek/views_kyc.py
from __future__ import annotations
from typing import Any, Dict
from django.http import HttpResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from django.apps import apps
from django.utils.html import escape
from markdown import markdown
from weasyprint import HTML, CSS
from django.http import FileResponse, JsonResponse
from progeek.contratos.service import render_contract_with_legals
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

try:
    import markdown as md  # pip package: Markdown
except ImportError:
    md = None

def md_to_html(text: str) -> str:
    text = text or ""
    # Heurística: si parece HTML (tags), no conviertas
    if "<" in text and "</" in text:
        return text
    if md is not None:
        return md.markdown(text, extensions=["extra", "sane_lists"])
    # Fallback muy básico
    return f"<pre style='white-space:pre-wrap'>{escape(text)}</pre>"


# MODELOS – ajusta app_label/nombres a los tuyos
Company = apps.get_model('companies', 'Company')
from progeek.models import B2CKycIndex           # <- ej. tu modelo del token
from checkouters.models.legal import B2CContrato  # <- si guardas la PLANTILLA BASE de contrato
from checkouters.utils.pdf import generar_pdf_contrato

# Util: carga la PLANTILLA BASE de contrato (Markdown)
def get_contract_base_template(company) -> str:
    """
    Puedes:
      a) Guardar una única plantilla global (namespace=default, slug='b2c-contrato-base')
      b) Guardarla en un modelo propio ContractTemplate
      c) Tenerla embebida en código (fallback)
    Aquí intento (b) y si no existe, uso un fallback simple con el marcador.
    """
    row = ContractTemplate.objects.filter(is_active=True).first() if ContractTemplate else None
    if row and row.content:
        return row.content

    # Fallback mínimo con marcador
    return (
        "# CONTRATO DE COMPRA-VENTA (B2C)\n\n"
        "**Fecha:** {{ contrato.fecha }} · **Nº:** {{ contrato.numero }}\n\n"
        "## Datos del cliente\n"
        "- {{ cliente.nombre }} {{ cliente.apellidos }} · DNI/NIE: {{ cliente.dni_nie }}\n\n"
        "## Descripción\n"
        "El cliente transmite la propiedad de los dispositivos a la parte compradora.\n\n"
        "{# B2C_CONDICIONES #}\n"
        "\n_Firmas:_\n\nCliente: ____________________     Comprador: ____________________\n"
    )

# Util: arma el contexto del contrato a partir del token
def build_ctx_from_token(tk) -> Dict[str, Any]:
    """
    Devuelve el dict con las claves usadas por las plantillas:
      operador.*, empresa.*, cliente.*, contrato.*, dispositivos[], condiciones[]
    - operador/empresa se completan vía variables públicas + overlay en el servicio legal.
    """
    # Cliente
    cliente = {
        "nombre": tk.customer_first_name or "",
        "apellidos": tk.customer_last_name or "",
        "dni_nie": tk.customer_doc_id or "",
        "email": tk.customer_email or "",
        "telefono": tk.customer_phone or "",
        "direccion": tk.customer_address or "",
    }
    # Contrato
    contrato = {
        "numero": tk.contract_number or f"B2C-{tk.pk:06d}",
        "fecha": (tk.created_at or now()).date().isoformat(),
        "otp_hash": tk.otp_hash or "",
        "kyc_ref": tk.kyc_ref or "",
        "importe_total": float(tk.offer_total or 0.0),
        "validez_dias": tk.offer_valid_days or 7,
        "comision_pct": getattr(tk, "comision_pct", None),
    }
    # Dispositivos (adapta a tu estructura)
    dispositivos = []
    for it in getattr(tk, "items", []):  # si tienes relación inversa, cambia esto
        dispositivos.append({
            "modelo": it.model_name,
            "capacidad": it.capacity,
            "imei_serial": it.imei or it.serial or "",
            "estado_fisico": it.physical_state or "",
            "estado_funcional": it.functional_state or "",
            "precio": float(getattr(it, "price", 0.0)),
        })

    # Condiciones adicionales (opcional)
    condiciones = []
    if getattr(tk, "certified_erase", False):
        condiciones.append("Borrado certificado de datos")

    return {
        "cliente": cliente,
        "contrato": contrato,
        "dispositivos": dispositivos,
        "condiciones": condiciones,
        # operador/empresa vendrán de variables públicas + overlay (servicio legal)
    }

# CSS básico para el PDF
BASE_CSS = CSS(string="""
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12pt; line-height: 1.35; color: #111; }
  h1,h2,h3 { color: #111; }
  h1 { font-size: 20pt; margin: 0 0 10px; }
  h2 { font-size: 14pt; margin: 14px 0 6px; }
  h3 { font-size: 12.5pt; margin: 10px 0 4px; }
  ul { margin: 6px 0 6px 18px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 10px 0; }
  .muted { color: #666; }
""")

class KycPdfPreviewView:
    """
    GET /api/b2c/contratos/kyc/<uuid:token>/pdf-preview/
    """
    def __call__(self, request, token: str):
        tk = get_object_or_404(KycToken, token=token, is_active=True)
        company = tk.company  # o tk.tenant / tk.partner -> Company

        # 1) plantilla base del contrato (Markdown)
        base_tpl_md = get_contract_base_template(company)

        # 2) contexto desde token
        ctx = build_ctx_from_token(tk)

        # 3) CONTRATO COMPLETO (Markdown) = contrato + condiciones B2C (según modo del tenant)
        md_full = render_contract_with_legals(company, base_tpl_md, ctx)

        # 4) Markdown -> HTML
        html = markdown(md_full, extensions=["extra", "sane_lists"])

        # 5) HTML -> PDF
        pdf_bytes = HTML(string=html, base_url=request.build_absolute_uri("/")).write_pdf(stylesheets=[BASE_CSS])

        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = 'inline; filename="contrato_b2c_preview.pdf"'
        return resp
    
class B2CContratoPdfPreviewByToken(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token: str):
        # 1) Resolver en PUBLIC
        with schema_context(get_public_schema_name()):
            idx = (
                B2CKycIndex.objects.filter(token=token)
                .order_by("-expires_at")
                .first()
            )
            if not idx:
                return JsonResponse({"detail": "Token no reconocido."}, status=404)
            if idx.revoked_at:
                return JsonResponse({"detail": "Token revocado."}, status=410)
            if idx.expires_at and timezone.now() > idx.expires_at:
                return JsonResponse({"detail": "Token caducado."}, status=410)

        # 2) Cargar contrato en el schema del tenant
        with schema_context(idx.tenant_slug):
            contrato = get_object_or_404(B2CContrato, pk=idx.contrato_id)

            # 3) Generar PREVIEW SIEMPRE en memoria
            content_file, sha = generar_pdf_contrato(contrato, preview=True)
            content_file.seek(0)
            pdf_bytes = content_file.read()

        # 4) Responder stream inline
        bio = io.BytesIO(pdf_bytes)
        resp = FileResponse(bio, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="contrato_preview_{contrato.pk}.pdf"'
        resp["Content-Length"] = str(len(pdf_bytes))
        resp["Accept-Ranges"] = "bytes"
        resp["Cache-Control"] = "private, max-age=0, no-store"
        resp["X-Document-SHA256"] = sha
        resp["X-Frame-Options"] = "SAMEORIGIN"
        return resp
