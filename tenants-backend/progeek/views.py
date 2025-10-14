import logging
import os
from rest_framework import viewsets, permissions
from .models import LoteGlobal, DispositivoAuditado,UserGlobalRole,PlantillaCorreo,B2CKycIndex
from .serializers import (
    LoteGlobalSerializer,TenantUpdateSerializer,
    DispositivoAuditadoSerializer,UserSerializer,PlantillaCorreoSerializer
)
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_tenants.utils import schema_context,get_public_schema_name,get_tenant_model
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.response import Response
from checkouters.models.oportunidad import Oportunidad,HistorialOportunidad
from checkouters.models.documento import Documento
from checkouters.models.dispositivo import DispositivoReal,Dispositivo
from checkouters.models.cliente import Cliente
from checkouters.serializers import DispositivoSerializer,DispositivoRealSerializer,DocumentoSerializer,B2CContratoDetailSerializer,OportunidadSerializer,HistorialOportunidadSerializer
from checkouters.models.tienda import UserTenantExtension
from checkouters.models.legal import B2CContrato
from django.db import connection
from django.contrib.auth import get_user_model
from rest_framework import generics, permissions,viewsets,status 
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.serializers import ModelSerializer
from progeek.estados_operaciones import ESTADOS_AGRUPADOS
from django.db.models import Count
from django.shortcuts import get_object_or_404
from django_test_app.companies.models import Company, Domain 
from rest_framework.permissions import IsAdminUser
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from django.http import HttpResponse, Http404,FileResponse
from django.utils.text import slugify

from checkouters.utils.createpdf import generar_pdf_oportunidad
from django.conf import settings
from uuid import UUID
from hashids import Hashids 
from datetime import datetime, time
from .serializers import OportunidadPublicaSerializer
from progeek.plantillas_por_defecto import PLANTILLAS_POR_DEFECTO
from decimal import Decimal, InvalidOperation
from django.db.models.functions import Cast
from django.db.models import Q,CharField
from django.db import models
from django.db.models import Case, When, IntegerField
from rest_framework.exceptions import NotFound, ValidationError
from collections import defaultdict, Counter
from urllib.parse import urljoin
from django.core.mail import send_mail
from django.utils.html import strip_tags
import hashlib
import io
import json
from django_test_app.logging_utils import log_ws_event, log_ws_warning, log_ws_error
import unicodedata
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q

# Configuración de Hashids
hashids = Hashids(
    salt=settings.SECRET_KEY,
    min_length=10,
    alphabet="0123456789ABCDEF"  # ✅ tiene 16 caracteres únicos

)
def _norm(s: str) -> str:
    s = (s or "").strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower()

def _norm_estado(v):
    return (v or "").strip().lower()

def _serialize_tenant_detail(tenant) -> dict:
    # Conteo de tiendas en el schema del tenant
    try:
        with schema_context(tenant.schema_name):
            with connection.cursor() as cursor:
                # Si la tabla cambiase de nombre, ajústalo aquí
                cursor.execute("SELECT COUNT(*) FROM checkouters_tienda")
                num_tiendas = cursor.fetchone()[0]
    except Exception:
        num_tiendas = "Error"

    acuerdo_pdf_nombre = None
    acuerdo_pdf_url = None
    archivo_acuerdo = getattr(tenant, "acuerdo_empresas_pdf", None)
    if getattr(archivo_acuerdo, "name", None):
        acuerdo_pdf_nombre = os.path.basename(archivo_acuerdo.name)
        acuerdo_pdf_url = f"/api/tenants/{tenant.id}/agreement/download/"

    logo_nombre = None
    logo_url = None
    archivo_logo = getattr(tenant, "logo", None)
    if getattr(archivo_logo, "name", None):
        logo_nombre = os.path.basename(archivo_logo.name)
        logo_url = f"/api/tenants/{tenant.id}/logo/download/"

    return {
        "id": tenant.id,
        "nombre": tenant.name,
        "schema": tenant.schema_name,
        "estado": getattr(tenant, "estado", "activo"),
        "fecha_creacion": tenant.created,
        "tiendas": num_tiendas,
        "cif": tenant.cif,
        "tier": tenant.tier,

        "contacto_comercial": getattr(tenant, "contacto_comercial", None),
        "telefono_comercial": getattr(tenant, "telefono_comercial", None),
        "correo_comercial": getattr(tenant, "correo_comercial", None),
        "contacto_financiero": getattr(tenant, "contacto_financiero", None),
        "telefono_financiero": getattr(tenant, "telefono_financiero", None),
        "correo_financiero": getattr(tenant, "correo_financiero", None),

        "direccion_calle": getattr(tenant, "direccion_calle", None),
        "direccion_piso": getattr(tenant, "direccion_piso", None),
        "direccion_puerta": getattr(tenant, "direccion_puerta", None),
        "direccion_cp": getattr(tenant, "direccion_cp", None),
        "direccion_poblacion": getattr(tenant, "direccion_poblacion", None),
        "direccion_provincia": getattr(tenant, "direccion_provincia", None),
        "direccion_pais": getattr(tenant, "direccion_pais", None),

        "numero_empleados": getattr(tenant, "numero_empleados", None),
        "vertical": getattr(tenant, "vertical", None),
        "vertical_secundaria": getattr(tenant, "vertical_secundaria", None),
        "web_corporativa": getattr(tenant, "web_corporativa", None),
        "facturacion_anual": getattr(tenant, "facturacion_anual", None),
        "numero_tiendas_oficiales": getattr(tenant, "numero_tiendas_oficiales", None),

        "goal": getattr(tenant, "goal", None),
        "acuerdo_empresas": getattr(tenant, "acuerdo_empresas", None),
        "acuerdo_empresas_pdf_nombre": acuerdo_pdf_nombre,
        "acuerdo_empresas_pdf_url": acuerdo_pdf_url,
        "logo_nombre": logo_nombre,
        "logo_url": logo_url,
        "management_mode": getattr(tenant, "management_mode", None),
        "legal_namespace": getattr(tenant, "legal_namespace", None),
        "legal_slug": getattr(tenant, "legal_slug", None),
        "legal_overrides": getattr(tenant, "legal_overrides", None),
        "comision_pct": getattr(tenant, "comision_pct", None),
        "solo_empresas": getattr(tenant, "solo_empresas", None),
        "es_demo": getattr(tenant, "es_demo", False),
    }

def canal_a_tipo_cliente(canal: str | None) -> str:
    s = (canal or "").casefold().replace("_", " ").replace("-", " ").strip()
    if "b2b" in s:
        return "b2b"
    if "b2c" in s:
        return "b2c"
    if any(k in s for k in ("empresa", "business", "company")):
        return "b2b"
    return "b2c"

def _add_count(bucket, modelo_id, estado, inc=1):
    bucket[modelo_id][estado] += inc
def _multiset_by_model_and_state(rows, model_key, state_key):
    """
    Devuelve un contador {(modelo_id) -> {estado_norm -> count}}
    rows: iterable de dicts/objs
    """
    from collections import defaultdict
    counts = defaultdict(lambda: defaultdict(int))
    for r in rows:
        modelo_id = getattr(r, model_key) if hasattr(r, model_key) else r.get(model_key)
        estado = getattr(r, state_key) if hasattr(r, state_key) else r.get(state_key)
        counts[modelo_id][_norm(estado)] += 1
    return counts
def _enviar_mail_acta_firma(tenant_slug: str, acta):
    """
    Envía correo al cliente para firmar el ACTA.
    Usa PlantillaCorreo si existe el evento 'b2c_acta_solicitud_firma',
    si no, manda una plantilla básica.
    """
    # URL pública: el index por token resuelve el tenant
    base_url = getattr(settings, "PUBLIC_BASE_URL", "https://progeek.es")
    link_firma = urljoin(base_url, f"/kyc-upload/{acta.kyc_token}")

    # Intenta coger plantilla
    try:
        plantilla = PlantillaCorreo.objects.get(evento="b2c_acta_solicitud_firma")
        asunto = plantilla.asunto or "Firma del acta"
        cuerpo_html = (plantilla.cuerpo or "").format(
            NOMBRE_CLIENTE=(acta.contrato_datos or {}).get("cliente", {}).get("nombre") or "",
            EMPRESA=(acta.contrato_datos or {}).get("empresa", {}).get("nombre") or "",
            TOTAL=(acta.contrato_datos or {}).get("total") or 0,
            LINK_FIRMA=link_firma,
        )
    except PlantillaCorreo.DoesNotExist:
        asunto = "Firma del acta"
        cuerpo_html = f"""
        <p>Hola{(" " + ((acta.contrato_datos or {}).get("cliente", {}).get("nombre") or "")) if (acta.contrato_datos or {}).get("cliente", {}).get("nombre") else ""},</p>
        <p>Te hemos generado el acta con el resumen de los equipos auditados.</p>
        <p><b>No necesitas subir DNI</b>; solo revisa y firma con el código OTP.</p>
        <p>Puedes firmarla aquí: <a href="{link_firma}">{link_firma}</a></p>
        <p>Gracias.</p>
        """

    remitente = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@progeek.es")
    send_mail(
        subject=asunto,
        message=strip_tags(cuerpo_html),
        from_email=remitente,
        recipient_list=[acta.email],
        html_message=cuerpo_html,
        fail_silently=False,
    )
User = get_user_model()

logger = logging.getLogger(__name__)

def generar_pdf_contrato(contrato, preview=False):
    # Detecta tipo
    is_acta = getattr(contrato, "tipo", "") == "acta"

    ctx = {
        "contrato": contrato,
        "preview": bool(preview),
        "firmado": (contrato.estado == "firmado") and bool(contrato.firmado_en),
        "logo_url": getattr(settings, "PDF_LOGO_URL", None),     # por tenant si lo tienes
        "brand_color": getattr(settings, "PDF_BRAND_COLOR", "#0e7afe"),
        "acta_id": contrato.id if is_acta else None,
        "now": timezone.now(),
        # "qr_sha_url": build_qr_url(contrato.contrato_datos.get("ref_sha256"))  # opcional
    }

    template = "pdf/acta.html" if is_acta else "pdf/contrato.html"
    html = render_to_string(template, ctx)

    # WeasyPrint (ejemplo)
    pdf_bytes = HTML(string=html, base_url=settings.STATIC_ROOT).write_pdf()
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    return io.BytesIO(pdf_bytes), sha


# ==========================
# Dashboard Admin (multi-tenant)
# ==========================
from checkouters.kpimanager.dashboard_manager_serializers import DashboardManagerSerializer
from checkouters.utils.utilskpis import parse_bool, parse_date_str, comparativa_periodo

class DashboardAdminAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = request.query_params
        fecha_inicio = parse_date_str(params.get("fecha_inicio"))
        fecha_fin = parse_date_str(params.get("fecha_fin"))
        if not fecha_inicio or not fecha_fin:
            return Response({"error": "Parámetros 'fecha_inicio' y 'fecha_fin' son obligatorios (YYYY-MM-DD)."}, status=400)

        granularidad = params.get("granularidad") or "mes"
        tienda_id = params.get("tienda_id")
        usuario_id = params.get("usuario_id")
        comparar = parse_bool(params.get("comparar"))
        tenant_slug = params.get("tenant")

        fecha_inicio = timezone.make_aware(datetime.combine(fecha_inicio, time.min))
        fecha_fin = timezone.make_aware(datetime.combine(fecha_fin, time.max))

        def _collect():
            return DashboardManagerSerializer.collect(
                request=request,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                granularidad=granularidad,
                filtros={"tienda_id": tienda_id, "usuario_id": usuario_id},
                opciones={"comparar": comparar},
            )

        # Forzar un tenant concreto
        if tenant_slug:
            with schema_context(tenant_slug):
                data = _collect()
            return Response(data, status=200)

        pub = get_public_schema_name() if callable(get_public_schema_name) else "public"
        TenantModel = get_tenant_model()
        tenants = list(TenantModel.objects.exclude(schema_name=pub).values_list("schema_name", flat=True))
        # Mapa schema -> porcentaje de comisión (0-1)
        pct_map = {
            t.schema_name: (Decimal(str(t.comision_pct or 0)) / Decimal("100"))
            for t in TenantModel.objects.exclude(schema_name=pub).only("schema_name", "comision_pct")
        }

        bloques = []
        for schema in tenants:
            try:
                with schema_context(schema):
                    data_block = _collect()
                    # Adjunta el schema para poder aplicar fallback con su porcentaje de comisión
                    if isinstance(data_block, dict):
                        data_block["_schema"] = schema
                    bloques.append(data_block)
            except Exception:
                continue

        if not bloques:
            empty = {
                "resumen": {"valor_total": Decimal(0), "ticket_medio": Decimal(0), "comision_total": Decimal(0), "comision_media": Decimal(0), "margen_medio": Decimal(0)},
                "evolucion": [],
                "comparativa": None,
                "rankings": {"productos": [], "tiendas_por_valor": [], "usuarios_por_valor": [], "tiendas_por_operaciones": [], "usuarios_por_operaciones": []},
                "pipeline": {"abiertas": 0, "valor_estimado": 0, "por_estado": []},
                "operativa": {"recibidas": 0, "completadas": 0, "conversion_pct": None, "tmed_respuesta_h": None, "tmed_recogida_h": None, "tmed_cierre_h": None, "rechazos": {"total": 0, "motivos": []}, "abandono_pct": None},
            }
            return Response(empty, status=200)

        # Merge
        res_agg = defaultdict(Decimal)
        evol_map = defaultdict(Decimal)
        rank_prod = defaultdict(Decimal)
        rank_tiendas_valor = defaultdict(Decimal)
        rank_users_valor = defaultdict(Decimal)
        rank_tiendas_ops = defaultdict(Decimal)
        rank_users_ops = defaultdict(Decimal)
        pipe_estado = {}
        abiertas = Decimal(0)
        valor_estimado = Decimal(0)
        total_ops_count = Decimal(0)

        conv_acc = Decimal(0); conv_n = 0
        t_resp_acc = Decimal(0); t_resp_n = 0
        t_rec_acc = Decimal(0); t_rec_n = 0
        t_cie_acc = Decimal(0); t_cie_n = 0
        aband_acc = Decimal(0); aband_n = 0
        rech_mot = defaultdict(Decimal)
        rech_total = Decimal(0)
        recibidas_sum = Decimal(0)
        completadas_sum = Decimal(0)

        for b in bloques:
            for k in ("valor_total", "ticket_medio", "comision_total", "comision_media", "margen_medio"):
                res_agg[k] += Decimal(str((b.get("resumen") or {}).get(k, 0) or 0))

            for p in b.get("evolucion") or []:
                periodo = str(p.get("periodo", ""))
                evol_map[periodo] += Decimal(str(p.get("valor", 0)))

            ranks = b.get("rankings") or {}
            for r in ranks.get("productos") or []:
                rank_prod[str(r.get("nombre", ""))] += Decimal(str(r.get("valor", 0)))
            for r in ranks.get("tiendas_por_valor") or []:
                rank_tiendas_valor[str(r.get("tienda", r.get("nombre", "")))] += Decimal(str(r.get("valor", 0)))
            for r in ranks.get("usuarios_por_valor") or []:
                rank_users_valor[str(r.get("usuario", r.get("nombre", "")))] += Decimal(str(r.get("valor", 0)))
            for r in ranks.get("tiendas_por_operaciones") or []:
                rank_tiendas_ops[str(r.get("tienda", r.get("nombre", "")))] += Decimal(str(r.get("ops", 0)))
            for r in ranks.get("usuarios_por_operaciones") or []:
                rank_users_ops[str(r.get("usuario", r.get("nombre", "")))] += Decimal(str(r.get("ops", 0)))

            pipe = b.get("pipeline") or {}
            abiertas += Decimal(str(pipe.get("abiertas", 0)))
            valor_estimado += Decimal(str(pipe.get("valor_estimado", 0)))
            for row in pipe.get("por_estado") or []:
                e = str(row.get("estado", ""))
                d = pipe_estado.setdefault(e, {"count": Decimal(0), "valor": Decimal(0)})
                d["count"] += Decimal(str(row.get("count", 0)))
                d["valor"] += Decimal(str(row.get("valor", 0)))
                total_ops_count += Decimal(str(row.get("count", 0)))

            op = b.get("operativa") or {}
            if op.get("recibidas") is not None:
                recibidas_sum += Decimal(str(op.get("recibidas", 0)))
            if op.get("completadas") is not None:
                completadas_sum += Decimal(str(op.get("completadas", 0)))
            if op.get("conversion_pct") is not None: conv_acc += Decimal(str(op.get("conversion_pct", 0))); conv_n += 1
            if op.get("tmed_respuesta_h") is not None: t_resp_acc += Decimal(str(op.get("tmed_respuesta_h", 0))); t_resp_n += 1
            if op.get("tmed_recogida_h") is not None: t_rec_acc += Decimal(str(op.get("tmed_recogida_h", 0))); t_rec_n += 1
            if op.get("tmed_cierre_h") is not None: t_cie_acc += Decimal(str(op.get("tmed_cierre_h", 0))); t_cie_n += 1
            if op.get("abandono_pct") is not None: aband_acc += Decimal(str(op.get("abandono_pct", 0))); aband_n += 1
            rech = (op.get("rechazos") or {})
            rech_total += Decimal(str(rech.get("total", 0)))
            for m in rech.get("motivos") or []:
                rech_mot[str(m.get("motivo", ""))] += Decimal(str(m.get("count", 0)))

        evolucion = [{"periodo": k, "valor": v} for k, v in evol_map.items()]
        evolucion.sort(key=lambda x: x["periodo"])  # YYYY-MM

        def _top(dct, key_name, val_name, top=10):
            arr = [{key_name: k, val_name: v} for k, v in dct.items()]
            arr.sort(key=lambda x: x[val_name], reverse=True)
            return arr[:top]

        rankings = {
            "productos": _top(rank_prod, "nombre", "valor"),
            "tiendas_por_valor": _top(rank_tiendas_valor, "tienda", "valor"),
            "usuarios_por_valor": _top(rank_users_valor, "usuario", "valor"),
            "tiendas_por_operaciones": _top(rank_tiendas_ops, "tienda", "ops"),
            "usuarios_por_operaciones": _top(rank_users_ops, "usuario", "ops"),
        }
        pipeline = {"abiertas": abiertas, "valor_estimado": valor_estimado, "por_estado": [{"estado": k, **v} for k, v in pipe_estado.items()]}
        operativa = {
            "recibidas": recibidas_sum,
            "completadas": completadas_sum,
            "conversion_pct": (conv_acc / conv_n) if conv_n else None,
            "tmed_respuesta_h": (t_resp_acc / t_resp_n) if t_resp_n else None,
            "tmed_recogida_h": (t_rec_acc / t_rec_n) if t_rec_n else None,
            "tmed_cierre_h": (t_cie_acc / t_cie_n) if t_cie_n else None,
            "rechazos": {"total": rech_total, "motivos": [{"motivo": k, "count": v} for k, v in rech_mot.items()]},
            "abandono_pct": (aband_acc / aband_n) if aband_n else None,
        }

        compar = comparativa_periodo(evolucion, fecha_inicio, fecha_fin, granularidad, {}, {}, comparar)

        # Fallbacks: si la suma de valor_total es 0, usa el valor estimado del pipeline
        if res_agg.get("valor_total", Decimal(0)) == 0 and valor_estimado > 0:
            res_agg["valor_total"] = valor_estimado
        # Ticket medio: si es 0 y hay operaciones, deriva del valor_total y el recuento total de oportunidades
        if res_agg.get("ticket_medio", Decimal(0)) == 0 and total_ops_count > 0:
            try:
                res_agg["ticket_medio"] = (res_agg["valor_total"] / total_ops_count)
            except Exception:
                pass
        # Comisión: si está en 0, calcula usando el porcentaje configurado en cada tenant
        if res_agg.get("comision_total", Decimal(0)) == 0 and res_agg.get("valor_total", Decimal(0)) > 0:
            total_calc = Decimal(0)
            for b in bloques:
                try:
                    bres = (b or {}).get("resumen") or {}
                    schema = (b or {}).get("_schema")
                    pct = pct_map.get(schema, Decimal(0))
                    b_com_tot = Decimal(str(bres.get("comision_total", 0) or 0))
                    b_val_tot = Decimal(str(bres.get("valor_total", 0) or 0))
                    if b_com_tot == 0 and b_val_tot > 0 and pct > 0:
                        total_calc += (b_val_tot * pct)
                    else:
                        total_calc += b_com_tot
                except Exception:
                    continue
            if total_calc > 0:
                res_agg["comision_total"] = total_calc

        if res_agg.get("comision_media", Decimal(0)) == 0 and res_agg.get("ticket_medio", Decimal(0)) > 0:
            # Aproximación: media de comisiones medias por tenant usando su pct cuando falte
            medias = []
            for b in bloques:
                try:
                    bres = (b or {}).get("resumen") or {}
                    schema = (b or {}).get("_schema")
                    pct = pct_map.get(schema, Decimal(0))
                    b_com_med = Decimal(str(bres.get("comision_media", 0) or 0))
                    b_t_med = Decimal(str(bres.get("ticket_medio", 0) or 0))
                    if b_com_med == 0 and b_t_med > 0 and pct > 0:
                        medias.append(b_t_med * pct)
                    elif b_com_med > 0:
                        medias.append(b_com_med)
                except Exception:
                    continue
            if medias:
                res_agg["comision_media"] = sum(medias) / Decimal(len(medias))

        out = {
            "resumen": dict(res_agg),
            "evolucion": evolucion,
            "comparativa": compar,
            "rankings": rankings,
            "pipeline": pipeline,
            "operativa": operativa,
        }
        return Response(out, status=200)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verificar_credenciales(request):
    password = request.data.get("password")

    if not password:
        return Response({"detail": "La contraseña es obligatoria."}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user

    if not user.check_password(password):
        return Response({"detail": "Contraseña incorrecta."}, status=status.HTTP_403_FORBIDDEN)

    return Response({"detail": "Contraseña verificada."}, status=status.HTTP_200_OK)

class LoteGlobalViewSet(viewsets.ModelViewSet):
    serializer_class = LoteGlobalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        with schema_context("public"):
            return LoteGlobal.objects.all().order_by("-fecha_creacion")
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        tenant_slug = instance.tenant_slug
        lote_id = instance.lote_id

        # Borrar el Lote real dentro del schema del tenant
        try:
            with schema_context(tenant_slug):
                Oportunidad.objects.filter(id=lote_id).delete()
        except Exception as e:
            return Response(
                {"detail": f"No se pudo eliminar el Lote del tenant: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Borrar el LoteGlobal del schema public
        with schema_context("public"):
            instance.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dispositivos_de_oportunidad(request, pk):
    print(f"➡️ Solicitud recibida para oportunidad_global {pk}")

    try:
        lote_global = LoteGlobal.objects.get(pk=pk)
        print(f"✅ LoteGlobal encontrado: {lote_global}")
    except LoteGlobal.DoesNotExist:
        print("❌ LoteGlobal no encontrado")
        return Response({"error": "Oportunidad no encontrada"}, status=404)

    tenant_slug = lote_global.tenant_slug
    lote_id = lote_global.lote_id
    print(f"🌐 Cambiando a schema: {tenant_slug} / oportunidad_id: {lote_id}")

    with schema_context(tenant_slug):
        try:
            oportunidad = Oportunidad.objects.get(pk=lote_id)
            print(f"✅ Oportunidad encontrada en tenant {tenant_slug}")
            dispositivos = Dispositivo.objects.filter(oportunidad=oportunidad)
            print(f"📦 Dispositivos encontrados: {dispositivos.count()}")
        except Oportunidad.DoesNotExist:
            print("❌ Oportunidad no existe en el schema del tenant")
            return Response({"error": "Oportunidad no existe en el tenant"}, status=404)

        serializer = DispositivoSerializer(dispositivos, many=True)
        return Response(serializer.data)
    
    
class DispositivoAuditadoViewSet(viewsets.ModelViewSet):
    queryset = DispositivoAuditado.objects.select_related("auditoria", "auditoria__tecnico").all()
    serializer_class = DispositivoAuditadoSerializer

    def get_queryset(self):
        dispositivo_id = self.request.query_params.get("dispositivo_id")
        lote_id = self.request.query_params.get("lote")
        tenant_slug = self.request.query_params.get("tenant_slug")

        qs = super().get_queryset()

        if dispositivo_id and lote_id and tenant_slug:
            return qs.filter(
                dispositivo_id=dispositivo_id,
                auditoria__lote_id=lote_id,
                tenant_slug=tenant_slug,
            )

        return qs.none()
    
class OportunidadesGlobalesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            role = request.user.global_role
        except UserGlobalRole.DoesNotExist:
            return Response({"detail": "No autorizado"}, status=status.HTTP_403_FORBIDDEN)

        if not role.es_empleado_interno:
            return Response({"detail": "Acceso denegado"}, status=status.HTTP_403_FORBIDDEN)
        estados = request.query_params.getlist("estado")
        estado = request.query_params.get("estado")
        fecha_inicio = request.query_params.get("fecha_inicio")
        fecha_fin = request.query_params.get("fecha_fin")
        finalizadas = request.query_params.get("finalizadas")  # 👈 aquí

        busqueda = request.query_params.get("busqueda")
        limit = int(request.query_params.get("limit", 25))
        offset = int(request.query_params.get("offset", 0))

        estados_finalizados = ["pagado", "recibido por el cliente"]  # 👈 define aquí para mantener
        agrupacion_estado = request.query_params.get("estado_agrupado")
        TenantModel = get_tenant_model()
        resultados = []
        
        for tenant in TenantModel.objects.exclude(schema_name="public"):
            tenant_match = not busqueda or (
                hasattr(tenant, 'name') and busqueda.lower() in tenant.name.lower())
            
            with schema_context(tenant.schema_name):
                qs = Oportunidad.objects.all()

                if agrupacion_estado in ESTADOS_AGRUPADOS:
                    qs = qs.filter(estado__in=ESTADOS_AGRUPADOS[agrupacion_estado])
                else:
                    estados = request.query_params.getlist("estado")
                    if estados:
                        qs = qs.filter(estado__in=estados)
                    else:
                        estado = request.query_params.get("estado")
                        if estado:
                            qs = qs.filter(estado__iexact=estado)

                if busqueda:
                    qs = qs.filter(
                        Q(cliente__razon_social__icontains=busqueda) |
                        Q(nombre__icontains=busqueda) |
                        Q(tienda__nombre__icontains=busqueda) 
                       
                    )

                if fecha_inicio:
                    qs = qs.filter(fecha_creacion__gte=fecha_inicio)
                if fecha_fin:
                    qs = qs.filter(fecha_creacion__lte=fecha_fin)

                if finalizadas == "true":
                    qs = qs.filter(estado__in=estados_finalizados)
                elif finalizadas == "false":
                    qs = qs.exclude(estado__in=estados_finalizados)
                if tenant_match or busqueda:
                    for o in qs:
                        data = OportunidadSerializer(o).data
                        data["tenant"] = tenant.name
                        data["schema"] = tenant.schema_name
                        data["tienda"] = o.tienda.nombre if o.tienda else None
                        resultados.append(data)

        total = len(resultados)
        paginated = resultados[offset:offset + limit]

        return Response({
            "results": paginated,
            "total": total,
            "limit": limit,
            "offset": offset
        })

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def cambiar_estado_oportunidad_global(request, tenant, uuid):
    user = request.user

    if not (getattr(user.global_role, "es_superadmin", False) or getattr(user.global_role, "es_empleado_interno", False)):
        return Response({"detail": "No autorizado"}, status=403)

    nuevo_estado = request.data.get("estado")
    if not nuevo_estado:
        return Response({"detail": "Debes especificar el nuevo estado"}, status=400)

    with schema_context(tenant):
        try:
            oportunidad = Oportunidad.objects.get(uuid=uuid)
        except Oportunidad.DoesNotExist:
            return Response({"detail": "Oportunidad no encontrada"}, status=404)

        estado_anterior = oportunidad.estado
        oportunidad.estado = nuevo_estado
        oportunidad.save()

        return Response({
            "detalle": "Estado actualizado",
            "anterior": estado_anterior,
            "nuevo": nuevo_estado
        })
   
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def oportunidades_globales_por_estado(request):
    # Permisos
    try:
        role = request.user.global_role
        if not getattr(role, "es_empleado_interno", False):
            logger.warning(f"❌ Acceso denegado - user {request.user} no es interno.")
            return Response({"detail": "No autorizado"}, status=403)
    except Exception:
        logger.warning(f"❌ No tiene rol global asignado el usuario {request.user}")
        return Response({"detail": "No autorizado"}, status=403)

    # Estados: ?estado=a&estado=b y ?estado=a,b
    estados = request.query_params.getlist("estado")
    if len(estados) == 1 and "," in estados[0]:
        estados = [e.strip() for e in estados[0].split(",") if e.strip()]
    if not estados:
        return Response({"detail": "Debe especificar al menos un estado."}, status=400)

    # Fechas (fin inclusivo)
    fecha_inicio_raw = request.query_params.get("fecha_inicio")
    fecha_fin_raw = request.query_params.get("fecha_fin")

    def parse_date(d):
        try:
            return datetime.fromisoformat(d)
        except Exception:
            try:
                return datetime.strptime(d, "%Y-%m-%d")
            except Exception:
                return None

    fi = parse_date(fecha_inicio_raw) if fecha_inicio_raw else None
    ff = parse_date(fecha_fin_raw) if fecha_fin_raw else None
    if ff:
        ff = datetime.combine(ff.date(), time(23, 59, 59, 999999))

    # Búsqueda libre
    busqueda = request.query_params.get("busqueda") or request.query_params.get("cliente")

    # Ordering seguro
    ordering_param = request.query_params.get("ordering") or "-fecha_creacion"
    allowed_ordering = {
        "fecha_creacion": "fecha_creacion",
        "-fecha_creacion": "-fecha_creacion",
        "cliente": "cliente__razon_social",
        "-cliente": "-cliente__razon_social",
    }
    ordering = allowed_ordering.get(ordering_param, "-fecha_creacion")

    logger.info(
        f"🔍 Buscando oportunidades estados={estados}, fechas={fi} → {ff}, "
        f"busqueda={busqueda!r}, ordering={ordering}"
    )

    resultado = []

    for company in Company.objects.exclude(schema_name="public"):
        try:
            with schema_context(company.schema_name):
                qs = (
                    Oportunidad.objects.filter(estado__in=estados)
                    .select_related("cliente", "tienda")
                    .prefetch_related("dispositivos_oportunidad")
                )

                if fi and ff:
                    qs = qs.filter(fecha_creacion__range=(fi, ff))
                elif fi:
                    qs = qs.filter(fecha_creacion__gte=fi)
                elif ff:
                    qs = qs.filter(fecha_creacion__lte=ff)

                if busqueda:
                    # Construir SIEMPRE en 'q' (no machacar 'qs')
                    q = (
                        Q(cliente__razon_social__icontains=busqueda)
                        | Q(nombre__icontains=busqueda)
                        | Q(tienda__nombre__icontains=busqueda)
                    )

                    # uuid: castear a texto para icontains
                    qs = qs.annotate(uuid_str=Cast("uuid", CharField()))
                    q |= Q(uuid_str__icontains=busqueda)

                    # hashid: si parece hashid válido, decodifica y filtra por id exacto
                    try:
                        decoded = HASHIDS.decode(busqueda)
                        if decoded:
                            q |= Q(id=decoded[0])
                    except Exception:
                        pass

                    qs = qs.filter(q)

                qs = qs.order_by(ordering)

                data = OportunidadPublicaSerializer(qs, many=True).data
                for o in data:
                    o["tenant"] = company.schema_name
                    o["partner"] = company.name
                resultado.extend(data)

        except Exception as e:
            logger.exception(f"❌ Error en tenant {company.schema_name}: {e}")

    return Response(resultado)
  
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detalle_oportunidad_global(request, tenant, id):
    try:
        role = request.user.global_role
        if not role.es_empleado_interno:
            logger.warning(f"❌ Acceso denegado - user {request.user} no es interno.")
            return Response({"detail": "No autorizado"}, status=403)
    except UserGlobalRole.DoesNotExist:
        logger.error(f"❌ Global role no encontrado para user {request.user}")
        return Response({"detail": "No autorizado"}, status=403)

    logger.info(f"🔍 Buscando oportunidad global - tenant={tenant}, id={id}")

    try:
        with schema_context(tenant):
            logger.info(f"🎯 Schema activado: {connection.tenant.schema_name}")
            oportunidad = Oportunidad.objects.get(uuid=id)
            data = OportunidadSerializer(oportunidad).data
            data["tenant"] = tenant
            return Response(data)
    except Oportunidad.DoesNotExist:
        logger.warning(f"❌ Oportunidad con uuid={id} no encontrada en tenant={tenant}")
        return Response({"detail": "Oportunidad no encontrada"}, status=404)
    except Exception as e:
        logger.exception(f"🔥 Error inesperado al obtener oportunidad {id} en {tenant}: {e}")
        return Response({"detail": "Error inesperado"}, status=500)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def historial_oportunidad_global(request, tenant, id):
    try:
        role = request.user.global_role
        if not role.es_empleado_interno:
            return Response({"detail": "No autorizado"}, status=403)
    except UserGlobalRole.DoesNotExist:
        return Response({"detail": "No autorizado"}, status=403)

    with schema_context(tenant):
        eventos = HistorialOportunidad.objects.filter(oportunidad_id=id).order_by('-fecha')
        serializer = HistorialOportunidadSerializer(eventos, many=True)
        return Response(serializer.data)
    
class YoAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant_obj = getattr(request, 'tenant', None)
        tenant_slug = getattr(tenant_obj, 'schema_name', None)

        # Si estamos en public schema, intentar leer X-Tenant del header
        if tenant_slug == get_public_schema_name() or tenant_slug == 'public':
            x_tenant = request.headers.get('X-Tenant') or request.headers.get('x-tenant')
            if x_tenant:
                try:
                    TenantModel = get_tenant_model()
                    tenant_obj = TenantModel.objects.get(schema_name=x_tenant)
                    tenant_slug = tenant_obj.schema_name
                except TenantModel.DoesNotExist:
                    pass

        data = {
            'id': user.id,
            'name': getattr(user, 'name', ''),
            'email': user.email,
            'global': None,
            'tenant': None,
        }

        try:
            global_role = user.global_role

            roles_por_tenant = {
                r.tenant_slug: {
                    'rol': r.rol,
                    'tienda_id': r.tienda_id,
                }
                for r in global_role.roles.all()
            }

            data['global'] = {
                'es_superadmin': global_role.es_superadmin,
                'es_empleado_interno': global_role.es_empleado_interno,
                'roles_por_tenant': roles_por_tenant,
                'rol_actual': roles_por_tenant.get(tenant_slug.lower() if tenant_slug else None),
            }
        except UserGlobalRole.DoesNotExist:
            pass

        if tenant_obj and tenant_slug and tenant_slug != get_public_schema_name():
            data['tenant'] = {
                'schema': tenant_slug,
                'name': getattr(tenant_obj, 'name', ''),
                'solo_empresas': getattr(tenant_obj, 'solo_empresas', False),
                'es_demo': getattr(tenant_obj, 'es_demo', False),
                'management_mode': getattr(tenant_obj, 'management_mode', None),
            }

        return Response(data)

class ResumenGlobalOportunidadesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not hasattr(user, "global_role") or not (
            user.global_role.es_superadmin or user.global_role.es_empleado_interno
        ):
            return Response({"detail": "No autorizado"}, status=403)

        resumen = {clave: 0 for clave in ESTADOS_RESUMEN}
        resumen["resto"] = 0

        try:
            TenantModel = get_tenant_model()
            with schema_context("public"):
                tenants = TenantModel.objects.all()

            for tenant in tenants:
                try:
                    with schema_context(tenant.schema_name):
                        # Verificamos que la tabla exista en el schema
                        tablas = connection.introspection.table_names()
                        if Oportunidad._meta.db_table not in tablas:
                            logger.warning("❌ Tabla Oportunidad no existe en %s", tenant.schema_name)
                            continue

                        estados_ya_contados = []
                        for clave, estados in ESTADOS_RESUMEN.items():
                            count = Oportunidad.objects.filter(estado__in=estados).count()
                            resumen[clave] += count
                            estados_ya_contados.extend(estados)

                        restantes = Oportunidad.objects.exclude(estado__in=estados_ya_contados).count()
                        resumen["resto"] += restantes

                except Exception as e:
                    logger.error("❌ Error procesando tenant %s: %s", tenant.schema_name, str(e))
                    continue

        except Exception as e:
            logger.exception("🔥 Error global en resumen")
            return Response({"detail": f"Error interno: {e}"}, status=500)

        return Response(resumen)


class UserListAPIView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        q = self.request.query_params.get('q', '').strip()
        qs = User.objects.all()

        if q:
            qs = qs.filter(
                Q(name__icontains=q) |
                Q(email__icontains=q)
            )
        return qs.order_by('name')[:20]  # Limita resultados a 20
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_tenants(request):
    if not getattr(request.user.global_role, "es_superadmin", False):
        return Response({"detail": "No autorizado"}, status=403)

    TenantModel = get_tenant_model()
    tenants = TenantModel.objects.exclude(schema_name="public")



    tenant_data = []
    for tenant in tenants:
        try:
            with schema_context(tenant.schema_name):
                with connection.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) FROM checkouters_tienda")
                    num_tiendas = cursor.fetchone()[0]
        except Exception as e:
            num_tiendas = "Error"

        tenant_data.append({
            "id": tenant.id,
            "nombre": tenant.name,
            "schema": tenant.schema_name,
            "estado": getattr(tenant, "estado", "activo"),
            "tiendas": num_tiendas,
            "modo": tenant.management_mode,
            "solo_empresas": getattr(tenant, "solo_empresas", False),
        })

    return Response(tenant_data)

@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def tenant_detail(request, id):
    TenantModel = get_tenant_model()
    if request.method in ['PUT', 'PATCH']:
        with transaction.atomic():
            tenant = get_object_or_404(TenantModel.objects.select_for_update(), id=id)
            serializer = TenantUpdateSerializer(
                tenant,
                data=request.data,
                partial=True  # aceptamos updates parciales
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            # devolvemos la representación completa
            return Response(_serialize_tenant_detail(tenant), status=status.HTTP_200_OK)

    # GET
    tenant = get_object_or_404(TenantModel, id=id)
    return Response(_serialize_tenant_detail(tenant), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def tenant_agreement_upload(request, id):
    TenantModel = get_tenant_model()
    with transaction.atomic():
        tenant = get_object_or_404(TenantModel.objects.select_for_update(), id=id)

        uploaded = request.FILES.get('acuerdo_empresas_pdf') or request.FILES.get('file')
        if not uploaded:
            return Response({"error": "Se requiere un archivo PDF."}, status=status.HTTP_400_BAD_REQUEST)

        content_type = (uploaded.content_type or '').lower()
        if 'pdf' not in content_type and not uploaded.name.lower().endswith('.pdf'):
            return Response({"error": "El archivo debe ser un PDF."}, status=status.HTTP_400_BAD_REQUEST)

        max_size_bytes = 10 * 1024 * 1024  # 10 MB
        if uploaded.size and uploaded.size > max_size_bytes:
            return Response({"error": "El PDF no puede superar los 10 MB."}, status=status.HTTP_400_BAD_REQUEST)

        base_name, ext = os.path.splitext(uploaded.name or 'acuerdo.pdf')
        ext = ext.lower() if ext else '.pdf'
        safe_base = slugify(base_name) or f'acuerdo-{tenant.id}'
        upload_path = f"acuerdos/tenant-{tenant.id}/{safe_base}{ext}"

        if getattr(tenant, 'acuerdo_empresas_pdf', None):
            tenant.acuerdo_empresas_pdf.delete(save=False)

        tenant.acuerdo_empresas_pdf.save(upload_path, uploaded, save=True)

    return Response({
        "acuerdo_empresas_pdf_url": f"/api/tenants/{tenant.id}/agreement/download/",
        "acuerdo_empresas_pdf_nombre": os.path.basename(tenant.acuerdo_empresas_pdf.name),
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_agreement_download(request, id):
    TenantModel = get_tenant_model()
    tenant = get_object_or_404(TenantModel, id=id)
    archivo = getattr(tenant, 'acuerdo_empresas_pdf', None)
    if not getattr(archivo, 'name', None):
        raise Http404("El partner no tiene un acuerdo PDF subido.")

    return FileResponse(
        archivo.open('rb'),
        as_attachment=True,
        filename=os.path.basename(archivo.name)
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def tenant_logo_upload(request, id):
    TenantModel = get_tenant_model()
    with transaction.atomic():
        tenant = get_object_or_404(TenantModel.objects.select_for_update(), id=id)

        uploaded = request.FILES.get('logo') or request.FILES.get('file')
        if not uploaded:
            return Response({"error": "Se requiere un archivo de imagen."}, status=status.HTTP_400_BAD_REQUEST)

        content_type = (uploaded.content_type or '').lower()
        valid_types = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
        valid_extensions = ['.png', '.jpg', '.jpeg', '.svg']

        is_valid_type = any(vt in content_type for vt in valid_types)
        is_valid_ext = any(uploaded.name.lower().endswith(ext) for ext in valid_extensions)

        if not is_valid_type and not is_valid_ext:
            return Response({"error": "El archivo debe ser una imagen (PNG, JPG, JPEG o SVG)."}, status=status.HTTP_400_BAD_REQUEST)

        max_size_bytes = 5 * 1024 * 1024  # 5 MB
        if uploaded.size and uploaded.size > max_size_bytes:
            return Response({"error": "La imagen no puede superar los 5 MB."}, status=status.HTTP_400_BAD_REQUEST)

        base_name, ext = os.path.splitext(uploaded.name or 'logo.png')
        ext = ext.lower() if ext else '.png'
        safe_base = slugify(base_name) or f'logo-{tenant.id}'
        upload_path = f"logos/tenant-{tenant.id}/{safe_base}{ext}"

        if getattr(tenant, 'logo', None):
            tenant.logo.delete(save=False)

        tenant.logo.save(upload_path, uploaded, save=True)

    return Response({
        "logo_url": f"/api/tenants/{tenant.id}/logo/download/",
        "logo_nombre": os.path.basename(tenant.logo.name),
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_logo_download(request, id):
    TenantModel = get_tenant_model()
    tenant = get_object_or_404(TenantModel, id=id)
    archivo = getattr(tenant, 'logo', None)
    if not getattr(archivo, 'name', None):
        raise Http404("El partner no tiene un logo subido.")

    return FileResponse(
        archivo.open('rb'),
        as_attachment=False,  # Para que se muestre en el navegador en lugar de descargarse
        filename=os.path.basename(archivo.name)
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_detail_by_schema(request, schema):
    TenantModel = get_tenant_model()
    tenant = get_object_or_404(TenantModel, schema_name__iexact=schema)
    return Response(_serialize_tenant_detail(tenant), status=status.HTTP_200_OK)

class CrearCompanyAPIView(APIView):
    permission_classes = [IsAdminUser]

    @transaction.atomic
    def post(self, request):
        data = request.data

        required = ["name", "schema"]
        for field in required:
            if not data.get(field):
                return Response({"error": f"Falta el campo obligatorio: {field}"}, status=400)

        schema = data["schema"].lower().strip()

        if Company.objects.filter(schema_name=schema).exists():
            return Response({"error": "Ese schema ya existe."}, status=400)
        
        # Validaciones ligeras opcionales
        management_mode = data.get("management_mode")
        if management_mode and management_mode not in ("default", "autoadmin"):
            return Response({"error": "management_mode inválido. Usa 'default' o 'autoadmin'."}, status=400)

        comision_pct = data.get("comision_pct", None)
        if comision_pct not in (None, ""):
            try:
                comision_pct = float(comision_pct)
                if comision_pct < 0 or comision_pct > 100:
                    return Response({"error": "comision_pct debe estar entre 0 y 100."}, status=400)
            except (TypeError, ValueError):
                return Response({"error": "comision_pct debe ser numérico."}, status=400)

        # Parsear legal_overrides si llega como JSON string
        legal_overrides = data.get("legal_overrides", None)
        if isinstance(legal_overrides, str):
            try:
                legal_overrides = json.loads(legal_overrides)
            except json.JSONDecodeError:
                return Response({"error": "legal_overrides no es JSON válido."}, status=400)
            
        # ✅ Crear el owner si se incluye
        owner = None
        if data.get("email") and data.get("password"):
            if User.objects.filter(email=data["email"]).exists():
                return Response({"error": "Ese email ya existe."}, status=400)

            owner = User.objects.create_user(
                email=data["email"],
                password=data["password"],
                is_staff=True
            )
        # --- Construir kwargs dinámicamente según campos reales del modelo ---
        model_fields = {f.name for f in Company._meta.get_fields() if isinstance(f, models.Field)}

        base_kwargs = dict(
            name=data["name"],
            schema_name=schema,
            slug=schema,
            owner=owner or User.objects.get(email="admin@progeek.es"),
            cif=data.get("cif", ""),
            direccion_calle=data.get("direccion_calle", ""),
            direccion_cp=data.get("direccion_cp", ""),
            direccion_poblacion=data.get("direccion_poblacion", ""),
            direccion_provincia=data.get("direccion_provincia", ""),
            direccion_pais=data.get("direccion_pais", "")
        )

        # Opcionales “seguros”: solo si existen en el modelo
        optional_map = {
            "management_mode": management_mode,
            "estado": data.get("estado"),
            "currency": data.get("currency"),
            "comision_pct": comision_pct,
            "razon_social": data.get("razon_social"),
            "legal_namespace": data.get("legal_namespace"),
            "legal_slug": data.get("legal_slug"),
            "legal_overrides": legal_overrides if legal_overrides is not None else data.get("legal_overrides"),
            "email_contacto": data.get("email_contacto"),
            "telefono_contacto": data.get("telefono_contacto"),
            "contacto_nombre": data.get("contacto_nombre"),
            "contacto_apellidos": data.get("contacto_apellidos"),
            "contacto_cargo": data.get("contacto_cargo"),
            "goal": data.get("goal"),
            "solo_empresas": data.get("solo_empresas"),
        }

        for k, v in optional_map.items():
            if v is not None and k in model_fields:
                base_kwargs[k] = v

        # ✅ Crear el tenant
        company = Company.objects.create(**base_kwargs)

        # ✅ Crear dominio dummy
        Domain.objects.create(
            domain=f"{company.schema_name}.fake",
            tenant=company,
            is_primary=True
        )

        # ✅ Relacionar user.tenants en public
        if owner:
            owner.tenants.add(company)

            # ✅ Darle permisos en el tenant
            with schema_context(schema):
                company.add_user(owner, is_superuser=True, is_staff=True)

        # Respuesta más útil
        respuesta = {
            "id": company.id,
            "name": company.name,
            "schema": company.schema_name,
            "estado": getattr(company, "estado", "pendiente"),
            "comision_pct": getattr(company, "comision_pct", None),
            "management_mode": getattr(company, "management_mode", None),
            "owner_email": owner.email if owner else "admin@progeek.es",
            "detail": "Partner creado correctamente.",
        }
        return Response(respuesta, status=status.HTTP_201_CREATED)
        
    

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def detalle_oportunidad_completo(request, tenant, id):
    from .serializers import DatosRecogidaSerializer  # importa donde esté
    from checkouters.estado_oportunidad import obtener_transiciones

    with schema_context(tenant):
        try:
            oportunidad = Oportunidad.objects.get(uuid=id)
        except Oportunidad.DoesNotExist:
            return Response({"error": "Oportunidad no encontrada"}, status=404)

        if request.method == "GET":
            dispositivos_reales = DispositivoReal.objects.filter(oportunidad=oportunidad)
            historial = HistorialOportunidad.objects.filter(oportunidad=oportunidad).order_by("-fecha")
            

            canal = getattr(getattr(oportunidad, "cliente", None), "canal", None)
            tipo_cliente = canal_a_tipo_cliente(canal)

            transiciones = obtener_transiciones(
                tipo_cliente=tipo_cliente,
                estado_actual=oportunidad.estado,
                user=request.user,
            )
            return Response({
                            "oportunidad": OportunidadSerializer(oportunidad).data,
                            "historial": HistorialOportunidadSerializer(historial, many=True).data,
                            "dispositivos_reales": DispositivoRealSerializer(dispositivos_reales, many=True).data,
                            "transiciones_validas": transiciones,
                        })

        elif request.method == "PATCH":
            user = request.user
            global_role = getattr(user, "global_role", None)
            if not global_role or not (global_role.es_superadmin or global_role.es_empleado_interno):
                return Response({"error": "No autorizado para editar desde public."}, status=403)
            
            estado_anterior = oportunidad.estado
            nuevo_estado = (request.data.get("estado") or estado_anterior).strip()
            serializer = DatosRecogidaSerializer(oportunidad, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                # Si el estado ha cambiado
                if nuevo_estado != estado_anterior:

                    canal = getattr(getattr(oportunidad, "cliente", None), "canal", None)
                    tipo_cliente = canal_a_tipo_cliente(canal)

                    transiciones = obtener_transiciones(
                        tipo_cliente=tipo_cliente,
                        estado_actual=estado_anterior,
                        user=user,
                    )
                    permitidas = (transiciones.get("siguientes")
                                  or transiciones.get("transiciones")
                                  or [])
                    if nuevo_estado not in permitidas:
                        return Response({
                            "estado": [f"No puedes pasar de {estado_anterior} a {nuevo_estado}. Transiciones permitidas: {', '.join(permitidas)}"]
                        }, status=400)

                    # Aplica el cambio de estado
                    oportunidad.estado = nuevo_estado

                    if nuevo_estado == "Pendiente de pago":
                        oportunidad.plazo_pago_dias = request.data.get("plazo_pago_dias", 30)
                        oportunidad.fecha_inicio_pago = timezone.now()
                    elif nuevo_estado == "Recogida generada":  # ← corregido (espacio)
                        oportunidad.numero_seguimiento = request.data.get("numero_seguimiento", "")
                        oportunidad.url_seguimiento = request.data.get("url_seguimiento", "")

                    oportunidad.save()

                    # Crea entrada en el historial
                    HistorialOportunidad.objects.create(
                        oportunidad=oportunidad,
                        tipo_evento="cambio_estado",
                        descripcion=f"Estado cambiado de {estado_anterior} a {nuevo_estado}",
                        estado_anterior=estado_anterior,
                        estado_nuevo=nuevo_estado,
                        usuario=user
                    )

                return Response(DatosRecogidaSerializer(oportunidad).data)

            return Response(serializer.errors, status=400)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def generar_pdf_oportunidad_global(request, tenant, pk):
    logger.info(f"➡️ [PDF] Generando PDF para oportunidad {pk} del tenant '{tenant}'...")

    try:
        # Obtener el objeto Company para acceder al logo
        TenantModel = get_tenant_model()
        tenant_obj = get_object_or_404(TenantModel, schema_name__iexact=tenant)

        with schema_context(tenant):
            oportunidad = Oportunidad.objects.select_related('cliente')\
                .prefetch_related('dispositivos').get(uuid=pk)

            pdf_buffer = generar_pdf_oportunidad(oportunidad, tenant=tenant_obj)
    except Oportunidad.DoesNotExist:
        logger.error(f"❌ Oportunidad con ID {pk} no encontrada en schema '{tenant}'")
        raise Http404("Oportunidad no encontrada")
    except Exception as e:
        logger.exception(f"❌ Error al generar el PDF para oportunidad {pk}: {e}")
        return HttpResponse("Error interno al generar el PDF", status=500)

    response = HttpResponse(pdf_buffer, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename=oportunidad_{pk}.pdf'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def descargar_documento_global(request, tenant, documento_id):
    logger.info(f"📥 [Superadmin] Petición de descarga del documento {documento_id} del schema '{tenant}' por el usuario {request.user}")

    with schema_context(tenant):
        doc = get_object_or_404(Documento, id=documento_id)

        try:
            if doc.oportunidad:
                logger.debug(f"🔗 Documento asociado a oportunidad ID {doc.oportunidad.id}")
            elif doc.dispositivo and doc.dispositivo.lote:
                logger.debug(f"🔗 Documento asociado a dispositivo ID {doc.dispositivo.id}")
            else:
                logger.warning("❌ Documento sin relación válida.")
                raise Http404("Documento sin relación válida.")
        except Exception as e:
            logger.error(f"❌ Error accediendo al documento: {e}")
            raise Http404("Documento inválido")

        logger.info(f"✅ Acceso autorizado. Iniciando descarga de {doc.nombre_original}")
        return FileResponse(
            doc.archivo.open(),
            as_attachment=True,
            filename=doc.nombre_original
        )
    

class SubirFacturaGlobalView(generics.CreateAPIView):
    serializer_class = DocumentoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        tenant = kwargs.get("tenant")
        logger.info(f"🌍 [Superadmin] Subida global de factura en tenant '{tenant}'")
        
        with schema_context(tenant):
            oportunidad_id = request.data.get("oportunidad")
            if not oportunidad_id:
                logger.warning("❌ No se proporcionó oportunidad en el formulario")
                return Response({"error": "Se requiere una oportunidad válida."}, status=400)
            
            oportunidad = get_object_or_404(Oportunidad, uuid=oportunidad_id)
            mutable_data = request.data.copy()
            mutable_data["oportunidad"] = oportunidad.id
            serializer = self.get_serializer(data=mutable_data)
            serializer.is_valid(raise_exception=True)

            serializer.save(subido_por=request.user, tipo="factura")
            logger.info(f"✅ Factura subida correctamente para oportunidad ID {oportunidad.id}")

            # Historial: subida
            HistorialOportunidad.objects.create(
                oportunidad=oportunidad,
                tipo_evento="factura_subida",
                descripcion=f"{request.user.get_full_name() or request.user.email} subió una factura",
                usuario=request.user
            )
            logger.info("📝 Historial 'factura_subida' registrado")

            # Cambio de estado automático
            if oportunidad.estado == "pendiente_factura":
                estado_anterior = oportunidad.estado
                oportunidad.estado = "factura_recibida"
                oportunidad.save(update_fields=["estado"])
                logger.info("🔄 Estado actualizado a 'factura_recibida'")
                HistorialOportunidad.objects.create(
                    oportunidad=oportunidad,
                    tipo_evento="cambio_estado",
                    descripcion=f"Estado cambiado de {estado_anterior} a factura_recibida",
                    estado_anterior=estado_anterior,
                    estado_nuevo="factura_recibida",
                    usuario=request.user
                )
            
            return Response(serializer.data, status=201)
        
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def crear_dispositivo_global(request, tenant):
    if not (getattr(request.user.global_role, "es_superadmin", False) or getattr(request.user.global_role, "es_empleado_interno", False)):
        return Response({"error": "No autorizado"}, status=403)

    with schema_context(tenant):
        serializer = DispositivoSerializer(data=request.data)
        if serializer.is_valid():
            oportunidad_id = request.data.get("oportunidad")
            dispositivo = serializer.save(usuario=request.user)

            if oportunidad_id:
                try:
                    oportunidad = Oportunidad.objects.get(id=oportunidad_id)
                    oportunidad.dispositivos.add(dispositivo)
                except Oportunidad.DoesNotExist:
                    pass

            return Response(DispositivoSerializer(dispositivo).data, status=201)

        return Response(serializer.errors, status=400)


    
class BorrarDispositivoGlobalAPIView(APIView):
    permission_classes = [IsAdminUser]

    def delete(self, request, tenant, dispositivo_id):
        """
        Borra un dispositivo en el schema del tenant correspondiente.
        Solo para superadmin o empleados internos.
        """
        if not (
            getattr(request.user.global_role, "es_superadmin", False)
            or getattr(request.user.global_role, "es_empleado_interno", False)
        ):
            return Response({"error": "No autorizado"}, status=403)

        logger.info(f"🗑️ [GLOBAL] Solicitud para borrar dispositivo {dispositivo_id} del tenant '{tenant}'")

        with schema_context(tenant):
            dispositivo = get_object_or_404(Dispositivo, id=dispositivo_id)

            if dispositivo.oportunidad and dispositivo.oportunidad.estado.lower() in ["pagado", "cerrado"]:
                return Response({"error": "No puedes eliminar un dispositivo vinculado a una oportunidad cerrada."}, status=400)

            dispositivo.delete()
            logger.info(f"✅ Dispositivo {dispositivo_id} eliminado correctamente de '{tenant}'")
            return Response(status=204)
     
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def busqueda_global(request):
    query = request.GET.get("q", "").strip()
    if not query or len(query) < 2:
        return Response({})

    TenantModel = get_tenant_model()
    tenants = TenantModel.objects.exclude(schema_name="public")

    resultados = {
        "oportunidades": [],
        "clientes": [],
        "dispositivos": []
    }

    # Intentar decodificar hashid para búsqueda por ID
    id_oportunidad = None
    try:
        decoded = hashids.decode(query)
        if decoded:
            id_oportunidad = decoded[0]
    except Exception:
        pass

    for tenant in tenants:
        with schema_context(tenant.schema_name):
            # Buscar clientes por nombre
            clientes = Cliente.objects.filter(
                razon_social__icontains=query
            ).values("id", "razon_social")

            for c in clientes:
                resultados["clientes"].append({
                    "id": c["id"],
                    "razon_social": c["razon_social"],
                    "schema": tenant.schema_name
                })

            # Buscar dispositivos por IMEI o SN
            dispositivos = DispositivoReal.objects.filter(
                Q(imei__icontains=query) | Q(numero_serie__icontains=query)
            ).select_related("modelo").values(
                "id", "imei", "numero_serie", "modelo__descripcion"
            )

            for d in dispositivos:
                resultados["dispositivos"].append({
                    "id": d["id"],
                    "imei": d["imei"],
                    "numero_serie": d["numero_serie"],
                    "modelo": d["modelo__descripcion"],
                    "schema": tenant.schema_name
                })

            # Buscar oportunidad por hashid decodificado
            if id_oportunidad:
                try:
                    oportunidad = Oportunidad.objects.get(id=id_oportunidad)
                    resultados["oportunidades"].append({
                        "id": oportunidad.id,
                        "uuid": str(oportunidad.uuid),
                        "hashid": oportunidad.hashid,
                        "nombre": oportunidad.nombre,
                        "schema": tenant.schema_name
                    })
                except Oportunidad.DoesNotExist:
                    pass

    return Response(resultados)

ESTADOS_PIPELINE = [
    "Pendiente",
    "Aceptado",
    "Recogida_generada",
    "En tránsito",
    "Recibido",
]

class PipelineOportunidadesPublicAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    class Pagination(PageNumberPagination):
        page_size = 10                       # por defecto
        page_size_query_param = "page_size"  # ?page_size=100
        max_page_size = 50

    def post(self, request):
        # 1) Estados desde body o query (?estados=Aceptado&estados=Pendiente)
        estados = request.data.get("estados") or request.query_params.getlist("estados")
        if not estados:
            return Response({"error": "Se requiere la lista de estados"}, status=400)

        # 2) Orden global (clave del serializer/campo del modelo)
        ordering = request.query_params.get("ordering", "-fecha_creacion")
        reverse = ordering.startswith("-")
        order_key = ordering.lstrip("-")

        paginator = self.Pagination()
        results = []
        total_count = 0

        # CRÍTICO: Cerrar conexión actual para permitir schema_context() funcionar
        from django.db import connection
        connection.close()

        tenants = Company.objects.exclude(schema_name="public")
        for tenant in tenants:
            with schema_context(tenant.schema_name):
                # Map label -> code a partir de choices del modelo
                field = Oportunidad._meta.get_field("estado")
                label_to_code = {_norm(label): code for code, label in field.choices}
                code_to_code  = {_norm(code):  code for code, label in field.choices}

                for estado_in in estados:
                    code = label_to_code.get(_norm(estado_in)) or code_to_code.get(_norm(estado_in)) or estado_in

                    qs = (
                        Oportunidad.objects
                        .filter(estado__iexact=code)
                        .select_related("cliente", "tienda")
                        .order_by(ordering)
                    )

                    # cuenta global (para el "count" real)
                    total_count += qs.count()

                    data = OportunidadPublicaSerializer(qs, many=True).data
                    for o in data:
                        o["tenant"] = tenant.schema_name
                        o["partner"] = tenant.name
                        o["_estado_code"] = code  # útil para depurar o filtrar en front
                    results.extend(data)

        # 3) Ordenar a nivel global por si algún tenant no coincide
        try:
            results.sort(key=lambda x: x.get(order_key) or "", reverse=reverse)
        except Exception:
            pass  # si la clave no existe en el serializer, simplemente se omite

        # 4) Respuesta paginada DRF
        page_items = paginator.paginate_queryset(results, request, view=self)
        resp = paginator.get_paginated_response(page_items)
        # Sobrescribimos el count con el total “real” sumado de cada tenant
        resp.data["count"] = total_count
        return resp
    

class GuardarAuditoriaGlobalAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, tenant):
        user = request.user
        role = getattr(user, "global_role", None)

        if not role or not role.es_empleado_interno:
            return Response({"detail": "No autorizado"}, status=403)

        dispositivo_id = request.data.get("dispositivo_id")
        estado_fisico = request.data.get("estado_fisico")
        estado_funcional = request.data.get("estado_funcional")
        observaciones = request.data.get("observaciones", "")
        precio_final = request.data.get("precio_final")

        if not dispositivo_id or not estado_fisico or not estado_funcional:
            return Response({"detail": "Campos obligatorios faltantes"}, status=400)

        try:
            with schema_context(tenant):
                from checkouters.models.dispositivo import DispositivoReal  # importa dentro del contexto

                dispositivo = DispositivoReal.objects.get(id=dispositivo_id)
                dispositivo.estado_fisico = estado_fisico
                dispositivo.estado_funcional = estado_funcional
                dispositivo.observaciones = observaciones
                dispositivo.auditado = True
                dispositivo.usuario_auditor = user
                dispositivo.fecha_auditoria = timezone.now()
                if precio_final is not None:
                    try:
                        dispositivo.precio_final = Decimal(precio_final)
                    except (ValueError, InvalidOperation):
                        return Response({"detail": "Precio final inválido"}, status=400)
                dispositivo.save()

        except DispositivoReal.DoesNotExist:
            return Response({"detail": "Dispositivo no encontrado en el tenant"}, status=404)
        except Exception as e:
            return Response({"detail": str(e)}, status=500)

        return Response({"ok": True})
    
class PlantillaCorreoViewSet(viewsets.ModelViewSet):
    queryset = PlantillaCorreo.objects.all()
    serializer_class = PlantillaCorreoSerializer
    permission_classes = [permissions.IsAdminUser]  # o una personalizada si quieres

    @action(detail=True, methods=["post"])
    def restaurar(self, request, pk=None):
        plantilla = self.get_object()
        por_defecto = PLANTILLAS_POR_DEFECTO.get(plantilla.evento)

        if not por_defecto:
            return Response({"detail": "No se encontró plantilla por defecto."}, status=404)

        plantilla.asunto = por_defecto["asunto"]
        plantilla.cuerpo = por_defecto["cuerpo"]
        plantilla.save()

        return Response({"detail": "Plantilla restaurada correctamente."})
    
class AdminB2CContratoViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAdminUser]
    queryset = B2CContrato.objects.all()
    lookup_field = "id"
    # --------------------------- helpers ---------------------------
    def _serialize(self, c, tenant_slug, opp=None):
        return {
            "id": c.id,
            "tipo": c.tipo,
            "estado": c.estado,
            "kyc_estado": getattr(c, "kyc_estado", "pendiente"),
            "email": c.email,
            "dni": c.dni,
            "pdf_url": c.pdf.url if getattr(c, "pdf", None) else None,
            "pdf_sha256": getattr(c, "pdf_sha256", None),
            "firmado_en": getattr(c, "firmado_en", None),
            "dni_anverso": c.dni_anverso.url if getattr(c, "dni_anverso", None) else None,
            "dni_reverso": c.dni_reverso.url if getattr(c, "dni_reverso", None) else None,
            "contrato_datos": getattr(c, "contrato_datos", None),
            "tenant_slug": tenant_slug,
            "oportunidad_id": opp if opp is not None else getattr(c, "oportunidad_id", None),
        }

    def _get_target(self, request):
        """
        Resuelve el contrato en el SCHEMA CORRECTO:
        - token  -> public.B2CKycIndex -> (tenant_slug, contrato_id) -> contrato en schema tenant
        - tenant_slug + contrato_id    -> contrato en schema tenant
        - tenant_slug + opp            -> contrato en schema tenant (prefiere estado firmado)

        Devuelve: (contrato, tenant_slug)
        """
        data = request.data or {}
        params = request.query_params or {}

        token = data.get("token") or params.get("token")
        tenant_slug = data.get("tenant_slug") or params.get("tenant_slug")
        contrato_id = data.get("contrato_id") or params.get("contrato_id")
        opp = data.get("opp") or params.get("opp")

        # 1) Resolver por token en public
        if token:
            with schema_context(get_public_schema_name()):
                idx = (
                    B2CKycIndex.objects.filter(token=token, revoked_at__isnull=True)
                    .order_by("-expires_at")
                    .first()
                )
                if not idx:
                    raise NotFound("Token no reconocido o revocado.")
                tenant_slug = idx.tenant_slug
                contrato_id = idx.contrato_id

        if not tenant_slug:
            raise ValidationError("Falta tenant_slug (o un token válido que lo resuelva).")

        # 2) Buscar dentro del tenant
        with schema_context(tenant_slug):
            if contrato_id:
                try:
                    contrato_id = int(contrato_id)
                except (TypeError, ValueError):
                    raise ValidationError({"contrato_id": "Debe ser numérico."})
                c = B2CContrato.objects.filter(id=contrato_id).first()
                if not c:
                    raise NotFound("Contrato no encontrado por id en el tenant.")
                return c, tenant_slug

            if opp:
                qs = B2CContrato.objects.filter(oportunidad_id=opp)
                qs = qs.annotate(
                    prioridad=Case(
                        When(estado="firmado", then=0),
                        default=1,
                        output_field=IntegerField(),
                    )
                ).order_by("prioridad", "-creado_en")
                c = qs.first()
                if not c:
                    raise NotFound("Contrato no encontrado por opp en el tenant.")
                return c, tenant_slug

        raise ValidationError("Faltan parámetros: envía token, o bien tenant_slug+contrato_id, o bien tenant_slug+opp.")

    def get_object(self):
        tenant_slug = self.request.query_params.get("tenant_slug")
        pk = self.kwargs.get(self.lookup_field or "pk")

        from checkouters.models.legal import B2CContrato
        with schema_context(tenant_slug):
            qs = B2CContrato.objects.all()

            if str(pk).isdigit():
                return qs.get(pk=int(pk))
            # si es un UUID => buscar por oportunidad_id
            return qs.filter(oportunidad_id=pk).annotate(
                prioridad=Case(When(estado="firmado", then=0), default=1, output_field=IntegerField())
            ).order_by("prioridad", "-creado_en").first()
        
        # --------------------------- GETs ---------------------------
    @action(detail=False, methods=["get"], url_path="detalle")
    def detalle(self, request):
        """Devuelve el detalle por token | tenant+id | tenant+opp (mismo shape que detalle-por-opp)."""
        contrato, tenant_slug = self._get_target(request)
        with schema_context(tenant_slug):
            c = B2CContrato.objects.get(id=contrato.id)
            data = self._serialize(c, tenant_slug)
        return Response(data, status=200)

    @action(detail=False, methods=["get"], url_path="detalle-por-opp")
    def detalle_por_opp(self, request):
        tenant_slug = (request.query_params.get("tenant_slug") or "").strip()
        opp        = (request.query_params.get("opp") or "").strip()
        tipo       = (request.query_params.get("tipo") or "").strip().lower()
        want_all   = (request.query_params.get("all") or "").strip().lower() in ("1", "true", "yes")

        log_ws_event("detalle_por_opp.in", user=getattr(request, "user", None),
                    schema=tenant_slug or "—", extra=f"opp={opp} tipo={tipo or '—'} all={want_all}")

        if not (tenant_slug and opp):
            log_ws_warning("detalle_por_opp.bad_args", user=getattr(request, "user", None),
                        schema=tenant_slug or "—", extra=f"opp={opp}")
            return Response({"detail": "Faltan tenant_slug y opp"}, status=400)

        with schema_context(tenant_slug):
            qs = B2CContrato.objects.filter(oportunidad_id=opp)

            total0 = qs.count()
            if tipo in ("marco", "acta"):
                qs = qs.filter(tipo=tipo)

            qs = qs.annotate(
                prioridad=Case(
                    When(estado="firmado", then=0),
                    default=1,
                    output_field=IntegerField(),
                )
            ).order_by("prioridad", "-creado_en")

            ids = list(qs.values_list("id", flat=True))
            tipos = list(qs.values_list("tipo", flat=True))
            log_ws_event("detalle_por_opp.qs",
                        user=getattr(request, "user", None),
                        schema=tenant_slug,
                        extra=f"total0={total0} filtrado={qs.count()} ids={ids} tipos={tipos}")

            # devolver muchos
            if want_all:
                if hasattr(self, "_serialize"):
                    data = [self._serialize(obj, tenant_slug, opp=opp) for obj in qs]
                else:
                    data = B2CContratoDetailSerializer(qs, many=True, context={"request": request}).data
                log_ws_event("detalle_por_opp.out_all",
                            user=getattr(request, "user", None),
                            schema=tenant_slug,
                            extra=f"n={len(data)}")
                return Response({"count": qs.count(), "results": data}, status=200)

            # devolver uno (el priorizado)
            c = qs.first()
            if not c:
                log_ws_warning("detalle_por_opp.empty",
                            user=getattr(request, "user", None),
                            schema=tenant_slug, extra=f"opp={opp} tipo={tipo or '—'}")
                return Response({"detail": "No hay contrato para esta oportunidad"}, status=404)

            if hasattr(self, "_serialize"):
                data = self._serialize(c, tenant_slug, opp=opp)
            else:
                data = B2CContratoDetailSerializer(c, context={"request": request}).data

            log_ws_event("detalle_por_opp.out_one",
                        user=getattr(request, "user", None),
                        schema=tenant_slug, extra=f"id={c.id} tipo={c.tipo} estado={c.estado}")
            return Response(data, status=200)

    # --------------------------- POST KYC ---------------------------
    @action(detail=False, methods=["post"], url_path="kyc/verificar")
    def kyc_verificar(self, request):
        contrato, tenant_slug = self._get_target(request)
        with schema_context(tenant_slug):
            B2CContrato.objects.filter(id=contrato.id).update(kyc_estado="verificado")
            nuevo = B2CContrato.objects.get(id=contrato.id)
        return Response({"id": nuevo.id, "kyc_estado": nuevo.kyc_estado})

    @action(detail=False, methods=["post"], url_path="kyc/mismatch")
    def kyc_mismatch(self, request):
        contrato, tenant_slug = self._get_target(request)
        motivo = (request.data or {}).get("motivo") or "Discrepancia detectada"
        with schema_context(tenant_slug):
            if hasattr(B2CContrato, "kyc_motivo"):
                B2CContrato.objects.filter(id=contrato.id).update(kyc_estado="mismatch", kyc_motivo=motivo)
            else:
                B2CContrato.objects.filter(id=contrato.id).update(kyc_estado="mismatch")
            nuevo = B2CContrato.objects.get(id=contrato.id)
        return Response({"id": nuevo.id, "kyc_estado": nuevo.kyc_estado, "motivo": motivo})

    @action(detail=False, methods=["post"], url_path="kyc/rechazar")
    def kyc_rechazar(self, request):
        contrato, tenant_slug = self._get_target(request)
        motivo = (request.data or {}).get("motivo") or "KYC rechazado"
        with schema_context(tenant_slug):
            if hasattr(B2CContrato, "kyc_motivo"):
                B2CContrato.objects.filter(id=contrato.id).update(kyc_estado="rechazado", kyc_motivo=motivo)
            else:
                B2CContrato.objects.filter(id=contrato.id).update(kyc_estado="rechazado")
            nuevo = B2CContrato.objects.get(id=contrato.id)
        return Response({"id": nuevo.id, "kyc_estado": nuevo.kyc_estado, "motivo": motivo})

    # --------------------------- POST ACTA ---------------------------
    @action(detail=False, methods=["post"], url_path="acta/generar-auto")
    def generar_acta_auto(self, request):
        """
        Body: { token? | tenant_slug, contrato_id, filtros?, observaciones?, firmar_ahora? }
        """
        contrato, tenant_slug = self._get_target(request)

        filtros = request.data.get("filtros", {})
        observaciones = request.data.get("observaciones", "") or ""
        firmar_ahora = bool(request.data.get("firmar_ahora", True))

        from checkouters.models import DispositivoReal  # dentro del tenant
        from .views import generar_pdf_contrato           # si vive en este módulo; ajusta import si no

        with schema_context(tenant_slug), transaction.atomic():
            marco = B2CContrato.objects.select_for_update().get(id=contrato.id)
            if getattr(marco, "tipo", "") != "marco":
                return Response({"detail": "Requiere un contrato marco."}, status=400)
            if marco.estado != "firmado":
                return Response({"detail": "El contrato marco debe estar firmado."}, status=400)

            opp_id = getattr(marco, "oportunidad_id", None)
            if not opp_id:
                return Response({"detail": "Sin oportunidad asociada."}, status=400)

            qs = DispositivoReal.objects.filter(oportunidad_id=opp_id)
            qs = self._apply_inventario_filters(qs, filtros)
            dispositivos = list(qs)

            if not dispositivos:
                return Response({"detail": "No hay dispositivos para el acta."}, status=400)
            


            datos_acta = {
                "empresa": (marco.contrato_datos or {}).get("empresa", {}),
                "cliente": (marco.contrato_datos or {}).get("cliente", {}),
                "dispositivos": [],
                "total": 0.0,
                "observaciones": observaciones,
                "ref_sha256": marco.pdf_sha256,
            }
            total = 0.0
            for d in dispositivos:
                precio = float(getattr(d, "precio_acordado", 0) or 0)
                datos_acta["dispositivos"].append({
                    "descripcion": getattr(d, "descripcion", "") or f"{getattr(d,'marca','')} {getattr(d,'modelo','')}".strip(),
                    "imei": getattr(d, "imei", None),
                    "serie": getattr(d, "numero_serie", None),
                    "estado": getattr(d, "grading", None) or getattr(d, "estado", None),
                    "precio": precio,
                    "observaciones": getattr(d, "observaciones", "") or "",
                })
                total += precio
            datos_acta["total"] = total

            acta = B2CContrato.objects.create(
                tipo="acta",
                principal=marco,
                email=marco.email,
                telefono=getattr(marco, "telefono", None),
                dni=marco.dni,
                contrato_datos=datos_acta,
                estado="pendiente",
            )

            pdf_file, sha = generar_pdf_contrato(acta, preview=False)
            acta.pdf.save(f"acta_{acta.id}.pdf", pdf_file, save=False)
            acta.pdf_sha256 = sha

            if firmar_ahora:
                import uuid
                acta.kyc_token = uuid.uuid4()
                acta.kyc_expires_at = timezone.now() + timezone.timedelta(days=7)
                with schema_context(get_public_schema_name()):
                    B2CKycIndex.objects.update_or_create(
                        token=acta.kyc_token,
                        defaults={
                            "tenant_slug": tenant_slug,
                            "contrato_id": acta.id,
                            "expires_at": acta.kyc_expires_at,
                            "revoked_at": None,
                        },
                    )
                acta.estado = "pendiente"
            else:
                acta.estado = "firmado"

            acta.save()

        return Response(
            {
                "ok": True,
                "acta_id": acta.id,
                "pdf_sha256": acta.pdf_sha256,
                "pdf_url": acta.pdf.url if getattr(acta, "pdf", None) else None,
                "kyc_token": getattr(acta, "kyc_token", None),
            },
            status=201,
        )  

    @action(detail=False, methods=["post"], url_path="acta/generar-por-opp")
    def generar_acta_por_opp(self, request):
        tenant_slug = (request.data or {}).get("tenant_slug")
        opp = (request.data or {}).get("opp")  # UUID de la oportunidad
        firmar_ahora = bool((request.data or {}).get("firmar_ahora", True))
        observaciones = (request.data or {}).get("observaciones", "") or ""

        if not tenant_slug or not opp:
            raise ValidationError("Debes enviar tenant_slug y opp (uuid).")

        with schema_context(tenant_slug):
            # 1) Oportunidad + líneas estimadas (Dispositivo) y reales auditadas (DispositivoReal)
            try:
                oportunidad = Oportunidad.objects.get(uuid=opp)
            except Oportunidad.DoesNotExist:
                raise NotFound("Oportunidad no encontrada.")

            # Dispositivos estimados (pueden tener 'cantidad')
            estimados = list(
                Dispositivo.objects.filter(oportunidad=oportunidad)
                .select_related("modelo")
                .values(
                    "id",
                    "modelo_id",
                    "modelo__descripcion",
                    "estado_funcional",
                    "estado_fisico",
                    "cantidad",
                    "precio_orientativo",
                )
            )

            # Dispositivos reales auditados
            reales_qs = (
                DispositivoReal.objects.filter(oportunidad=oportunidad, auditado=True)
                .select_related("modelo", "capacidad")
            )
            if not reales_qs.exists():
                return Response({"detail": "No hay dispositivos auditados."}, status=400)

            reales = list(
                reales_qs.values(
                    "id",
                    "modelo_id",
                    "modelo__descripcion",
                    "capacidad_id",
                    "imei",
                    "numero_serie",
                    "estado_fisico",
                    "estado_funcional",
                    "precio_final",
                    "observaciones",
                )
            )

            # 2) Comparación: multiconjunto por (modelo_id x estado_normalizado)
            est_counts = defaultdict(lambda: defaultdict(int))
            real_counts = defaultdict(lambda: defaultdict(int))

            # estimados: sumar por cantidad; usar estado_funcional -> fallback estado_fisico
            for e in estimados:
                estado_e = _norm_estado(e["estado_funcional"] or e["estado_fisico"])
                cant = int(e.get("cantidad") or 1)
                _add_count(est_counts, e["modelo_id"], estado_e, cant)

            # reales: cada unidad cuenta 1; usar estado_funcional -> fallback estado_fisico
            for r in reales:
                estado_r = _norm_estado(r["estado_funcional"] or r["estado_fisico"])
                _add_count(real_counts, r["modelo_id"], estado_r, 1)

            hay_diferencias = False
            modelos = set(est_counts.keys()) | set(real_counts.keys())
            for mid in modelos:
                if est_counts[mid] != real_counts[mid]:
                    hay_diferencias = True
                    break

            tipo_acta = "discrepancias" if hay_diferencias else "normal"

            # 3) Marco firmado
            marco = (
                B2CContrato.objects.filter(oportunidad_id=str(oportunidad.uuid), tipo="marco")
                .order_by("-creado_en")
                .first()
            )
            if not marco or marco.estado != "firmado":
                return Response({"detail": "Se requiere un contrato marco firmado para generar acta."}, status=400)

            # 4) Snapshot del acta usando los REALES
            #    Si hay discrepancias, añadimos 'estado_esperado' (más frecuente por modelo) y 'coincide'
            esperado_por_modelo = defaultdict(list)
            for e in estimados:
                esperado_por_modelo[e["modelo_id"]].extend(
                    [_norm_estado(e["estado_funcional"] or e["estado_fisico"])] * int(e.get("cantidad") or 1)
                )

            total = 0.0
            dispositivos_snapshot = []
            for r in reales:
                precio = float(r["precio_final"] or 0)
                total += precio
                estado_func = _norm_estado(r["estado_funcional"] or r["estado_fisico"])

                linea = {
                    "descripcion": r["modelo__descripcion"] or "Dispositivo",
                    "imei": r["imei"],
                    "serie": r["numero_serie"],
                    "estado": f"Físico: {r['estado_fisico'] or '-'} / Funcional: {r['estado_funcional'] or '-'}",
                    "precio": precio,
                    "observaciones": r["observaciones"] or "",
                }

                if hay_diferencias and esperado_por_modelo[r["modelo_id"]]:
                    cont = Counter(esperado_por_modelo[r["modelo_id"]])
                    esperado_top, _ = cont.most_common(1)[0]
                    linea["estado_esperado"] = esperado_top
                    linea["coincide"] = (estado_func == esperado_top)

                dispositivos_snapshot.append(linea)

            datos_acta = {
                "empresa": (marco.contrato_datos or {}).get("empresa", {}),
                "cliente": (marco.contrato_datos or {}).get("cliente", {}),
                "dispositivos": dispositivos_snapshot,
                "total": total,
                "observaciones": observaciones,
                "ref_sha256": marco.pdf_sha256,
                "tipo_acta": tipo_acta,
                "origen": {"opp": str(oportunidad.uuid), "tenant": tenant_slug},
            }

            # 5) Crear ACTA hija (+ firma opcional)
            with transaction.atomic():
                acta = B2CContrato.objects.create(
                    tipo="acta",
                    principal=marco,
                    email=marco.email,
                    telefono=getattr(marco, "telefono", None),
                    dni=marco.dni,
                    contrato_datos=datos_acta,
                    estado="pendiente",
                    oportunidad_id=str(oportunidad.uuid),
                )

                if firmar_ahora:
                    import uuid
                    acta.kyc_token = uuid.uuid4()
                    acta.kyc_expires_at = timezone.now() + timezone.timedelta(days=7)
                    with schema_context(get_public_schema_name()):
                        B2CKycIndex.objects.update_or_create(
                            token=acta.kyc_token,
                            defaults={
                                "tenant_slug": tenant_slug,
                                "contrato_id": acta.id,
                                "expires_at": acta.kyc_expires_at,
                                "revoked_at": None,
                            },
                        )
                    acta.estado = "pendiente"
                    acta.save(update_fields=["kyc_token", "kyc_expires_at", "estado"])
                    _enviar_mail_acta_firma(tenant_slug, acta)
                else:
                    acta.estado = "firmado"
                    acta.save(update_fields=["estado"])
                

        return Response(
            {
                "ok": True,
                "tipo_acta": tipo_acta,
                "acta_id": acta.id,
                "total": total,
                "kyc_token": str(getattr(acta, "kyc_token", "")) or None,
            },
            status=201,
        )

    @action(detail=True, methods=["get"], url_path="pdf-blob",
        permission_classes=[permissions.IsAuthenticated])
    def pdf_blob(self, request, id=None, **kwargs):
        # 1) Resolver tenant
        tenant_slug = (
            request.query_params.get("tenant_slug")
            or getattr(getattr(request, "tenant", None), "schema_name", None)
        )
        log_ws_event (f"[pdf_blob] pk={id} tenant_slug={tenant_slug!r}")
        if not tenant_slug or tenant_slug == get_public_schema_name():
            return Response({"detail": "Falta tenant_slug."}, status=status.HTTP_400_BAD_REQUEST)

        tipo = request.query_params.get("tipo")  # opcional: 'marco' | 'acta'

        from checkouters.models.legal import B2CContrato
        with schema_context(tenant_slug):
            qs = B2CContrato.objects.all()
            contrato = None

            # 2) Si pk es numérico -> id de contrato
            if str(id).isdigit():
                contrato = qs.filter(pk=int(id)).first()
                log_ws_event("[pdf_blob] Buscando por ID de contrato")
            else:
                # 3) Si no, trátalo como UUID de oportunidad
                q = qs.filter(oportunidad_id=id)
                log_ws_event("[pdf_blob] Buscando por oportunidad_id")
                if tipo in ("marco", "acta"):
                    q = q.filter(tipo=tipo)
                # Prioriza firmados
                q = q.annotate(
                    prioridad=Case(
                        When(estado="firmado", then=0),
                        default=1,
                        output_field=IntegerField(),
                    )
                ).order_by("prioridad", "-creado_en")
                contrato = q.first()

            if not contrato:
                return Response({"detail": "No B2CContrato matches the given query."}, status=404)
            if not contrato.pdf:
                return Response({"detail": "No hay PDF."}, status=404)

            resp = FileResponse(contrato.pdf.open("rb"), content_type="application/pdf")
            resp["Content-Disposition"] = f'inline; filename="contrato_{contrato.id}.pdf"'
            resp["Cache-Control"] = "private, no-store, no-cache, must-revalidate, max-age=0"
            resp["Pragma"] = "no-cache"
            resp["Expires"] = "0"
            resp["Referrer-Policy"] = "no-referrer"
            resp["X-Frame-Options"] = "SAMEORIGIN"
            return resp
        
