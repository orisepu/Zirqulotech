from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django_tenants.utils import schema_context, get_public_schema_name
from django.http import FileResponse, HttpResponse, JsonResponse
from django.core.files.base import ContentFile
from django.conf import settings
from django.core.mail import send_mail, EmailMessage
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated, AllowAny
from ipware import get_client_ip
from django.utils.timezone import now
import uuid
import hmac
import hashlib
import io

from ..models.legal import B2CContrato, LegalTemplate
from ..serializers import B2CContratoCreateSerializer, B2CContratoDetailSerializer, B2CContratoKYCFlagsSerializer, LegalTemplateSerializer
from ..permissions import EsTecnicoOAdmin
from ..utils.otp import check_otp, generar_otp, hash_otp
from ..utils.pdf import generar_pdf_contrato, persistir_pdf_final
from ..utils.images import sanitize_image
from ..services.legal_pdfs import build_condiciones_b2c_pdf
from progeek.models import B2CKycIndex
import django_filters
from rest_framework.filters import OrderingFilter
from datetime import timedelta
from django.template import Template, Context
from django.db.models import When, Case, IntegerField
from django_test_app.logging_utils import log_ws_event, log_ws_warning, log_ws_error
from django.db.models import Case, When, IntegerField


OTP_TTL_MINUTES = getattr(settings, "OTP_TTL_MINUTES", 10)
OTP_COOLDOWN_SECONDS = getattr(settings, "OTP_COOLDOWN_SECONDS", 60)
DEFAULT_NAMESPACE = "default"
DEFAULT_SLUG = "b2c-condiciones"
DEFAULT_TEMPLATE_TEXT ="""CONTRATO DE COMPRA DE DISPOSITIVOS (B2C)

Entre:
- El OPERADOR: {{ operador.nombre }} (CIF {{ operador.cif }}), con domicilio en {{ operador.direccion }}, email {{ operador.email }} y teléfono {{ operador.telefono }}{% if operador.web %}, web: {{ operador.web }}{% endif %}.
- La EMPRESA (partner): {{ empresa.nombre }}{% if empresa.cif %} (CIF {{ empresa.cif }}){% endif %}, domicilio {{ empresa.direccion }}{% if empresa.email %}, email {{ empresa.email }}{% endif %}{% if empresa.telefono %}, teléfono {{ empresa.telefono }}{% endif %}.
- El CLIENTE (vendedor): {{ cliente.nombre }} {{ cliente.apellidos }} (DNI/NIE {{ cliente.dni_nie }}), domicilio {{ cliente.direccion }}, email {{ cliente.email }}, teléfono {{ cliente.telefono }}.

Fecha: {{ contrato.fecha }} | Nº Contrato: {{ contrato.numero }}

1. Objeto
El Cliente vende a la Empresa/Operador los dispositivos descritos en este contrato, con transmisión de la propiedad y del derecho de uso, por el precio acordado.

2. Relación de dispositivos y precio
{% for d in dispositivos -%}
- {{ forloop.counter }}. {{ d.modelo }}{% if d.capacidad %} {{ d.capacidad }}{% endif %} | IMEI/Serie: {{ d.imei_serial }} | Estado físico: {{ d.estado_fisico }} | Estado funcional: {{ d.estado_funcional }} | Precio: {{ d.precio }} €
{% endfor -%}
Importe total estimado: {{ contrato.importe_total }} €.

3. Diagnóstico y verificación
La Empresa/Operador verificará IMEI/serie, funcionalidad y estado. Posible segunda oferta en {{ contrato.validez_dias|default:"7" }} días.

4. Propiedad y datos
El Cliente declara titularidad legítima. Posible borrado certificado de datos.

5. Pago
Se efectuará tras verificación, o aceptación de segunda oferta.

8. Protección de datos
Responsables: {{ operador.nombre }}{% if empresa.nombre and empresa.nombre != operador.nombre %} y {{ empresa.nombre }}{% endif %}. Derechos en {{ operador.email }}{% if empresa.email %} y {{ empresa.email }}{% endif %}.

11. Firma electrónica (OTP)
Huella: {{ contrato.otp_hash }} | Ref KYC: {{ contrato.kyc_ref }}.
"""

def get_or_create_active(namespace, slug):
    tpl = LegalTemplate.objects.filter(namespace=namespace, slug=slug, is_active=True).first()
    if not tpl:
        tpl = LegalTemplate.objects.create(
            namespace=namespace, slug=slug, title="Plantilla B2C por defecto",
            version="v1", content=DEFAULT_TEMPLATE_TEXT, is_active=True
        )
    return tpl

def _now():
    return timezone.now()

def _load_link(token: str):
    with schema_context(get_public_schema_name()):
        try:
            link = B2CKycIndex.objects.get(token=token)
        except B2CKycIndex.DoesNotExist:
            return None, "Token no válido."

        if (link.expires_at and timezone.now() >= link.expires_at) or link.revoked_at:
            return None, "Enlace expirado o ya utilizado."

        if not link.tenant_slug or not link.contrato_id:
            return None, "Token sin destino válido."

    return link, None

def _verify_otp(contrato: B2CContrato, code: str) -> bool:
    if not code or not contrato.otp_hash:
        return False
    try:
        digest = hashlib.sha256(code.encode("utf-8")).hexdigest()
        ok_hash = hmac.compare_digest(contrato.otp_hash, digest)
    except Exception:
        return False
    return ok_hash and bool(contrato.otp_vigente())


class B2CContratoFilter(django_filters.FilterSet):
    oportunidad = django_filters.UUIDFilter(field_name="oportunidad_id")

    class Meta:
        model = B2CContrato
        fields = ["oportunidad", "estado", "kyc_token", "email", "telefono"]


class B2CContratoViewSet(viewsets.ModelViewSet):
    queryset = B2CContrato.objects.all().order_by("-creado_en")
    http_method_names = ["post", "get", "patch"]
    lookup_field = "id"

    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["creado_en", "id"]
    filterset_class = B2CContratoFilter
    
    def get_serializer_class(self):
        if self.action in ["create"]:
            return B2CContratoCreateSerializer
        return B2CContratoDetailSerializer

    # === Helper: marcar oportunidad como aceptada al firmar ===
    def _actualizar_estado_oportunidad_por_firma(self, contrato: B2CContrato) -> None:
        """
        Reglas:
        - 'Oferta confirmada' o 'Nueva oferta enviada' -> 'Pendiente de pago' (plazo 7 días, fecha inicio ahora)
        - 'Aceptado' -> 'Contrato firmado'
        - Si ya está en 'Contrato firmado' / 'Pendiente de pago' / 'Pagado' -> no tocar (idempotente)
        - Si viene de otro estado anterior -> 'Aceptado' (fallback)
        """
        if not getattr(contrato, "oportunidad_id", None):
            return
        try:
            from django.apps import apps
            from django.db.models import Q
            Oportunidad = apps.get_model("checkouters", "Oportunidad")
            opp = (
                Oportunidad.objects
                .filter(Q(uuid=contrato.oportunidad_id) | Q(id=contrato.oportunidad_id))
                .first()
            )
            if not opp:
                return

            estado_actual = (getattr(opp, "estado", "") or "").strip()

            ESTADO_ACEPTADO = "Aceptado"
            ESTADO_FIRMADO  = "Contrato firmado"
            ESTADO_PDP      = "Pendiente de pago"

            # Estados en los que no debemos retroceder
            if estado_actual in {ESTADO_FIRMADO, ESTADO_PDP, "Pagado"}:
                return

            fields_to_update = ["estado"]

            if estado_actual in {"Oferta confirmada", "Nueva oferta enviada"}:
                opp.estado = ESTADO_PDP
                # plazo configurable, por defecto 7
                plazo_default = int(getattr(settings, "B2C_PLAZO_PAGO_DIAS_FIRMA", 7))
                opp.plazo_pago_dias = opp.plazo_pago_dias or plazo_default
                opp.fecha_inicio_pago = timezone.now()
                fields_to_update += ["plazo_pago_dias", "fecha_inicio_pago"]

            elif estado_actual == ESTADO_ACEPTADO:
                opp.estado = ESTADO_FIRMADO

            else:
                # Fallback: si venía de algo anterior a Aceptado, lo ponemos en Aceptado
                opp.estado = ESTADO_ACEPTADO

            try:
                opp.save(update_fields=list(set(fields_to_update)))
            except Exception:
                opp.save()

        except Exception:
            # Silenciamos para no romper la firma si hay mapeos distintos de modelos/apps
            pass

    @action(detail=False, methods=["get"], url_path=r"kyc/(?P<token>[0-9a-f\-]{36})/info", permission_classes=[permissions.AllowAny])
    def kyc_info(self, request, token=None, *args, **kwargs):
        with schema_context(get_public_schema_name()):
            idx = B2CKycIndex.objects.filter(token=token).order_by("-expires_at").first()
            if not idx:
                return Response({"detail": "Token no reconocido."}, status=404)

            now = timezone.now()
            if (idx.expires_at and idx.expires_at < now) or idx.revoked_at:
                return Response({"detail": "Enlace expirado o ya utilizado."}, status=410)

            tenant_slug = idx.tenant_slug
            contrato_id = idx.contrato_id

        with schema_context(tenant_slug):
            c = B2CContrato.objects.filter(id=contrato_id).first()
            if not c:
                return Response({"detail": "Contrato no encontrado."}, status=404)

            data = {
                "tipo": c.tipo,
                "requiere_dni": (c.tipo != "acta"),
                "estado": c.estado,
                "tenant_slug": tenant_slug,
                "contrato_id": c.id,
                "email": c.email,
                "cliente": (c.contrato_datos or {}).get("cliente"),
                "empresa": (c.contrato_datos or {}).get("empresa"),
                "kyc_expires_at": getattr(c, "kyc_expires_at", None),
            }

        return Response(data, status=200)
   
    @action(detail=True, methods=["post"], url_path="kyc/verificar", permission_classes=[EsTecnicoOAdmin])
    def kyc_verificar(self, request, pk=None):
        c: B2CContrato = self.get_object()
        c.kyc_estado = "verificado"
        c.kyc_verificado_en = timezone.now()
        c.kyc_verificado_por = request.user
        c.pago_bloqueado_por_kyc = False
        c.kyc_motivo = ""
        c.save(update_fields=["kyc_estado","kyc_verificado_en","kyc_verificado_por",
                            "pago_bloqueado_por_kyc","kyc_motivo"])
        return Response({"ok": True, "kyc_estado": c.kyc_estado})

    @action(detail=True, methods=["post"], url_path="kyc/mismatch", permission_classes=[EsTecnicoOAdmin])
    def kyc_mismatch(self, request, pk=None):
        c: B2CContrato = self.get_object()
        c.kyc_estado = "mismatch"
        c.pago_bloqueado_por_kyc = True
        c.kyc_motivo = request.data.get("motivo", "Discrepancia en datos del DNI")
        c.save(update_fields=["kyc_estado","pago_bloqueado_por_kyc","kyc_motivo"])
        return Response({"ok": True, "kyc_estado": c.kyc_estado})

    @action(detail=True, methods=["post"], url_path="kyc/rechazar", permission_classes=[EsTecnicoOAdmin])
    def kyc_rechazar(self, request, pk=None):
        c: B2CContrato = self.get_object()
        c.kyc_estado = "rechazado"
        c.pago_bloqueado_por_kyc = True
        c.kyc_motivo = request.data.get("motivo", "KYC rechazado")
        c.save(update_fields=["kyc_estado","pago_bloqueado_por_kyc","kyc_motivo"])
        return Response({"ok": True, "kyc_estado": c.kyc_estado})

    @action(detail=True, methods=["post"], url_path="verificar-otp")
    @transaction.atomic
    def verificar_otp(self, request, pk=None):
        contrato: B2CContrato = self.get_object()

        if contrato.estado not in ("pendiente", "otp_enviado"):
            return Response({"detail": "Estado inválido"}, status=status.HTTP_400_BAD_REQUEST)

        otp = (request.data.get("otp") or "").strip()
        if not _verify_otp(contrato, otp):
            contrato.otp_intentos = (contrato.otp_intentos or 0) + 1
            contrato.save(update_fields=["otp_intentos"])
            return Response({"ok": False, "detail": "OTP inválido o caducado"}, status=status.HTTP_400_BAD_REQUEST)

        contrato.marcar_firmado(
            firmante=request.data.get("firmante") or contrato.email,
            ip=request.META.get("REMOTE_ADDR", ""),
            ua=request.META.get("HTTP_USER_AGENT", ""),
        )
        contrato.save(update_fields=["estado", "firmado_en", "firmado_por", "ip_firmante", "user_agent"])

        pdf_url = persistir_pdf_final(contrato)

        # ✅ Marcar oportunidad aceptada
        self._actualizar_estado_oportunidad_por_firma(contrato)

        data = self.get_serializer(contrato).data
        data.update({"ok": True, "pdf_url": pdf_url})
        return Response(data, status=status.HTTP_200_OK)
    
    
    @action(detail=False, methods=["get"], url_path=r"detalle-por-opp")
    def detalle_por_opp(self, request):
        tenant_slug = (request.query_params.get("tenant_slug") or "").strip()
        opp = (request.query_params.get("opp") or "").strip()
        tipo = (request.query_params.get("tipo") or "").strip().lower()
        want_all = (request.query_params.get("all") or "").strip().lower() in ("1", "true", "yes")

        schema_log = tenant_slug or getattr(getattr(request, "tenant", None), "schema_name", None) or "—"

        log_ws_event(
            "detalle_por_opp.in",
            user=getattr(request, "user", None),
            schema=schema_log,
            extra=f"{'tenant=' + tenant_slug + ' ' if tenant_slug else ''}opp={opp} tipo={tipo or '—'} all={want_all}"
        )

        qs = B2CContrato.objects.filter(oportunidad_id=opp)

        # ⬇️ AQUI estaba el problema más común: si no aplicas este filtro, 'tipo=marco' y 'tipo=acta'
        #     devuelven lo mismo (el 'first' tras ordenar).
        if tipo in ("marco", "acta"):
            qs = qs.filter(tipo=tipo)

        qs = qs.annotate(
            prioridad=Case(
                When(estado="firmado", then=0),
                default=1,
                output_field=IntegerField(),
            )
        ).order_by("prioridad", "-creado_en")

        # Log de conteo y sample para ver qué hay realmente en BD
        count = qs.count()
        sample = list(qs.values("id", "tipo", "estado").order_by("-creado_en")[:5])
        log_ws_event(
            "detalle_por_opp.qs",
            user=getattr(request, "user", None),
            schema=schema_log,
            extra=f"count={count} sample={sample}"
        )

        if want_all:
            data = B2CContratoDetailSerializer(qs, many=True, context={"request": request}).data
            log_ws_event(
                "detalle_por_opp.out",
                user=getattr(request, "user", None),
                schema=schema_log,
                extra=f"return=list({len(data)}) ids={[d.get('id') for d in data]} tipos={[d.get('tipo') for d in data]}"
            )
            return Response({"count": count, "results": data}, status=200)

        contrato = qs.first()
        if not contrato:
            log_ws_warning(
                "detalle_por_opp.empty",
                user=getattr(request, "user", None),
                schema=schema_log,
                extra=f"opp={opp} tipo={tipo or '—'}"
            )
            return Response({"detail": "No hay contrato"}, status=404)

        data = B2CContratoDetailSerializer(contrato, context={"request": request}).data
        log_ws_event(
            "detalle_por_opp.out",
            user=getattr(request, "user", None),
            schema=schema_log,
            extra=f"return=1 id={contrato.id} tipo={getattr(contrato,'tipo','')}"
        )
        return Response(data, status=200)

    
    @action(detail=True, methods=["post"], url_path="generar-acta", permission_classes=[permissions.IsAuthenticated])
    def generar_acta(self, request, id=None, **kwargs):
        marco: B2CContrato = self.get_object()
        if not marco.es_marco:
            return Response({"detail": "Sólo se puede generar acta desde un contrato marco."}, status=400)
        if marco.estado != "firmado":
            return Response({"detail": "El contrato marco debe estar firmado antes de generar el acta."}, status=400)

        payload = request.data or {}
        dispositivos = payload.get("dispositivos", [])
        total = payload.get("total")
        observaciones = payload.get("observaciones", "")

        datos_acta = {
            "empresa": marco.contrato_datos.get("empresa", {}),
            "cliente": marco.contrato_datos.get("cliente", {}),
            "dispositivos": dispositivos,
            "total": total if total is not None else sum([(d.get("precio") or 0) for d in dispositivos]),
            "observaciones": observaciones,
            "ref_sha256": marco.pdf_sha256,
        }

        acta = B2CContrato.objects.create(
            tipo="acta",
            principal=marco,
            email=marco.email,
            telefono=marco.telefono,
            dni=marco.dni,
            contrato_datos=datos_acta,
            estado="pendiente",
            kyc_token=uuid.uuid4(),
            kyc_expires_at=timezone.now() + timedelta(days=7),
        )

        data = B2CContratoDetailSerializer(acta, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=["get"], url_path="pdf-preview")
    def pdf_preview(self, request, **kwargs):
        contrato = self.get_object()
        pdf_file, sha = generar_pdf_contrato(contrato, preview=True)
        
        bio = io.BytesIO(pdf_file.read())
        resp = FileResponse(bio, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="contrato_preview_{contrato.id}.pdf"'
        resp["Content-Length"] = str(len(pdf_file.getvalue()))
        resp["X-Document-SHA256"] = sha
        resp["X-Frame-Options"] = "SAMEORIGIN"
        return resp
    
    def perform_create(self, serializer):
        contrato = serializer.save()
        if not getattr(contrato, "kyc_token", None):
            contrato.kyc_token = uuid.uuid4()
        contrato.kyc_expires_at = timezone.now() + timedelta(days=3)
        contrato.save(update_fields=["kyc_token", "kyc_expires_at"])

        base = getattr(settings, "FRONTEND_BASE_URL", "").rstrip("/")
        enlace = f"{base}/kyc-upload/{contrato.kyc_token}"
        try:
            if contrato.email:
                send_mail(
                    subject="Completa tu verificación de identidad",
                    message=("Hola,\n\n"
                    "Para completar tu contrato de compra-venta, sube las fotos de tu DNI en el siguiente enlace:\n"
                    f"{enlace}\n\n"
                    "Este enlace caduca en 3 días. Si no solicitaste este proceso, ignora este mensaje.\n\n"
                    "Gracias."),
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@tu-dominio.com"),
                    recipient_list=[contrato.email],
                    fail_silently=False,
                )
        except Exception:
            pass
        
        tenant_slug = getattr(getattr(self.request, "tenant", None), "schema_name", None) or self.request.query_params.get("schema")
        if tenant_slug:
            with schema_context(get_public_schema_name()):
                B2CKycIndex.objects.update_or_create(
                    token=contrato.kyc_token,
                    defaults={
                        "tenant_slug": tenant_slug,
                        "contrato_id": contrato.id,
                        "expires_at": contrato.kyc_expires_at,
                        "revoked_at": None,
                    },
                )
    
    @action(detail=True, methods=["post"], url_path="subir-dni", permission_classes=[permissions.IsAuthenticated])
    def subir_dni(self, request, **kwargs):
        contrato: B2CContrato = self.get_object()
        lado = (request.data.get("lado") or "").strip().lower()
        file = request.FILES.get("imagen")

        if lado not in ("anverso", "reverso"):
            return Response({"detail": "Parametro 'lado' debe ser 'anverso' o 'reverso'."}, status=400)
        if not file:
            return Response({"detail": "Falta el archivo 'imagen'."}, status=400)

        try:
            cleaned = sanitize_image(file)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        filename = f"dni_{lado}.jpg"
        content = ContentFile(cleaned.read(), name=filename)

        if lado == "anverso":
            contrato.dni_anverso.save(filename, content, save=False)
            contrato.tiene_dni_anverso = True
        else:
            contrato.dni_reverso.save(filename, content, save=False)
            contrato.tiene_dni_reverso = True

        if not contrato.kyc_retenido_hasta:
            contrato.marcar_retencion(dias=1825)

        tiene_anv = bool(contrato.dni_anverso)
        tiene_rev = bool(contrato.dni_reverso)
        contrato.tiene_dni_anverso = tiene_anv
        contrato.tiene_dni_reverso = tiene_rev

        if tiene_anv and tiene_rev:
            if contrato.kyc_estado == "pendiente":
                contrato.kyc_estado = "docs_recibidos"
            contrato.kyc_completado = True
            if not contrato.kyc_completed_at:
                contrato.kyc_completed_at = timezone.now()

        contrato.save(update_fields=[
            "dni_anverso", "dni_reverso",
            "tiene_dni_anverso", "tiene_dni_reverso",
            "kyc_estado", "kyc_completado", "kyc_completed_at",
            "kyc_retenido_hasta", "actualizado_en",
        ])

        data = B2CContratoKYCFlagsSerializer(contrato, context={"request": request}).data
        return Response(data, status=200)

    @action(detail=True, methods=["delete"], url_path=r"dni/(?P<lado>anverso|reverso)", permission_classes=[permissions.IsAuthenticated])
    def borrar_dni(self, request, lado=None, **kwargs):
        contrato: B2CContrato = self.get_object()
        if lado == "anverso" and contrato.dni_anverso:
            contrato.dni_anverso.delete(save=False)
            contrato.dni_anverso = None
            contrato.tiene_dni_anverso = False
        elif lado == "reverso" and contrato.dni_reverso:
            contrato.dni_reverso.delete(save=False)
            contrato.dni_reverso = None
            contrato.tiene_dni_reverso = False
        else:
            return Response({"detail": "Nada que borrar."}, status=404)

        if contrato.kyc_estado == "docs_recibidos" and not (contrato.tiene_dni_anverso and contrato.tiene_dni_reverso):
            contrato.kyc_estado = "pendiente"
            contrato.kyc_completado = False
            contrato.kyc_completed_at = None

        contrato.save(update_fields=[
            "dni_anverso", "dni_reverso",
            "tiene_dni_anverso", "tiene_dni_reverso",
            "kyc_estado", "kyc_completado", "kyc_completed_at",
            "actualizado_en",
        ])
        return Response({"detail": "Imagen borrada."}, status=200)

    @action(detail=False,methods=["post"],url_path=r"kyc/(?P<token>[0-9a-f-]+)/subir-dni",permission_classes=[permissions.AllowAny], authentication_classes=[])
    def kyc_public_upload(self, request, token=None):
        with schema_context(get_public_schema_name()):
            idx = get_object_or_404(B2CKycIndex, token=token)
            if getattr(idx, "revoked_at", None) or (idx.expires_at and idx.expires_at < timezone.now()):
                return Response({"detail": "KYC token expirado"}, status=410)
            tenant_slug, contrato_id = idx.tenant_slug, idx.contrato_id

        lado = (request.data.get("lado") or "").strip().lower()
        file = request.FILES.get("imagen")
        if lado not in ("anverso", "reverso"):
            return Response({"detail": "Parametro 'lado' debe ser 'anverso' o 'reverso'."}, status=400)
        if not file:
            return Response({"detail": "Falta el archivo 'imagen'."}, status=400)

        try:
            cleaned = sanitize_image(file)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        filename = f"dni_{lado}.jpg"
        data_bytes = cleaned.read() if hasattr(cleaned, "read") else cleaned
        content = ContentFile(data_bytes, name=filename)

        with schema_context(tenant_slug):
            contrato = get_object_or_404(B2CContrato, pk=contrato_id)

            if lado == "anverso":
                contrato.dni_anverso.save(filename, content, save=False)
                contrato.tiene_dni_anverso = True
            else:
                contrato.dni_reverso.save(filename, content, save=False)
                contrato.tiene_dni_reverso = True

            if not contrato.kyc_retenido_hasta:
                contrato.marcar_retencion(dias=1825)

            tiene_anv = bool(contrato.dni_anverso)
            tiene_rev = bool(contrato.dni_reverso)
            contrato.tiene_dni_anverso = tiene_anv
            contrato.tiene_dni_reverso = tiene_rev

            msg = "Imagen subida correctamente."
            if tiene_anv and tiene_rev:
                if contrato.kyc_estado == "pendiente":
                    contrato.kyc_estado = "docs_recibidos"
                contrato.kyc_completado = True
                if not contrato.kyc_completed_at:
                    contrato.kyc_completed_at = timezone.now()
                msg = "Imagen subida. KYC listo (ambos lados)."

            contrato.save(update_fields=[
                "dni_anverso", "dni_reverso",
                "tiene_dni_anverso", "tiene_dni_reverso",
                "kyc_estado", "kyc_completado", "kyc_completed_at",
                "kyc_retenido_hasta", "actualizado_en",
            ])

            return Response({
                "detail": msg,
                "tiene_dni_anverso": contrato.tiene_dni_anverso,
                "tiene_dni_reverso": contrato.tiene_dni_reverso,
                "kyc_estado": contrato.kyc_estado,
                "kyc_completado": contrato.kyc_completado,
            }, status=200)

    @action(detail=False,methods=["post"],url_path=r"kyc/(?P<token>[0-9a-f\-]{36})/enviar-otp",permission_classes=[permissions.AllowAny],authentication_classes=[])
    def enviar_otp_token(self, request, token=None, **kwargs):
        link, err = _load_link(token)
        if err:
            return Response({"detail": err}, status=410)

        with schema_context(link.tenant_slug):
            contrato = B2CContrato.objects.get(id=link.contrato_id)

            requiere_dni_flag = getattr(contrato, "kyc_requerido", None)
            requiere_dni = requiere_dni_flag if requiere_dni_flag is not None else (contrato.tipo != "acta")

            if contrato.estado == "firmado":
                return Response({"detail": "Este contrato ya está firmado."}, status=400)

            if requiere_dni:
                if not (contrato.dni_anverso and contrato.dni_reverso):
                    return Response({"detail": "Debes subir anverso y reverso del DNI antes de enviar el OTP."}, status=400)
                if not contrato.dni:
                    return Response({"detail": "El DNI es obligatorio antes de enviar el código."}, status=400)

            if contrato.ultimo_envio_otp:
                diff = (timezone.now() - contrato.ultimo_envio_otp).total_seconds()
                if diff < OTP_COOLDOWN_SECONDS:
                    restante = int(OTP_COOLDOWN_SECONDS - diff)
                    return Response(
                        {
                            "detail": f"Espera {restante}s para solicitar un nuevo código.",
                            "cooldown_segundos": restante,
                            "cooldown": restante,
                        },
                        status=429,
                    )

            otp = generar_otp(6)
            contrato.otp_hash = hash_otp(otp)
            contrato.otp_expires_at = timezone.now() + timedelta(minutes=OTP_TTL_MINUTES)
            contrato.otp_intentos = 0
            contrato.estado = "otp_enviado"
            contrato.ultimo_envio_otp = timezone.now()
            contrato.save(update_fields=[
                "otp_hash", "otp_expires_at", "otp_intentos", "estado", "ultimo_envio_otp"
            ])

            email_dest = contrato.email
            kyc_token = contrato.kyc_token

        try:
            if email_dest:
                send_mail(
                    subject="Tu código de firma",
                    message=(f"Tu código es: {otp} (válido {OTP_TTL_MINUTES} minutos).\n"
                            f"Si aún no has subido tu DNI: {getattr(settings,'FRONTEND_BASE_URL','').rstrip('/')}/kyc-upload/{kyc_token}"),
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@tu-dominio.com"),
                    recipient_list=[email_dest],
                    fail_silently=False,
                )
        except Exception:
            return Response({"detail": "No se pudo enviar el código. Inténtalo más tarde."}, status=500)

        return Response({"detail": "Código enviado.",
                        "ttl_minutos": OTP_TTL_MINUTES,
                        "cooldown_segundos": OTP_COOLDOWN_SECONDS,
                        "cooldown": OTP_COOLDOWN_SECONDS}, status=200)

    @action(detail=False,methods=["post"],url_path=r"kyc/(?P<token>[0-9a-f\-]{36})/verificar-otp",permission_classes=[permissions.AllowAny],authentication_classes=[])
    def verificar_otp_token(self, request, token=None, **kwargs):
        link, err = _load_link(token)
        if err:
            return Response({"detail": err}, status=410)

        with schema_context(link.tenant_slug), transaction.atomic():
            contrato = (B2CContrato.objects.select_for_update().get(id=link.contrato_id))

            if contrato.estado == "firmado":
                return Response({"detail": "Este contrato ya está firmado."}, status=400)
            if contrato.estado not in ["pendiente", "otp_enviado"]:
                return Response({"detail": f"No se puede verificar en estado {contrato.estado}."}, status=400)
            if not contrato.otp_expires_at or timezone.now() >= contrato.otp_expires_at:
                contrato.estado = "expirado"
                contrato.save(update_fields=["estado"])
                return Response({"detail": "Código caducado. Solicita uno nuevo."}, status=400)
            if contrato.otp_intentos >= contrato.otp_max_intentos:
                return Response({"detail": "Has superado el número de intentos. Solicita un nuevo código."}, status=429)

            otp = (request.data.get("otp") or "").strip()
            if not otp or not check_otp(otp, contrato.otp_hash):
                contrato.otp_intentos += 1
                contrato.save(update_fields=["otp_intentos"])
                restantes = max(0, contrato.otp_max_intentos - contrato.otp_intentos)
                return Response({"detail": f"Código incorrecto. Intentos restantes: {restantes}."}, status=400)

            ip, _ = get_client_ip(request)
            contrato.firmado_en = timezone.now()
            contrato.firmado_por = contrato.email or contrato.telefono
            contrato.ip_firmante = ip
            contrato.user_agent = request.META.get("HTTP_USER_AGENT", "")[:1000]
            contrato.estado = "firmado"
            pdf_file, sha = generar_pdf_contrato(contrato,preview=False)
            contrato.pdf.save(f"contrato_{contrato.id}.pdf", pdf_file, save=False)
            contrato.pdf_sha256 = sha
            
            contrato.otp_hash = ""
            contrato.otp_expires_at = None
            contrato.otp_intentos = 0
            contrato.ultimo_envio_otp = None

            contrato.save()
            
            # ✅ Marcar oportunidad aceptada
            self._actualizar_estado_oportunidad_por_firma(contrato)
            
            email_dest = contrato.email
            pdf_path = contrato.pdf.path if hasattr(contrato.pdf, "path") else None
            pdf_url  = contrato.pdf.url if contrato.pdf else None
            sha256   = contrato.pdf_sha256
            contrato_id = contrato.id
            
            def _send_signed_email():
                subject = "Contrato firmado — Confirmación"
                body = (
                    "Hola,\n\n"
                    "Tu contrato ha sido firmado correctamente.\n\n"
                    f"Referencia: {contrato_id}\n"
                    f"SHA-256 del PDF: {sha256}\n\n"
                    "Adjuntamos el documento firmado para tu referencia.\n"
                    "Gracias.\n"
                )
                if not email_dest:
                    return

                msg = EmailMessage(
                    subject=subject,
                    body=body,
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@tu-dominio.com"),
                    to=[email_dest],
                )
                try:
                    if pdf_path:
                        with open(pdf_path, "rb") as f:
                            msg.attach(f"contrato_{contrato_id}.pdf", f.read(), "application/pdf")
                    msg.send(fail_silently=True)
                except Exception:
                    pass

            transaction.on_commit(_send_signed_email)

            pdf_url = contrato.pdf.url if contrato.pdf else None
            firmado_en = contrato.firmado_en
            sha256 = contrato.pdf_sha256

        with schema_context(get_public_schema_name()):
            B2CKycIndex.objects.filter(token=token, revoked_at__isnull=True)\
                .update(revoked_at=timezone.now())

        if not pdf_url:
            return Response({"detail": "Contrato firmado, pero no se pudo generar el PDF."}, status=500)

        return Response({
            "detail": "Contrato firmado.",
            "firmado": True,
            "pdf": pdf_url,
            "sha256": sha256,
            "firmado_en": firmado_en,
        }, status=200)
    
    @action(detail=True, methods=["get"], url_path="pdf-blob", permission_classes=[permissions.IsAuthenticated])
    def pdf_blob(self, request, **kwargs):
        contrato: B2CContrato = self.get_object()
        if not contrato.pdf:
            return Response({"detail": "No hay PDF."}, status=404)

        # 🔒 Cabeceras para privacidad/no-cache
        resp = FileResponse(contrato.pdf.open("rb"), content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="contrato_{contrato.id}.pdf"'
        resp["Cache-Control"] = "private, no-store, no-cache, must-revalidate, max-age=0"
        resp["Pragma"] = "no-cache"
        resp["Expires"] = "0"
        resp["Referrer-Policy"] = "no-referrer"
        resp["X-Frame-Options"] = "SAMEORIGIN"
        return resp
    
    @action(detail=True, methods=["post"])
    def finalizar(self, request, id=None):
        contrato = self.get_object()
        contrato.estado = "finalizado"
        contrato.save(update_fields=["estado"])
        return Response({"estado": contrato.estado}, status=200)

    @action(detail=False, methods=["get"], url_path=r"por-oportunidad/(?P<opp>[0-9a-f-]+)")
    def por_oportunidad(self, request, opp=None):
        qs = B2CContrato.objects.filter(oportunidad_id=opp)

        # Opcional: permitir ?tipo=marco|acta
        tipo = request.query_params.get("tipo")
        if tipo in ("marco", "acta"):
            qs = qs.filter(tipo=tipo)

        # Preferir firmados primero y, dentro de cada grupo, el más reciente
        qs = qs.annotate(
            prioridad=Case(
                When(estado="firmado", then=0),
                default=1,
                output_field=IntegerField(),
            )
        ).order_by("prioridad", "-creado_en")

        contrato = qs.first()
        if not contrato:
            return Response({"detail": "No hay contrato"}, status=status.HTTP_404_NOT_FOUND)

        data = B2CContratoDetailSerializer(contrato, context={"request": request}).data
        return Response(data, status=status.HTTP_200_OK)  

class B2CContratoFlagsAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, token):
        with schema_context(get_public_schema_name()):
            idx = get_object_or_404(B2CKycIndex, token=token)
            exp = idx.expires_at
            if getattr(idx, "revoked_at", None) or (exp and exp < now()):
                return Response({"detail": "KYC token expirado"}, status=410)
            tenant_slug, contrato_id = idx.tenant_slug, idx.contrato_id
        
        with schema_context(tenant_slug):
            contrato = get_object_or_404(B2CContrato, pk=contrato_id)

        if (contrato.kyc_revocado_at is not None) or (
            contrato.kyc_expires_at and contrato.kyc_expires_at < now()
        ):
            return Response({"detail": "KYC token expirado"}, status=410)

        return Response({
            "tiene_dni_anverso": bool(contrato.tiene_dni_anverso),
            "tiene_dni_reverso": bool(contrato.tiene_dni_reverso),
        })
    

class B2CContratoKycFinalizarAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request, token):
            with schema_context(get_public_schema_name()):
                idx = get_object_or_404(B2CKycIndex, token=token)
                exp = idx.expires_at
                if exp and exp < now():
                    return Response({"detail": "KYC token expirado"}, status=410)
                tenant_slug, contrato_id = idx.tenant_slug, idx.contrato_id

            with schema_context(tenant_slug):
                contrato = get_object_or_404(B2CContrato, pk=contrato_id)

                ya_estaba = bool(getattr(contrato, "kyc_completado", False))
                if getattr(contrato, "kyc_completado", False):
                    return Response({"ok": True, "estado": getattr(contrato, "estado", None)}, status=200)
                
                if not contrato.dni_anverso or not contrato.dni_reverso:
                    return Response({"detail": "Falta anverso y/o reverso del DNI."}, status=400)

                contrato.kyc_completado = True
                if not getattr(contrato, "kyc_completed_at", None):
                    contrato.kyc_completed_at = now()
                contrato.kyc_revocado_at = now()
                if hasattr(contrato, "estado"):
                    try:
                        contrato.estado = "KYC completado"
                    except Exception:
                        pass
                contrato.save()

            with schema_context(get_public_schema_name()):
                B2CKycIndex.objects.filter(token=token).update(revoked_at=now())

            if not ya_estaba and getattr(contrato, "email", None):
                try:
                    send_mail(
                        subject="Hemos recibido tu documentación",
                        message=("Gracias por completar el proceso de verificación.\n"
                                "Revisaremos tu documentación y te avisaremos por correo."),
                        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                        recipient_list=[contrato.email],
                        fail_silently=True,
                    )
                except Exception:
                    pass

            return Response({"ok": True, "estado": getattr(contrato, "estado", None)}, status=200)
    

class B2CContratoRenovarKYCApiView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        contrato = get_object_or_404(B2CContrato, pk=pk)

        dias = int(request.data.get("dias", 7))
        regenerar = bool(request.data.get("regenerar_token", True))

        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None) or getattr(connection, "schema_name", None)

        if regenerar or not getattr(contrato, "kyc_token", None):
            contrato.kyc_token = uuid.uuid4()
        nueva = now() + timedelta(days=dias)
        contrato.kyc_expires_at = nueva
        if hasattr(contrato, "kyc_revocado_at"):
            contrato.kyc_revocado_at = None
        contrato.save(update_fields=["kyc_token", "kyc_expires_at", "kyc_revocado_at"])

        with schema_context(get_public_schema_name()):
            B2CKycIndex.objects.update_or_create(
                token=contrato.kyc_token,
                defaults={
                    "tenant_slug": tenant_slug,
                    "contrato_id": contrato.id,
                    "expires_at": nueva,
                    "revoked_at": None,
                },
            )

        url = f"{getattr(settings, 'FRONTEND_BASE_URL', 'https://progeek.es').rstrip('/')}/kyc-upload/{contrato.kyc_token}"
        return Response({"ok": True, "kyc_token": str(contrato.kyc_token), "url": url, "expira_en_dias": dias}, status=200)
    

class B2CContratoReenviarKYCApiView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        contrato = get_object_or_404(B2CContrato, pk=pk)

        dias = int(request.data.get("dias", 7))
        regenerar = bool(request.data.get("regenerar_token", True))
        destinatario = request.data.get("email") or getattr(contrato, "email", None)
        if not destinatario:
            return Response({"detail": "No hay email del cliente."}, status=400)

        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None) or getattr(connection, "schema_name", None)

        if regenerar or not getattr(contrato, "kyc_token", None):
            contrato.kyc_token = uuid.uuid4()
        nueva = now() + timedelta(days=dias)
        contrato.kyc_expires_at = nueva
        if hasattr(contrato, "kyc_revocado_at"):
            contrato.kyc_revocado_at = None
        contrato.save(update_fields=["kyc_token", "kyc_expires_at", "kyc_revocado_at"])

        with schema_context(get_public_schema_name()):
            B2CKycIndex.objects.update_or_create(
                token=contrato.kyc_token,
                defaults={
                    "tenant_slug": tenant_slug,
                    "contrato_id": contrato.id,
                    "expires_at": nueva,
                    "revoked_at": None,
                },
            )

        url = f"{getattr(settings, 'FRONTEND_BASE_URL', 'https://progeek.es').rstrip('/')}/kyc-upload/{contrato.kyc_token}"

        try:
            send_mail(
                subject="Accede de nuevo a tu verificación KYC",
                message=(f"Hola,\n\nTe dejamos un nuevo enlace para continuar la verificación:\n{url}\n\n"
                         f"El enlace caduca en {dias} día(s)."),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@progeek.es"),
                recipient_list=[destinatario],
                fail_silently=True,
            )
        except Exception:
            pass

        return Response({"ok": True, "email": destinatario, "url": url, "expira_en_dias": dias}, status=200)   


class B2CContratoPdfPublicAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, kyc_token):
        contrato = get_object_or_404(B2CContrato, kyc_token=kyc_token)
        if not contrato.pdf:
            return Response({"detail": "PDF no disponible"}, status=status.HTTP_404_NOT_FOUND)

        try:
            return redirect(contrato.pdf.url)
        except Exception:
            pass

        return FileResponse(contrato.pdf.open("rb"), content_type="application/pdf")
    

class B2CContratoPdfPreviewByToken(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token: str):
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

        with schema_context(idx.tenant_slug):
            contrato = get_object_or_404(B2CContrato, pk=idx.contrato_id)
            content_file, sha = generar_pdf_contrato(contrato, preview=True)
            content_file.seek(0)
            pdf_bytes = content_file.read()

        bio = io.BytesIO(pdf_bytes)
        resp = FileResponse(bio, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="contrato_preview_{contrato.pk}.pdf"'
        resp["Content-Length"] = str(len(pdf_bytes))
        resp["X-Document-SHA256"] = sha
        resp["X-Frame-Options"] = "SAMEORIGIN"
        return resp


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def condiciones_b2c_pdf(request):
    tenant_slug = request.query_params.get("tenant_slug")
    version = request.query_params.get("v", "v1")
    lang = request.query_params.get("lang", "es")
    if not tenant_slug:
        return HttpResponse("tenant_slug requerido", status=400)
    with schema_context(tenant_slug):
        out = build_condiciones_b2c_pdf(tenant=type("T",(),{"schema_name":tenant_slug,"name":tenant_slug}))
    resp = HttpResponse(out["bytes"], content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="condiciones-b2c-{version}.pdf"'
    resp["ETag"] = out["sha256"]
    resp["Cache-Control"] = "public, max-age=86400"
    return resp


class LegalTemplateView(APIView):
    def get(self, request):
        ns = request.query_params.get("namespace") or DEFAULT_NAMESPACE
        sl = request.query_params.get("slug") or DEFAULT_SLUG
        tpl = get_or_create_active(ns, sl)
        return Response(LegalTemplateSerializer(tpl).data)

    def put(self, request):
        ns = request.query_params.get("namespace") or DEFAULT_NAMESPACE
        sl = request.query_params.get("slug") or DEFAULT_SLUG
        tpl = get_or_create_active(ns, sl)
        for f in ("title", "version", "content"):
            if f in request.data:
                setattr(tpl, f, request.data.get(f) or "")
        tpl.save(update_fields=["title", "version", "content", "updated_at"])
        return Response(LegalTemplateSerializer(tpl).data, status=status.HTTP_200_OK)


class LegalTemplatePublishView(APIView):
    @transaction.atomic
    def post(self, request):
        ns = (request.data.get("namespace") or DEFAULT_NAMESPACE).strip()
        sl = (request.data.get("slug") or DEFAULT_SLUG).strip()
        current = LegalTemplate.objects.filter(namespace=ns, slug=sl, is_active=True).first()
        if current:
            current.is_active = False
            current.save(update_fields=["is_active", "updated_at"])
        new = LegalTemplate.objects.create(
            namespace=ns,
            slug=sl,
            title=request.data.get("title") or (current.title if current else "Plantilla B2C"),
            version=request.data.get("version") or (current.version if current else "v1"),
            content=request.data.get("content") or (current.content if current else DEFAULT_TEMPLATE_TEXT),
            is_active=True,
        )
        return Response(LegalTemplateSerializer(new).data, status=status.HTTP_201_CREATED)


class LegalTemplateVersionsView(APIView):
    def get(self, request):
        ns = request.query_params.get("namespace") or DEFAULT_NAMESPACE
        sl = request.query_params.get("slug") or DEFAULT_SLUG
        qs = LegalTemplate.objects.filter(namespace=ns, slug=sl).order_by("-updated_at", "-id")
        return Response(LegalTemplateSerializer(qs, many=True).data)


class LegalRenderPreviewView(APIView):
    def post(self, request):
        content = request.data.get("content") or DEFAULT_TEMPLATE_TEXT
        ctx = request.data.get("ctx_demo") or {
            "operador": (get_or_create_global().default_overrides or {}).get("operador", {}),
            "empresa": {"nombre": "Dr Frog S.L.", "cif": "B32490123", "direccion":"C/ Demo 1, Barcelona", "email":"info@drfrog.es", "telefono":"+34 600 111 222"},
            "cliente": {"nombre":"Luis","apellidos":"Pérez","dni_nie":"12345678Z","direccion":"Av. Demo 123","email":"luis@example.com","telefono":"+34 612 345 678"},
            "contrato": {"numero":"B2C-2025-000123","fecha":"2025-08-15","otp_hash":"abc123","kyc_ref":"KYC-999","importe_total":325.00,"validez_dias":7},
            "dispositivos": [{"modelo":"iPhone 13","imei_serial":"3567...","capacidad":"128GB","estado_fisico":"Muy bueno","estado_funcional":"OK","precio":200.00}],
            "condiciones": ["Borrado certificado de datos"]
        }
        rendered = Template(content).render(Context(ctx))
        return Response({"rendered": rendered})
    

