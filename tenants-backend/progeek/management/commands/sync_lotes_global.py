from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context, get_tenant_model
from progeek.models import LoteGlobal

class Command(BaseCommand):
    help = "Sincroniza lotes globales desde todos los tenants."

    def handle(self, *args, **options):
        TenantModel = get_tenant_model()
        total_lotes = 0

        # Limpiar tabla global antes de sincronizar
        LoteGlobal.objects.all().delete()

        for tenant in TenantModel.objects.exclude(schema_name="public"):
            print(f"→ Procesando tenant: {tenant.slug} ({tenant.schema_name})")

            try:
                with schema_context(tenant.schema_name):
                    from checkouters.models import Lote
                    lotes = Lote.objects.all()

                    for lote in lotes:
                        LoteGlobal.objects.create(
                            tenant_slug=tenant.slug,
                            lote_id=lote.id,
                            nombre_lote=lote.nombre or f"Lote {lote.id}",
                            estado=lote.estado,
                            fecha_creacion=lote.fecha_creacion,
                            fecha_recepcion=getattr(lote, "fecha_recepcion", None),
                            auditado=getattr(lote, "auditado", False),
                            precio_estimado=getattr(lote, "precio_estimado", None),
                        )

                    print(f"  ✅ {lotes.count()} lotes sincronizados")
                    total_lotes += lotes.count()

            except Exception as e:
                print(f"  ⚠ Error en {tenant.slug}: {e}")

        print(f"✅ Sincronizados {total_lotes} lotes en total.")
