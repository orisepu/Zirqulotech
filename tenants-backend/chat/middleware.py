# chat/middleware.py
from urllib.parse import parse_qs
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.core.exceptions import FieldError
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, ExpiredTokenError, TokenError
from django_test_app.logging_utils import log_ws_event

User = get_user_model()

# -------------------------------
# Helpers de token / usuario
# -------------------------------
def _get_token_from_scope(scope):
    """
    1) Sec-WebSocket-Protocol: "jwt,<ACCESS_TOKEN>" o "<ACCESS_TOKEN>"
    2) Authorization: Bearer <ACCESS_TOKEN>
    3) Querystring ?token=<ACCESS_TOKEN>
    """
    # 1) Subprotocol
    subprotocols = scope.get("subprotocols") or []
    for sp in subprotocols:
        parts = [p.strip() for p in sp.split(",")]
        if parts and (parts[0] == "jwt" and len(parts) > 1):
            return parts[1]
        if len(parts) == 1 and "." in parts[0]:  # heurística JWT
            return parts[0]

    # 2) Authorization header
    for k, v in (scope.get("headers") or []):
        if k == b"authorization" and v.lower().startswith(b"bearer "):
            return v.split()[1].decode("utf-8")

    # 3) Query ?token=
    query = parse_qs((scope.get("query_string") or b"").decode())
    if "token" in query and query["token"]:
        return query["token"][0]

    return None


@database_sync_to_async
def get_user_from_token(token: str):
    """
    Valida el token. Devuelve:
      - User si OK
      - "__EXPIRED__" si exp
      - AnonymousUser para resto de casos (inválido, sin user_id, etc.)
    """
    try:
        validated = UntypedToken(token)  # respeta SIMPLE_JWT['LEEWAY']
    except ExpiredTokenError:
        return "__EXPIRED__"
    except (InvalidToken, TokenError):
        return AnonymousUser()

    try:
        user_id = validated.get("user_id")
        if not user_id:
            return AnonymousUser()
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


@database_sync_to_async
def get_global_flags(user_id: int) -> dict:
    from progeek.models import UserGlobalRole
    try:
        gr = UserGlobalRole.objects.only("es_superadmin", "es_empleado_interno").get(user_id=user_id)
        return {"es_superadmin": bool(gr.es_superadmin), "es_empleado_interno": bool(gr.es_empleado_interno)}
    except UserGlobalRole.DoesNotExist:
        return {"es_superadmin": False, "es_empleado_interno": False}


@database_sync_to_async
def user_has_tenant(user_id: int, tenant_slug: str) -> bool:
    """Comprueba si el usuario tiene rol en el tenant dado."""
    from progeek.models import RolPorTenant
    # Nada de select_related/only aquí; no lo necesitamos
    try:
        qs = RolPorTenant.objects.filter(tenant_slug=tenant_slug)
        qs = qs.filter(user_role__profile_id=user_id)
    except FieldError:
        qs = RolPorTenant.objects.filter(tenant_slug=tenant_slug, user_role__user_id=user_id)
    return qs.exists()


@database_sync_to_async
def pick_tenant_from_roles(user_id: int) -> str | None:
    """Elige un tenant cualquiera del usuario (el más reciente por id)."""
    from progeek.models import RolPorTenant
    # Evitamos select_related + only por el conflicto que te ha salido
    try:
        qs = RolPorTenant.objects.filter(user_role__profile_id=user_id)
    except FieldError:
        qs = RolPorTenant.objects.filter(user_role__user_id=user_id)

    # Obtenemos directamente el slug como string
    slug = qs.order_by("-id").values_list("tenant_slug", flat=True).first()
    return slug or None


# -------------------------------
# Middlewares ASGI
# -------------------------------
class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # --- Token ---
        token = _get_token_from_scope(scope)
        if not token:
            scope["user"] = AnonymousUser()
            log_ws_event("WS/JWT: sin token")
        else:
            user = await get_user_from_token(token)
            if user == "__EXPIRED__":
                await send({"type": "websocket.close", "code": 4401, "reason": "Token expired"})
                return
            scope["user"] = user
            if getattr(user, "is_authenticated", False):
                log_ws_event("WS/JWT: usuario autenticado", user=user)
            else:
                log_ws_event("WS/JWT: token inválido -> AnonymousUser")

        # --- Tenant (solo usuarios autenticados) ---
        tenant = None
        if getattr(scope["user"], "is_authenticated", False):
            # Tenant por query (?tenant= / ?schema=)
            qs = parse_qs((scope.get("query_string") or b"").decode())
            tenant_qs = (qs.get("tenant") or qs.get("schema") or [None])[0]
            tenant = (tenant_qs or "").lower() if tenant_qs else None

            flags = await get_global_flags(scope["user"].id)
            es_super = flags["es_superadmin"] or flags["es_empleado_interno"]

            if tenant:
                if not es_super:
                    allowed = await user_has_tenant(scope["user"].id, tenant)
                    if not allowed:
                        await send({"type": "websocket.close", "code": 4403, "reason": "Forbidden tenant"})
                        return
            else:
                tenant = await pick_tenant_from_roles(scope["user"].id)
                if not tenant and es_super:
                    tenant = "public"

            if not tenant and scope.get("type") == "websocket":
                await send({"type": "websocket.close", "code": 4001, "reason": "Missing tenant"})
                return

            if tenant:
                scope["tenant_schema"] = tenant
                log_ws_event("WS/JWT: tenant resuelto", user=scope["user"], extra={"tenant": tenant})

        return await super().__call__(scope, receive, send)


class UsuarioTenantASGIMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        # Respetar tenant resuelto
        tenant = scope.get("tenant_schema")
        if tenant:
            return await super().__call__(scope, receive, send)

        # Para WS sin tenant (no autenticado o no permitido), cerrar limpio
        if scope.get("type") == "websocket":
            await send({"type": "websocket.close", "code": 4001, "reason": "Missing tenant"})
            return

        # En HTTP deja que otras capas gestionen
        return await super().__call__(scope, receive, send)
