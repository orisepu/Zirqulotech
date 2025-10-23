# TenantDebugMiddleware - DESACTIVADO (solo para debugging manual)
# Descomentar solo cuando necesites debuggear tenant resolution
# class TenantDebugMiddleware:
#     def __init__(self, get_response):
#         self.get_response = get_response
#
#     def __call__(self, request):
#         import logging
#         from django.db import connection
#         logger = logging.getLogger(__name__)
#         logger.debug("Host: %s | Schema activo: %s", request.get_host(), connection.schema_name)
#         return self.get_response(request)