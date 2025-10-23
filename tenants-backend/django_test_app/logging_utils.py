# backend/utils/logging_utils.py
import time
import logging
from colorama import Fore, Style

logger = logging.getLogger(__name__)

def log_http_response(method, path, status, duration, ip, host, tenant):
    # Solo loggear errores 4xx y 5xx
    if status >= 500:
        color, icon = Fore.RED, "❌"
        logger.error(
            f"{color}{icon} [{status}] {method} {path} | {duration}ms | IP: {ip} | Host: {host} | X-Tenant: {tenant}"
        )
    elif status >= 400:
        color, icon = Fore.YELLOW, "⚠️"
        logger.warning(
            f"{color}{icon} [{status}] {method} {path} | {duration}ms | IP: {ip} | Host: {host} | X-Tenant: {tenant}"
        )
    # No loggear respuestas exitosas (2xx) ni redirecciones (3xx)

def log_exception(method, path="—", exception=None, ip="—", host="—", tenant="—"):
    logger.error(
        f"{Fore.RED}💥 [EXCEPTION] {method} {path} | IP: {ip} | Host: {host} | X-Tenant: {tenant}\n"
        f"{Fore.RED}↪︎ {type(exception).__name__}: {exception}"
    )

def log_ws_event(event, user=None, schema=None, extra=""):
    logger.info(
        f"{Fore.MAGENTA}🔌 [{event}] WS | Schema: {schema or '—'} | User: {getattr(user, 'email', 'anon')} {extra}"
    )

def log_ws_warning(event, user=None, schema=None, extra=""):
    logger.warning(
        f"{Fore.YELLOW}⚠️ [{event}] WS | Schema: {schema or '—'} | User: {getattr(user, 'email', 'anon')} {extra}"
    )

def log_ws_error(event, user=None, schema=None, exception=None):
    logger.error(
        f"{Fore.RED}❌ [{event}] WS | Schema: {schema or '—'} | User: {getattr(user, 'email', 'anon')}\n"
        f"{Fore.RED}↪︎ {type(exception).__name__ if exception else 'Error'}: {exception}"
    )


