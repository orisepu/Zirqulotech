import time
from django.utils.deprecation import MiddlewareMixin
from colorama import init
from django_test_app.logging_utils import log_http_response, log_exception

init(autoreset=True)


class RequestLoggingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._start_time = time.time()

    def process_exception(self, request, exception):
        ip = self.get_client_ip(request)
        method = request.method
        path = request.get_full_path()
        host = request.get_host()
        tenant = request.META.get('HTTP_X_TENANT', '—')

        log_exception(method, path, exception, ip, host, tenant)

    def process_response(self, request, response):
        ip = self.get_client_ip(request)
        method = request.method
        path = request.get_full_path()
        status = response.status_code
        host = request.get_host()
        tenant = request.META.get('HTTP_X_TENANT', '—')
        duration = int((time.time() - getattr(request, '_start_time', time.time())) * 1000)

        log_http_response(method, path, status, duration, ip, host, tenant)
        return response

    def get_client_ip(self, request):
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0]
        return request.META.get('REMOTE_ADDR', '')
