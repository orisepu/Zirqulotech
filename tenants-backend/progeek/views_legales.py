from django.db import transaction
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework import views, status
from rest_framework.response import Response
from django.template import Template, Context,TemplateSyntaxError
from copy import deepcopy
from .models import PublicLegalTemplate, PublicLegalVariables
from progeek.legal.service import render_b2c_contract, sanitize_django_template
from django.apps import apps

DEFAULT_NS = "default"
DEFAULT_SLUG = "b2c-condiciones"
DEFAULT_CONTENT = """CONTRATO DE COMPRA DE DISPOSITIVOS (B2C)

Entre:
- El OPERADOR: {{ operador.nombre }} (CIF {{ operador.cif }}), con domicilio en {{ operador.direccion }}, email {{ operador.email }} y teléfono {{ operador.telefono }}{% if operador.web %}, web: {{ operador.web }}{% endif %}.
- La EMPRESA (partner): {{ empresa.nombre }}{% if empresa.cif %} (CIF {{ empresa.cif }}){% endif %}{% if empresa.direccion %}, domicilio {{ empresa.direccion }}{% endif %}{% if empresa.email %}, email {{ empresa.email }}{% endif %}{% if empresa.telefono %}, teléfono {{ empresa.telefono }}{% endif %}.
- El CLIENTE (vendedor): {{ cliente.nombre }} {{ cliente.apellidos }} (DNI/NIE {{ cliente.dni_nie }}){% if cliente.direccion %}, domicilio {{ cliente.direccion }}{% endif %}{% if cliente.email %}, email {{ cliente.email }}{% endif %}{% if cliente.telefono %}, teléfono {{ cliente.telefono }}{% endif %}.

Fecha: {{ contrato.fecha }} | Nº Contrato: {{ contrato.numero }}

1. Objeto
El Cliente vende a la Empresa/Operador los dispositivos descritos en este contrato, con transmisión de la propiedad y del derecho de uso, por el precio acordado.

2. Relación de dispositivos y precio
{% for d in dispositivos %}
- {{ forloop.counter }}. {{ d.modelo }}{% if d.capacidad %} {{ d.capacidad }}{% endif %} | IMEI/Serie: {{ d.imei_serial }} | Estado físico: {{ d.estado_fisico }} | Estado funcional: {{ d.estado_funcional }} | Precio: {{ d.precio }} €
{% endfor %}
Importe total estimado: {{ contrato.importe_total }} € .

3. Diagnóstico y verificación
La Empresa/Operador verificará IMEI/serie, funcionalidad y estado. Si se detectan discrepancias (bloqueo, cuenta activa, daños no informados, batería fuera de umbral u otras), se podrá emitir una segunda oferta. El Cliente dispondrá de {{ contrato.validez_dias|default:"7" }} días naturales para aceptarla. Si la rechaza, se devolverá el equipo conforme a la cláusula 9.

4. Propiedad y datos
El Cliente declara ser propietario legítimo y mayor de edad, y que el producto no es de origen ilícito. Se compromete a eliminar cuentas (iCloud/Google/MDM) y desactivar funciones de seguridad (Buscar mi iPhone/Find My/FRP). La Empresa/Operador podrá realizar borrado certificado de datos cuando proceda.

5. Pago
El pago se efectuará al IBAN o método indicado por el Cliente tras la verificación técnica. En caso de segunda oferta, el pago se realizará tras su aceptación expresa.

6. Garantías y desistimiento
Al tratarse de compraventa del Cliente a la Empresa/Operador, no aplica el derecho de desistimiento del consumidor. El Cliente garantiza la titularidad y ausencia de cargas. Cualquier vicio oculto, origen ilícito o manipulación facultará a la Empresa/Operador a resolver el contrato y reclamar daños.

7. Fraude y dispositivos bloqueados
Si el dispositivo presenta reporte de robo/pérdida, IMEI en lista negra, bloqueo por impago, o se detecta manipulación del identificador, el contrato quedará en suspenso y el equipo podrá quedar a disposición de las autoridades.

8. Protección de datos
El tratamiento de datos (incluyendo KYC/identidad e imágenes de DNI) se realiza para la prevención del fraude y la ejecución del contrato. Responsables: {{ operador.nombre }}{% if empresa.nombre and empresa.nombre != operador.nombre %} y {{ empresa.nombre }}{% endif %}. Podrá ejercer derechos en {{ operador.email }}{% if empresa.email %} y {{ empresa.email }}{% endif %}. Conservación según normativa aplicable.

9. Logística y devoluciones
Si procede devolución, se coordinará envío/recogida. En caso de rechazo de segunda oferta por discrepancias sustanciales, los costes de retorno podrán repercutirse según condiciones comunicadas.

10. Ley aplicable y jurisdicción
Se aplica la ley española. Salvo norma imperativa, las partes se someten a los juzgados del domicilio del Cliente.

11. Firma electrónica (OTP) y evidencias
El Cliente acepta que la firma se realice mediante OTP remitido a su contacto, generándose huella: {{ contrato.otp_hash }} y referencia KYC: {{ contrato.kyc_ref }}. El documento firmado electrónicamente tendrá plena validez.

Firmas:
- Cliente: ______________________  (OTP verificado)
- Empresa/Operador: ______________________

Anexos:
{% if condiciones and condiciones|length > 0 %}
{% for c in condiciones %}- {{ c }}
{% endfor %}
{% else %}- Sin anexos adicionales.
{% endif %}
"""
# Obtén tu Company sin acoplar fuerte
Company = apps.get_model('companies', 'Company')  # ajusta app_label si difiere

def _public():
    try:
        return get_public_schema_name()
    except Exception:
        return "public"

def get_or_create_active(ns, slug):
    with schema_context(_public()):
        obj = PublicLegalTemplate.objects.filter(namespace=ns, slug=slug, is_active=True).first()
        if not obj:
            obj = PublicLegalTemplate.objects.create(
                namespace=ns, slug=slug, title="Plantilla B2C por defecto",
                version="v1", content=DEFAULT_CONTENT, is_active=True
            )
        return obj

class LegalTemplateView(views.APIView):
    def get(self, request):
        ns = request.query_params.get("namespace") or DEFAULT_NS
        sl = request.query_params.get("slug") or DEFAULT_SLUG
        obj = get_or_create_active(ns, sl)
        return Response({
            "namespace": obj.namespace, "slug": obj.slug,
            "title": obj.title, "version": obj.version, "content": obj.content,
            "is_active": obj.is_active, "updated_at": obj.updated_at
        })

    def put(self, request):
        ns = request.query_params.get("namespace") or DEFAULT_NS
        sl = request.query_params.get("slug") or DEFAULT_SLUG
        obj = get_or_create_active(ns, sl)
        for f in ("title", "version", "content"):
            if f in request.data:
                setattr(obj, f, request.data.get(f) or "")
        with schema_context(_public()):
            obj.save(update_fields=["title","version","content","updated_at"])
        return Response({
            "namespace": obj.namespace, "slug": obj.slug,
            "title": obj.title, "version": obj.version, "content": obj.content,
            "is_active": obj.is_active, "updated_at": obj.updated_at
        })

class LegalTemplatePublishView(views.APIView):
    @transaction.atomic
    def post(self, request):
        ns = (request.data.get("namespace") or DEFAULT_NS).strip()
        sl = (request.data.get("slug") or DEFAULT_SLUG).strip()
        with schema_context(_public()):
            current = PublicLegalTemplate.objects.filter(namespace=ns, slug=sl, is_active=True).first()
            if current:
                current.is_active = False
                current.save(update_fields=["is_active","updated_at"])
            new = PublicLegalTemplate.objects.create(
                namespace=ns, slug=sl,
                title=request.data.get("title") or (current.title if current else "Plantilla B2C"),
                version=request.data.get("version") or (current.version if current else "v1"),
                content=request.data.get("content") or (current.content if current else DEFAULT_CONTENT),
                is_active=True,
            )
            return Response({
                "namespace": new.namespace, "slug": new.slug,
                "title": new.title, "version": new.version, "content": new.content,
                "is_active": new.is_active, "updated_at": new.updated_at
            }, status=status.HTTP_201_CREATED)

class LegalTemplateVersionsView(views.APIView):
    def get(self, request):
        ns = request.query_params.get("namespace") or DEFAULT_NS
        sl = request.query_params.get("slug") or DEFAULT_SLUG
        with schema_context(_public()):
            qs = PublicLegalTemplate.objects.filter(namespace=ns, slug=sl).order_by("-updated_at","-id")
            data = [{
                "namespace": x.namespace, "slug": x.slug, "title": x.title,
                "version": x.version, "content": x.content,
                "is_active": x.is_active, "updated_at": x.updated_at
            } for x in qs]
        return Response(data)
    


def get_vars(ns: str) -> dict:
    with schema_context(_public()):
        row = PublicLegalVariables.objects.filter(namespace=ns).first()
        return deepcopy(row.data if row else {})

def set_vars(ns: str, data: dict) -> dict:
    with schema_context(_public()):
        row, _ = PublicLegalVariables.objects.get_or_create(namespace=ns, defaults={"data": {}})
        row.data = data or {}
        row.save(update_fields=["data","updated_at"])
        return deepcopy(row.data)

class LegalVariablesView(views.APIView):
    def get(self, request):
        ns = request.query_params.get("namespace") or DEFAULT_NS
        return Response({"namespace": ns, "data": get_vars(ns)})

    def put(self, request):
        ns = request.query_params.get("namespace") or DEFAULT_NS
        payload = request.data.get("data")
        if not isinstance(payload, dict):
            return Response({"detail": "data debe ser objeto JSON"}, status=400)
        data = set_vars(ns, payload)
        return Response({"namespace": ns, "data": data})

class LegalRenderPreviewView(views.APIView):
    """
    POST body:
    {
      "company_id": 123,            # opcional; si no, se usa un dummy
      "mode": "autoadmin|default",  # opcional; si no, se usa company.is_autoadmin
      "content": "string",          # opcional; si lo envías, hace preview con este texto
      "ctx_demo": {...}             # opcional; datos de cliente/contrato/dispositivos
    }
    """
    def post(self, request):
        company_id = request.data.get("company_id")
        mode = (request.data.get("mode") or "").strip().lower()
        content = request.data.get("content")
        ctx_demo = request.data.get("ctx_demo") or {}

        # 1) carga company o crea dummy
        if company_id:
            company = Company.objects.filter(id=company_id).first()
            if not company:
                return Response({"detail": "Company no encontrada"}, status=404)
        else:
            # dummy minimísimo con attrs usados por el servicio
            class _Dummy:
                uuid = "DEMO-UUID"
                legal_namespace = "default"
                is_autoadmin = (mode == "autoadmin")
                def company_overlay(self):  # emula tu método
                    return {"empresa": {
                        "nombre": "Dr Frog S.L.",
                        "cif": "B32490123",
                        "direccion": "C/ Demo 1, Barcelona",
                        "email": "info@drfrog.es",
                        "telefono": "+34 600 111 222",
                    }}
                def effective_legal_namespaces(self):
                    return [f"tenant:{self.uuid}", "default"]
            company = _Dummy()

        # si se forzó modo, respétalo
        if mode in ("autoadmin", "default"):
            setattr(company, "is_autoadmin", mode == "autoadmin")

        # 2) contexto demo por defecto si no viene
        if not ctx_demo:
            ctx_demo = {
                "operador": {},  # se cargará desde variables public/default
                "cliente": {"nombre":"Luis","apellidos":"Pérez","dni_nie":"12345678Z","direccion":"Av. Demo 123","email":"luis@example.com","telefono":"+34 612 345 678"},
                "contrato": {"numero":"B2C-2025-000123","fecha":"2025-08-15","otp_hash":"abc123","kyc_ref":"KYC-999","importe_total":325.00,"validez_dias":7},
                "dispositivos": [{"modelo":"iPhone 13","descripcion":"","serie":"3567...","imei":"3567...","imei_serial":"3567...","capacidad":"128GB","estado_declarado":"Exdcelente","estado_fisico":"Muy bueno","estado_funcional":"OK","precio":200.00,"precio_provisional":200.00}],
                "condiciones": ["Borrado certificado de datos"]
            }

        # 3) render
        try:
            rendered = render_b2c_contract(
                company,
                ctx_demo,
                content_override=content,  # si envías contenido, lo usa
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        return Response({"rendered": rendered}, status=200)