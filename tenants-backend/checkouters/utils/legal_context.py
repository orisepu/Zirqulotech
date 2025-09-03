from django.conf import settings
from django.utils import timezone
from zoneinfo import ZoneInfo
from django.utils.formats import date_format


def build_legal_context(contrato, overlay: dict) -> dict:
    datos = getattr(contrato, "contrato_datos", {}) or {}
    tz = ZoneInfo(getattr(settings, "DEFAULT_LEGAL_TZ", "Europe/Madrid"))
    now_local = timezone.localtime(timezone.now(), tz)
    fecha_corta = now_local.strftime("%d/%m/%Y")
    hora_corta  = now_local.strftime("%H:%M")
    # Requiere LANGUAGE_CODE='es' y l10n activado para el mes en español:
    fecha_larga = date_format(now_local, "j \\d\\e F \\d\\e Y", use_l10n=True)

    ctx = {
        "empresa": overlay.get("empresa", {}) or datos.get("empresa", {}),
        "cliente": datos.get("cliente", {}),
        "contrato": {
            "id": contrato.id,
            "tipo": getattr(contrato, "tipo", ""),
            "fecha": now_local
        },
        "oportunidad_id": getattr(contrato, "oportunidad_id", ""),
        "dispositivos": datos.get("dispositivos") or datos.get("dispositivos_estimados") or [],
        "now": now_local,              # por si lo necesitas como datetime
        "fecha": fecha_corta,          # "16/08/2025"
        "hora": hora_corta,            # "13:29"
        "fecha_larga": fecha_larga,    # "16 de agosto de 2025"

        
    }
    # “overlay” pisa claves de ctx de arriba si las trajeras también ahí
    # (si no lo quieres, elimina esta línea)
    ctx = {**ctx, **overlay}
    return ctx
