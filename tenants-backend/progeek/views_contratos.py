from __future__ import annotations
from rest_framework import views, status
from rest_framework.response import Response
from django.apps import apps
from django.http import FileResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
import io
from progeek.models import B2CKycIndex  # índice público
from checkouters.models.legal import B2CContrato  # tu modelo real de contrato
from typing import Any, Dict, List
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from django.template import engines, Context, TemplateSyntaxError,Engine
import bleach

# importa tu generador actual (lo parchearemos en B más abajo para insertar condiciones)
from checkouters.utils.pdf import generar_pdf_contrato  



from progeek.contratos.service import render_contract_with_legals

Company = apps.get_model('companies', 'Company')

class ContractRenderFullPreviewView(views.APIView):
    """
    POST /api/contratos/render-full/
    body:
    {
      "company_id": 3,                   # obligatorio (o simular dummy si quieres)
      "contract_content": "...",         # plantilla base del contrato (Markdown/HTML)
      "ctx": { ... },                    # cliente/contrato/dispositivos/...
      "marker": "{# B2C_CONDICIONES #}"  # opcional
    }
    """
    def post(self, request):
        company_id = request.data.get("company_id")
        raw = (request.data.get("contract_content") or "").strip()
        ctx = request.data.get("ctx") or {}
        marker = request.data.get("marker") or "{# B2C_CONDICIONES #}"

        if not company_id:
            return Response({"detail": "company_id es obligatorio"}, status=400)

        company = Company.objects.filter(id=company_id).first()
        if not company:
            return Response({"detail": "Company no encontrada"}, status=404)

        try:
            rendered = render_contract_with_legals(
                company=company,
                contract_template_content=raw,
                ctx_input=ctx,
                marker=marker,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        return Response({"rendered": rendered}, status=200)

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
    
def deep_merge(a: dict, b: dict) -> dict:
    """merge superficial+recursivo (b pisa a)"""
    out = dict(a or {})
    for k, v in (b or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out

def default_preview_context(canal: str = "b2c") -> dict:
    # Mock mínimo para que todas las plantillas muestren algo
    return {
        "operador": {
            "nombre": "Progeek Solutions S.L.",
            "cif": "B00000000",
            "direccion": "C/ Ejemplo 123, 08000 Barcelona, España",
            "email": "legal@progeek.es",
            "telefono": "+34 600 000 000",
            "web": "https://progeek.es",
            "direccion_logistica": "C/ Logística 1, 08000 Barcelona",
        },
        "cliente": {
            "nombre": "Ana",
            "apellidos": "Pérez López",
            "dni_nie": "12345678Z",
            "email": "ana@example.com",
            "telefono": "+34 611 111 111",
            "direccion": "C/ Cliente 9, 28000 Madrid",
            "canal": canal,  # ← b2b/b2c
        },
        "contrato": {
            "numero": "C-2025-0099",
            "fecha": "2025-08-17",
            "otp_hash": "ABCD-1234",
            "kyc_ref": "KYC-0001",
            "importe_total": 123.45,
            "validez_dias": 14,
        },
        "dispositivos": [
            {
                "descripcion": "iPhone 13 128GB",
                "modelo": "A2633",
                "imei": "356789012345678",
                "serie": "",
                "capacidad": "128GB",
                "estado_declarado": "bueno",
                "precio_provisional": 230.00,
            }
        ],
        # Puedes añadir más nodos si tu plantilla los usa
    }

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def contrato_render_preview(request):
    """
    Body:
      {
        "content": "<h1>...</h1> ... {% for d in dispositivos %} ...",
        "force_canal": "b2b" | "b2c",               # opcional (default b2c)
        "context": { ... }                           # opcional, mergea sobre el default
      }
    """
    
    content = (request.data.get("content") or "").strip()
    if not content:
        return Response({"detail": "Falta 'content'."}, status=400)

    canal = (request.data.get("force_canal") or "b2c").strip().lower()
    if canal not in ("b2b", "b2c"):
        canal = "b2c"

    override_ctx = request.data.get("context") or {}
    if not isinstance(override_ctx, dict):
        return Response({"detail": "'context' debe ser un objeto JSON"}, status=400)

    # Construye el contexto final (dict plano), SIN Context()
    ctx = deep_merge(default_preview_context(canal), override_ctx)

    try:
        # Usa el motor de Django (tus filtros como 'default'/'capfirst' funcionarán)
        django_engine = engines["django"]
        template = django_engine.from_string(content)
        # IMPORTANTE: pasar un dict, NO Context()
        rendered = template.render(ctx)  # request=None
    except TemplateSyntaxError as ex:
        return Response(
            {"detail": f"Error de sintaxis en la plantilla: {ex}"},
            status=400,
        )
    except Exception as ex:
        # Este era tu error: 'context must be a dict rather than Context.'
        return Response(
            {"detail": f"No se pudo renderizar la plantilla: {ex}"},
            status=400,
        )

    return Response({"rendered": rendered})