from django_tenants.utils import get_tenant_model, schema_context
from rest_framework.decorators import api_view, permission_classes, renderer_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.db import connection
from django.db.models import Prefetch
from ..models.oportunidad import Oportunidad
from ..models.dispositivo import DispositivoReal, Dispositivo
from checkouters.utils.createpdf import generar_pdf_oportunidad
from django.http import HttpResponse,JsonResponse
from rest_framework.response import Response
from progeek.utils import enviar_correo
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

def generar_pdf_view(request, pk):
    logger.info(f"➡️ Generando PDF para oportunidad {pk}...")

    try:
        oportunidad = Oportunidad.objects.select_related('cliente').prefetch_related(
            Prefetch('dispositivos_oportunidad',
                     queryset=Dispositivo.objects.select_related('modelo', 'capacidad', 'dispositivo_personalizado'))
        ).get(pk=pk)
    except Oportunidad.DoesNotExist:
        logger.error(f"❌ Oportunidad con ID {pk} no encontrada")
        raise Http404("Oportunidad no encontrada")

    # Obtener el tenant actual para usar su logo en el PDF
    tenant = connection.tenant

    try:
        pdf_buffer = generar_pdf_oportunidad(oportunidad, tenant=tenant)
        logger.info(f"✅ PDF generado correctamente para oportunidad {pk}")
    except Exception as e:
        logger.exception(f"❌ Error al generar el PDF para oportunidad {pk}: {e}")
        return HttpResponse("Error interno al generar el PDF", status=500)

    response = HttpResponse(pdf_buffer, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename=oportunidad_{pk}.pdf'
    return response


def generar_pdf_oferta_formal(request, pk):
    """
    Genera PDF de oferta formal con dispositivos auditados (DispositivoReal).
    Usa precio_final en lugar de precio_orientativo.
    """
    logger.info(f"➡️ Generando PDF oferta formal para oportunidad {pk}...")

    try:
        oportunidad = Oportunidad.objects.select_related('cliente').get(pk=pk)
    except Oportunidad.DoesNotExist:
        logger.error(f"❌ Oportunidad con ID {pk} no encontrada")
        raise Http404("Oportunidad no encontrada")

    # Obtener el tenant actual para usar su logo en el PDF
    tenant = connection.tenant

    # Obtener dispositivos REALES (auditados) en lugar de los declarados
    dispositivos_reales = DispositivoReal.objects.filter(
        oportunidad=oportunidad
    ).select_related('modelo', 'capacidad', 'dispositivo_personalizado')

    if not dispositivos_reales.exists():
        logger.warning(f"⚠️ No hay dispositivos reales para oportunidad {pk}, generando PDF vacío")

    try:
        # Generar PDF usando los dispositivos reales
        pdf_buffer = generar_pdf_oportunidad(
            oportunidad,
            tenant=tenant,
            dispositivos_override=list(dispositivos_reales)
        )
        logger.info(f"✅ PDF oferta formal generado correctamente para oportunidad {pk}")
    except Exception as e:
        logger.exception(f"❌ Error al generar PDF oferta formal para oportunidad {pk}: {e}")
        return HttpResponse("Error interno al generar el PDF", status=500)

    response = HttpResponse(pdf_buffer, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename=oferta_formal_{pk}.pdf'
    return response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def enviar_correo_oferta(request, id):
    schema = request.data.get("schema")
    evento = request.data.get("evento")
    if not schema:
        return Response({"detail": "Falta el parámetro 'schema'"}, status=400)

    with schema_context(schema):
        try:
            oportunidad = Oportunidad.objects.select_related("cliente", "tienda").get(uuid=id)  # ← usamos uuid correctamente
        except Oportunidad.DoesNotExist:
            return Response({"detail": f"Oportunidad no encontrada en schema '{schema}'"}, status=404)

        cliente = oportunidad.cliente
        tienda = oportunidad.tienda
        creador = oportunidad.usuario
        contexto = {
            "nombre_cliente": cliente.razon_social if cliente else "Cliente",
            "cliente_email": getattr(cliente, "email", "") or getattr(cliente, "correo", ""),
            "creador_oportunidad": getattr(creador, "email", ""),
            "nombre_oportunidad": oportunidad.nombre or "",
            "nombre_creador": (f"{getattr(creador, 'first_name', '')} {getattr(creador, 'last_name', '')}".strip()
                if creador
                else ""
            ),
            "fecha_oferta": oportunidad.fecha_oferta.strftime("%d/%m/%Y") if getattr(oportunidad, "fecha_oferta", None) else timezone.now().strftime("%d/%m/%Y"),
            # Puedes agregar más si la plantilla los necesita
        }

        enviar_correo(evento, contexto)
        print("[DEBUG EMAIL] Contexto:", contexto)
    
        return Response({"ok": True})
