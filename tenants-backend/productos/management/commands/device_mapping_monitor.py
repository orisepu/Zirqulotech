"""
Comando de monitoreo para el sistema de mapeo de dispositivos.
Ejecuta verificaciones periódicas y envía alertas.
"""

import json
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from productos.services.monitoring import MappingMonitoringService


class Command(BaseCommand):
    help = """
    Monitorea el sistema de mapeo de dispositivos y genera alertas.

    Subcomandos:
    - check: Verifica estado de salud y envía alertas si es necesario
    - report: Genera reporte específico
    - alerts: Verifica solo anomalías y alertas críticas
    - dashboard: Muestra métricas para dashboard
    """

    def add_arguments(self, parser):
        parser.add_argument('action', type=str, choices=[
            'check', 'report', 'alerts', 'dashboard'
        ], help='Acción de monitoreo a realizar')

        parser.add_argument('--brand', type=str, help='Marca específica para reportes')
        parser.add_argument('--hours', type=int, default=24, help='Horas hacia atrás para análisis (default: 24)')
        parser.add_argument('--days', type=int, default=7, help='Días para reportes de marca (default: 7)')
        parser.add_argument('--send-alerts', action='store_true', help='Enviar alertas por email')
        parser.add_argument('--format', type=str, choices=['text', 'json'], default='text', help='Formato de salida')
        parser.add_argument('--threshold', type=str, choices=['warning', 'error', 'critical'], default='error', help='Umbral mínimo de alertas')

    def handle(self, *args, **options):
        action = options['action']

        try:
            if action == 'check':
                self.handle_check(options)
            elif action == 'report':
                self.handle_report(options)
            elif action == 'alerts':
                self.handle_alerts(options)
            elif action == 'dashboard':
                self.handle_dashboard(options)
            else:
                raise CommandError(f"Acción '{action}' no reconocida")

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
            raise

    def handle_check(self, options):
        """Verificación completa de salud del sistema."""
        hours = options['hours']
        send_alerts = options['send_alerts']
        output_format = options['format']

        monitoring = MappingMonitoringService()

        self.stdout.write(f"🔍 Verificando estado del sistema (últimas {hours} horas)")

        # Obtener estado de salud
        health_status = monitoring.get_health_status(hours)

        if output_format == 'json':
            self._output_health_json(health_status)
        else:
            self._output_health_text(health_status)

        # Enviar alertas si se solicita
        if send_alerts and health_status.alerts:
            monitoring.send_alerts(health_status.alerts)
            self.stdout.write(f"📧 Enviadas {len(health_status.alerts)} alertas por email")

        # Exit code basado en estado de salud
        if health_status.overall_health == 'critical':
            exit(2)
        elif health_status.overall_health in ['error', 'warning']:
            exit(1)

    def handle_report(self, options):
        """Genera reportes específicos."""
        brand = options.get('brand')
        days = options['days']
        output_format = options['format']

        monitoring = MappingMonitoringService()

        if brand:
            self.stdout.write(f"📊 Generando reporte para {brand} ({days} días)")
            report = monitoring.get_brand_performance_report(brand, days)

            if output_format == 'json':
                self.stdout.write(json.dumps(report, indent=2, default=str))
            else:
                self._output_brand_report_text(report)
        else:
            self.stdout.write("📊 Generando reporte diario")
            report = monitoring.generate_daily_report()

            if output_format == 'json':
                self.stdout.write(json.dumps(report, indent=2, default=str))
            else:
                self._output_daily_report_text(report)

    def handle_alerts(self, options):
        """Verifica solo anomalías y alertas críticas."""
        threshold = options['threshold']
        send_alerts = options['send_alerts']
        output_format = options['format']

        monitoring = MappingMonitoringService()

        self.stdout.write("🚨 Verificando anomalías del sistema")

        # Verificar anomalías
        anomaly_alerts = monitoring.check_system_anomalies()

        # Obtener alertas del estado general
        health_status = monitoring.get_health_status(24)

        # Filtrar por umbral
        threshold_levels = {
            'warning': ['warning', 'error', 'critical'],
            'error': ['error', 'critical'],
            'critical': ['critical']
        }

        all_alerts = anomaly_alerts + health_status.alerts
        filtered_alerts = [
            alert for alert in all_alerts
            if alert.level.value in threshold_levels[threshold]
        ]

        if output_format == 'json':
            alerts_data = [{
                'level': alert.level.value,
                'title': alert.title,
                'message': alert.message,
                'metric_name': alert.metric_name,
                'current_value': alert.current_value,
                'threshold_value': alert.threshold_value,
                'timestamp': alert.timestamp.isoformat(),
                'brand': alert.brand,
                'device_type': alert.device_type
            } for alert in filtered_alerts]

            self.stdout.write(json.dumps({
                'alerts': alerts_data,
                'count': len(alerts_data),
                'threshold': threshold
            }, indent=2))
        else:
            if filtered_alerts:
                self.stdout.write(f"🚨 {len(filtered_alerts)} alertas encontradas (≥{threshold}):")
                for alert in filtered_alerts:
                    level_style = {
                        'warning': self.style.WARNING,
                        'error': self.style.ERROR,
                        'critical': self.style.ERROR
                    }.get(alert.level.value, self.style.SUCCESS)

                    self.stdout.write(f"   {level_style(alert.level.value.upper())}: {alert.title}")
                    self.stdout.write(f"      {alert.message}")
                    if alert.brand:
                        self.stdout.write(f"      Marca: {alert.brand}")
            else:
                self.stdout.write(f"✅ Sin alertas de nivel {threshold} o superior")

        # Enviar alertas críticas si se solicita
        if send_alerts and filtered_alerts:
            monitoring.send_alerts(filtered_alerts)
            self.stdout.write(f"📧 Enviadas {len(filtered_alerts)} alertas por email")

        # Exit code basado en alertas encontradas
        if any(alert.level.value == 'critical' for alert in filtered_alerts):
            exit(2)
        elif any(alert.level.value == 'error' for alert in filtered_alerts):
            exit(1)

    def handle_dashboard(self, options):
        """Genera métricas para dashboard web."""
        hours = options['hours']

        monitoring = MappingMonitoringService()

        # Datos para dashboard
        health_status = monitoring.get_health_status(hours)
        daily_report = monitoring.generate_daily_report()

        dashboard_data = {
            'system_health': {
                'status': health_status.overall_health,
                'mapping_success_rate': health_status.mapping_success_rate,
                'avg_confidence_score': health_status.avg_confidence_score,
                'total_active_mappings': health_status.total_active_mappings,
                'mappings_needing_review': health_status.mappings_needing_review,
                'performance_score': health_status.performance_score,
                'alerts_count': len(health_status.alerts)
            },
            'daily_metrics': daily_report['daily_metrics'],
            'top_brands': daily_report['top_brands'],
            'attention_needed': daily_report['attention_needed'],
            'recent_alerts': [{
                'level': alert.level.value,
                'title': alert.title,
                'message': alert.message,
                'timestamp': alert.timestamp.isoformat()
            } for alert in health_status.alerts[:5]],  # Solo últimas 5
            'generated_at': timezone.now().isoformat()
        }

        self.stdout.write(json.dumps(dashboard_data, indent=2, default=str))

    def _output_health_json(self, health_status):
        """Salida JSON del estado de salud."""
        health_data = {
            'overall_health': health_status.overall_health,
            'mapping_success_rate': health_status.mapping_success_rate,
            'avg_confidence_score': health_status.avg_confidence_score,
            'total_active_mappings': health_status.total_active_mappings,
            'mappings_needing_review': health_status.mappings_needing_review,
            'recent_failures': health_status.recent_failures,
            'performance_score': health_status.performance_score,
            'alerts': [{
                'level': alert.level.value,
                'title': alert.title,
                'message': alert.message,
                'metric_name': alert.metric_name,
                'current_value': alert.current_value,
                'threshold_value': alert.threshold_value,
                'timestamp': alert.timestamp.isoformat(),
                'brand': alert.brand,
                'device_type': alert.device_type
            } for alert in health_status.alerts],
            'generated_at': timezone.now().isoformat()
        }

        self.stdout.write(json.dumps(health_data, indent=2))

    def _output_health_text(self, health_status):
        """Salida de texto del estado de salud."""
        # Estado general con color
        status_style = {
            'healthy': self.style.SUCCESS,
            'warning': self.style.WARNING,
            'error': self.style.ERROR,
            'critical': self.style.ERROR
        }.get(health_status.overall_health, self.style.SUCCESS)

        self.stdout.write(f"Estado: {status_style(health_status.overall_health.upper())}")

        # Métricas
        self.stdout.write("\n📊 Métricas:")
        self.stdout.write(f"   Tasa de éxito: {health_status.mapping_success_rate:.1%}")
        self.stdout.write(f"   Confianza promedio: {health_status.avg_confidence_score:.1f}")
        self.stdout.write(f"   Mappings activos: {health_status.total_active_mappings:,}")
        self.stdout.write(f"   Necesitan revisión: {health_status.mappings_needing_review:,}")
        self.stdout.write(f"   Rendimiento: {health_status.performance_score:.1%}")

        # Alertas
        if health_status.alerts:
            self.stdout.write(f"\n🚨 Alertas ({len(health_status.alerts)}):")
            for alert in health_status.alerts:
                level_style = {
                    'info': self.style.SUCCESS,
                    'warning': self.style.WARNING,
                    'error': self.style.ERROR,
                    'critical': self.style.ERROR
                }.get(alert.level.value, self.style.SUCCESS)

                self.stdout.write(f"   {level_style(alert.level.value.upper())}: {alert.title}")
                self.stdout.write(f"      {alert.message}")
        else:
            self.stdout.write("\n✅ Sin alertas")

    def _output_brand_report_text(self, report):
        """Salida de texto para reporte de marca."""
        self.stdout.write(f"\n📊 Reporte para {report['brand']} ({report['period']})")

        metrics = report['brand_metrics']
        self.stdout.write("\n📈 Métricas de procesamiento:")
        self.stdout.write(f"   Total procesados: {metrics['total_processed'] or 0:,}")
        self.stdout.write(f"   Total exitosos: {metrics['total_successful'] or 0:,}")

        if metrics['total_processed']:
            success_rate = (metrics['total_successful'] or 0) / metrics['total_processed']
            self.stdout.write(f"   Tasa de éxito: {success_rate:.1%}")

        mapping_stats = report['mapping_stats']
        self.stdout.write("\n🗂️  Estado de mappings:")
        self.stdout.write(f"   Total activos: {mapping_stats['total_active']:,}")
        self.stdout.write(f"   Alta confianza: {mapping_stats['high_confidence']:,}")
        self.stdout.write(f"   Baja confianza: {mapping_stats['low_confidence']:,}")
        self.stdout.write(f"   Necesitan revisión: {mapping_stats['needs_review']:,}")

    def _output_daily_report_text(self, report):
        """Salida de texto para reporte diario."""
        self.stdout.write(f"\n📅 Reporte diario ({report['date']})")

        metrics = report['daily_metrics']
        self.stdout.write("\n📊 Métricas del día:")
        self.stdout.write(f"   Procesados: {metrics['total_processed'] or 0:,}")
        self.stdout.write(f"   Exitosos: {metrics['total_successful'] or 0:,}")

        if metrics['total_processed']:
            success_rate = (metrics['total_successful'] or 0) / metrics['total_processed']
            self.stdout.write(f"   Tasa de éxito: {success_rate:.1%}")

        # Top marcas
        if report['top_brands']:
            self.stdout.write("\n🏆 Top marcas:")
            for brand_data in report['top_brands'][:3]:
                self.stdout.write(f"   {brand_data['brand']}: {brand_data['total']:,}")

        # Atención necesaria
        attention = report['attention_needed']
        total_attention = sum(attention.values())
        if total_attention > 0:
            self.stdout.write(f"\n⚠️  Requieren atención: {total_attention:,}")
            for key, value in attention.items():
                if value > 0:
                    self.stdout.write(f"   {key}: {value:,}")