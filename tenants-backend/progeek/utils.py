from django_tenants.utils import schema_context
from django.core.mail import send_mail
from django.template import Template, Context
from checkouters.models.dispositivo import Dispositivo  # ← ajustado a tu estructura
from progeek.models import PlantillaCorreo
import re

def cargar_estado_cliente(dispositivo_id, tenant_slug):
    with schema_context(tenant_slug):
        try:
            dispositivo = Dispositivo.objects.get(id=dispositivo_id)
            return {
                "estado_fisico_cliente": dispositivo.estado_fisico,
                "estado_funcional_cliente": dispositivo.estado_funcional,
            }
        except Dispositivo.DoesNotExist:
            return {
                "estado_fisico_cliente": None,
                "estado_funcional_cliente": None,
            }
        
def detectar_variables(texto: str) -> list[str]:
    return list(set(re.findall(r'{{\s*(\w+)\s*}}', texto)))

def render_plantilla(texto: str, contexto: dict) -> str:
    try:
        variables_esperadas = detectar_variables(texto)
        faltantes = [v for v in variables_esperadas if v not in contexto]
        if faltantes:
            # puedes lanzar excepción, loggear o avisar
            print(f"⚠️ Faltan variables en el contexto: {faltantes}")
        return Template(texto).render(Context(contexto))
    except Exception as e:
        print(f"Error al renderizar plantilla: {e}")
        return texto

def enviar_correo(evento: str, contexto: dict):
    print("[DEBUG EMAIL] ▶️ Entrando en enviar_correo...")
    try:
        plantilla = PlantillaCorreo.objects.get(evento=evento, activo=True)
    except PlantillaCorreo.DoesNotExist:
        print(f"[DEBUG EMAIL] ❌ No se encontró plantilla activa para evento '{evento}'")
        return

    asunto = render_plantilla(plantilla.asunto, contexto)
    cuerpo = render_plantilla(plantilla.cuerpo, contexto)
    destinatario_raw = render_plantilla(plantilla.destinatario, contexto)

    # soportar múltiples destinatarios separados por coma
    destinatarios = [
        email.strip()
        for email in destinatario_raw.split(",")
        if email.strip()
    ]
    print("[DEBUG EMAIL] Preparando envío")

    if not destinatarios:
        print("[DEBUG EMAIL] ❌ No hay destinatarios. Abortando envío.")
        return  # no hay correos válidos
    print(f"[DEBUG EMAIL] Enviando a: {destinatarios}")
    print(f"[DEBUG EMAIL] Asunto: {asunto}")
    print(f"[DEBUG EMAIL] Cuerpo: {cuerpo}")
    send_mail(
        subject=asunto,
        message=cuerpo,
        from_email="noreply@progeek.es",
        recipient_list=destinatarios,
        fail_silently=False,
    )
    print("[DEBUG EMAIL] ✅ Correo enviado correctamente")