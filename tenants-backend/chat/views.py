from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Chat,Mensaje
from progeek.models import UserGlobalRole
from .serializers import ChatSerializer
from django.db import connection
from django_tenants.utils import schema_context, get_tenant_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync



@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def obtener_o_crear_chat(request):
    from progeek.models import UserGlobalRole, RolPorTenant

    cliente_id = request.data.get('cliente_id')
    current_schema = connection.schema_name
    print(f"🔍 obtener_o_crear_chat | schema actual: {current_schema}, cliente_id: {cliente_id}")

    if not cliente_id:
        return Response({"error": "cliente_id es obligatorio"}, status=400)

    # Si estamos en un tenant (no public), comportamiento normal
    if current_schema != "public":
        chat = Chat.objects.filter(cliente_id=cliente_id).first()
        if not chat:
            chat = Chat.objects.create(cliente_id=cliente_id)
        serializer = ChatSerializer(chat)
        return Response(serializer.data)

    # Si estamos en public (empleado interno), buscar tenant del usuario
    user = request.user
    if not UserGlobalRole.objects.filter(user=user, es_empleado_interno=True).exists():
        return Response({"error": "No autorizado. Solo empleados internos pueden crear chats desde public."}, status=403)

    # Buscar tenants del usuario cliente
    TenantModel = get_tenant_model()
    try:
        user_roles = RolPorTenant.objects.filter(user_role__user_id=cliente_id).values_list('tenant_slug', flat=True)
        tenant_slugs = list(user_roles)

        if not tenant_slugs:
            return Response({"error": f"El usuario {cliente_id} no pertenece a ningún tenant."}, status=404)

        # Usar el primer tenant (o podrías permitir elegir)
        target_tenant_slug = tenant_slugs[0]
        print(f"✅ Usuario {cliente_id} pertenece a tenants: {tenant_slugs}, usando: {target_tenant_slug}")

        # Crear/obtener chat en el tenant del usuario
        with schema_context(target_tenant_slug):
            chat = Chat.objects.filter(cliente_id=cliente_id).first()
            if not chat:
                chat = Chat.objects.create(cliente_id=cliente_id)
                print(f"✅ Chat creado en tenant {target_tenant_slug}: chat_id={chat.id}")
            else:
                print(f"✅ Chat existente en tenant {target_tenant_slug}: chat_id={chat.id}")

            serializer = ChatSerializer(chat)
            data = serializer.data
            data['schema'] = target_tenant_slug  # Agregar schema a la respuesta
            return Response(data)

    except Exception as e:
        print(f"❌ Error creando chat para usuario {cliente_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({"error": f"Error al crear chat: {str(e)}"}, status=500)

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
        # ✅ OPTIMIZACIÓN: Si viene schema como query param, buscar directamente en ese tenant
        schema_param = request.query_params.get('schema')

        if schema_param:
            print(f"✅ Usando schema del query param: {schema_param}")
            with schema_context(schema_param):
                try:
                    chat = Chat.objects.get(id=chat_id)
                    mensajes = Mensaje.objects.filter(chat=chat).order_by("enviado")
                    return Response([
                        {
                            "autor": m.autor.name if m.autor else "Sistema",
                            "texto": m.texto,
                            "oportunidad_id": m.oportunidad_id,
                            "tenant": schema_param,
                        }
                        for m in mensajes
                    ])
                except Chat.DoesNotExist:
                    return Response({"detail": f"Chat {chat_id} no encontrado en tenant {schema_param}."}, status=404)

        # Fallback: Iterar todos los tenants (backward compatibility)
        print(f"⚠️ No se especificó schema, iterando todos los tenants para chat {chat_id}")
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

    TenantModel = get_tenant_model()
    channel_layer = get_channel_layer()

    # Buscar el chat en todos los tenants
    for tenant in TenantModel.objects.exclude(schema_name="public"):
        with schema_context(tenant.schema_name):
            try:
                chat = Chat.objects.get(id=chat_id)
                chat.cerrado = True
                chat.save()

                # Notificar a todos los usuarios conectados al chat vía WebSocket
                group_name = f"chat_{chat_id}"
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        "type": "chat_closed",
                        "mensaje": "El chat ha sido cerrado por el equipo de soporte",
                        "cerrado_por": user.name or user.email,
                    }
                )
                print(f"✅ Chat {chat_id} cerrado y notificado vía WebSocket al grupo {group_name}")

                return Response({"ok": True})
            except Chat.DoesNotExist:
                continue

    return Response({"detail": "Chat no encontrado"}, status=404)