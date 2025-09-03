# <tu_app_b2c>/management/commands/purge_kyc.py
import sys
import re
from datetime import timedelta
from typing import Iterable, Set

from django.core.management.base import BaseCommand
from django.utils.timezone import now
from django.db import transaction
from django.core.files.storage import default_storage
from django.db.models import Q, Field

from django.conf import settings

# Ajusta a tu modelo real
from . import __name__ as _pkg  # noqa
from ...models import B2CContrato  # <-- cambia el import si tu modelo está en otro módulo

"""
Política por defecto:
- Revocar/limpiar tokens caducados.
- Eliminar ficheros KYC:
    a) contratos KYC NO completados y token caducado hace > retention_days
    b) contratos KYC SÍ completados hace > retention_days
- Limpiar ficheros huérfanos (en el prefix) que no están referenciados
  por ningún FileField de B2CContrato.

Parámetros:
--prefix kyc/                 Prefijo de almacenamiento donde viven los ficheros KYC.
--retention-days 30           Días de retención (por defecto 30).
--dry-run                     Simulación (por defecto TRUE si no pasas --delete).
--delete                      Ejecuta borrados reales.
--no-orphans                  No buscar/limpiar huérfanos.
--verbose                     Más detalle.
"""

def _iter_filefields(model) -> Iterable[Field]:
    for f in model._meta.get_fields():
        # FileField y subclases
        if getattr(f, "get_internal_type", lambda: "")() in ("FileField", "ImageField"):
            yield f

def _collect_referenced_paths(prefix: str) -> Set[str]:
    """Recoge todos los paths referenciados por FileFields en B2CContrato que empiecen por prefix."""
    referenced: Set[str] = set()
    for f in _iter_filefields(B2CContrato):
        vals = B2CContrato.objects.exclude(**{f.name: ""}).exclude(**{f"{f.name}__isnull": True}).values_list(f.name, flat=True)
        for v in vals:
            if not v:
                continue
            # v suele ser el path relativo en el storage
            if str(v).startswith(prefix):
                referenced.add(str(v))
    return referenced

def _list_storage_paths(prefix: str) -> Iterable[str]:
    """
    Lista paths en el storage bajo 'prefix'.
    Soporta S3 (django-storages) y fallback recursivo con listdir.
    """
    st = default_storage
    name = st.__class__.__name__

    # S3Boto3Storage: usar bucket nativo para eficiencia
    if name == "S3Boto3Storage" and hasattr(st, "bucket"):
        bucket = st.bucket
        for obj in bucket.objects.filter(Prefix=prefix):
            key = obj.key
            if key.endswith("/"):
                continue
            yield key
        return

    # Fallback: recorrer con listdir recursivo (para FileSystemStorage u otros)
    def walk(dir_prefix: str):
        try:
            dirs, files = st.listdir(dir_prefix)
        except Exception:
            return
        for f in files:
            yield f"{dir_prefix.rstrip('/')}/{f}".lstrip("/")
        for d in dirs:
            yield from walk(f"{dir_prefix.rstrip('/')}/{d}")

    # Normalizar
    prefix_norm = prefix.strip("/")
    yield from walk(prefix_norm)

class Command(BaseCommand):
    help = "Purgar tokens KYC caducados y ficheros KYC según política de retención."

    def add_arguments(self, parser):
        parser.add_argument("--prefix", type=str, default="kyc/", help="Prefijo en el storage para ficheros KYC.")
        parser.add_argument("--retention-days", type=int, default=30, help="Días de retención para borrado de ficheros.")
        parser.add_argument("--delete", action="store_true", help="Ejecuta borrados reales (por defecto dry-run).")
        parser.add_argument("--dry-run", action="store_true", help="Fuerza dry-run.")
        parser.add_argument("--no-orphans", action="store_true", help="No comprobar/borrar ficheros huérfanos.")
        parser.add_argument("--verbose", action="store_true", help="Salida detallada.")

    def handle(self, *args, **opts):
        prefix: str = opts["prefix"]
        retention_days: int = opts["retention_days"]
        do_delete: bool = opts["delete"] and not opts["dry_run"]
        check_orphans: bool = not opts["no_orphans"]
        verbose: bool = opts["verbose"]

        cutoff = now() - timedelta(days=retention_days)
        self.stdout.write(self.style.MIGRATE_HEADING(f"[purge_kyc] prefix={prefix} retention_days={retention_days} dry_run={not do_delete}"))

        # 1) Revocar/limpiar tokens caducados (si no están ya revocados)
        caducados_q = Q(kyc_expires_at__isnull=False, kyc_expires_at__lt=now(), kyc_revocado_at__isnull=True)
        caducados = list(B2CContrato.objects.filter(caducados_q).only("id", "kyc_token", "kyc_revocado_at", "kyc_expires_at"))
        if caducados:
            self.stdout.write(self.style.HTTP_INFO(f"→ Tokens caducados a revocar: {len(caducados)}"))
            if do_delete:
                with transaction.atomic():
                    for c in caducados:
                        c.kyc_revocado_at = now()
                        # opcional: limpiar el token para evitar reenvíos del mismo enlace
                        # c.kyc_token = None
                        c.save(update_fields=["kyc_revocado_at"])
            else:
                for c in caducados:
                    if verbose:
                        self.stdout.write(f"   dry-run: revocar id={c.id} exp={c.kyc_expires_at}")

        # 2a) Borrar ficheros de contratos NO completados cuyo token caducó hace > retention_days
        pendientes_viejos_q = Q(kyc_completado=False) & Q(kyc_expires_at__lt=cutoff)
        pendientes_viejos = list(B2CContrato.objects.filter(pendientes_viejos_q))
        self.stdout.write(self.style.HTTP_INFO(f"→ Contratos NO completados y caducados >{retention_days}d: {len(pendientes_viejos)}"))
        self._purge_files_for(pendientes_viejos, prefix, do_delete, verbose, tag="pendiente_caducado")

        # 2b) Borrar ficheros de contratos SÍ completados hace > retention_days
        completados_viejos_q = Q(kyc_completado=True) & Q(kyc_completed_at__lt=cutoff)
        completados_viejos = list(B2CContrato.objects.filter(completados_viejos_q))
        self.stdout.write(self.style.HTTP_INFO(f"→ Contratos COMPLETADOS hace >{retention_days}d: {len(completados_viejos)}"))
        self._purge_files_for(completados_viejos, prefix, do_delete, verbose, tag="completado_antiguo")

        # 3) (Opcional) Buscar y borrar HUÉRFANOS: ficheros en storage bajo prefix que no están referenciados
        if check_orphans:
            self.stdout.write(self.style.HTTP_INFO("→ Buscando huérfanos en storage..."))
            referenced = _collect_referenced_paths(prefix)
            total_huellas = len(referenced)
            orphan_count = 0
            for path in _list_storage_paths(prefix):
                if path not in referenced:
                    orphan_count += 1
                    if do_delete:
                        try:
                            default_storage.delete(path)
                            if verbose:
                                self.stdout.write(f"   orphan DEL: {path}")
                        except Exception as e:
                            self.stderr.write(self.style.WARNING(f"   orphan ERR: {path} -> {e}"))
                    else:
                        if verbose:
                            self.stdout.write(f"   orphan dry-run: {path}")
            self.stdout.write(self.style.SUCCESS(f"Huérfanos detectados: {orphan_count} (referenciados: {total_huellas})"))

        self.stdout.write(self.style.SUCCESS("Purgado KYC finalizado."))

    def _purge_files_for(self, contratos: Iterable[B2CContrato], prefix: str, do_delete: bool, verbose: bool, tag: str):
        if not contratos:
            return
        filefields = list(_iter_filefields(B2CContrato))
        for c in contratos:
            for f in filefields:
                try:
                    file = getattr(c, f.name, None)
                    if not file:
                        continue
                    path = getattr(file, "name", "") or ""
                    if not path or not str(path).startswith(prefix):
                        continue
                    if do_delete:
                        try:
                            file.delete(save=False)  # borra del storage
                            if verbose:
                                self.stdout.write(f"   {tag} DEL id={c.id} field={f.name} path={path}")
                        except Exception as e:
                            self.stderr.write(self.style.WARNING(f"   {tag} ERR id={c.id} field={f.name}: {e}"))
                    else:
                        if verbose:
                            self.stdout.write(f"   {tag} dry-run id={c.id} field={f.name} path={path}")
                except Exception as e:
                    self.stderr.write(self.style.WARNING(f"   {tag} ERR id={getattr(c,'id','?')} field={getattr(f,'name','?')}: {e}"))
