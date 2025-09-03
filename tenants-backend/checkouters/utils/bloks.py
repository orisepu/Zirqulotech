# utils/blocks.py
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from django.template import Template, Context
from django.utils import timezone
import json, re
import html as _html
from markdown import markdown
import logging

logger = logging.getLogger(__name__)

# Solo las etiquetas que Paragraph soporta de forma fiable
ALLOWED_TAGS = {"br", "b", "i", "u", "font"}

_CODE_FONT_OPEN = "<font face='Courier'>"
_CODE_FONT_CLOSE = "</font>"

def _escape(s: str) -> str:
    return _html.escape(s or "", quote=False)

def _fenced_code_to_font(md: str) -> str:
    """
    Convierte bloques ```lang\n...\n``` a <font> con saltos <br/>.
    """
    def repl(m):
        _lang = (m.group(1) or "").strip()  # no lo usamos, pero podrías colorear por lang
        body = m.group(2) or ""
        body = _escape(body).rstrip("\n")
        body = body.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br/>")
        return f"{_CODE_FONT_OPEN}{body}{_CODE_FONT_CLOSE}"
    return re.sub(r"```(\w+)?\n([\s\S]*?)```", repl, md, flags=re.MULTILINE)

def _inline_code_to_font(html_text: str) -> str:
    """
    Convierte <code>...</code> o `inline` a <font>.
    (python-markdown suele generar <code> para inline).
    """
    # 1) Etiquetas <code> del HTML generado
    html_text = re.sub(
        r"<code[^>]*>(.*?)</code>",
        lambda m: f"{_CODE_FONT_OPEN}{_escape(m.group(1))}{_CODE_FONT_CLOSE}",
        html_text,
        flags=re.I | re.S,
    )
    # 2) Ticks que hayan quedado en texto sin parsear (por si acaso)
    html_text = re.sub(
        r"`([^`]+)`",
        lambda m: f"{_CODE_FONT_OPEN}{_escape(m.group(1))}{_CODE_FONT_CLOSE}",
        html_text,
    )
    return html_text

def _strip_unknown_tags(h: str) -> str:
    # elimina cualquier <tag ...> que no sea allowed; deja closing/empty de allowed
    def repl(m):
        tag = (m.group(1) or "").lower().strip("/")
        return m.group(0) if tag in ALLOWED_TAGS else ""
    return re.sub(r"<\s*/?\s*([a-z0-9]+)(\s+[^>]*)?>", repl, h, flags=re.I)

def _markdown_to_rl(text: str) -> str:
    """
    Convierte markdown → HTML → HTML “seguro” para ReportLab Paragraph.
    - h1..h6 → <b>...</b><br/>
    - strong/em → b/i
    - ul/ol → '• item<br/>' / '1) item<br/>'
    - code inline y fenced → <font face="Courier">...</font>
    - links → 'texto (URL)'
    - elimina tags desconocidos
    """
    if not text:
        return ""

    # 0) Pre: transformar fenced code antes del parser MD (evita que añada <p>)
    pre_md = _fenced_code_to_font(text)

    # 1) markdown → html (extensiones básicas)
    try:
        html = markdown(pre_md, extensions=["extra", "sane_lists", "tables"])
    except Exception:
        logger.warning("[MD] fallo al parsear markdown, usando texto plano")
        html = _escape(pre_md)

    # 2) headings → <b>…</b><br/>  (¡hacer esto ANTES de borrar headings!)
    html = re.sub(
        r"<h[1-6][^>]*>(.*?)</h[1-6]>",
        lambda m: f"<b>{m.group(1)}</b><br/>",
        html,
        flags=re.I | re.S,
    )

    # 3) strong/em → b/i
    html = re.sub(r"<(/?)strong>", r"<\1b>", html, flags=re.I)
    html = re.sub(r"<(/?)em>", r"<\1i>", html, flags=re.I)

    # 4) listas no anidadas (planas y robustas)
    def _ul_to_text(m):
        inner = m.group(1)
        items = re.findall(r"<li[^>]*>(.*?)</li>", inner, flags=re.I | re.S)
        return "".join([f"• {re.sub('<[^>]+>', '', it).strip()}<br/>" for it in items])

    def _ol_to_text(m):
        inner = m.group(1)
        items = re.findall(r"<li[^>]*>(.*?)</li>", inner, flags=re.I | re.S)
        out = []
        for i, it in enumerate(items, 1):
            it = re.sub(r"<[^>]+>", "", it).strip()
            out.append(f"{i}) {it}<br/>")
        return "".join(out)

    html = re.sub(r"<ul[^>]*>(.*?)</ul>", _ul_to_text, html, flags=re.I | re.S)
    html = re.sub(r"<ol[^>]*>(.*?)</ol>", _ol_to_text, html, flags=re.I | re.S)

    # 5) enlaces → "texto (url)"
    def _a_to_text(m):
        href = (m.group(1) or "").strip()
        txt = re.sub(r"<[^>]+>", "", m.group(2) or "").strip()
        if txt and href:
            return f"{txt} ({href})"
    # Si no hay texto o href, caemos a texto limpio
        return txt or href

    html = re.sub(r'<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)</a>', _a_to_text, html, flags=re.I | re.S)

    # 6) inline code → <font>
    html = _inline_code_to_font(html)

    # 7) quitar <p> envolventes (Paragraph ya gestiona saltos con <br/>)
    html = re.sub(r"</?p[^>]*>", "", html, flags=re.I)

    # 8) eliminar tags desconocidos (dejar br/b/i/u/font)
    html = _strip_unknown_tags(html)

    # 9) normalizar saltos
    html = html.replace("\r\n", "\n").replace("\r", "\n")
    # evitar duplicar <br/> si ya vienen; colapsar triples a dobles
    html = re.sub(r"(?:\n\s*){2,}", "\n\n", html)           # colapsa múltiples \n
    html = html.replace("\n", "<br/>")
    html = re.sub(r"(?:<br/>\s*){3,}", "<br/><br/>", html)  # no más de 2 seguidos

    return html.strip()

# === helpers básicos ===
def _capfirst(s):
    try:
        s = str(s or "")
        return s[:1].upper() + s[1:]
    except Exception:
        return s

def _money(v):
    from decimal import Decimal
    try:
        return f"{Decimal(v):,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return f"{v} €"

def _md_to_html(md: str) -> str:
    # usa el mismo conversor que ya tienes para markdown -> html (si ya tienes uno, llama allí)
    # fallback rápido: convierte ** ** a <b>, * * a <i>, saltos a <br/>
    html = md or ""
    html = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html)
    html = re.sub(r"\*(.+?)\*", r"<i>\1</i>", html)
    html = html.replace("\n", "<br/>")
    return html

def _rl_sanitize(html: str) -> str:
    if not html:
        return ""
    html = html.replace("<strong>", "<b>").replace("</strong>", "</b>")
    html = html.replace("<em>", "<i>").replace("</em>", "</i>")
    # fuera tags no soportadas por Paragraph
    html = re.sub(r"</?(h\d|div|span|ul|ol|li|table|thead|tbody|tr|td|th)[^>]*>", "", html, flags=re.I)
    html = html.replace("<p>", "").replace("</p>", "<br/>")
    return html.strip()

def _render_str_template(s: str, ctx: dict) -> str:
    # Render seguro (Django template)
    try:
        return Template(s).render(Context(ctx))
    except Exception:
        return s

def _fmt_cell(value, fmt: str | None):
    if fmt == "money":
        return _money(value)
    if fmt == "capfirst":
        return _capfirst(value)
    return value

# === núcleo: blocks -> flowables ===
def render_legal_blocks(blocks, ctx, styles=None):
    """
    blocks: list[dict] con format blocks_v1
    ctx: contexto con operador/empresa/cliente/contrato/dispositivos/...
    """
    if styles is None:
        styles = getSampleStyleSheet()
        if "Small" not in styles:
            styles.add(ParagraphStyle(name="Small", fontSize=9, leading=12))
        if "Tiny" not in styles:
            styles.add(ParagraphStyle(name="Tiny", fontSize=8, leading=10, textColor=colors.grey))

    ctx = dict(ctx or {})
    ctx["now_local"] = timezone.localtime(timezone.now())

    flow = []

    for b in (blocks or []):
        t = (b.get("type") or "").lower()

        if t == "spacer":
            flow.append(Spacer(1, (b.get("mm", 4) or 4) * mm))
            continue

        if t == "heading":
            level = int(b.get("level") or 2)
            text = _render_str_template(b.get("text") or "", ctx)
            html = _rl_sanitize(_markdown_to_rl(text))
            style = styles["Heading1"] if level == 1 else styles["Heading2"]
            flow.append(Paragraph(html or "&nbsp;", style))
            continue

        if t == "paragraph_md":
            md = _render_str_template(b.get("text_md") or "", ctx)
            html = _rl_sanitize(_markdown_to_rl(md))
            flow.append(Paragraph(html or "&nbsp;", styles["Small"]))
            continue

        if t == "columns":
            left_md  = _render_str_template(b.get("left_md")  or "", ctx)
            right_md = _render_str_template(b.get("right_md") or "", ctx)
            left_html  = _rl_sanitize(_markdown_to_rl(left_md))
            right_html = _rl_sanitize(_markdown_to_rl(right_md))
            data = [
                [Paragraph(left_html or "&nbsp;", styles["Small"]),
                 Paragraph(right_html or "&nbsp;", styles["Small"])]
            ]
            w = b.get("widths") or [0.5, 0.5]
            gutter = (b.get("gutter_mm") or 4) * mm
            # Las anchuras reales se aplican al construir la Table en tu generador con page width; aquí fijamos estilo:
            t_ = Table(data, colWidths=None, hAlign="LEFT", spaceBefore=0, spaceAfter=0)
            t_.setStyle(TableStyle([
                ("VALIGN", (0,0), (-1,-1), "TOP"),
                ("LEFTPADDING", (0,0), (-1,-1), 0),
                ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ]))
            # guardamos metadata mínima para que el llamador pueda recalcular colWidths si quiere
            t_._desired_widths_ratio = w
            t_._gutter = gutter
            flow.append(t_)
            continue

        if t == "table":
            cols = b.get("cols") or []
            rows = b.get("rows") or []

            # encabezados
            head = [Paragraph(_rl_sanitize(_markdown_to_rl(c.get("header") or "")), styles["Small"]) for c in cols]
            data = [head]

            # filas
            for r in rows:
                if "for" in r:
                    loop = r["for"]
                    each = (loop.get("each") or "").strip()
                    var  = (loop.get("as") or "x").strip() or "x"
                    items = ctx.get(each) or []
                    for it in (items if isinstance(items, list) else []):
                        row_cells = []
                        local = dict(ctx); local[var] = it
                        for j, cell in enumerate(r.get("cells") or []):
                            rendered = _render_str_template(str(cell), local)
                            fmt = (cols[j].get("fmt") if j < len(cols) else None)
                            rendered = _fmt_cell(rendered, fmt)
                            row_cells.append(Paragraph(_rl_sanitize(_markdown_to_rl(str(rendered))), styles["Small"]))
                        data.append(row_cells)
                else:
                    row_cells = []
                    for j, cell in enumerate(r.get("cells") or []):
                        rendered = _render_str_template(str(cell), ctx)
                        fmt = (cols[j].get("fmt") if j < len(cols) else None)
                        rendered = _fmt_cell(rendered, fmt)
                        row_cells.append(Paragraph(_rl_sanitize(_markdown_to_rl(str(rendered))), styles["Small"]))
                    data.append(row_cells)

            # anchos de columna
            col_widths = [(c.get("width_mm") or 30) * mm for c in cols]
            t_ = Table(data, colWidths=col_widths)
            ts = [
                ("GRID", (0,0), (-1,-1), 0.25, colors.grey),
                ("BACKGROUND", (0,0), (-1,0), colors.whitesmoke),
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ]

            # alineaciones por columna
            for j, c in enumerate(cols):
                al = (c.get("align") or "").upper()
                if al in ("LEFT","CENTER","RIGHT"):
                    ts.append(("ALIGN", (j,1), (j,-1), al))

            # fila total en negrita si marcada
            for idx, r in enumerate(rows, start=1):  # +1 por cabecera
                if (r.get("row_style") or {}).get("bold"):
                    ts.append(("FONTNAME", (0, idx), (-1, idx), "Helvetica-Bold"))

            t_.setStyle(TableStyle(ts))
            flow.append(t_)
            continue

        # fallback: ignora tipos desconocidos
        continue

    return flow
