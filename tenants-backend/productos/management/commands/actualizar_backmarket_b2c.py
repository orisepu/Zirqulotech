import json
import random
import re
import time
from decimal import Decimal
from pathlib import Path
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from playwright.sync_api import sync_playwright

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging


BACKMARKET_URL = "https://www.backmarket.es/buyback-funnel/api/v1/funnel/regular/offer"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.backmarket.es/buyback/sell",
    "Origin": "https://www.backmarket.es",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
}


def build_session() -> requests.Session:
    s = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=0.6,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
    s.mount("https://", adapter)
    s.headers.update(DEFAULT_HEADERS)
    return s


def obtener_cookies_backmarket() -> dict[str, str]:
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto("https://www.backmarket.es/buyback/sell", wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            cookies = page.context.cookies()
            browser.close()
            return {c["name"]: c["value"] for c in cookies}
    except Exception:
        return {}


def gb_from_text(txt: str) -> Optional[int]:
    if not txt:
        return None
    t = (txt or "").lower()
    m = re.search(r"\b(\d+(?:\.\d+)?)\s*(tb|gb)\b", t, flags=re.I)
    if not m:
        return None
    num, unit = m.groups()
    try:
        val = float(num)
    except Exception:
        return None
    unit = unit.upper()
    if unit == "TB":
        return int(round(val * 1024))
    return int(round(val))


def _set_progress(tarea: TareaActualizacionLikewize, pct: int, msg: str) -> None:
    tarea.progreso = max(0, min(100, int(pct)))
    tarea.subestado = msg[:120]
    tarea.save(update_fields=["progreso", "subestado"])


class Command(BaseCommand):
    help = "Descarga precios B2C (Back Market) y llena staging (iPhone) para revisión."

    def add_arguments(self, parser):
        parser.add_argument("--tarea", type=str, required=True)
        parser.add_argument("--delay", type=float, default=0.8)
        parser.add_argument("--jitter", type=float, default=0.4)
        parser.add_argument("--only-model", type=str, default="", help="Filtra por nombre exacto de modelo (case-insensitive)")
        parser.add_argument("--only-gb", type=int, default=0, help="Filtra por capacidad en GB (p.ej. 128, 256, 1024)")
        parser.add_argument("--limit", type=int, default=0, help="Procesa solo N modelos")
        parser.add_argument("--debug", action="store_true")

    def handle(self, *args, **opts):
        tarea = TareaActualizacionLikewize.objects.get(pk=opts["tarea"])
        delay_base: float = opts["delay"]
        delay_jitter: float = opts["jitter"]
        only_model: str = (opts.get("only_model") or "").strip()
        only_gb: int = int(opts.get("only_gb") or 0)
        limit: int = int(opts.get("limit") or 0)
        debug: bool = bool(opts.get("debug") or False)

        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
        rel_name = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
        gb_field = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
        ModeloModel = CapacidadModel._meta.get_field(rel_field).related_model

        session = build_session()
        # Intenta obtener cookies reales vía Playwright para evitar 403
        cookies = obtener_cookies_backmarket()
        if cookies:
            jar = requests.cookies.RequestsCookieJar()
            for k, v in cookies.items():
                jar.set(k, v, domain="www.backmarket.es", path="/")
            session.cookies.update(jar)
        else:
            # Precalienta con GET si no hay Playwright
            try:
                session.get("https://www.backmarket.es/buyback/sell", timeout=10)
            except Exception:
                pass

        # Inicializa tarea
        tarea.estado = "RUNNING"
        tarea.iniciado_en = timezone.now()
        tarea.save(update_fields=["estado", "iniciado_en"])

        # Paths/log
        stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        base_dir = Path(settings.MEDIA_ROOT) / "backmarket" / stamp
        base_dir.mkdir(parents=True, exist_ok=True)
        log_path = base_dir / "log.txt"
        tarea.log_path = str(log_path)
        tarea.save(update_fields=["log_path"])

        def log(msg: str):
            with open(log_path, "a", encoding="utf-8") as fh:
                fh.write(f"{timezone.now().isoformat()} {msg}\n")

        # Cleanup staging
        LikewizeItemStaging.objects.filter(tarea=tarea).delete()
        staged = []

        modelos_qs = (ModeloModel.objects
                      .filter(tipo="iPhone")
                      .order_by(rel_name)
                      .only(rel_name, "id"))
        if only_model:
            modelos_qs = modelos_qs.filter(**{f"{rel_name}__iexact": only_model})
        if limit:
            modelos_qs = modelos_qs[:limit]

        total = modelos_qs.count()
        log(f"Back Market: {total} modelos iPhone…")
        _set_progress(tarea, 5, "Preparando")

        def canon_model_bm(s: str) -> list[str]:
            s0 = (s or "").strip()
            out = set()
            if not s0:
                return []
            t = s0
            # iPhone SE years → with parentheses
            m = re.search(r"(?i)\biPhone\s*SE\s*(?:\(([^)]+)\)|\s+([^)]+))", t)
            if m:
                token = (m.group(1) or m.group(2) or "").strip()
                # Map generation → year
                tok = token.lower()
                year = None
                if re.search(r"\b(3|3rd|third)\b", tok):
                    year = "2022"
                elif re.search(r"\b(2|2nd|second)\b", tok):
                    year = "2020"
                elif re.search(r"\b(1|1st|first)\b", tok):
                    year = "2016"
                elif re.search(r"\b20(1[6]|20|22)\b", tok):
                    y = re.search(r"20(16|20|22)", tok)
                    year = y.group(0) if y else None
                if year:
                    t = re.sub(r"(?i)\biPhone\s*SE\s*(?:\([^)]+\)|\s+[^)]+)", f"iPhone SE ({year})", t)
            # mini must be lowercase per examples
            t = re.sub(r"(?i)\bMini\b", "mini", t)
            out.add(t)
            # also add variant without parentheses for SE
            if "SE (" in t:
                out.add(re.sub(r"\s*\((\d{4})\)", r" \1", t))
            # add opposite mini case just in case
            out.add(re.sub(r"(?i)\bmini\b", "Mini", t))
            return list(out)

        for i, modelo in enumerate(modelos_qs.iterator(), start=1):
            nombre_modelo_raw = getattr(modelo, rel_name, "") or ""
            model_names = canon_model_bm(nombre_modelo_raw)
            caps = (CapacidadModel.objects
                    .filter(**{f"{rel_field}_id": modelo.id})
                    .only("id", gb_field))

            for cap in caps:
                cap_text = getattr(cap, gb_field, "") or ""
                gb = gb_from_text(cap_text)
                if not gb:
                    continue
                if only_gb and gb != only_gb:
                    continue

                time.sleep(delay_base + random.random() * delay_jitter)
                try:
                    headers_base = {
                        **DEFAULT_HEADERS,
                        "Sec-Fetch-Site": "same-origin",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Dest": "empty",
                    }

                    # Build candidate combinations
                    storages = [str(gb)]
                    if gb % 1024 == 0:
                        storages.append(str(gb // 1024))  # 1024 -> 1
                        if gb == 1024:
                            storages.append("1000")      # 1TB sometimes as 1000

                    next_steps = ["true", "false"]
                    embedded_opts = ["false", "true"]
                    func_states = [None, "1", "2"]

                    data = None
                    last_status = None
                    last_body = ""
                    last_params = None

                    for mname in model_names:
                        ref_model = (mname or "iPhone").replace(" ", "+")
                        for stor in storages:
                            for ns in next_steps:
                                for emb in embedded_opts:
                                    for fstate in func_states:
                                        params = {
                                            "brand": "Apple",
                                            "category": "smartphone",
                                            "model": mname,
                                            "nextStep": ns,
                                            "state_body": "1",
                                            # include functional only if provided
                                        **({"state_functional": fstate} if fstate else {}),
                                            "state_screen": "1",
                                            "storage": stor,
                                            "embedded": emb,
                                        }
                                        headers = dict(headers_base)
                                        headers["Referer"] = f"https://www.backmarket.es/buyback/sell/apple/{ref_model}?storage={stor}"
                                        r = session.get(BACKMARKET_URL, params=params, headers=headers, timeout=20)
                                        last_status = r.status_code
                                        last_params = params
                                        if r.status_code == 200:
                                            try:
                                                data = r.json()
                                            except Exception:
                                                data = None
                                            if data:
                                                break
                                        else:
                                            if r.status_code in (403, 429):
                                                time.sleep(1.5 + random.random())
                                                r = session.get(BACKMARKET_URL, params=params, headers=headers, timeout=20)
                                                last_status = r.status_code
                                                if r.status_code == 200:
                                                    try:
                                                        data = r.json()
                                                    except Exception:
                                                        data = None
                                                    if data:
                                                        break
                                            try:
                                                last_body = r.text[:300]
                                            except Exception:
                                                last_body = ""
                                    if data:
                                        break
                            if data:
                                break
                        if data:
                            break

                    if not data:
                        if debug:
                            log(f"DEBUG FAIL model={model_names} stor={storages} last_status={last_status} params={json.dumps(last_params or {})} body={last_body}")
                        log(f"{nombre_modelo_raw} {gb}GB → HTTP {last_status}")
                        continue
                    amount = None
                    try:
                        amount = data.get("listing", {}).get("price", {}).get("amount")
                    except Exception:
                        amount = None
                    if amount is None:
                        if debug:
                            log(f"DEBUG OK-200 sin precio: {json.dumps(data)[:300]}")
                        log(f"{nombre_modelo_raw} {gb}GB → sin precio")
                        continue
                    price = Decimal(str(amount))
                    staged.append(LikewizeItemStaging(
                        tarea=tarea,
                        tipo="iPhone",
                        modelo_raw=nombre_modelo_raw,
                        modelo_norm=model_names[0],
                        almacenamiento_gb=gb,
                        precio_b2b=price,  # campo staging
                        capacidad_id=cap.id,
                    ))
                except Exception as e:
                    log(f"{nombre_modelo_raw} {gb}GB → error {type(e).__name__}: {e}")
                    continue

            if total:
                _set_progress(tarea, 10 + int(80 * i / total), f"{i}/{total} modelos")

        if staged:
            LikewizeItemStaging.objects.bulk_create(staged, ignore_conflicts=True)

        tarea.total_modelos = total
        tarea.finalizado_en = timezone.now()
        tarea.estado = "SUCCESS"
        _set_progress(tarea, 100, "Listo para revisar cambios")
        tarea.save(update_fields=["total_modelos", "finalizado_en", "estado", "progreso", "subestado", "log_path"])
        log("✅ Staging Back Market completado.")
