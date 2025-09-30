"""
Comando de gestión para administrar el caché de mapeo de dispositivos.
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db import transaction

from productos.models import DeviceMapping, MappingMetrics
from productos.services.incremental_mapping import IncrementalMappingService, MappingOptimizer
from productos.services.monitoring import MappingMonitoringService


class Command(BaseCommand):
    help = """
    Gestiona el caché de mapeo de dispositivos.

    Subcomandos disponibles:
    - cleanup: Limpia mappings antiguos no confirmados
    - optimize: Optimiza mappings de baja confianza
    - rebuild: Reconstruye caché para una marca específica
    - health: Muestra estado de salud del sistema
    - report: Genera reporte de rendimiento
    - invalidate: Invalida mappings específicos
    """

    def add_arguments(self, parser):
        # Subcomando principal
        parser.add_argument('action', type=str, choices=[
            'cleanup', 'optimize', 'rebuild', 'health', 'report', 'invalidate'
        ], help='Acción a realizar')

        # Argumentos opcionales
        parser.add_argument('--brand', type=str, help='Marca específica para algunas acciones')
        parser.add_argument('--days', type=int, default=30, help='Días para limpieza/reporte (default: 30)')
        parser.add_argument('--min-confidence', type=int, default=40, help='Confianza mínima para optimización (default: 40)')
        parser.add_argument('--force', action='store_true', help='Forzar acción sin confirmación')
        parser.add_argument('--dry-run', action='store_true', help='Simular acción sin aplicar cambios')

    def handle(self, *args, **options):
        action = options['action']

        try:
            if action == 'cleanup':
                self.handle_cleanup(options)
            elif action == 'optimize':
                self.handle_optimize(options)
            elif action == 'rebuild':
                self.handle_rebuild(options)
            elif action == 'health':
                self.handle_health(options)
            elif action == 'report':
                self.handle_report(options)
            elif action == 'invalidate':
                self.handle_invalidate(options)
            else:
                raise CommandError(f"Acción '{action}' no reconocida")

        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("Operación cancelada por el usuario"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
            raise

    def handle_cleanup(self, options):
        """Limpia mappings antiguos no confirmados."""
        days = options['days']
        dry_run = options['dry_run']
        force = options['force']

        self.stdout.write(f"🧹 Iniciando limpieza de mappings antiguos (>{days} días)")

        service = IncrementalMappingService()

        if dry_run:
            # Contar mappings que se limpiarían
            cutoff_date = timezone.now() - timezone.timedelta(days=days)
            count = DeviceMapping.objects.filter(
                is_active=True,
                last_confirmed_at__lt=cutoff_date,
                times_confirmed=1,
                confidence_score__lt=60
            ).count()

            self.stdout.write(
                self.style.WARNING(f"[DRY RUN] Se limpiarían {count} mappings antiguos")
            )
            return

        if not force:
            confirmation = input(f"¿Confirmar limpieza de mappings no confirmados en {days} días? (y/N): ")
            if confirmation.lower() != 'y':
                self.stdout.write("Operación cancelada")
                return

        with transaction.atomic():
            cleaned_count = service.cleanup_old_mappings(days)

        self.stdout.write(
            self.style.SUCCESS(f"✅ Limpiados {cleaned_count} mappings antiguos")
        )

    def handle_optimize(self, options):
        """Optimiza mappings de baja confianza."""
        min_confidence = options['min_confidence']
        dry_run = options['dry_run']

        self.stdout.write(f"⚡ Optimizando mappings con confianza < {min_confidence}")

        if dry_run:
            count = DeviceMapping.objects.filter(
                is_active=True,
                confidence_score__lt=min_confidence,
                needs_review=False
            ).count()

            self.stdout.write(
                self.style.WARNING(f"[DRY RUN] Se optimizarían {count} mappings de baja confianza")
            )
            return

        optimizer = MappingOptimizer()
        result = optimizer.optimize_low_confidence_mappings(min_confidence)

        self.stdout.write("📊 Resultados de optimización:")
        self.stdout.write(f"   Procesados: {result['processed']}")
        self.stdout.write(f"   Mejorados: {result['improved']}")
        self.stdout.write(f"   Marcados para revisión: {result['marked_for_review']}")

        if result['improved'] > 0:
            self.stdout.write(
                self.style.SUCCESS(f"✅ Optimizados {result['improved']} mappings")
            )

    def handle_rebuild(self, options):
        """Reconstruye caché para una marca específica."""
        brand = options['brand']
        force = options['force']
        dry_run = options['dry_run']

        if not brand:
            raise CommandError("Se requiere especificar --brand para rebuild")

        self.stdout.write(f"🔄 Reconstruyendo caché para marca: {brand}")

        if dry_run:
            count = DeviceMapping.objects.filter(
                source_brand__iexact=brand,
                is_active=True
            ).count()

            self.stdout.write(
                self.style.WARNING(f"[DRY RUN] Se invalidarían {count} mappings de {brand}")
            )
            return

        if not force:
            confirmation = input(f"¿Confirmar reconstrucción de caché para {brand}? (y/N): ")
            if confirmation.lower() != 'y':
                self.stdout.write("Operación cancelada")
                return

        optimizer = MappingOptimizer()

        with transaction.atomic():
            invalidated_count = optimizer.rebuild_cache_for_brand(brand)

        self.stdout.write(
            self.style.SUCCESS(f"✅ Invalidados {invalidated_count} mappings de {brand}")
        )
        self.stdout.write("ℹ️  Ejecuta la próxima actualización para regenerar caché")

    def handle_health(self, options):
        """Muestra estado de salud del sistema."""
        hours_back = min(options.get('days', 1) * 24, 168)  # Max 7 días

        self.stdout.write(f"🏥 Estado de salud del sistema (últimas {hours_back} horas)")

        monitoring = MappingMonitoringService()
        health_status = monitoring.get_health_status(hours_back)

        # Estado general
        status_color = {
            'healthy': self.style.SUCCESS,
            'warning': self.style.WARNING,
            'error': self.style.ERROR,
            'critical': self.style.ERROR
        }.get(health_status.overall_health, self.style.SUCCESS)

        self.stdout.write(f"Estado general: {status_color(health_status.overall_health.upper())}")

        # Métricas principales
        self.stdout.write("\n📊 Métricas principales:")
        self.stdout.write(f"   Tasa de éxito: {health_status.mapping_success_rate:.1%}")
        self.stdout.write(f"   Confianza promedio: {health_status.avg_confidence_score:.1f}")
        self.stdout.write(f"   Mappings activos: {health_status.total_active_mappings:,}")
        self.stdout.write(f"   Necesitan revisión: {health_status.mappings_needing_review:,}")
        self.stdout.write(f"   Fallos recientes: {health_status.recent_failures}")
        self.stdout.write(f"   Score de rendimiento: {health_status.performance_score:.1%}")

        # Alertas
        if health_status.alerts:
            self.stdout.write(f"\n🚨 Alertas ({len(health_status.alerts)}):")
            for alert in health_status.alerts:
                alert_color = {
                    'info': self.style.SUCCESS,
                    'warning': self.style.WARNING,
                    'error': self.style.ERROR,
                    'critical': self.style.ERROR
                }.get(alert.level.value, self.style.SUCCESS)

                self.stdout.write(f"   {alert_color(alert.level.value.upper())}: {alert.title}")
                self.stdout.write(f"      {alert.message}")
        else:
            self.stdout.write(f"\n✅ Sin alertas activas")

    def handle_report(self, options):
        """Genera reporte de rendimiento."""
        brand = options.get('brand')
        days = options['days']

        monitoring = MappingMonitoringService()

        if brand:
            self.stdout.write(f"📈 Reporte de rendimiento para {brand} ({days} días)")
            report = monitoring.get_brand_performance_report(brand, days)
            self._display_brand_report(report)
        else:
            self.stdout.write(f"📈 Reporte diario del sistema")
            report = monitoring.generate_daily_report()
            self._display_daily_report(report)

    def _display_brand_report(self, report):
        """Muestra reporte específico de marca."""
        metrics = report['brand_metrics']

        self.stdout.write("\n📊 Métricas de la marca:")
        self.stdout.write(f"   Total procesados: {metrics['total_processed'] or 0:,}")
        self.stdout.write(f"   Total exitosos: {metrics['total_successful'] or 0:,}")
        self.stdout.write(f"   Uso de caché: {metrics['total_cached'] or 0:,}")
        self.stdout.write(f"   Nuevos creados: {metrics['total_new'] or 0:,}")

        if metrics['total_processed']:
            success_rate = (metrics['total_successful'] or 0) / metrics['total_processed']
            self.stdout.write(f"   Tasa de éxito: {success_rate:.1%}")

        mapping_stats = report['mapping_stats']
        self.stdout.write("\n🗂️  Mappings activos:")
        self.stdout.write(f"   Total: {mapping_stats['total_active']:,}")
        self.stdout.write(f"   Alta confianza (≥80): {mapping_stats['high_confidence']:,}")
        self.stdout.write(f"   Baja confianza (<50): {mapping_stats['low_confidence']:,}")
        self.stdout.write(f"   Necesitan revisión: {mapping_stats['needs_review']:,}")

        if report['algorithm_distribution']:
            self.stdout.write("\n🔧 Distribución por algoritmo:")
            for algorithm, count in report['algorithm_distribution'].items():
                self.stdout.write(f"   {algorithm}: {count:,}")

    def _display_daily_report(self, report):
        """Muestra reporte diario."""
        metrics = report['daily_metrics']

        self.stdout.write(f"\n📅 Fecha: {report['date']}")
        self.stdout.write("\n📊 Métricas del día:")
        self.stdout.write(f"   Total procesados: {metrics['total_processed'] or 0:,}")
        self.stdout.write(f"   Total exitosos: {metrics['total_successful'] or 0:,}")
        self.stdout.write(f"   Uso de caché: {metrics['total_cached_used'] or 0:,}")
        self.stdout.write(f"   Nuevos creados: {metrics['total_new_created'] or 0:,}")

        if metrics['total_processed']:
            success_rate = (metrics['total_successful'] or 0) / metrics['total_processed']
            self.stdout.write(f"   Tasa de éxito: {success_rate:.1%}")

        # Top marcas
        top_brands = report['top_brands']
        if top_brands:
            self.stdout.write("\n🏆 Top marcas del día:")
            for i, brand_data in enumerate(top_brands[:5], 1):
                self.stdout.write(
                    f"   {i}. {brand_data['brand']}: {brand_data['total']:,} "
                    f"({brand_data['success_rate']:.1f}% éxito)"
                )

        # Atención necesaria
        attention = report['attention_needed']
        self.stdout.write("\n⚠️  Requieren atención:")
        self.stdout.write(f"   Baja confianza: {attention['low_confidence']:,}")
        self.stdout.write(f"   Necesitan revisión: {attention['needs_review']:,}")
        self.stdout.write(f"   Antiguos sin confirmar: {attention['old_unconfirmed']:,}")

    def handle_invalidate(self, options):
        """Invalida mappings específicos."""
        brand = options.get('brand')
        force = options['force']
        dry_run = options['dry_run']

        if not brand:
            raise CommandError("Se requiere especificar --brand para invalidate")

        # Filtros de invalidación
        filters = {'source_brand__iexact': brand, 'is_active': True}

        if dry_run:
            count = DeviceMapping.objects.filter(**filters).count()
            self.stdout.write(
                self.style.WARNING(f"[DRY RUN] Se invalidarían {count} mappings de {brand}")
            )
            return

        if not force:
            confirmation = input(f"¿Confirmar invalidación de mappings para {brand}? (y/N): ")
            if confirmation.lower() != 'y':
                self.stdout.write("Operación cancelada")
                return

        with transaction.atomic():
            updated = DeviceMapping.objects.filter(**filters).update(
                is_active=False,
                invalidated_at=timezone.now(),
                invalidation_reason=f"Manual invalidation via management command"
            )

        self.stdout.write(
            self.style.SUCCESS(f"✅ Invalidados {updated} mappings de {brand}")
        )