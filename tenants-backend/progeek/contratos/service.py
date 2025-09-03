from __future__ import annotations
from typing import Dict, Any, Optional
from django.template import Template, Context, TemplateSyntaxError

from progeek.legal.service import render_b2c_contract, sanitize_django_template


LEGALES_MARKER = "{# B2C_CONDICIONES #}"

def _inject_marker_or_append(body: str, annex: str, marker: str = LEGALES_MARKER) -> str:
    if marker in (body or ""):
        return body.replace(marker, annex)
    sep = "\n\n---\n\n" if "\n" in (body or "") else "\n---\n"
    return f"{body}{sep}{annex}"

def render_contract_with_legals(company, contract_template_content: str, ctx_input: Dict[str, Any], *, marker: str = LEGALES_MARKER) -> str:
    tpl_body = sanitize_django_template(contract_template_content or "")
    try:
        body_rendered = Template(tpl_body).render(Context(ctx_input or {}))
    except TemplateSyntaxError as e:
        raise ValueError(f"Error de plantilla (contrato): {e}")

    legales_rendered = render_b2c_contract(company, ctx_input, slug_base="b2c-condiciones")
    return _inject_marker_or_append(body_rendered, legales_rendered, marker=marker)
