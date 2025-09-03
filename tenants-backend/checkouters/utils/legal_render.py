import logging, re
from django.template import Template, Context

logger = logging.getLogger(__name__)
TAG_RE = re.compile(r"{%.*?%}|{{.*?}}", re.DOTALL)

DOTPATH = re.compile(r"\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}")

def deep_get(d: dict, path: str, default=""):
    cur = d
    for p in path.split("."):
        if not isinstance(cur, dict) or p not in cur:
            return default
        cur = cur[p]
    return cur

def render_text(text: str, ctx: dict) -> str:
    def _rep(m):
        key = m.group(1)
        return str(deep_get(ctx, key, ""))
    return DOTPATH.sub(_rep, text)

def render_blocklist(blocks: list[str], ctx: dict) -> list[str]:
    out = []
    for i, raw in enumerate(blocks or []):
        try:
            rendered = Template(str(raw)).render(Context(ctx))
            if "{%" in rendered or "{{" in rendered:
                logger.warning("[LEGAL_RENDER] leftovers in block %d, stripping tags", i)
                rendered = TAG_RE.sub("", rendered)
            out.append(rendered.strip())
        except Exception:
            logger.exception("[LEGAL_RENDER] render error block %d", i)
            out.append(str(raw))
    return out
