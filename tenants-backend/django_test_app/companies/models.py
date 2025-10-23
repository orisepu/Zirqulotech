import os
import logging
from decimal import Decimal
from collections.abc import Mapping

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django_tenants.models import DomainMixin
from django.utils.text import slugify
from tenant_users.tenants.models import TenantBase

from checkouters.storage import PrivateDocumentStorage
logger = logging.getLogger(__name__)
_NameFieldLength = 64


def agreement_upload_path(instance, filename: str) -> str:
    """Guarda los acuerdos en una carpeta por tenant con nombre seguro."""
    base, ext = os.path.splitext(filename or "")
    ext = ext.lower() if ext else ".pdf"
    safe_base = slugify(base) or "acuerdo"
    tenant_id = instance.pk or "temp"
    return f"acuerdos/tenant-{tenant_id}/{safe_base}{ext}"

def logo_upload_path(instance, filename: str) -> str:
    """Guarda los logos directamente en carpeta logos con ID del tenant."""
    _, ext = os.path.splitext(filename or "")
    ext = ext.lower() if ext else ".png"
    tenant_id = instance.pk or "temp"
    return f"logos/tenant-{tenant_id}{ext}"

def _deepmerge(a, b):
    out = dict(a or {})
    for k, v in dict(b or {}).items():
        if isinstance(v, Mapping) and isinstance(out.get(k), Mapping):
            out[k] = _deepmerge(out[k], v)
        else:
            out[k] = v
    return out
class Company(TenantBase):
    """Modelo de Partner (tenant) extendido"""

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=100, default="type1")
    cif = models.CharField(max_length=100, blank=True)
    tier = models.CharField(max_length=100, blank=True)

    # Comisión del partner en porcentaje (0–100)
    comision_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("10.00"),
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Porcentaje de comisión aplicado al partner (0–100)."
    )

    # Contactos
    contacto_comercial = models.CharField(max_length=100, blank=True)
    contacto_financiero = models.CharField(max_length=100, blank=True)
    telefono_comercial = models.CharField(max_length=20, blank=True)
    telefono_financiero = models.CharField(max_length=20, blank=True)
    correo_comercial = models.EmailField(blank=True)
    correo_financiero = models.EmailField(blank=True)
    # Datos de empresa
    numero_empleados = models.PositiveIntegerField(null=True, blank=True)

    # Dirección fiscal
    direccion_calle = models.CharField(max_length=255, blank=True)
    direccion_piso = models.CharField(max_length=50, blank=True)
    direccion_puerta = models.CharField(max_length=50, blank=True)
    direccion_cp = models.CharField(max_length=10, blank=True)
    direccion_poblacion = models.CharField(max_length=100, blank=True)
    direccion_provincia = models.CharField(max_length=100, blank=True)
    direccion_pais = models.CharField(max_length=100, blank=True)   

    # Sector
    vertical = models.CharField(max_length=100, blank=True)
    vertical_secundaria = models.CharField(max_length=100, blank=True)

    # Otros
    web_corporativa = models.URLField(blank=True)
    facturacion_anual = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    numero_tiendas_oficiales = models.PositiveIntegerField(null=True, blank=True)
    goal = models.TextField(blank=True)
    acuerdo_empresas = models.TextField(
        blank=True,
        help_text="Detalle del acuerdo vigente entre las empresas."
    )
    acuerdo_empresas_pdf = models.FileField(
        upload_to=agreement_upload_path,
        storage=PrivateDocumentStorage(),
        blank=True,
        null=True,
        help_text="Archivo PDF del acuerdo firmado entre las empresas."
    )

    solo_empresas = models.BooleanField(
        default=False,
        help_text="Si está activo, el partner solo opera con clientes empresa/autónomos."
    )

    es_demo = models.BooleanField(
        default=False,
        help_text="Modo demo: permite usar cualquier correo, DNI, CIF, etc. sin validación estricta."
    )

    # Estado del partner
    ESTADO_CHOICES = [
        ("activo", "Activo"),
        ("inactivo", "Inactivo"),
        ("pendiente", "Pendiente"),
    ]
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default="activo",
        help_text="Estado operativo del partner."
    )

    # Logo opcional
    logo = models.ImageField(
        upload_to=logo_upload_path,
        storage=PrivateDocumentStorage(),
        blank=True,
        null=True,
        help_text="Logo del partner usado en PDFs y documentación."
    )

    MANAGEMENT_CHOICES = [
        ("default", "Gestionado por Progeek y plantillas globales"),
        ("autoadmin", "Autoadministrado y plantillas propias"),
    ]
    management_mode = models.CharField(
        max_length=12, choices=MANAGEMENT_CHOICES, default="default"
    )

    # === Selección/overrides de condiciones ===
    legal_namespace = models.SlugField(
        default="default",
        help_text="Conjunto público de condiciones (default, autoadmin, brand-x, ...)"
    )
    legal_slug = models.SlugField(
        default="b2c-condiciones",
        help_text="Slug de la plantilla legal a usar (p.ej. b2c-condiciones, b2b-condiciones)"
    )
    legal_overrides = models.JSONField(
        default=dict, blank=True,
        help_text='Overrides JSON. Ej.: {"empresa": {"nombre": "...", "email": "..."}}'
    )
    # --- Modo ---
    @property
    def is_autoadmin(self) -> bool:
        return self.management_mode == "autoadmin"
    
    # --- HELPERS: construyen el overlay de variables de empresa desde tus campos ---
    # --- Namespace efectivo (con fallback) ---
    def effective_legal_namespaces(self) -> list[str]:
        """
        Orden de búsqueda de plantillas:
        1) Si autoadmin: namespace por-tenant
        2) El namespace configurado en el tenant (legal_namespace)
        3) 'default'
        """
        ns: list[str] = []
        if self.is_autoadmin:
            ns.append(f"tenant:{self.uuid}")  # espacio aislado por tenant
        if self.legal_namespace:
            ns.append(self.legal_namespace)
        ns.append("default")
        # quitar duplicados manteniendo orden
        seen, out = set(), []
        for x in ns:
            if x not in seen:
                seen.add(x); out.append(x)
        return out

    # --- Overlay con datos de empresa (para variables {{empresa.*}}) ---
    def company_overlay(self) -> dict:
        addr = ", ".join(list(filter(bool, [
            " ".join(list(filter(bool, [self.direccion_calle, self.direccion_piso, self.direccion_puerta]))),
            " ".join(list(filter(bool, [self.direccion_cp, self.direccion_poblacion, self.direccion_provincia]))),
            self.direccion_pais or "España",
        ])))
        email = self.correo_financiero or self.correo_comercial or ""
        phone = self.telefono_financiero or self.telefono_comercial or ""
        empresa = {
            "nombre": self.name or "",
            "cif": self.cif or "",
            "direccion": addr,
            "email": email,
            "telefono": phone,
            "web": self.web_corporativa or "",
        }
        empresa = {k: v for k, v in empresa.items() if v}
        return {"empresa": empresa} if empresa else {}



    def legal_ovaerlay(self) -> dict:
        # 1) defaults globales
        defaults = deepcopy(getattr(settings, "LEGAL_DEFAULT_OVERRIDES", {}))
        # 2) overrides del tenant (pisan a defaults)
        ov = _deepmerge(defaults, dict(self.legal_overrides or {}))
        # 3) completa empresa.* con datos de Company si faltan
        base_emp = ov.get("empresa", {})
        for k, v in (self.company_overlay().get("empresa") or {}).items():
            base_emp.setdefault(k, v)
        if base_emp:
            ov["empresa"] = base_emp
        return ov
    def legal_overlay(self) -> dict:
                """
                PublicLegalVariables(namespace*) << company_overlay() << legal_overrides (tenant)
                """
                from progeek.models import PublicLegalVariables

                defaults = {}
                try:
                    namespaces = list(self.effective_legal_namespaces())
                except Exception as e:
                    namespaces = ["default"]
                    logger.warning("[LEGAL_OVERLAY] effective_legal_namespaces() fallo: %s", e, exc_info=True)

                # variables públicas por namespace (saltamos tenant:<uuid>)
                for ns in namespaces:
                    if ns.startswith("tenant:"):
                        continue
                    try:
                        rec = PublicLegalVariables.objects.filter(namespace=ns).first()
                        if rec and rec.data:
                            defaults = _deepmerge(defaults, rec.data)
                    except Exception as e:
                        logger.warning("[LEGAL_OVERLAY] ns=%s error: %s", ns, e, exc_info=True)

                comp = self.company_overlay()
                ten  = dict(self.legal_overrides or {})

                overlay = _deepmerge(defaults, comp)
                overlay = _deepmerge(overlay, ten)

                logger.info("[LEGAL_OVERLAY] schema=%s mode=%s namespaces=%s keys=%s",
                            getattr(self, "schema_name", "?"),
                            self.management_mode, namespaces, list(overlay.keys()))
                return overlay


class Domain(DomainMixin):
    """This class is required for django_tenants."""
