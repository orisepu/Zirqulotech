from __future__ import annotations
from copy import deepcopy
import re
from typing import Optional, List, Dict, Any

from django.template import Template, Context, TemplateSyntaxError
from django_tenants.utils import get_public_schema_name, schema_context
from django.apps import apps

# Si tus modelos públicos viven en progeek.models:
try:
    from progeek.models import PublicLegalTemplate, PublicLegalVariables  # type: ignore
except Exception:
    # fallback por si están en otra app (evita ciclos)
    PublicLegalTemplate = apps.get_model('progeek', 'PublicLegalTemplate')
    PublicLegalVariables = apps.get_model('progeek', 'PublicLegalVariables')

def _public_schema() -> str:
    try:
        return get_public_schema_name()
    except Exception:
        return "public"

def sanitize_django_template(s: str) -> str:
    if not isinstance(s, str):
        return s
    s = s.replace('{%-','{%').replace('-%}','%}').replace('{{-','{{').replace('-}}','}}')
    s = re.sub(r'\{\%\s*for([^%]+)-\s*\%\}', r'{% for\1 %}', s)
    s = re.sub(r'\{\%\s*endfor\s*-\s*\%\}', r'{% endfor %}', s)
    return s

def find_active_template(namespace: str, slug: str):
    with schema_context(_public_schema()):
        return PublicLegalTemplate.objects.filter(
            namespace=namespace, slug=slug, is_active=True
        ).first()

def resolve_b2c_template(company, slug_base: str = "b2c-condiciones"):
    """
    Gestionado:   default/b2c-condiciones
    Autoadmin:    tenant:<uuid>/b2c-condiciones -> default/b2c-condiciones-autoadmin -> default/b2c-condiciones
    """
    if getattr(company, "is_autoadmin", False):
        ns_tenant = f"tenant:{company.uuid}"
        tpl = find_active_template(ns_tenant, slug_base)
        if tpl: return tpl
        tpl = find_active_template("default", f"{slug_base}-autoadmin")
        if tpl: return tpl
        return find_active_template("default", slug_base)
    else:
        return find_active_template("default", slug_base)

def merge_vars(namespaces: List[str]) -> Dict[str, Any]:
    """
    Carga PublicLegalVariables.data por namespace y hace merge (último pisa).
    """
    acc: Dict[str, Any] = {}
    with schema_context(_public_schema()):
        for ns in namespaces:
            row = PublicLegalVariables.objects.filter(namespace=ns).first()
            if not row:
                continue
            data = row.data or {}
            for k, v in data.items():
                if isinstance(v, dict) and isinstance(acc.get(k), dict):
                    acc[k].update(v)
                else:
                    acc[k] = deepcopy(v)
    return acc

def company_overlay_dict(company) -> Dict[str, Any]:
    """
    Usa tu Company.company_overlay() si existe; si no, devuelve {}.
    """
    try:
        ov = company.company_overlay()  # {'empresa': {...}}
    except Exception:
        ov = {}
    return ov or {}

def render_b2c_contract(
    company,
    ctx_input: Dict[str, Any],
    *,
    slug_base: str = "b2c-condiciones",
    content_override: Optional[str] = None,
    mandatory_slug: str = "b2c-mandatorio-operador",
) -> str:
    """
    - Resuelve plantilla según modo (gestionado/autoadmin)
    - Fusiona variables por namespace
    - Aplica overlay empresa (sin pisar explícitos)
    - Mezcla ctx_input (operación/cliente)
    - Renderiza
    - Si autoadmin: inyecta bloque obligatorio del operador (mandatory_slug)
      - reemplaza marcador {# OPERADOR_MANDATORIO #} si está
      - si no, lo añade al final
    """
    # 1) plantilla
    if content_override:
        content = sanitize_django_template(content_override or "")
    else:
        tpl = resolve_b2c_template(company, slug_base=slug_base)
        if not tpl:
            raise ValueError("No se encontró plantilla activa para B2C.")
        content = sanitize_django_template(tpl.content or "")

    # 2) namespaces para variables
    if getattr(company, "is_autoadmin", False):
        try:
            ns_order = list(company.effective_legal_namespaces())  # p.ej. ['tenant:<uuid>', 'brand-x', 'default']
        except Exception:
            ns_order = [f"tenant:{company.uuid}", "default"]
    else:
        try:
            ns = company.legal_namespace or "default"
            ns_order = [ns, "default"] if ns and ns != "default" else ["default"]
        except Exception:
            ns_order = ["default"]

    # 3) merge de variables
    ctx = merge_vars(ns_order)

    # 4) overlay empresa sin pisar explícitos
    emp = (company_overlay_dict(company) or {}).get("empresa", {})
    base_emp = ctx.get("empresa", {})
    for k, v in (emp or {}).items():
        base_emp.setdefault(k, v)
    if base_emp:
        ctx["empresa"] = base_emp

    # 5) mezcla con datos de la operación/cliente (pisan)
    for k, v in (ctx_input or {}).items():
        if isinstance(v, dict) and isinstance(ctx.get(k), dict):
            ctx[k].update(v)
        else:
            ctx[k] = v

    # 6) render principal
    try:
        rendered = Template(content).render(Context(ctx))
    except TemplateSyntaxError as e:
        raise ValueError(f"Error de plantilla: {e}")

    # 7) bloque obligatorio si autoadmin
    if getattr(company, "is_autoadmin", False):
        op_block = find_active_template("default", mandatory_slug)
        if op_block and (op_text := sanitize_django_template(op_block.content or "").strip()):
            inject = Template(op_text).render(Context(ctx))
            marker = "{# OPERADOR_MANDATORIO #}"
            if marker in rendered:
                rendered = rendered.replace(marker, inject)
            else:
                rendered = f"{rendered}\n\n---\n\n{inject}"

    return rendered
