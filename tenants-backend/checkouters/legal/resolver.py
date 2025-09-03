# checkouters/legal/resolver.py
from typing import List, Optional, Tuple, Dict
import json, logging
from django_tenants.utils import get_public_schema_name, schema_context
from progeek.models import PublicLegalTemplate

logger = logging.getLogger(__name__)

def _to_blocks(content: str) -> list[str]:
    """Si detectamos sintaxis de plantilla, no partimos: 1 solo bloque."""
    if not content:
        return []
    if "{%" in content or "{{" in content:
        return [content]  # 🔸 no dividir: evita separar if/endif
    # Si no hay plantillas, podemos partir en párrafos
    txt = content.replace("\r\n", "\n")
    parts = [p.strip() for p in txt.split("\n\n")]
    return [p for p in parts if p]

def resolve_legal_template(slug: str, *, namespaces: list[str], version: str | None = None):
    from django_tenants.utils import get_public_schema_name, schema_context
    from progeek.models import PublicLegalTemplate

    with schema_context(get_public_schema_name()):
        qs = PublicLegalTemplate.objects.filter(slug=slug, is_active=True)
        if version:
            qs = qs.filter(version=version)

        for ns in namespaces:
            try:
                tpl = qs.filter(namespace=ns).order_by("-updated_at", "-id").first()
                if not tpl:
                    logger.info("[LEGAL_RESOLVER] no template ns=%s slug=%s", ns, slug)
                    continue
                blocks = _to_blocks(tpl.content or "")
                meta = {"namespace": ns, "slug": tpl.slug, "version": tpl.version, "title": tpl.title}
                logger.info("[LEGAL_RESOLVER] OK ns=%s slug=%s ver=%s blocks=%d", ns, slug, tpl.version, len(blocks))
                return blocks, meta
            except Exception:
                logger.exception("[LEGAL_RESOLVER] error ns=%s slug=%s", ns, slug)

        if "default" not in namespaces:
            try:
                tpl = qs.filter(namespace="default").order_by("-updated_at", "-id").first()
                if tpl:
                    blocks = _to_blocks(tpl.content or "")
                    meta = {"namespace": "default", "slug": tpl.slug, "version": tpl.version, "title": tpl.title}
                    logger.info("[LEGAL_RESOLVER] Fallback default slug=%s ver=%s blocks=%d", slug, tpl.version, len(blocks))
                    return blocks, meta
            except Exception:
                logger.exception("[LEGAL_RESOLVER] error fallback default slug=%s", slug)

    logger.warning("[LEGAL_RESOLVER] sin resultado slug=%s namespaces=%s version=%s", slug, namespaces, version)
    return [], {}