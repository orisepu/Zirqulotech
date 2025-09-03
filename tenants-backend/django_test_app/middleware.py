
class TenantDebugMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from django.db import connection
        print("🌍 Host:", request.get_host())
        print("🧩 Schema activo:", connection.schema_name)
        return self.get_response(request)