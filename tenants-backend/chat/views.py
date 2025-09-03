from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Chat,Mensaje
from progeek.models import UserGlobalRole
from .serializers import ChatSerializer 
from django.db import connection
from django_tenants.utils import schema_context, get_tenant_model



@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def obtener_o_crear_chat(request):
    cliente_id = request.data.get('cliente_id')
    print("🔍 De obtener o crear chat def Current schema:", connection.schema_name)
    if not cliente_id:
        return Response({"error": "cliente_id es obligatorio"}, status=400)

    # Busca chat donde cliente sea cliente_id
    chat = Chat.objects.filter(cliente_id=cliente_id).first()

    if not chat:
        chat = Chat.objects.create(cliente_id=cliente_id)

    serializer = ChatSerializer(chat)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def historial_mensajes(request, chat_id):
    user = request.user
    schema_actual = connection.schema_name
    TenantModel = get_tenant_model()

    es_empleado_interno = (
        hasattr(user, "global_role") and user.global_role.es_empleado_interno
    )

    # Si es empleado interno (desde public) → puede buscar en todos los tenants
    if es_empleado_interno and schema_actual == "public":
        for tenant in TenantModel.objects.exclude(schema_name="public"):
            with schema_context(tenant.schema_name):
                try:
                    chat = Chat.objects.get(id=chat_id)
                    mensajes = Mensaje.objects.filter(chat=chat).order_by("enviado")
                    return Response([
                        {
                            "autor": m.autor.name if m.autor else "Sistema",
                            "texto": m.texto,
                            "oportunidad_id": m.oportunidad_id,
                            "tenant": tenant.schema_name,
                        }
                        for m in mensajes
                    ])
                except Chat.DoesNotExist:
                    continue
        return Response({"detail": "Chat no encontrado."}, status=404)

    # Si NO es empleado interno → estamos en un tenant, buscamos solo en el actual
    elif schema_actual != "public":
        try:
            chat = Chat.objects.get(id=chat_id)

            # Validar que el usuario participa en el chat (si tienes esa relación)
            if chat.cliente != user:
                return Response({"detail": "No autorizado."}, status=403)

            mensajes = Mensaje.objects.filter(chat=chat).order_by("enviado")
            return Response([
                {
                    "autor": m.autor.name if m.autor else "Sistema",
                    "texto": m.texto,
                    "oportunidad_id": m.oportunidad_id,
                    "tenant": schema_actual,
                }
                for m in mensajes
            ])
        except Chat.DoesNotExist:
            return Response({"detail": "Chat no encontrado."}, status=404)

    # Si es empleado interno pero por error está en un tenant → rechazar
    return Response({"detail": "No autorizado."}, status=403)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_chats_abiertos(request):
    user = request.user

    if not UserGlobalRole.objects.filter(user=user, es_empleado_interno=True).exists():
        return Response({"detail": "No autorizado."}, status=403)

    TenantModel = get_tenant_model()
    resultados = []

    for tenant in TenantModel.objects.exclude(schema_name="public"):
        with schema_context(tenant.schema_name):
            chats = Chat.objects.filter(cerrado=False).select_related("cliente")
            for chat in chats:
                data = ChatSerializer(chat).data
                data["tenant"] = tenant.schema_name
                resultados.append(data)

    return Response(resultados)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cerrar_chat(request, chat_id):
    user = request.user

    if not UserGlobalRole.objects.filter(user=user, es_empleado_interno=True).exists():
        return Response({"detail": "No autorizado."}, status=403)

    try:
        chat = Chat.objects.get(id=chat_id)
        chat.cerrado = True
        chat.save()
        return Response({"ok": True})
    except Chat.DoesNotExist:
        return Response({"detail": "Chat no encontrado"}, status=404)