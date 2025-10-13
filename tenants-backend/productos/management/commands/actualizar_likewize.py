import os
import re
import csv
import json
import logging
from decimal import Decimal
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import (
    Q, CharField, TextField, IntegerField,
    PositiveIntegerField, SmallIntegerField, BigIntegerField
)
from typing import List, Dict, Optional
from productos.models import TareaActualizacionLikewize, LikewizeItemStaging, LikewizeCazadorTarea
from productos.likewize_config import get_apple_presets, get_extra_presets
from playwright.sync_api import sync_playwright
import requests
from typing import Optional

# ==========================
# Config
# ==========================
# Categorías del endpoint de Likewize -> familia/marca
ANUM_RE = re.compile(r"\bA\d{4}\b", re.I)
_CPU_FAMILIAS = [
    "M4 Ultra", "M4 Max", "M4 Pro", "M4",
    "M3 Ultra", "M3 Max", "M3 Pro", "M3",
    "M2 Ultra", "M2 Max", "M2 Pro", "M2",
    "M1 Ultra", "M1 Max", "M1 Pro", "M1",
    "Xeon W", "Xeon",
    "Core i9", "Core i7", "Core i5", "Core i3",
]


# ==========================
# Utilidades comunes
# ==========================

def _ipad_subfamily_from_raw(text: str) -> str:
    t = text or ""
    if re.search(r"\biPad\s+Pro\b", t, re.I):  return "iPad Pro"
    if re.search(r"\biPad\s+Air\b", t, re.I):  return "iPad Air"
    if re.search(r"\biPad\s+mini\b", t, re.I): return "iPad mini"
    return "iPad"


def _ipad_chip_from_raw(text: str) -> str:
    m = re.search(r"\b(M[1-4])\b", text or "", re.I)
    return m.group(1).upper() if m else ""


def _ipad_extract_generation(text: str) -> int | None:
    t = text or ""
    # (a) explícito entre paréntesis: "(5.ª generación)"
    m = re.search(r"\(\s*(\d{1,2})\s*\.?ª\s*generaci[oó]n\s*\)", t, re.I)
    if m:
        g = int(m.group(1))
        if 2 <= g <= 10: return g
    # (b) número suelto justo antes de Wi-Fi/Cellular (evitando capturar 12.9/11)
    m = re.search(r"(?<![\d.,])(\d{1,2})(?![\d.,])\s*(?= *(?:Wi[\-\s]?Fi|Wifi|WiFi|Cellular)\b)", t, re.I)
    if m:
        g = int(m.group(1))
        if 2 <= g <= 10: return g
    return None


def _ipad_has_chip_token(text: str) -> bool:
    return bool(re.search(r"\bM[1-4]\b", text or "", re.I))


def _ipad_score_v3(descr: str, *, base: str, want_wifi: bool, want_cellular: bool,
                   want_chip: str, want_gen: int | None, gb: int | None) -> int:
    d = descr or ""
    s = 0
    # Coincidencias básicas
    if base and base.lower() in d.lower(): s += 4
    if want_wifi and re.search(r"\bWi[\-\s]?Fi\b", d, re.I): s += 3
    if want_cellular and re.search(r"\bCellular\b", d, re.I): s += 3

    # Chip gating: si el raw no trae chip, penaliza candidatos con chip explícito
    if want_chip:
        if re.search(rf"\b{re.escape(want_chip)}\b", d, re.I): s += 6
        elif _ipad_has_chip_token(d): s -= 5
    else:
        if _ipad_has_chip_token(d): s -= 6

    # Generación: fuerte
    # extrae gen del candidato
    cand_gen = None
    m = re.search(r"\(\s*(\d{1,2})\s*\.?ª\s*generaci[oó]n\s*\)", d, re.I)
    if m:
        try:
            cg = int(m.group(1))
            if 2 <= cg <= 10: cand_gen = cg
        except:  # noqa: E722
            pass
    # M4 no usa "n.ª generación": trátalo como gen especial
    is_m4 = bool(re.search(r"\b\(M4\)\b", d, re.I))

    if want_gen is not None:
        if cand_gen is not None:
            if cand_gen == want_gen: s += 10
            else: s -= 8
        # si pedimos gen X y el candidato es M4 (sin gen), penaliza salvo que el raw traiga M4
        if is_m4 and not want_chip:
            s -= 6
    else:
        # si el raw NO dice generación: no favorezcas "(n.ª generación)" ni "(M4)"
        if cand_gen is not None: s -= 1
        if is_m4: s -= 4

    # Heurística por capacidad (evitar saltar a gens nuevas cuando gb es pequeño y el raw no lo pide)
    if gb:
        if gb <= 64 and want_gen is None:
            if cand_gen and cand_gen >= 4: s -= 3
            if _ipad_has_chip_token(d): s -= 4
        elif gb == 128 and want_gen is None:
            if cand_gen and cand_gen >= 5: s -= 2

    # Bonus por especificidad
    s += min(len(d), 80) // 25
    return s


def _build_cap_info_map(cap_ids: set[int]) -> dict[int, dict]:
    """
    Devuelve un dict {cap_id: {"bd_modelo": str, "bd_capacidad": str}}
    usando CapacidadModel + su FK a Modelo.
    """
    if not cap_ids:
        return {}
    caps = (CapacidadModel.objects
            .filter(id__in=cap_ids)
            .select_related(REL_FIELD)
            .only("id", GB_FIELD, f"{REL_FIELD}__{REL_NAME}"))
    out: dict[int, dict] = {}
    for c in caps:
        modelo = getattr(c, REL_FIELD)
        out[c.id] = {
            "bd_modelo": getattr(modelo, REL_NAME, "") or "",
            "bd_capacidad": getattr(c, GB_FIELD, "") or "",
        }
    return out


def save_cazado_result(
    tarea_uuid,
    *,
    total_likewize: int,
    matches: List[Dict],
    no_cazados_bd: List[Dict],
    no_cazados_likewize: List[Dict] | None = None,
    status: Optional[str] = None,
    meta: Optional[Dict] = None,
):
    """
    Guarda/actualiza el resumen de cazado para que lo sirva el endpoint.
    """
    # Valor por defecto robusto para status
    default_status = getattr(getattr(LikewizeCazadorTarea, "Status", object), "DONE", "done")
    status = status or default_status

    obj, _ = LikewizeCazadorTarea.objects.update_or_create(
        id=tarea_uuid,   # el PK de LikewizeCazadorTarea es UUID según tu diseño
        defaults={
            "status": status,
            "total_likewize": int(total_likewize or 0),
            "matches": matches or [],
            "no_cazados_bd": no_cazados_bd or [],
            "no_cazados_likewize": no_cazados_likewize or [],
            "meta": meta or {},
        },
    )
    return obj


def set_progress(tarea: TareaActualizacionLikewize, pct: int, msg: str) -> None:
    tarea.progreso = max(0, min(100, int(pct)))
    tarea.subestado = msg[:120]
    tarea.save(update_fields=["progreso", "subestado"])


def _base_sin_storage(nombre: str) -> str:
    s = (nombre or "").strip()
    # quita capacidad 256GB / 1 TB / 1.5 TB
    s = re.sub(r"(\d+(?:[.,]\d+)?)\s*(TB|GB)\b", "", s, flags=re.I)
    # quita A-number
    s = re.sub(r"\bA\d{4}\b", "", s, flags=re.I)
    # quita conectividad para no estrechar de más
    s = re.sub(r"\bWi-?Fi\b", "", s, flags=re.I)
    s = re.sub(r"\bCellular\b", "", s, flags=re.I)
    # quita fechas sueltas tipo 10/2023 o 2023
    s = re.sub(r"\b\d{1,2}/20\d{2}\b", "", s)
    s = re.sub(r"\b20\d{2}\b", "", s)
    # espacios múltiples
    s = re.sub(r"\s{2,}", " ", s).strip()
    return s


def cargar_equivalencias(path: str) -> dict[tuple[str, int], int]:
    eq: dict[tuple[str, int], int] = {}
    if not path or not os.path.exists(path):
        return eq

    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            modelo_csv = norm_modelo(row.get("Modelo", "") or "")
            try:
                gb = int(row.get("GB", "") or 0)
                cap_id = int(row.get("capacidad_id", "") or 0)
            except Exception:
                continue
            if modelo_csv and gb and cap_id:
                eq[(modelo_csv, gb)] = cap_id
    return eq


def canonical_family_from_text(text: str) -> str | None:
    s = (text or "").strip().lower()
    if s.startswith("macbookpro") or s.startswith("macbook pro"):
        return "MacBook Pro"
    if s.startswith("macbookair") or s.startswith("macbook air"):
        return "MacBook Air"
    if s.startswith("macbook"):
        return "MacBook"
    if s.startswith("imac pro") or s.startswith("imacpro"):
        return "iMac Pro"
    if s.startswith("imac"):
        return "iMac"
    if s.startswith("mac mini") or s.startswith("macmini"):
        return "Mac mini"
    if s.startswith("mac studio") or s.startswith("macstudio"):
        return "Mac Studio"
    if s.startswith("mac pro") or s.startswith("macpro"):
        return "Mac Pro"
    if s.startswith("iphone"):
        return "iPhone"
    if s.startswith("ipad"):
        return "iPad"
    return None


def norm_modelo(nombre: str) -> str:
    """
    Normaliza mínimamente sin romper siglas:
    - uniformiza algunos términos (SSD, Fusion Drive, GB/TB, pulgadas)
    - quita espacios duplicados
    - NO convierte a title-case ciego para no romper 'A1991', 'SSD', etc.
    """
    s = (nombre or "").strip()
    # normaliza unidades / palabras frecuentes
    s = re.sub(r"\b(Inch|Inches)\b", "inch", s, flags=re.I)
    s = re.sub(r"\bGb\b", "GB", s, flags=re.I)
    s = re.sub(r"\bTb\b", "TB", s, flags=re.I)
    s = re.sub(r"\bSsd\b", "SSD", s, flags=re.I)
    s = re.sub(r"\bFusion\s*Drive\b", "Fusion Drive", s, flags=re.I)
    # Core I5 -> Core i5
    s = re.sub(r"\bCore\s+I([3579])\b", r"Core i\1", s, flags=re.I)
    # espacios múltiples
    s = re.sub(r"\s{2,}", " ", s).strip()
    return s


def extraer_gpu_cores(texto: str) -> int | None:
    t = (texto or "")
    m = re.search(r"\b(\d{1,3})\s*Core\s*GPU\b", t, flags=re.I)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return None
    # (opcional) palabras -> número (por si algún día apareciera "Seventy-Six")
    WORDS = {
        "sixty": 60, "seventy-six": 76, "seventy six": 76,
        "thirty-two": 32, "thirty two": 32, "twenty-four": 24, "twenty four": 24,
    }
    m = re.search(r"\b([a-z\- ]+)\s*Core\s*GPU\b", t, flags=re.I)
    if m:
        key = re.sub(r"\s+", " ", m.group(1).strip().lower())
        return WORDS.get(key)
    return None


def extraer_storage_gb(texto: str) -> int | None:
    # soporta "512GB", "512 GB", "1 TB", "1.5 TB"
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(TB|GB)\b", texto, flags=re.I)
    if not m:
        return None
    qty = m.group(1).replace(",", ".")
    unit = m.group(2).upper()
    try:
        val = float(qty)
    except ValueError:
        return None
    if unit == "TB":
        return int(round(val * 1024))
    return int(round(val))


def extraer_pulgadas(texto: str) -> int | None:
    # Soporta 9.7'', 12.9", 11-inch, 13 pulgadas…
    m = (re.search(r"\b(\d{1,2}(?:[.,]\d)?)\s*(?:''|\"|″|inch(?:es)?|pulgadas)\b", texto, flags=re.I)
         or re.search(r"\b(\d{1,2})\s*(?:''|\"|″)\b", texto, flags=re.I))
    if not m:
        return None
    try:
        val = float(m.group(1).replace(",", "."))
    except Exception:
        return None
    # staging guarda int (p.ej., 12.9 → 13)
    return int(round(val))


def extraer_a_number(texto: str) -> str:
    m = re.search(r"\bA(\d{4})\b", texto or "", flags=re.I)
    return f"A{m.group(1)}" if m else ""


def extraer_anio(texto: str) -> int | None:
    m = re.search(r"\b(20\d{2})\b", texto)
    return int(m.group(1)) if m else None


def extraer_cpu(texto: str) -> str:
    t = (texto or "")

    # Apple Silicon con sufijos (Ultra/Max/Pro)
    m = re.search(r"\b(M[1-4])(?:\s|-)?(Ultra|Max|Pro)?\b", t, flags=re.I)
    if m:
        base = m.group(1).upper()
        suf = (m.group(2) or "").title()
        return f"{base} {suf}".strip()

    # Intel Core con frecuencia (Core i5 3.8 / 3.5 / 3.4 ...)
    m = re.search(r"\bCore\s+i([3579])\s*([0-9](?:\.[0-9])?)\b", t, flags=re.I)
    if m:
        return f"Core i{m.group(1)} {m.group(2)}"

    # Xeon W explícito con frecuencia
    m = re.search(r"\bXeon\s*W\b.*?\b([0-9](?:\.[0-9])?)\b", t, flags=re.I)
    if m:
        return f"Xeon W {m.group(1)}"

    # Fallback por familias conocidas
    for fam in _CPU_FAMILIAS:
        if re.search(rf"\b{re.escape(fam)}\b", t, flags=re.I):
            return fam

    return ""


# ==========================
# Mapeo de Capacidad / Modelo
# ==========================
CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
REL_FIELD = getattr(settings, "CAPACIDAD_REL_MODEL_FIELD", "modelo")     # FK en Capacidad -> Modelo
REL_NAME = getattr(settings, "REL_MODELO_NAME_FIELD", "descripcion")     # campo legible en Modelo
GB_FIELD = getattr(settings, "CAPACIDAD_GB_FIELD", "tamaño")             # texto "512 GB", "1 TB", etc.
Modelo = CapacidadModel._meta.get_field(REL_FIELD).related_model

_IPHONE_SUFFIXES = ["Pro Max", "Pro", "Plus", "Mini", "Max"]


def _iphone_base(nombre: str) -> tuple[str, set[str]]:
    """
    Devuelve (base, sufijos) para iPhones.
    base: nombre sin almacenamiento (ej. 'iPhone 15 Pro')
    sufijos: tokens como {'Pro','Max','Plus','Mini'} detectados en el texto.
    """
    s = (nombre or "").strip()
    # quita '128GB', '1 TB', etc
    s = re.sub(r"\s+\d+(?:[.,]\d+)?\s*(TB|GB)\b.*$", "", s, flags=re.I).strip()
    # normaliza dobles espacios
    s = re.sub(r"\s{2,}", " ", s)
    suffixes = {sx for sx in _IPHONE_SUFFIXES if re.search(rf"\b{re.escape(sx)}\b", s, flags=re.I)}
    return s, suffixes


def _iphone_score(descr: str, base: str, want_suffixes: set[str]) -> int:
    """
    Score alto si encaja exacto con el 'base' y/o comparte sufijos (Pro, Max, Plus...).
    """
    d = (descr or "").strip().lower()
    b = (base or "").strip().lower()
    s = 0
    if d == b: s += 10
    if d.startswith(b + " "): s += 6
    if b in d: s += 3
    # bonifica coincidencia de sufijos deseados y penaliza si no coinciden
    have_suffixes = {sx for sx in _IPHONE_SUFFIXES if sx.lower() in d}
    s += 3 * len(have_suffixes & {x.lower() for x in want_suffixes})
    # pequeña penalización si hay sufijos no deseados
    s -= 1 * len(have_suffixes - {x.lower() for x in want_suffixes})
    # preferir descripciones más largas (más específicas) a igualdad
    s += min(len(d), 80) // 20
    return s


def _ipad_connectivity_flags(texto: str) -> tuple[bool, bool]:
    """Detecta si el nombre menciona Wi-Fi/Wifi/WiFi o Cellular."""
    s = (texto or "").lower()
    wifi = bool(re.search(r"\bwi[\-\s]?fi\b", s) or re.search(r"\bwifi\b", s))
    cellular = "cellular" in s
    return wifi, cellular


def _ipad_score(descr: str, base: str, want_wifi: bool, want_cellular: bool) -> int:
    """Pequeño score para desempatar modelos iPad."""
    d = (descr or "").lower()
    b = (base or "").lower()
    s = 0
    if d == b: s += 8
    if b and b in d: s += 4
    # bonifica conectividad correcta y penaliza la opuesta
    if want_wifi and ("wi-fi" in d or "wifi" in d): s += 3
    if want_cellular and "cellular" in d: s += 3
    if want_wifi and "cellular" in d: s -= 2
    if want_cellular and ("wi-fi" in d or "wifi" in d): s -= 2
    # prioriza descripciones largas (más específicas)
    s += min(len(d), 80) // 20
    return s


def _extraer_nucleos_y_freq_intel(texto: str) -> tuple[int | None, str | None]:
    """
    Soporta '8 Core 3.5', 'Eight Core 3.5', 'Twenty-Four Core 2.7', etc.
    Devuelve (nucleos, freq_str).
    """
    t = (texto or "")
    lower = t.lower()

    # 1) Núcleos como dígito: '8 Core', '28 Core'
    m = re.search(r"\b(\d{1,2})\s*core\b", lower, flags=re.I)
    if m:
        cores = int(m.group(1))
    else:
        # 2) Núcleos como palabra: 'Eight Core', 'Twenty-Four Core', …
        WORD2NUM = {
            "eight": 8, "ten": 10, "twelve": 12, "fourteen": 14, "eighteen": 18,
            "twenty": 20, "twenty-one": 21, "twenty-two": 22, "twenty-three": 23,
            "twenty-four": 24, "twenty five": 25, "twenty-five": 25,
            "twenty six": 26, "twenty-six": 26,
            "twenty seven": 27, "twenty-seven": 27,
            "twenty eight": 28, "twenty-eight": 28,
        }
        cores = None
        m = re.search(r"\b([a-z\- ]+)\s*core\b", lower, flags=re.I)
        if m:
            key = m.group(1).strip()
            # normaliza espacios/guiones
            key_norm = re.sub(r"\s+", " ", key)
            cores = WORD2NUM.get(key_norm, WORD2NUM.get(key_norm.replace(" ", "-")))

    # Frecuencia tipo '3.5' tras 'Core'
    freq = None
    m = re.search(r"\bcore\b\s+(\d(?:\.\d)?)\b", lower, flags=re.I)
    if m:
        freq = m.group(1)

    return cores, freq

def _mac_score_v1(
    descr: str,
    *,
    base: str,
    gb: Optional[int],
    want_cpu_cores: Optional[int] = None,
    want_gpu_cores: Optional[int] = None,
) -> int:
    d = descr or ""
    s = 0

    # match básico por "base" (modelo sin almacenamiento/fecha/etc.)
    if base and base.lower() in d.lower():
        s += 4

    # --- Gating/penalización por núcleos CPU ---
    have_cpu = _cpu_cores_from_text_cpu_only(d)
    if want_cpu_cores and have_cpu and want_cpu_cores != have_cpu:
        return -999  # descarta candidatos con distinto nº de núcleos
    if want_cpu_cores and have_cpu and want_cpu_cores == have_cpu:
        s += 6

    # --- Refuerzo por núcleos GPU (opcional) ---
    have_gpu = extraer_gpu_cores(d)
    if want_gpu_cores and have_gpu:
        s += 4 if want_gpu_cores == have_gpu else -4

    # Pequeño bonus por especificidad del texto
    s += min(len(d), 80) // 25
    return s

def _cpu_cores_from_text_cpu_only(t: str) -> Optional[int]:
    t = t or ""
    m = re.search(r'\b(\d{1,2})\s*[- ]?core\s*cpu\b', t, re.I)
    if m:
        return int(m.group(1))
    m = re.search(r'\bXeon\b.*?\b(\d{1,2})\s*[- ]?core\b', t, re.I)
    if m:
        return int(m.group(1))
    m = re.search(r'\b(\d{1,2})\s*core\b', t, re.I)
    if m:
        after = t[m.end():]
        if not re.match(r'\s*gpu\b', after, re.I):
            return int(m.group(1))
    return None

def _cpu_cores_from_text(t: str) -> int | None:
    # "18 Core 2.3" / "8 Core 3.2" / "10 Core 3.0" / "14 Core 2.5"
    m = re.search(r'\b(\d{1,2})\s*core\b', t or "", flags=re.I)
    return int(m.group(1)) if m else None


def _cpu_freq_from_text(t: str) -> str | None:
    # toma el número justo tras "Core", p.ej. "14 Core 2.5"
    m = re.search(r'core\s*\d{1,2}\s*([0-9](?:\.[0-9])?)', t or "", flags=re.I)
    return m.group(1) if m else None


def extraer_capacidad(texto: str) -> str:
    t = (texto or "").lower()

    # normal
    m = re.search(r'\b(\d+(?:\.\d+)?)\s*(tb|gb)\b', t, flags=re.I)
    if not m:
        # tolera "4TB S", "512GB SS", o sin "ssd"
        m = re.search(r'\b(\d+(?:\.\d+)?)\s*(tb|gb)\s*s{0,3}\b', t, flags=re.I)

    if m:
        num, unit = m.groups()
        try:
            num = int(float(num))
        except ValueError:
            pass
        return f"{num} {unit.upper()}"
    return ""


def _cpu_fix_from_anumber(fam: str | None, a_number: str | None, cpu: str) -> str:
    fam = (fam or "").strip()
    a = (a_number or "").strip().upper()
    c = (cpu or "").strip()

    # Mac mini (2023)
    if fam == "Mac mini":
        if a == "A2816" and "M2 Pro" not in c:
            return "M2 Pro"
        if a == "A2686" and "M2 " not in c and "M2 Pro" not in c:
            return "M2"
        if a == "A2348" and "M1" not in c:
            return "M1"

    # Mac Pro (2023)
    if fam == "Mac Pro" and a in {"A2786", "A2787"} and "M2 Ultra" not in c:
        return "M2 Ultra"

    # iMac 24"
    if fam == "iMac":
        if a in {"A2873", "A2874"} and "M3" not in c:
            return "M3"
        if a in {"A2438", "A2439"} and "M1" not in c:
            return "M1"

    return c


def _score_macpro(descr: str, *, a_number: str | None, anio: int | None,
                  cores: int | None, freq: str | None, es_torre: bool | None,
                  want_cpu: str = "", want_gpu_cores: int | None = None) -> int:
    d = (descr or "")
    s = 0
    if a_number and a_number.upper() in d.upper(): s += 6
    if anio and (str(anio) in d): s += 4

    has_xeon = bool(re.search(r"\bXeon\b", d, re.I))
    has_intel = bool(re.search(r"\bIntel\b", d, re.I))
    has_mchip = bool(re.search(r"\bM[1-4]\b", d, re.I))
    want_asi = bool(re.match(r"\s*M[1-4]", (want_cpu or ""), re.I))

    if want_asi and has_mchip: s += 4
    if not want_asi and (has_xeon or has_intel): s += 4
    if want_asi and (has_xeon or has_intel): s -= 8
    if (not want_asi) and has_mchip: s -= 8

    if re.search(r"\bXeon\s*W\b", d, re.I): s += 2
    if cores and re.search(rf"\b{cores}\s*Core\b", d, re.I): s += 3
    if freq and freq in d: s += 2

    # usar el parámetro want_gpu_cores (no src_text)
    have_gpu = extraer_gpu_cores(d)
    if want_gpu_cores and have_gpu:
        s += 4 if want_gpu_cores == have_gpu else -4

    if es_torre is True: s += 2
    s += min(len(d), 80) // 20
    return s


def _patterns_for_capacity(gb: int) -> set[str]:
    def trim(x):
        s = f"{x:.3f}".rstrip("0").rstrip(".")
        return s or "0"

    pats = {str(gb), f"{gb}GB", f"{gb} GB"}
    tb = gb / 1024.0
    for s in {trim(tb), trim(tb).replace(".", ",")}:
        pats.update({f"{s}TB", f"{s} TB"})
    return pats


def _fmt_pulgadas(p: int) -> str:
    return f"{p} Pulgadas"


# --- reemplaza tu resolver_capacidad_id por este ---

def resolver_capacidad_id(
    modelo_norm: str,
    almacenamiento_gb: int | None,
    equivalencias: dict[tuple[str, int], int],
    _deprecated_CapacidadModel=None,
    a_number: str | None = None,
    pulgadas: int | None = None,
    anio: int | None = None,
    cpu: str = "",
    tipo: str | None = None,
    gpu_cores: int | None = None,
    marca: str | None = None,
    likewize_code: str | None = None,
    likewize_code_raw: str | None = None,
) -> int | None:
    if not almacenamiento_gb:
        return None

    # 0) equivalencias explícitas
    cap_id = equivalencias.get((modelo_norm, int(almacenamiento_gb)))
    if cap_id:
        return cap_id

    likewize_codes = []
    for value in (likewize_code_raw, likewize_code):
        if value:
            val = value.strip()
            if val:
                likewize_codes.append(val)
    likewize_codes_upper = {code.upper() for code in likewize_codes}

    if likewize_codes_upper:
        code_q = Q()
        for code in likewize_codes:
            code_q |= Q(likewize_modelo__iexact=code)
            code_q |= Q(likewize_modelo__iendswith=code)
        for code in likewize_codes_upper:
            code_q |= Q(likewize_modelo__iexact=code)
            code_q |= Q(likewize_modelo__iendswith=code)

        qs_code = Modelo.objects.filter(code_q)
        if tipo:
            qs_code = qs_code.filter(tipo__iexact=tipo.strip())
        if marca:
            qs_code = qs_code.filter(marca__iexact=marca.strip())

        if qs_code.exists():
            qsize = Q()
            for s in _patterns_for_capacity(int(almacenamiento_gb)):
                qsize |= Q(**{f"{GB_FIELD}__icontains": s})

            for modelo in qs_code[:10]:
                cap = CapacidadModel.objects.filter(**{REL_FIELD: modelo}).filter(qsize).values_list("id", flat=True).first()
                if cap:
                    return cap

    # 1) Búsqueda por Modelo con señales fuertes
    cand = Modelo.objects.all()
    applied_filter = False

    if a_number:
        # A-number es identificador único de Apple: DEBE coincidir exactamente
        # Buscar SOLO en likewize_modelo (campo dedicado), sin fallback a descripción
        q_anumber = Q(likewize_modelo__iexact=a_number) | Q(likewize_modelo__icontains=a_number)
        cand = cand.filter(q_anumber)
        applied_filter = True
        # Si no hay coincidencias, retornar None (no mapear con A-number incorrecto)
        if not cand.exists():
            return None

    if pulgadas:
        ptxt = _fmt_pulgadas(int(pulgadas))
        q = Q(pantalla__iexact=ptxt) | Q(**{f"{REL_NAME}__icontains": f"{pulgadas} pulgadas"})
        cand = cand.filter(q)
        applied_filter = True

    if anio:
        q = Q(año=int(anio)) | Q(**{f"{REL_NAME}__icontains": str(anio)})
        cand = cand.filter(q)
        applied_filter = True

    if cpu:
        cand = cand.filter(Q(**{f"{REL_NAME}__icontains": cpu}) | Q(procesador__icontains=cpu))
        applied_filter = True

    if gpu_cores:
        pat = f"{gpu_cores} Core GPU"
        cand = cand.filter(Q(**{f"{REL_NAME}__icontains": pat}))
        applied_filter = True

    fam = canonical_family_from_text(modelo_norm) or (tipo or "").strip()

    # iPad ------------------------------------------------
    if fam in {"iPad", "iPad Pro", "iPad Air", "iPad mini"}:
        raw = modelo_norm
        want_wifi, want_cellular = _ipad_connectivity_flags(raw)
        subfam   = _ipad_subfamily_from_raw(raw)
        want_chip = (_ipad_chip_from_raw(raw) or (cpu or "").strip().upper())
        want_gen  = _ipad_extract_generation(raw)
        cpu = _cpu_fix_from_anumber(fam, a_number, cpu or "")
        base = _base_sin_storage(raw)

        qs = Modelo.objects.filter(**{f"{REL_NAME}__icontains": "iPad"})

        if subfam != "iPad":
            qs = qs.filter(**{f"{REL_NAME}__icontains": subfam})
        else:
            qs = qs.exclude(**{f"{REL_NAME}__icontains": "iPad Pro"}) \
                   .exclude(**{f"{REL_NAME}__icontains": "iPad Air"}) \
                   .exclude(**{f"{REL_NAME}__icontains": "iPad mini"})

        size_m = re.search(r"\b(\d{1,2}(?:[.,]\d)?)\b", raw, flags=re.I)   # usar RAW
        if size_m:
            size_raw = size_m.group(1)
            s_dot, s_comma = size_raw.replace(",", "."), size_raw.replace(".", ",")
            q_size = (Q(**{f"{REL_NAME}__icontains": f"{s_dot} pulgadas"}) |
                      Q(**{f"{REL_NAME}__icontains": f"{s_comma} pulgadas"}) |
                      Q(**{f"{REL_NAME}__icontains": s_dot}) |
                      Q(**{f"{REL_NAME}__icontains": s_comma}) |
                      Q(**{f"{REL_NAME}__icontains": f'{s_dot}"'}) |
                      Q(**{f"{REL_NAME}__icontains": f'{s_comma}"'}))
            qs = qs.filter(q_size)

        if want_wifi:
            qs = qs.filter(
                Q(**{f"{REL_NAME}__icontains": "Wi-Fi"}) |
                Q(**{f"{REL_NAME}__icontains": "Wifi"}) |
                Q(**{f"{REL_NAME}__icontains": "WiFi"})
            )
        if want_cellular:
            qs = qs.filter(**{f"{REL_NAME}__icontains": "Cellular"})

        if want_chip:
            q_chip = Q(**{f"{REL_NAME}__icontains": want_chip}) | Q(procesador__icontains=want_chip)
            qs_chip = qs.filter(q_chip)
            if qs_chip.exists():
                qs = qs_chip

        candidatos = list(qs.values("id", REL_NAME)[:200])
        if not candidatos:
            return None

        gb = int(almacenamiento_gb or 0)
        candidatos.sort(
            key=lambda r: _ipad_score_v3(
                r[REL_NAME],
                base=base,
                want_wifi=want_wifi,
                want_cellular=want_cellular,
                want_chip=want_chip,
                want_gen=want_gen,
                gb=gb,
            ),
            reverse=True
        )

        qsize = Q()
        for s in _patterns_for_capacity(int(almacenamiento_gb)):
            qsize |= Q(**{f"{GB_FIELD}__icontains": s})

        for r in candidatos[:20]:
            modelo_id = r["id"]
            cap = CapacidadModel.objects.filter(
                Q(**{f"{REL_FIELD}_id": modelo_id}) & qsize
            ).values_list("id", flat=True).first()
            if cap:
                return cap

        return None

    # iPhone ---------------------------------------------
    if not applied_filter and fam == "iPhone":
        base, want_suffixes = _iphone_base(modelo_norm)
        qs = Modelo.objects.filter(tipo="iPhone", **{f"{REL_NAME}__icontains": "iPhone"})
        cand = list(qs.filter(**{f"{REL_NAME}__icontains": base.split(" ", 1)[-1]}).values("id", REL_NAME)[:50])
        if not cand:
            cand = list(qs.values("id", REL_NAME)[:50])

        best = None
        best_score = -10**9
        for row in cand:
            descr = row[REL_NAME]
            sc = _iphone_score(descr, base, want_suffixes)
            if sc > best_score:
                best_score, best = sc, row
        if not best or best_score < 3:
            return None

        modelo_id = best["id"]
        qcap = Q(**{f"{REL_FIELD}_id": modelo_id})
        qsize = Q()
        for s in _patterns_for_capacity(int(almacenamiento_gb)):
            qsize |= Q(**{f"{GB_FIELD}__icontains": s})
        return CapacidadModel.objects.filter(qcap & qsize).values_list("id", flat=True).first()


    # Mac Pro --------------------------------------------
    tnorm_lower = (modelo_norm or "").lower()
    is_macpro_word = bool(re.search(r"\bmac\s*pro\b", tnorm_lower))
    if (fam == "Mac Pro") or (is_macpro_word and fam in {None, "Mac"}):
        cores, freq = _extraer_nucleos_y_freq_intel(modelo_norm)
        qs = Modelo.objects.filter(tipo__iexact="Mac Pro")
        candidatos = list(qs.values("id", REL_NAME, "pantalla", "año", "procesador")[:200])
        if not candidatos:
            return None

        best = None
        best_score = -10**9
        for r in candidatos:
            es_torre = not bool(r.get("pantalla")) or ("pulgadas" not in (r.get(REL_NAME) or "").lower())
            sc = _score_macpro(
                r.get(REL_NAME) or "",
                a_number=a_number,
                anio=anio,
                cores=cores,
                freq=freq,
                es_torre=es_torre,
                want_cpu=cpu or "",
                want_gpu_cores=gpu_cores,
            )
            if sc > best_score:
                best_score, best = sc, r

        if best and best_score >= 4:
            modelo_id = best["id"]
            qcap = Q(**{f"{REL_FIELD}_id": modelo_id})
            qsize = Q()
            for s in _patterns_for_capacity(int(almacenamiento_gb)):
                qsize |= Q(**{f"{GB_FIELD}__icontains": s})
            cap = CapacidadModel.objects.filter(qcap & qsize).values_list("id", flat=True).first()
            if cap:
                return cap

    # Mac genérico ---------------------------------------
    if fam in {"MacBook Pro", "MacBook Air", "iMac", "iMac Pro", "Mac mini", "Mac Studio", "Mac Pro"}:
        # Ampliar tipos candidatos: hay instalaciones donde algunos "iMac Pro"/"Mac mini" están tipados como "Mac"
        type_candidates = {
            "MacBook Pro": ["MacBook Pro"],
            "MacBook Air": ["MacBook Air"],
            "iMac": ["iMac", "Mac"],
            "iMac Pro": ["iMac Pro", "iMac", "Mac"],
            "Mac mini": ["Mac mini", "Mac"],
            "Mac Studio": ["Mac Studio", "Mac"],
            "Mac Pro": ["Mac Pro", "Mac"],
        }.get(fam, [fam])
        qs = Modelo.objects.filter(tipo__in=type_candidates)
        def soft_filter(qs0, qexpr):
            qs1 = qs0.filter(qexpr)
            return qs1 if qs1.exists() else qs0
        want_cores = _cpu_cores_from_text_cpu_only(modelo_norm)
        if want_cores:
            qs = soft_filter(qs, Q(**{f"{REL_NAME}__iregex": rf"\b{want_cores}\s*-?\s*core\b"}))

        # Caso Mac mini 2023 A2686/A2816 (Likewize mezcla)
        if fam == "Mac mini" and (anio == 2023 or anio is None):
            if a_number and a_number.upper() in {"A2686", "A2816"}:
                q_any_a = (Q(**{f"{REL_NAME}__icontains": "A2686"}) |
                           Q(**{f"{REL_NAME}__icontains": "A2816"}))
                if cpu:
                    q_any_a &= (Q(procesador__icontains=cpu) | Q(**{f"{REL_NAME}__icontains": cpu}))
                qs = soft_filter(qs, q_any_a)

        if a_number:
            # A-number es identificador único: filtro DURO (no soft_filter)
            # Si no coincide el A-number, NO mapear
            q_anumber = Q(likewize_modelo__iexact=a_number) | Q(likewize_modelo__icontains=a_number)
            qs = qs.filter(q_anumber)
            # Si no hay resultados, retornar None inmediatamente
            if not qs.exists():
                return None

        if pulgadas and fam in {"MacBook Pro", "MacBook Air", "iMac", "iMac Pro"}:
            ptxt = _fmt_pulgadas(int(pulgadas))
            q_p = Q(pantalla__iexact=ptxt) | Q(**{f"{REL_NAME}__icontains": f"{pulgadas} pulgadas"})
            qs = soft_filter(qs, q_p)

        # Refuerzo: iMac Pro casi siempre es Xeon W — ayuda si el raw no lo trae
        if fam == "iMac Pro" and not cpu:
            cpu = "Xeon W"

        if cpu:
            q_cpu = Q(procesador__icontains=cpu) | Q(**{f"{REL_NAME}__icontains": cpu})
            qs = soft_filter(qs, q_cpu)

        skip_year = (fam == "MacBook Air" and (cpu or "").upper().startswith("M3"))
        if anio and not skip_year:
            q_year = Q(año=int(anio)) | Q(**{f"{REL_NAME}__icontains": str(anio)})
            qs = soft_filter(qs, q_year)

        if not qs.exists():
            qs = Modelo.objects.filter(tipo=fam)
        want_cpu_cores_lw = _cpu_cores_from_text_cpu_only(modelo_norm or "")
        want_gpu_cores_lw = gpu_cores or extraer_gpu_cores(modelo_norm or "")
        def mac_score(m, *, src_text: str):
            d = (getattr(m, REL_NAME, "") or "")
            likewize_field = (getattr(m, "likewize_modelo", "") or "")
            s = 0
            if a_number:
                # A-number es identificador único: DEBE coincidir en likewize_modelo
                # Coincidencia exacta en campo dedicado
                if likewize_field.upper() == a_number.upper():
                    s += 20
                # Contiene en campo dedicado (ej: "A1419 A1418")
                elif a_number.upper() in likewize_field.upper():
                    s += 15
                # NO coincide en likewize_modelo: DESCALIFICACIÓN TOTAL
                else:
                    s -= 10000  # Hace que este modelo nunca sea elegido
            if cpu and (cpu.lower() in (getattr(m, "procesador", "") or "").lower() or cpu.lower() in d.lower()):
                s += 4
            if gpu_cores and re.search(rf"\b{gpu_cores}\s*core\s*gpu\b", d, re.I):
                s += 4

            # Núcleos CPU: preferir coincidencia exacta, pero NO bloquear
            want_cpu_cores = _cpu_cores_from_text_cpu_only(src_text or "")
            have_cpu_cores = _cpu_cores_from_text_cpu_only(d)
            if want_cpu_cores and have_cpu_cores:
                if want_cpu_cores == have_cpu_cores:
                    s += 6
                else:
                    s -= 6  # penaliza, pero permite elegir si otras señales (A-number, pulgadas, año) son fuertes

            if pulgadas and (
                (_fmt_pulgadas(int(pulgadas)) or "").lower() == (getattr(m, "pantalla", "") or "").lower()
                or f"{pulgadas} pulgadas" in d.lower()
            ): s += 3
            if anio and (getattr(m, "año", None) == anio or str(anio) in d): s += 2
            s += min(len(d), 80) // 20
            return s
        
        modelos = list(qs[:50])
        if not modelos:
            return None
        modelos.sort(
            key=lambda m: (mac_score(m, src_text=modelo_norm), len(getattr(m, REL_NAME, "") or "")),
            reverse=True
        )
        # Probar varios candidatos hasta encontrar una capacidad disponible
        qsize = Q()
        for s in _patterns_for_capacity(int(almacenamiento_gb)):
            qsize |= Q(**{f"{GB_FIELD}__icontains": s})
        for modelo in modelos[:20]:
            qcap = Q(**{f"{REL_FIELD}_id": modelo.id})
            cap = CapacidadModel.objects.filter(qcap & qsize).values_list("id", flat=True).first()
            if cap:
                return cap
        return None

# ==========================
# Likewize
# ==========================
def obtener_cookies() -> dict[str, str]:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://appleb2bonlineesp.likewize.com/", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        cookies = page.context.cookies()
        browser.close()
        return {
            c["name"]: c["value"]
            for c in cookies
            if c["name"] in [
                "AWSELB",
                "AWSELBCORS",
                "incap_ses_255_2640985",
                "nlbi_2640985",
                "visid_incap_2640985",
            ]
        }


def obtener_modelos_por_categoria(cookies: dict[str, str], categoria_id: int, *, brand_id: int | None = None) -> list[dict]:
    if brand_id:
        url = "https://appleb2bonlineesp.likewize.com/Home.aspx/GetSelectedModels"
        payload = json.dumps({"productId": str(categoria_id), "brandId": str(brand_id)})
    else:
        url = "https://appleb2bonlineesp.likewize.com/Home.aspx/GetList"
        payload = json.dumps({"id": categoria_id})
    headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "Origin": "https://appleb2bonlineesp.likewize.com",
        "Referer": "https://appleb2bonlineesp.likewize.com/",
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
    }
    r = requests.post(url, headers=headers, cookies=cookies, data=payload, timeout=30)
    if not r.ok:
        return []
    data = r.json()
    if isinstance(data, dict) and "d" in data:
        data = data["d"]
    elif isinstance(data, str):
        data = json.loads(data)
    return data if isinstance(data, list) else []

def obtener_capacidades_por_master(cookies: dict[str, str], master_model_id: str | int) -> list[dict]:
    """
    Llama a https://appleb2bonlineesp.likewize.com/Home.aspx/GetSelectedCapacitys
    con {'masterModelId': '<id>'} y devuelve la lista de variantes (hijos) por capacidad.
    """
    url = "https://appleb2bonlineesp.likewize.com/Home.aspx/GetSelectedCapacitys"
    payload = json.dumps({"masterModelId": str(master_model_id)})
    headers = {
        "Content-Type": "application/json; charset=UTF-8",
        "Origin": "https://appleb2bonlineesp.likewize.com",
        "Referer": "https://appleb2bonlineesp.likewize.com/",
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
    }
    try:
        r = requests.post(url, headers=headers, cookies=cookies, data=payload, timeout=30)
        if not r.ok:
            return []
        data = r.json()
        if isinstance(data, dict) and "d" in data:
            data = data["d"]
        elif isinstance(data, str):
            data = json.loads(data)
        return data if isinstance(data, list) else []
    except Exception:
        return []
    
def _norm(s: str) -> str:
    return (s or "").strip().lower()

# Quita capacidad tipo 64GB/1 TB, códigos Google (GB7N6, GVU6C), 'Google', '5G', etc.
_GOOGLE_CODE_RE = re.compile(r'\b(?!A\d{4})(?=[A-Z0-9]{5,6}\b)[A-Z0-9]{5,6}\b')
_CAP_RE = re.compile(r'\b(\d+\s?TB|\d+\s?GB)\b', re.I)

def _limpia_capacidad(s: str) -> str:
    return _CAP_RE.sub('', s or '')

def _limpia_codigo_google(s: str) -> str:
    # Evita tocar A#### (Apple). El (?!A\d{4}) ya lo garantiza.
    return _GOOGLE_CODE_RE.sub('', s or '')

def normalizar_nombre_google(s: str) -> str:
    if not s:
        return ''
    out = s
    out = re.sub(r'^\s*Google\s+', '', out, flags=re.I)
    out = _limpia_capacidad(out)
    out = re.sub(r'\b5G\b', '', out, flags=re.I)
    out = re.sub(r'\bDual\s*SIM\b', '', out, flags=re.I)
    out = _limpia_codigo_google(out)
    out = re.sub(r'\s+', ' ', out).strip()
    return out

def normalizar_google(s: str) -> str:
    if not s:
        return ""
    out = s
    out = re.sub(r'^\s*Google\s+', '', out, flags=re.I)
    out = _CAP_RE.sub('', out)
    out = re.sub(r'\b5G\b', '', out, flags=re.I)
    out = re.sub(r'\bDual\s*SIM\b', '', out, flags=re.I)
    out = _GOOGLE_CODE_RE.sub('', out)
    out = re.sub(r'\s+', ' ', out).strip()
    return out

def normaliza_para_comparar(brand: str, name: str) -> str:
    b = (brand or "").lower()
    if b == "google":
        return _norm(normalizar_google(name))
    # Puedes añadir aquí normalizaciones por marca (Samsung, etc.)
    return _norm(name)

def precargar_indices_modelos():
    """
    Devuelve:
      - idx_likewize: {(brand_lower, likewize_modelo_lower): modelo_id}
      - idx_norm: {(brand_lower, normalizado): [modelo_id,...]}  (por si hay colisiones)
      - idx_master: {masterModelId: modelo_id}  (si tu modelo lo guarda)
    """
    idx_likewize = {}
    idx_norm = {}
    idx_master = {}
    # Sustituye 'Modelo' y campos por los reales:
    for m in Modelo.objects.all().only("id", "marca", "likewize_modelo"):
        brand_l = _norm(getattr(m, "marca", ""))
        lk = _norm(getattr(m, "likewize_modelo", ""))
        if brand_l and lk:
            idx_likewize[(brand_l, lk)] = m.id
            # índice normalizado:
            nk = normaliza_para_comparar(brand_l, lk)
            if nk:
                idx_norm.setdefault((brand_l, nk), []).append(m.id)

        # Si tienes el campo en tu modelo:
        master_id = getattr(m, "likewize_master_model_id", None)
        if master_id:
            idx_master[str(master_id)] = m.id
    return idx_likewize, idx_norm, idx_master

def resolver_modelo_desde_bd(brand: str, m_dict: dict,
                             idx_likewize, idx_norm, idx_master):
    """
    Aplica orden:
      1) likewize_modelo exacto (M_Model / MasterModelName)
      2) masterModelId (si lo tienes en BD)
      3) normalizado contra idx_norm
    """
    brand_l = _norm(brand)
    m_model = (m_dict.get("M_Model") or m_dict.get("MasterModelName") or "").strip()
    master_id = (m_dict.get("MasterModelId") or m_dict.get("masterModelId") or "")
    candidatos_texto = [m_model]
    # a veces ModelName encaja mejor que M_Model:
    model_name = (m_dict.get("ModelName") or "").strip()
    if model_name and model_name not in candidatos_texto:
        candidatos_texto.append(model_name)

    # 1) exacto por likewize_modelo
    for cand in candidatos_texto:
        key = (brand_l, _norm(cand))
        if key in idx_likewize:
            return idx_likewize[key], f"likewize_modelo='{cand}'"

    # 2) masterModelId
    if master_id:
        mid = str(master_id).strip()
        if mid in idx_master:
            return idx_master[mid], f"masterModelId={mid}"

    # 3) normalizado
    for cand in candidatos_texto:
        nk = normaliza_para_comparar(brand_l, cand)
        if (brand_l, nk) in idx_norm:
            ids = idx_norm[(brand_l, nk)]
            if len(ids) == 1:
                return ids[0], f"normalizado='{nk}'"
            # ambigüedad: elegir el primero y anotar
            return ids[0], f"normalizado_ambiguous='{nk}' ids={ids}"

    return None, "sin_match"


# ==========================
# Command
# ==========================
class Command(BaseCommand):
    help = "Descarga precios Likewize y llena staging para revisión (no aplica cambios)."

    def add_arguments(self, parser):
        parser.add_argument("--tarea", type=str, required=True)
        parser.add_argument("--mode", type=str, default="apple")
        parser.add_argument("--brands", nargs="*", type=str, default=None)
        parser.add_argument("--mapping_system", type=str, default="auto", choices=["v1", "v2", "v3", "v4", "auto"])

    @staticmethod
    def _map_with_v4_engine(device_data: dict, tarea_id: str = "") -> Optional[int]:
        """
        Intenta mapear dispositivo usando v4 engine (TDD-based system).

        Args:
            device_data: Diccionario con datos del dispositivo
            tarea_id: ID de la tarea de actualización

        Returns:
            capacidad_id si tiene éxito, None si falla
        """
        try:
            from productos.mapping.services.device_mapper_service import DeviceMapperService
            from productos.mapping.core.types import LikewizeInput
            from productos.models import DeviceMappingV2

            # Usar FullName como input principal (contiene toda la información)
            full_name = device_data.get('FullName', '') or device_data.get('ModelName', '')

            if not full_name:
                logger.warning("No hay FullName/ModelName para v4 engine")
                return None

            # Crear input para v4
            v4_input = LikewizeInput(
                model_name=full_name,
                m_model=device_data.get('M_Model', ''),
                full_name=full_name,
                capacity=device_data.get('Capacity', ''),
                device_price=None,
                brand_name=device_data.get('BrandName', 'Apple')
            )

            # Ejecutar v4 engine
            v4_service = DeviceMapperService()
            v4_result = v4_service.map(v4_input)

            if not v4_result.success:
                logger.debug(f"v4 engine no encontró match: {v4_result.error_message}")
                return None

            # Crear DeviceMappingV2 para auditoría
            device_signature = f"{full_name}|{device_data.get('Capacity_GB', 0)}"
            import hashlib
            device_signature = hashlib.md5(device_signature.encode()).hexdigest()

            try:
                DeviceMappingV2.objects.create(
                    device_signature=device_signature,
                    source_data=device_data,
                    source_type='mac' if 'mac' in full_name.lower() else 'ios',
                    extracted_a_number=device_data.get('A_Number', ''),
                    extracted_model_name=full_name,
                    extracted_cpu=device_data.get('CPU', ''),
                    extracted_year=device_data.get('Year'),
                    extracted_capacity_gb=device_data.get('Capacity_GB'),
                    extracted_screen_size=device_data.get('ScreenSize'),
                    mapped_capacity_id=v4_result.matched_capacidad_id,
                    confidence_score=int(v4_result.match_score * 100),
                    mapping_algorithm=f"v4_{v4_result.match_strategy.value}" if v4_result.match_strategy else "v4",
                    decision_path=[{
                        "strategy": "v4_engine",
                        "success": True,
                        "confidence": int(v4_result.match_score * 100)
                    }],
                    candidates_considered=[{
                        "capacity_id": v4_result.matched_capacidad_id,
                        "model_description": v4_result.matched_modelo_descripcion
                    }],
                    rejection_reasons=[],
                    processing_time_ms=0,
                    needs_review=v4_result.match_score < 0.60
                )
            except Exception as e:
                # Si falla crear el mapping record, continuar (no crítico)
                logger.debug(f"No se pudo crear DeviceMappingV2: {str(e)}")

            logger.info(
                f"v4 mapping exitoso: {full_name} -> "
                f"{v4_result.matched_capacidad_id} (confianza: {v4_result.match_score:.2f})"
            )

            return v4_result.matched_capacidad_id

        except ImportError as e:
            logger.warning(f"v4 engine no disponible: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error usando v4 engine: {str(e)}", exc_info=True)
            return None

    @staticmethod
    def _format_capacity_for_v2(gb_value):
        """
        Formatea capacidad en GB a string con unidad para servicios V2.

        Args:
            gb_value: Capacidad en GB (int o None)

        Returns:
            String formateado: "512GB", "1TB", etc.
        """
        if not gb_value:
            return ""

        gb_value = int(gb_value)

        # Convertir a TB si >= 1024
        if gb_value >= 1024:
            tb = gb_value / 1024
            # Si es TB entero (1TB, 2TB), mostrar sin decimales
            if tb == int(tb):
                return f"{int(tb)}TB"
            # Si tiene decimales (1.5TB), mostrarlos
            return f"{tb}TB"

        # Menor a 1TB: mostrar en GB
        return f"{gb_value}GB"

    def handle(self, *args, **opts):
        tarea = TareaActualizacionLikewize.objects.get(pk=opts["tarea"])
        tarea.estado = "RUNNING"
        tarea.iniciado_en = timezone.now()
        tarea.save()

        # Paths y logger
        stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        base_dir = Path(settings.MEDIA_ROOT) / "likewize" / stamp
        base_dir.mkdir(parents=True, exist_ok=True)
        log_path = base_dir / "log.txt"
        tarea.log_path = str(log_path)
        tarea.save(update_fields=["log_path"])

        logger = logging.getLogger(f"likewize.{tarea.id}")
        logger.setLevel(logging.INFO)
        logger.handlers.clear()
        fh = logging.FileHandler(log_path, encoding="utf-8")
        fh.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
        logger.addHandler(fh)
        logger.propagate = False

        def log(msg: str):
            logger.info(msg)
        idx_likewize, idx_norm, idx_master = precargar_indices_modelos()
        try:
            log("🚀 Descargando Likewize…")
            set_progress(tarea, 5, "Iniciando navegador")

            cookies = obtener_cookies()
            if not cookies:
                raise RuntimeError("No se pudieron obtener cookies.")
            log("🔑 Cookies obtenidas")
            set_progress(tarea, 15, "Cookies obtenidas")

            # Cargar equivalencias
            equivalencias_csv = getattr(settings, "EQUIVALENCIAS_CSV", "")
            equivalencias = cargar_equivalencias(equivalencias_csv)

            mode = (opts.get("mode") or "apple").lower()
            raw_brands = opts.get("brands") or []
            brand_filter = {
                b.strip().lower()
                for b in raw_brands
                if isinstance(b, str) and b.strip()
            }

            if mode == "others":
                presets_source = get_extra_presets()
            else:
                presets_source = get_apple_presets()

            presets = [p for p in presets_source if p.get("product_id")]
            if brand_filter:
                log("Filtrando marcas: " + ", ".join(sorted(brand_filter)))
                presets = [
                    p for p in presets
                    if (p.get("marca") or "").strip().lower() in brand_filter
                ]

            if not presets:
                raise RuntimeError("No hay categorías configuradas para la actualización solicitada.")

            used_brands = sorted({
                (preset.get("marca") or "").strip()
                for preset in presets
                if (preset.get("marca") or "").strip()
            })
            if hasattr(tarea, "meta"):
                try:
                    meta = dict(tarea.meta or {})
                    meta.update({"mode": mode, "brands": used_brands})
                    tarea.meta = meta
                    tarea.save(update_fields=["meta"])
                except Exception:
                    pass

            if not presets:
                raise RuntimeError("No hay categorías configuradas para la actualización solicitada.")

            # Descargar y normalizar
            modelos_totales: list[dict] = []
            capacidades_cache: dict[str, list[dict]] = {}
            total_cats = len(presets)

            for i, preset in enumerate(presets, start=1):
                product_id = int(preset.get("product_id"))
                brand_id = preset.get("brand_id")
                tipo = (preset.get("tipo") or "SmartPhone").strip() or "SmartPhone"
                marca_por_defecto = (preset.get("marca") or "Apple").strip() or "Apple"
                allowed_m_models_raw = [
                    (code or "").strip()
                    for code in (preset.get("allowed_m_models") or [])
                    if (code or "").strip()
                ]
                excluded_m_models_raw = [
                    (code or "").strip()
                    for code in (preset.get("exclude_m_models") or [])
                    if (code or "").strip()
                ]
                allowed_m_models = {code.upper() for code in allowed_m_models_raw}
                excluded_m_models = {code.upper() for code in excluded_m_models_raw}
                allowed_m_model_suffixes = {code.split()[-1].upper() for code in allowed_m_models_raw}
                excluded_m_model_suffixes = {code.split()[-1].upper() for code in excluded_m_models_raw}
                allowed_m_model_patterns: list[re.Pattern] = []
                for raw in preset.get("allowed_m_model_regex") or []:
                    try:
                        allowed_m_model_patterns.append(re.compile(raw))
                    except re.error as exc:
                        log(f"⚠️ Patrón allow M_MODEL inválido '{raw}': {exc}")
                excluded_m_model_patterns: list[re.Pattern] = []
                for raw in preset.get("exclude_m_model_regex") or []:
                    try:
                        excluded_m_model_patterns.append(re.compile(raw))
                    except re.error as exc:
                        log(f"⚠️ Patrón exclude M_MODEL inválido '{raw}': {exc}")
                allowed_model_name_patterns: list[re.Pattern] = []
                for raw in preset.get("allowed_model_name_regex") or []:
                    try:
                        allowed_model_name_patterns.append(re.compile(raw, re.I))
                    except re.error as exc:
                        log(f"⚠️ Patrón allow ModelName inválido '{raw}': {exc}")
                excluded_model_name_patterns: list[re.Pattern] = []
                for raw in preset.get("exclude_model_name_regex") or []:
                    try:
                        excluded_model_name_patterns.append(re.compile(raw, re.I))
                    except re.error as exc:
                        log(f"⚠️ Patrón exclude ModelName inválido '{raw}': {exc}")
                set_progress(
                    tarea,
                    15 + int(70 * (i - 1) / total_cats),
                    f"Procesando {marca_por_defecto} {tipo} ({i}/{total_cats})"
                )
                arr = obtener_modelos_por_categoria(cookies, product_id, brand_id=brand_id)
                # Para marcas con brandId (p.ej. Google): bajar variantes por capacidad
                if brand_id:
                    seen_ids: set[int] = set()
                    expanded: list[dict] = []
                    for m in arr or []:
                        mmid = (m.get("MasterModelId") or m.get("masterModelId") or m.get("MasterModelID") or "")
                        mmid = str(mmid).strip()
                        if mmid:
                            hijos = obtener_capacidades_por_master(cookies, mmid)
                            if hijos:
                                for h in hijos:
                                    pid = h.get("PhoneModelId") or h.get("ModelId") or h.get("Id")
                                    try:
                                        key = int(pid) if pid is not None else None
                                    except Exception:
                                        key = None
                                    if key is not None and key in seen_ids:
                                        continue
                                    if key is not None:
                                        seen_ids.add(key)
                                    expanded.append(h)
                                continue
                        # fallback: si no hay hijos, conservar el maestro
                        expanded.append(m)
                    log(f"↗️ Expandido por capacidad: {len(arr)} → {len(expanded)} filas ({marca_por_defecto} {tipo})")
                    arr = expanded
                log(f"✅ {len(arr)} modelos {marca_por_defecto} {tipo}")

                for m in arr:
                    nombre_raw = (m.get("ModelName") or m.get("FullName") or "").strip()
                    if not nombre_raw:
                        continue
                    brand_name = (m.get("BrandName") or "").strip()

                    modelo_id, motivo = resolver_modelo_desde_bd(
                        brand=brand_name,
                        m_dict=m,
                        idx_likewize=idx_likewize,
                        idx_norm=idx_norm,
                        idx_master=idx_master,
                    )
                    m["__modelo_id_resuelto"] = modelo_id
                    m["__motivo_mapeo"] = motivo
                    brand_name = (m.get("BrandName") or "").strip()
                    m_model     = (m.get("M_Model") or m.get("MasterModelName") or "").strip()
                    full_name   = (m.get("FullName") or nombre_raw).strip()
                    capacity    = (m.get("Capacity") or "").strip()   # "128GB", "256GB", etc.

                    # Normalización para mapear a tu catálogo base (Pixel 6, Pixel 7, ...)
                    if (brand_name or '').lower() == 'google':
                        base_key = normalizar_nombre_google(m_model or nombre_raw)
                    else:
                        base_key = nombre_raw  # otras marcas usan su flujo habitual

                    # Ejemplo: "Pixel 6 GB7N6" -> "Pixel 6"
                    #         "Pixel 7 GVU6C 256GB" -> "Pixel 7"

                    # A partir de aquí, puedes usar 'base_key' para cruzar con tus modelos internos.
                    # Por ejemplo, guardar en staging:
                    m['__modelo_base_normalizado'] = base_key
                    m['__capacity_normalizada']    = capacity

                    # (tu lógica existente de guardado sigue igual, sólo añades estas claves si te ayudan)
                    m_model_raw = (m.get("M_Model") or "").strip()
                    m_model_upper = m_model_raw.upper()
                    m_model_suffix = m_model_raw.split()[-1].upper() if m_model_raw else ""

                    if allowed_m_models and (m_model_upper not in allowed_m_models and m_model_suffix not in allowed_m_models):
                        continue
                    if allowed_m_model_suffixes and m_model_suffix and m_model_suffix not in allowed_m_model_suffixes:
                        continue
                    if allowed_m_model_patterns and not any(pattern.search(m_model_raw) for pattern in allowed_m_model_patterns):
                        continue
                    if excluded_m_models and (m_model_upper in excluded_m_models or m_model_suffix in excluded_m_models or m_model_suffix in excluded_m_model_suffixes):
                        continue
                    if excluded_m_model_patterns and any(pattern.search(m_model_raw) for pattern in excluded_m_model_patterns):
                        continue
                    if allowed_model_name_patterns and not any(pattern.search(nombre_raw) for pattern in allowed_model_name_patterns):
                        continue
                    if excluded_model_name_patterns and any(pattern.search(nombre_raw) for pattern in excluded_model_name_patterns):
                        continue

                    # IMPORTANTE: Usar M_Model (sin capacidad) para modelo_norm en lugar de FullName
                    # Esto mejora el mapeo fuzzy al comparar solo nombres de modelo sin la capacidad
                    # Ej: "iPad Pro 12.9'' Wi-Fi" en lugar de "iPad Pro 12.9'' Wi-Fi 32GB"
                    m_model_for_norm = (m.get("M_Model") or m.get("MasterModelName") or nombre_raw).strip()
                    s = norm_modelo(m_model_for_norm)

                    marca = (m.get("BrandName") or marca_por_defecto).strip() or marca_por_defecto
                    product_category = (m.get("ProductCategoryName") or tipo).strip() or tipo
                    capacidad_raw = m.get("Capacity") or ""
                    storage_gb = (extraer_storage_gb(nombre_raw)
                                  or extraer_storage_gb(capacidad_raw)
                                  or extraer_storage_gb(m.get("FullName") or ""))

                    master_id = (m.get("MasterModelId") or m.get("MasterModelID") or "").strip()
                    variant_price: Decimal | None = None
                    if master_id:
                        cache_key = str(master_id)
                        capacity_rows = capacidades_cache.get(cache_key)
                        if capacity_rows is None:
                            capacity_rows = obtener_capacidades_por_master(cookies, master_id)
                            capacidades_cache[cache_key] = capacity_rows or []
                        for row in capacity_rows or []:
                            cap_text = (row.get("Capacity") or row.get("CapacityName") or "").strip()
                            cap_gb = extraer_storage_gb(cap_text) or extraer_storage_gb(row.get("ModelName") or "")
                            if storage_gb is None and cap_gb:
                                storage_gb = cap_gb
                            if storage_gb and cap_gb and cap_gb == storage_gb:
                                try:
                                    variant_price = Decimal(str(row.get("ModelValue")))
                                except Exception:
                                    variant_price = None
                                break
                        if variant_price is None and capacity_rows:
                            head = capacity_rows[0]
                            try:
                                variant_price = Decimal(str(head.get("ModelValue")))
                            except Exception:
                                variant_price = None

                    precio_raw = m.get("DevicePrice")
                    precio_decimal = Decimal("0")
                    if variant_price is not None:
                        precio_decimal = variant_price
                    elif precio_raw not in (None, ""):
                        try:
                            precio_decimal = Decimal(str(precio_raw))
                        except Exception:
                            precio_decimal = Decimal("0")

                    modelos_totales.append({
                        "tipo": product_category,
                        "marca": marca,
                        "modelo_raw": nombre_raw,
                        "likewize_model_code": m_model_raw,  # Código completo, no solo sufijo
                        "likewize_model_code_raw": m_model_raw,
                        "likewize_modelo": m_model_raw,
                        "modelo_norm": s,
                        "almacenamiento_gb": storage_gb,
                        "pulgadas": extraer_pulgadas(nombre_raw),   # usar RAW para 'inch'
                        "any": extraer_anio(nombre_raw),            # <-- campo 'any' en tu modelo
                        "a_number": extraer_a_number(nombre_raw) or "",
                        "cpu": extraer_cpu(nombre_raw),
                        "gpu_cores": extraer_gpu_cores(nombre_raw),
                        "disco": ("SSD" if re.search(r"\bSSD\b", s)
                                  else ("Fusion Drive" if re.search(r"Fusion Drive", s, flags=re.I) else "")),
                        "precio_b2b": precio_decimal,
                    })

                set_progress(
                    tarea,
                    15 + int(70 * i / total_cats),
                    f"{marca_por_defecto} {tipo} listo ({i}/{total_cats})"
                )

            set_progress(tarea, 90, "Guardando staging")

            # Llenar staging (con capacidad_id resuelta)
            LikewizeItemStaging.objects.filter(tarea=tarea).delete()

            # Determine mapping system to use
            mapping_system = opts.get("mapping_system", "auto")
            logger.info(f"Sistema de mapeo seleccionado: {mapping_system}")

            # Initialize services based on selected system
            v2_service = None
            v3_service = None
            use_v4_mapping = False

            if mapping_system in ["v2", "auto"]:
                mapping_v2_enabled = getattr(settings, 'MAPPING_V2_ENABLED', False)
                if mapping_v2_enabled:
                    try:
                        from productos.services.device_mapping_v2_service import DeviceMappingV2Service
                        v2_service = DeviceMappingV2Service()
                        logger.info("V2 mapping service disponible")
                    except ImportError:
                        logger.warning("DeviceMappingV2Service no disponible")

            if mapping_system in ["v3", "auto"]:
                try:
                    from productos.services.auto_learning_engine_v3 import AutoLearningEngineV3
                    v3_service = AutoLearningEngineV3()
                    logger.info("V3 mapping service disponible")
                except ImportError:
                    logger.warning("AutoLearningEngineV3 no disponible")

            if mapping_system in ["v4", "auto"]:
                # v4 se maneja directamente con _map_with_v4_engine
                use_v4_mapping = True
                logger.info("V4 mapping engine habilitado")

            objs = []
            no_mapeados = 0
            mapping_stats = {
                "v4_success": 0,
                "v3_success": 0,
                "v2_success": 0,
                "v1_success": 0,
                "failed": 0
            }

            for x in modelos_totales:
                cap_id = None
                used_system = None

                # Prepare device data for all systems
                device_data = {
                    'M_Model': x["modelo_norm"],
                    'MasterModelName': x["modelo_norm"],
                    'ModelName': x.get("modelo_norm", ""),
                    'FullName': x.get("modelo_raw", ""),
                    'Capacity': self._format_capacity_for_v2(x.get("almacenamiento_gb", 0)),
                    'BrandName': x.get("marca", "Apple"),
                    'ProductCategoryName': x.get("tipo", ""),
                    'ModelValue': str(x.get("precio_b2b", "0")),
                }

                # Add extracted information to device_data
                if x.get("a_number"):
                    device_data['A_Number'] = x["a_number"]
                if x.get("pulgadas"):
                    device_data['ScreenSize'] = x["pulgadas"]
                if x.get("any"):
                    device_data['Year'] = x["any"]
                if x.get("cpu"):
                    device_data['CPU'] = x["cpu"]
                if x.get("gpu_cores"):
                    device_data['GPU_Cores'] = x["gpu_cores"]
                if x.get("almacenamiento_gb"):
                    device_data['Capacity_GB'] = x["almacenamiento_gb"]

                # Cascading fallback strategy: v4 → v3 → v2 → v1
                if mapping_system == "v1":
                    # Explicit v1 only
                    cap_id = resolver_capacidad_id(
                        modelo_norm=x["modelo_norm"],
                        almacenamiento_gb=x["almacenamiento_gb"],
                        equivalencias=equivalencias,
                        a_number=(x["a_number"] or None),
                        pulgadas=x["pulgadas"],
                        anio=x["any"],
                        cpu=x["cpu"] or "",
                        gpu_cores=x.get("gpu_cores"),
                        tipo=x["tipo"],
                        marca=x.get("marca"),
                        likewize_code=x.get("likewize_model_code"),
                        likewize_code_raw=x.get("likewize_modelo") or x.get("likewize_model_code_raw"),
                    )
                    used_system = "v1" if cap_id else None

                elif mapping_system == "v2":
                    # Explicit v2 only
                    if v2_service:
                        try:
                            mapping_result = v2_service.map_single_device(device_data, str(tarea.id))
                            cap_id = mapping_result.mapped_capacity_id if mapping_result else None
                            used_system = "v2" if cap_id else None
                        except Exception as e:
                            logger.error(f"Error using V2 mapping: {str(e)}")

                elif mapping_system == "v3":
                    # Explicit v3 only
                    if v3_service:
                        try:
                            cap_id = v3_service.mapear_dispositivo(
                                modelo_likewize=x["modelo_raw"],
                                almacenamiento_gb=x["almacenamiento_gb"]
                            )
                            used_system = "v3" if cap_id else None
                        except Exception as e:
                            logger.error(f"Error using V3 mapping: {str(e)}")

                elif mapping_system == "v4":
                    # Explicit v4 only
                    if use_v4_mapping:
                        try:
                            cap_id = self._map_with_v4_engine(device_data, str(tarea.id))
                            used_system = "v4" if cap_id else None
                        except Exception as e:
                            logger.error(f"Error using V4 mapping: {str(e)}")

                elif mapping_system == "auto":
                    # Auto: Try v4 → v3 → v2 → v1 with fallback

                    # Try v4 first
                    if use_v4_mapping and not cap_id:
                        try:
                            cap_id = self._map_with_v4_engine(device_data, str(tarea.id))
                            if cap_id:
                                used_system = "v4"
                        except Exception as e:
                            logger.debug(f"V4 failed, trying v3: {str(e)}")

                    # Try v3 fallback
                    if v3_service and not cap_id:
                        try:
                            cap_id = v3_service.mapear_dispositivo(
                                modelo_likewize=x["modelo_raw"],
                                almacenamiento_gb=x["almacenamiento_gb"]
                            )
                            if cap_id:
                                used_system = "v3"
                        except Exception as e:
                            logger.debug(f"V3 failed, trying v2: {str(e)}")

                    # Try v2 fallback
                    if v2_service and not cap_id:
                        try:
                            mapping_result = v2_service.map_single_device(device_data, str(tarea.id))
                            cap_id = mapping_result.mapped_capacity_id if mapping_result else None
                            if cap_id:
                                used_system = "v2"
                        except Exception as e:
                            logger.debug(f"V2 failed, trying v1: {str(e)}")

                    # Try v1 fallback
                    if not cap_id:
                        cap_id = resolver_capacidad_id(
                            modelo_norm=x["modelo_norm"],
                            almacenamiento_gb=x["almacenamiento_gb"],
                            equivalencias=equivalencias,
                            a_number=(x["a_number"] or None),
                            pulgadas=x["pulgadas"],
                            anio=x["any"],
                            cpu=x["cpu"] or "",
                            gpu_cores=x.get("gpu_cores"),
                            tipo=x["tipo"],
                            marca=x.get("marca"),
                            likewize_code=x.get("likewize_model_code"),
                            likewize_code_raw=x.get("likewize_modelo") or x.get("likewize_model_code_raw"),
                        )
                        if cap_id:
                            used_system = "v1"

                # Track statistics
                if used_system:
                    mapping_stats[f"{used_system}_success"] += 1
                else:
                    mapping_stats["failed"] += 1
                    
                if not cap_id:
                    no_mapeados += 1

                objs.append(
                    LikewizeItemStaging(
                        tarea=tarea,
                        tipo=x["tipo"],
                        marca=x.get("marca", "Apple"),
                        modelo_raw=x["modelo_raw"],
                        likewize_model_code=x.get("likewize_model_code", ""),
                        modelo_norm=x["modelo_norm"],
                        almacenamiento_gb=x["almacenamiento_gb"] or 0,
                        precio_b2b=x["precio_b2b"],
                        capacidad_id=cap_id,
                        pulgadas=x["pulgadas"],
                        any=x["any"],             # <-- campo 'any' en tu modelo
                        a_number=x["a_number"],
                        cpu=x["cpu"],
                        disco=x["disco"],
                    )
                )

            LikewizeItemStaging.objects.bulk_create(objs, ignore_conflicts=True)

            try:
                from collections import defaultdict

                def _year(row):
                    return row.get("any") or row.get("año") or row.get("year")

                def _device_key(row):
                    return (row.get("a_number") or "",
                            row.get("pulgadas"),
                            _year(row))

                def _cap_key(row):
                    return _device_key(row) + (int(row.get("almacenamiento_gb") or 0),)

                def _variant_sig(row):
                    return (row.get("cpu") or "", row.get("gpu_cores"))

                # --- STAGING (S) ---
                S_rows = list(
                    LikewizeItemStaging.objects
                    .filter(tarea=tarea)
                    .values("a_number", "pulgadas", "any", "almacenamiento_gb", "cpu")
                )

                S_caps = set()
                S_by_dev_caps = defaultdict(set)
                S_by_dev_capsig = defaultdict(lambda: defaultdict(set))
                for r in S_rows:
                    k = _cap_key(r)
                    S_caps.add(k)
                    dev = _device_key(r)
                    gb = int(r.get("almacenamiento_gb") or 0)
                    S_by_dev_caps[dev].add(gb)
                    S_by_dev_capsig[dev][gb].add(_variant_sig(r))

                # --- OFICIAL/BD (E) ---
                fam_ok = {"iPhone", "iPad", "Mac", "MacBook Pro", "MacBook Air", "iMac", "Mac mini", "Mac Studio", "Mac Pro"}
                caps_qs = (CapacidadModel.objects
                           .select_related(REL_FIELD)
                           .filter(**{f"{REL_FIELD}__tipo__in": list(fam_ok)}))

                def _parse_gb(txt):
                    return extraer_storage_gb(txt or "")

                def _pulgadas_from_model(m):
                    # usa pantalla si está, si no re-usa la descripción
                    base = (getattr(m, "pantalla", "") or "")
                    if base:
                        m_ = re.search(r"(\d{1,2})", base)
                        if m_:
                            try:
                                return int(m_.group(1))
                            except:  # noqa: E722
                                pass
                    return extraer_pulgadas(getattr(m, REL_NAME, "") or "")

                E_rows = []
                for cap in caps_qs:
                    m = getattr(cap, REL_FIELD)
                    descr = getattr(m, REL_NAME, "") or ""
                    E_rows.append({
                        "cap_id": cap.id,
                        "a_number": extraer_a_number(descr),
                        "pulgadas": _pulgadas_from_model(m),
                        "any": getattr(m, "año", None),
                        "almacenamiento_gb": _parse_gb(getattr(cap, GB_FIELD, "") or ""),
                        "cpu": (getattr(m, "procesador", "") or ""),
                        "gpu_cores": extraer_gpu_cores(descr),
                    })

                E_caps = set()
                E_by_dev_caps = defaultdict(set)
                E_by_dev_capsig = defaultdict(lambda: defaultdict(set))
                E_cap_to_id = {}
                for r in E_rows:
                    k = _cap_key(r)
                    E_caps.add(k)
                    E_cap_to_id.setdefault(k, []).append(r["cap_id"])
                    dev = _device_key(r)
                    gb = int(r.get("almacenamiento_gb") or 0)
                    E_by_dev_caps[dev].add(gb)
                    E_by_dev_capsig[dev][gb].add(_variant_sig(r))

                # --- Conjuntos ---
                delete_caps = E_caps - S_caps
                insert_caps = S_caps - E_caps

                # --- Clasificación ---
                A1, A2, A2_star, B_cap, C_dev = [], [], [], [], []

                S_devices = set(S_by_dev_caps.keys())
                E_devices = set(E_by_dev_caps.keys())

                for cap in delete_caps:
                    dev = cap[:3]   # (a_number, pulgadas, año)
                    gb = cap[3]
                    if dev not in S_devices:
                        A1.append(cap)  # Likewize ya no trae el dispositivo entero
                    else:
                        if gb not in S_by_dev_caps[dev]:
                            A2.append(cap)  # el dispositivo está, pero falta esa capacidad en S
                        else:
                            # misma capacidad pero distinta variante (cpu/gpu cores)
                            if S_by_dev_capsig[dev][gb] != E_by_dev_capsig[dev][gb]:
                                A2_star.append(cap)
                            else:
                                A2.append(cap)

                for cap in insert_caps:
                    dev = cap[:3]
                    if dev in E_devices:
                        B_cap.append(cap)  # me falta capacidad en BD
                    else:
                        C_dev.append(cap)  # me falta dispositivo en BD

                def _fmt_cap(cap):
                    a, p, y, gb = cap
                    ids = E_cap_to_id.get(cap, [])
                    suf = f"  (cap_id={ids[0]})" if ids else ""
                    return f"A={a or '-'} · {p or '-'}\" · {y or '-'} · {gb}GB{suf}"

                # --- Log resumen + muestras ---
                print("\n=== POST-STAGING: Conjuntos S vs E ===")
                print(f"S_caps={len(S_caps)}  E_caps={len(E_caps)}  DELETEs(E\\S)={len(delete_caps)}  INSERTs(S\\E)={len(insert_caps)}")
                print("\n=== CLASIFICACIÓN DETALLADA ===")
                print(f"A1 (E\\S) falta dispositivo entero en S: {len(A1)}")
                for cap in A1[:30]:
                    print("  - " + _fmt_cap(cap))

                print(f"\nA2 (E\\S) falta capacidad en S: {len(A2)}")
                for cap in A2[:30]:
                    print("  - " + _fmt_cap(cap))

                print(f"\nA2* (E\\S) misma capacidad pero variante/cores distinta: {len(A2_star)}")
                for cap in A2_star[:30]:
                    print("  - " + _fmt_cap(cap))

                print(f"\nB (S\\E) me falta capacidad en BD: {len(B_cap)}")
                for cap in B_cap[:30]:
                    print("  - " + _fmt_cap(cap))

                print(f"\nC (S\\E) me falta dispositivo en BD: {len(C_dev)}")
                for cap in C_dev[:30]:
                    print("  - " + _fmt_cap(cap))

            except Exception as _e:
                print(f"⚠️ Error en diff/clasificación S vs E: {type(_e).__name__}: {_e}")
            # 👆 HASTA AQUÍ

            tarea.total_modelos = len(modelos_totales)
            tarea.finalizado_en = timezone.now()
            tarea.estado = "SUCCESS"
            set_progress(tarea, 100, "Listo para revisar cambios")
            tarea.save()

            # Log mapping statistics
            total_mapped = sum(mapping_stats[k] for k in ["v4_success", "v3_success", "v2_success", "v1_success"])
            log(f"📊 Estadísticas de mapeo (sistema: {mapping_system}):")
            log(f"   ✅ V4: {mapping_stats['v4_success']} dispositivos")
            log(f"   ✅ V3: {mapping_stats['v3_success']} dispositivos")
            log(f"   ✅ V2: {mapping_stats['v2_success']} dispositivos")
            log(f"   ✅ V1: {mapping_stats['v1_success']} dispositivos")
            log(f"   Total mapeados: {total_mapped}/{len(modelos_totales)}")
            log(f"ℹ️ Items no mapeados a capacidad_id: {no_mapeados}")
            log("✅ Staging completado. Listo para comparar y aplicar desde UI.")
            st_rows = list(
                LikewizeItemStaging.objects
                .filter(tarea=tarea, capacidad_id__isnull=False)
                .values("modelo_raw", "capacidad_id")
            )
            cap_ids_stage = {r["capacidad_id"] for r in st_rows if r["capacidad_id"]}
            cap_info_map_stage = _build_cap_info_map(cap_ids_stage)

            matches = []
            for r in st_rows:
                cap_id = r["capacidad_id"]
                info = cap_info_map_stage.get(cap_id)
                if not info:
                    continue
                matches.append({
                    "likewize_nombre": r["modelo_raw"],
                    "bd_modelo": info["bd_modelo"],
                    "bd_capacidad": info["bd_capacidad"],
                    "capacidad_id": cap_id,
                })

            # ======== Construir 'no_cazados_bd' (capacidad en BD que NO apareció en staging) ========
            fam_ok = {
                "iPhone", "iPad", "Mac", "MacBook Pro", "MacBook Air",
                "iMac", "Mac mini", "Mac Studio", "Mac Pro"
            }
            db_cap_ids = set(
                CapacidadModel.objects
                .filter(**{f"{REL_FIELD}__tipo__in": list(fam_ok)})
                .values_list("id", flat=True)
            )
            no_cazados_ids = db_cap_ids - cap_ids_stage
            cap_info_map_db = _build_cap_info_map(no_cazados_ids)

            no_cazados_bd = []
            for cid in sorted(no_cazados_ids):
                info = cap_info_map_db.get(cid)
                if not info:
                    continue
                no_cazados_bd.append({
                    "bd_modelo": info["bd_modelo"],
                    "bd_capacidad": info["bd_capacidad"],
                    "capacidad_id": cid,
                })

            # ======== Guardar resumen de cazado para el endpoint ========
            # Cargar también los NO CAZADOS de Likewize (staging sin capacidad_id)
            lw_no_cazados_rows = list(
                LikewizeItemStaging.objects
                .filter(tarea=tarea, capacidad_id__isnull=True)
                .values("modelo_raw")
            )
            no_cazados_likewize = [
                {"likewize_nombre": r.get("modelo_raw") or ""}
                for r in lw_no_cazados_rows
            ]

            # Total normalizado = filas en staging (tras unique_together)
            total_norm = LikewizeItemStaging.objects.filter(tarea=tarea).count()

            save_cazado_result(
                tarea_uuid=str(tarea.id),
                total_likewize=total_norm,
                matches=matches,
                no_cazados_bd=no_cazados_bd,
                no_cazados_likewize=no_cazados_likewize,
                status="done",
                meta={
                    "staging_rows": total_norm,
                    "no_mapeados": no_mapeados,
                    "tarea_id": str(tarea.id),
                },
            )

        except Exception as e:
            tarea.estado = "ERROR"
            tarea.error_message = f"{type(e).__name__}: {e}"
            tarea.finalizado_en = timezone.now()
            tarea.save()
            log(f"❌ ERROR: {e}")
            raise
