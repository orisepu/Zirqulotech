import csv
import datetime as dt
import json
import random
import re
import time
from typing import Optional, Tuple, Dict, List
from decimal import Decimal

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from pathlib import Path

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging


SWAPPIE_URL_V3 = "https://swappie.com/api/sell/api/v3/prices/"
SWAPPIE_URL_V2 = "https://swappie.com/api/sell/api/v2/prices/"  # fallback

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    ),
    "Referer": "https://swappie.com/es/",
    "Origin": "https://swappie.com",
}

DEFAULT_COUNTRY = "ES"
VISUAL_PRIORITY = ["LIKE_NEW", "ALMOST_NEW", "GOOD", "MODERATE"]


def storage_from_model_name(name: str) -> str | None:
    if not isinstance(name, str):
        return None
    m = re.search(r"\b(\d+(?:TB|GB))\b", name)
    return m.group(1) if m else None


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


def canonicalizar_modelo_swappie(s: str) -> str:
    if not isinstance(s, str):
        s = str(s)
    s = s.replace("\xa0", " ").replace("–", "-")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"(?i)\b(iPhone\s+\d{2})\s+mini\b", r"\1 Mini", s)

    def se_year_from_text(t: str) -> str | None:
        t = t.replace("-", " ").replace("_", " ")
        if re.search(r"\b(3|3rd|third)\b", t):
            return "iPhone SE 2022"
        if re.search(r"\b(2|2nd|second)\b", t):
            return "iPhone SE 2020"
        if re.search(r"\b(1|1st|first)\b", t):
            return "iPhone SE 2016"
        return None

    if re.search(r"(?i)\biPhone\s*SE\s*[, -]?\s*(2016|2020|2022)\b", s):
        s = re.sub(r"(?i)\biPhone\s*SE\s*[, -]?\s*(2016|2020|2022)\b",
                   lambda m: f"iPhone SE {m.group(1)}", s)
        return s

    m = re.search(r"(?i)\biPhone\s*SE\s*\(([^)]+)\)", s)
    if m:
        year = se_year_from_text(m.group(1))
        if year:
            return re.sub(r"(?i)\biPhone\s*SE\s*\([^)]+\)", year, s)

    m2 = re.search(r"(?i)\biPhone\s*SE[^\w]*(?:\b(1st|2nd|3rd|first|second|third)\b.*?\bgeneration\b)", s)
    if m2:
        year = se_year_from_text(m2.group(1))
        if year:
            return re.sub(r"(?i)\biPhone\s*SE[^\w]*(?:\b(1st|2nd|3rd|first|second|third)\b.*?\bgeneration\b)",
                          year, s)

    if re.search(r"(?i)\biPhone\s*SE\b", s) and re.search(r"(?i)\bgeneration\b", s):
        if re.search(r"(?i)\b3(?:rd)?|third\b", s):
            return "iPhone SE 2022"
        if re.search(r"(?i)\b2(?:nd)?|second\b", s):
            return "iPhone SE 2020"
        if re.search(r"(?i)\b1(?:st)?|first\b", s):
            return "iPhone SE 2016"

    return s


def normalizar_modelo(raw: str) -> str:
    if not isinstance(raw, str):
        return str(raw)
    s = raw.strip()
    s = re.sub(r"^Apple\s+", "", s, flags=re.I)
    s = re.sub(r"\b(\d+\s?GB|1\s?TB|2\s?TB)\b", "", s, flags=re.I)
    s = re.sub(r"(iPhone)(\d)", r"\1 \2", s, flags=re.I)
    s = re.sub(r"(iPad)(\d)", r"\1 \2", s, flags=re.I)
    s = re.sub(r"\(.*?\)", "", s).strip()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def gb_to_label_from_text(txt: str) -> Optional[str]:
    if not txt:
        return None
    t = (txt or "").lower()
    m = re.search(r"\b(\d+(?:\.\d+)?)\s*(tb|gb)\b", t, flags=re.I)
    if not m:
        return None
    num, unit = m.groups()
    try:
        val = int(float(num))
    except Exception:
        return None
    unit = unit.upper()
    return f"{val}{unit}"


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


def obtener_precios_swappie_v3(
    session: requests.Session,
    modelo: str,
    storages: List[str],
    country: str = DEFAULT_COUNTRY,
) -> Dict[str, Optional[float]]:
    storages = [s for s in storages if s] or []
    params = {"model_name": modelo, "country": country, "storages": json.dumps(storages or [])}
    resp = session.get(SWAPPIE_URL_V3, params=params, timeout=15)
    if resp.status_code != 200:
        return {}
    try:
        data = resp.json()
    except Exception:
        return {}
    rows = data.get("results")
    if not isinstance(rows, list):
        return {}
    grouped: dict[str, list[dict]] = {}
    for item in rows:
        mn = item.get("model_name", "")
        stor = storage_from_model_name(mn)
        if not stor:
            continue
        grouped.setdefault(stor, []).append(item)

    out: Dict[str, Optional[float]] = {}
    def visual_rank(v: str) -> int:
        try:
            return VISUAL_PRIORITY.index(v)
        except ValueError:
            return len(VISUAL_PRIORITY)

    for stor, items in grouped.items():
        candidates = [it for it in items if not it.get("functional_condition")] or items
        candidates.sort(key=lambda it: visual_rank(it.get("visual_condition", "")))
        best = candidates[0]
        price_obj = best.get("price") or {}
        price_val = price_obj.get("price")
        try:
            out[stor] = float(price_val) if price_val is not None else None
        except Exception:
            out[stor] = None
    return out


def _set_progress(tarea: TareaActualizacionLikewize, pct: int, msg: str) -> None:
    tarea.progreso = max(0, min(100, int(pct)))
    tarea.subestado = msg[:120]
    tarea.save(update_fields=["progreso", "subestado"])


class Command(BaseCommand):
    help = "Descarga precios B2C (Swappie) y llena staging para revisión (no aplica cambios)."

    def add_arguments(self, parser):
        parser.add_argument("--tarea", type=str, required=True)
        parser.add_argument("--country", default=DEFAULT_COUNTRY)
        parser.add_argument("--delay", type=float, default=0.8)
        parser.add_argument("--jitter", type=float, default=0.4)
        parser.add_argument("--tipo", default="iPhone", help="Tipo de modelo a procesar (por defecto iPhone)")

    def handle(self, *args, **opts):
        tarea = TareaActualizacionLikewize.objects.get(pk=opts["tarea"])
        country: str = opts["country"]
        delay_base: float = opts["delay"]
        delay_jitter: float = opts["jitter"]
        tipo_obj: str = opts["tipo"]

        # Modelos configurables
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        rel_field = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")
        rel_name = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")
        gb_field = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")
        ModeloModel = CapacidadModel._meta.get_field(rel_field).related_model

        session = build_session()

        # Inicializa tarea
        tarea.estado = "RUNNING"
        tarea.iniciado_en = timezone.now()
        tarea.save(update_fields=["estado", "iniciado_en"])

        # Paths y logging sencillo (log a fichero)
        stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        base_dir = Path(settings.MEDIA_ROOT) / "swappie" / stamp
        base_dir.mkdir(parents=True, exist_ok=True)
        log_path = base_dir / "log.txt"
        tarea.log_path = str(log_path)
        tarea.save(update_fields=["log_path"])
        def log(msg: str):
            with open(log_path, "a", encoding="utf-8") as fh:
                fh.write(f"{timezone.now().isoformat()} {msg}\n")

        # Itera modelos del tipo
        modelos_qs = (ModeloModel.objects
                      .filter(tipo=tipo_obj)
                      .order_by(rel_name)
                      .only(rel_name, "id"))

        total = modelos_qs.count()
        log(f"Procesando {total} modelos tipo {tipo_obj} (country={country})…")
        _set_progress(tarea, 5, "Preparando")

        # Limpiar staging previo de esta tarea
        LikewizeItemStaging.objects.filter(tarea=tarea).delete()
        staged_objs: List[LikewizeItemStaging] = []

        for i, modelo in enumerate(modelos_qs.iterator(), start=1):
            nombre_modelo = getattr(modelo, rel_name, "") or ""
            nombre_norm = normalizar_modelo(canonicalizar_modelo_swappie(nombre_modelo))

            caps = (CapacidadModel.objects
                    .filter(**{f"{rel_field}_id": modelo.id})
                    .only("id", gb_field))

            storages: List[str] = []
            cap_map: Dict[str, int] = {}
            for cap in caps:
                tamaño_txt = getattr(cap, gb_field, "") or ""
                stor = gb_to_label_from_text(tamaño_txt) or ""
                if stor:
                    storages.append(stor)
                    cap_map[stor] = cap.id
                # Añade sinónimos: 1024GB ↔ 1TB
                gb_num = gb_from_text(tamaño_txt)
                if gb_num:
                    # Siempre añade forma GB como referencia
                    gb_label = f"{gb_num}GB"
                    storages.append(gb_label)
                    cap_map[gb_label] = cap.id
                    if gb_num % 1024 == 0:
                        tb_label = f"{gb_num // 1024}TB"
                        storages.append(tb_label)
                        cap_map[tb_label] = cap.id

            storages = sorted(list(set(storages)))
            if not storages:
                self.stdout.write(f"- {nombre_modelo:28} sin capacidades reconocidas; salto")
                continue

            time.sleep(delay_base + random.random() * delay_jitter)
            prices_map = obtener_precios_swappie_v3(session, modelo=nombre_norm, storages=storages, country=country)

            if not prices_map:
                log(f"- {nombre_modelo:28} ❌ sin precios en Swappie")
                continue

            pares = ", ".join([f"{k}:{('-' if v is None else f'{v:.0f}€')}" for k, v in sorted(prices_map.items())])
            log(f"- {nombre_modelo:28} ✅ {pares}")

            for stor, price in prices_map.items():
                cap_id = cap_map.get(stor)
                if not cap_id:
                    continue
                if price is None:
                    continue
                # Parse stor to GB
                m = re.match(r"^(\d+)(GB|TB)$", stor, flags=re.I)
                gb = 0
                if m:
                    qty = int(m.group(1))
                    unit = m.group(2).upper()
                    gb = qty * 1024 if unit == "TB" else qty
                staged_objs.append(LikewizeItemStaging(
                    tarea=tarea,
                    tipo=tipo_obj,
                    modelo_raw=nombre_modelo,
                    modelo_norm=nombre_norm,
                    almacenamiento_gb=gb,
                    precio_b2b=Decimal(str(price)),  # usamos campo precio_b2b como contenedor genérico
                    capacidad_id=cap_id,
                ))

            if total:
                _set_progress(tarea, 10 + int(80 * i / total), f"{i}/{total} modelos")

        if staged_objs:
            LikewizeItemStaging.objects.bulk_create(staged_objs, ignore_conflicts=True)
        tarea.total_modelos = total
        tarea.finalizado_en = timezone.now()
        tarea.estado = "SUCCESS"
        _set_progress(tarea, 100, "Listo para revisar cambios")
        tarea.save(update_fields=["total_modelos", "finalizado_en", "estado", "progreso", "subestado", "log_path"])
        log("✅ Staging B2C (Swappie) completado.")
