"""
Sistema de monitoreo y alertas para el mapeo de dispositivos.
Proporciona métricas en tiempo real y alertas proactivas.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from decimal import Decimal
from dataclasses import dataclass
from enum import Enum

from django.utils import timezone
from django.db.models import Count, Avg, Q, F
from django.core.mail import send_mail
from django.conf import settings

from ..models import DeviceMapping, MappingMetrics, MappingFeedback


logger = logging.getLogger(__name__)


class AlertLevel(Enum):
    """Niveles de alerta del sistema."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class Alert:
    """Estructura de alerta del sistema."""
    level: AlertLevel
    title: str
    message: str
    metric_name: str
    current_value: Any
    threshold_value: Any
    timestamp: datetime
    brand: Optional[str] = None
    device_type: Optional[str] = None


@dataclass
class MappingHealthStatus:
    """Estado de salud del sistema de mapeo."""
    overall_health: str  # 'healthy', 'warning', 'critical'
    mapping_success_rate: float
    avg_confidence_score: float
    total_active_mappings: int
    mappings_needing_review: int
    recent_failures: int
    performance_score: float
    alerts: List[Alert]


class MappingMonitoringService:
    """
    Servicio de monitoreo para el sistema de mapeo de dispositivos.
    Genera métricas, detecta anomalías y emite alertas.
    """

    def __init__(self):
        # Configuración de umbrales de alerta
        self.ALERT_THRESHOLDS = {
            'mapping_success_rate_warning': 0.85,  # <85% success rate
            'mapping_success_rate_critical': 0.70,  # <70% success rate
            'avg_confidence_critical': 50,  # <50 avg confidence
            'high_review_percentage': 0.20,  # >20% need review
            'performance_degradation': 0.30,  # 30% slower than baseline
            'new_failures_spike': 10,  # >10 new failures in hour
        }

        # Configuración de notificaciones
        self.NOTIFICATION_EMAILS = getattr(settings, 'MAPPING_ALERT_EMAILS', [])

    def get_health_status(self, hours_back: int = 24) -> MappingHealthStatus:
        """
        Evalúa el estado de salud del sistema de mapeo.

        Args:
            hours_back: Horas hacia atrás para evaluar métricas

        Returns:
            Estado de salud con métricas y alertas
        """
        cutoff_time = timezone.now() - timedelta(hours=hours_back)

        # Calcular métricas principales
        metrics = self._calculate_core_metrics(cutoff_time)

        # Detectar alertas
        alerts = self._detect_alerts(metrics, cutoff_time)

        # Determinar estado general
        overall_health = self._determine_overall_health(metrics, alerts)

        return MappingHealthStatus(
            overall_health=overall_health,
            mapping_success_rate=metrics['mapping_success_rate'],
            avg_confidence_score=metrics['avg_confidence_score'],
            total_active_mappings=metrics['total_active_mappings'],
            mappings_needing_review=metrics['mappings_needing_review'],
            recent_failures=metrics['recent_failures'],
            performance_score=metrics['performance_score'],
            alerts=alerts
        )

    def _calculate_core_metrics(self, cutoff_time: datetime) -> Dict[str, float]:
        """Calcula métricas principales del sistema."""
        # Métricas de mapping activos
        total_active = DeviceMapping.objects.filter(is_active=True).count()
        need_review = DeviceMapping.objects.filter(is_active=True, needs_review=True).count()

        # Métricas recientes de MappingMetrics
        recent_metrics = MappingMetrics.objects.filter(
            created_at__gte=cutoff_time
        ).aggregate(
            total_processed=Count('total_processed'),
            total_successful=Count('successfully_mapped'),
            avg_confidence=Avg('avg_confidence_score'),
            avg_processing_time=Avg('avg_processing_time')
        )

        # Calcular tasas
        total_processed = recent_metrics['total_processed'] or 1
        total_successful = recent_metrics['total_successful'] or 0
        success_rate = total_successful / total_processed if total_processed > 0 else 0

        # Métricas de rendimiento
        baseline_time = Decimal('2.0')  # 2 segundos baseline
        current_time = recent_metrics['avg_processing_time'] or baseline_time
        performance_score = float(min(1.0, baseline_time / current_time))

        return {
            'total_active_mappings': total_active,
            'mappings_needing_review': need_review,
            'mapping_success_rate': success_rate,
            'avg_confidence_score': float(recent_metrics['avg_confidence'] or 0),
            'recent_failures': total_processed - total_successful,
            'performance_score': performance_score,
            'avg_processing_time': float(current_time),
        }

    def _detect_alerts(self, metrics: Dict, cutoff_time: datetime) -> List[Alert]:
        """Detecta alertas basadas en métricas actuales."""
        alerts = []
        now = timezone.now()

        # Alerta: Tasa de éxito baja
        success_rate = metrics['mapping_success_rate']
        if success_rate < self.ALERT_THRESHOLDS['mapping_success_rate_critical']:
            alerts.append(Alert(
                level=AlertLevel.CRITICAL,
                title="Tasa de Mapeo Crítica",
                message=f"Tasa de éxito de mapeo en {success_rate:.1%} (< {self.ALERT_THRESHOLDS['mapping_success_rate_critical']:.1%})",
                metric_name="mapping_success_rate",
                current_value=success_rate,
                threshold_value=self.ALERT_THRESHOLDS['mapping_success_rate_critical'],
                timestamp=now
            ))
        elif success_rate < self.ALERT_THRESHOLDS['mapping_success_rate_warning']:
            alerts.append(Alert(
                level=AlertLevel.WARNING,
                title="Tasa de Mapeo Baja",
                message=f"Tasa de éxito de mapeo en {success_rate:.1%} (< {self.ALERT_THRESHOLDS['mapping_success_rate_warning']:.1%})",
                metric_name="mapping_success_rate",
                current_value=success_rate,
                threshold_value=self.ALERT_THRESHOLDS['mapping_success_rate_warning'],
                timestamp=now
            ))

        # Alerta: Confianza promedio baja
        avg_confidence = metrics['avg_confidence_score']
        if avg_confidence < self.ALERT_THRESHOLDS['avg_confidence_critical']:
            alerts.append(Alert(
                level=AlertLevel.ERROR,
                title="Confianza de Mapeo Baja",
                message=f"Confianza promedio en {avg_confidence:.1f} (< {self.ALERT_THRESHOLDS['avg_confidence_critical']})",
                metric_name="avg_confidence_score",
                current_value=avg_confidence,
                threshold_value=self.ALERT_THRESHOLDS['avg_confidence_critical'],
                timestamp=now
            ))

        # Alerta: Alto porcentaje de revisión necesaria
        total_active = metrics['total_active_mappings']
        need_review = metrics['mappings_needing_review']
        if total_active > 0:
            review_percentage = need_review / total_active
            if review_percentage > self.ALERT_THRESHOLDS['high_review_percentage']:
                alerts.append(Alert(
                    level=AlertLevel.WARNING,
                    title="Alto Porcentaje de Revisión",
                    message=f"{review_percentage:.1%} de mappings necesitan revisión (> {self.ALERT_THRESHOLDS['high_review_percentage']:.1%})",
                    metric_name="review_percentage",
                    current_value=review_percentage,
                    threshold_value=self.ALERT_THRESHOLDS['high_review_percentage'],
                    timestamp=now
                ))

        # Alerta: Degradación de rendimiento
        performance_score = metrics['performance_score']
        if performance_score < (1.0 - self.ALERT_THRESHOLDS['performance_degradation']):
            alerts.append(Alert(
                level=AlertLevel.WARNING,
                title="Degradación de Rendimiento",
                message=f"Rendimiento en {performance_score:.1%} del baseline",
                metric_name="performance_score",
                current_value=performance_score,
                threshold_value=1.0 - self.ALERT_THRESHOLDS['performance_degradation'],
                timestamp=now
            ))

        # Alertas específicas por marca
        brand_alerts = self._detect_brand_specific_alerts(cutoff_time)
        alerts.extend(brand_alerts)

        return alerts

    def _detect_brand_specific_alerts(self, cutoff_time: datetime) -> List[Alert]:
        """Detecta alertas específicas por marca."""
        alerts = []

        # Marcas con tasas de éxito anómalas
        brand_metrics = MappingMetrics.objects.filter(
            created_at__gte=cutoff_time
        ).values('brand').annotate(
            total=Count('total_processed'),
            successful=Count('successfully_mapped'),
            avg_confidence=Avg('avg_confidence_score')
        ).filter(total__gt=5)  # Solo marcas con volumen suficiente

        for metric in brand_metrics:
            brand = metric['brand']
            total = metric['total']
            successful = metric['successful']
            success_rate = successful / total if total > 0 else 0

            # Alerta por marca con tasa baja
            if success_rate < 0.5:  # 50% threshold para marcas específicas
                alerts.append(Alert(
                    level=AlertLevel.ERROR,
                    title=f"Problemas de Mapeo - {brand}",
                    message=f"Marca {brand} con tasa de éxito {success_rate:.1%}",
                    metric_name="brand_success_rate",
                    current_value=success_rate,
                    threshold_value=0.5,
                    timestamp=timezone.now(),
                    brand=brand
                ))

        return alerts

    def _determine_overall_health(self, metrics: Dict, alerts: List[Alert]) -> str:
        """Determina el estado general de salud."""
        if any(alert.level == AlertLevel.CRITICAL for alert in alerts):
            return "critical"
        elif any(alert.level == AlertLevel.ERROR for alert in alerts):
            return "error"
        elif any(alert.level == AlertLevel.WARNING for alert in alerts):
            return "warning"
        else:
            return "healthy"

    def send_alerts(self, alerts: List[Alert], force_send: bool = False):
        """
        Envía alertas por email si es necesario.

        Args:
            alerts: Lista de alertas a enviar
            force_send: Forzar envío ignorando throttling
        """
        if not alerts or not self.NOTIFICATION_EMAILS:
            return

        # Filtrar solo alertas críticas y errores (a menos que force_send)
        if not force_send:
            alerts = [a for a in alerts if a.level in [AlertLevel.CRITICAL, AlertLevel.ERROR]]

        if not alerts:
            return

        try:
            subject = f"[Mapeo Dispositivos] {len(alerts)} alertas detectadas"
            message = self._format_alert_email(alerts)

            send_mail(
                subject=subject,
                message=message,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@localhost'),
                recipient_list=self.NOTIFICATION_EMAILS,
                fail_silently=False
            )

            logger.info(f"Enviadas {len(alerts)} alertas por email")

        except Exception as e:
            logger.exception(f"Error enviando alertas por email: {e}")

    def _format_alert_email(self, alerts: List[Alert]) -> str:
        """Formatea alertas para email."""
        lines = [
            "Sistema de Mapeo de Dispositivos - Alertas",
            "=" * 50,
            f"Fecha: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total de alertas: {len(alerts)}",
            ""
        ]

        for alert in alerts:
            lines.extend([
                f"🚨 {alert.level.value.upper()}: {alert.title}",
                f"   {alert.message}",
                f"   Métrica: {alert.metric_name}",
                f"   Valor actual: {alert.current_value}",
                f"   Umbral: {alert.threshold_value}",
                ""
            ])

        lines.extend([
            "Para más detalles, revisa el dashboard de monitoreo.",
            "Este es un mensaje automático del sistema de mapeo."
        ])

        return "\n".join(lines)

    def generate_daily_report(self) -> Dict[str, Any]:
        """Genera reporte diario del sistema."""
        now = timezone.now()
        yesterday = now - timedelta(days=1)

        # Métricas del día
        daily_metrics = MappingMetrics.objects.filter(
            date=yesterday.date()
        ).aggregate(
            total_processed=Count('total_processed'),
            total_successful=Count('successfully_mapped'),
            total_cached_used=Count('cached_mappings_used'),
            total_new_created=Count('new_mappings_created'),
            avg_confidence=Avg('avg_confidence_score'),
            avg_processing_time=Avg('avg_processing_time')
        )

        # Top marcas del día
        top_brands = list(
            MappingMetrics.objects.filter(date=yesterday.date())
            .values('brand')
            .annotate(
                total=Count('total_processed'),
                success_rate=Count('successfully_mapped') * 100.0 / Count('total_processed')
            )
            .order_by('-total')[:10]
        )

        # Mappings que necesitan atención
        attention_needed = {
            'low_confidence': DeviceMapping.objects.filter(
                is_active=True,
                confidence_score__lt=50
            ).count(),
            'needs_review': DeviceMapping.objects.filter(
                is_active=True,
                needs_review=True
            ).count(),
            'old_unconfirmed': DeviceMapping.objects.filter(
                is_active=True,
                times_confirmed=1,
                last_confirmed_at__lt=now - timedelta(days=7)
            ).count()
        }

        # Estado de feedback
        feedback_stats = MappingFeedback.objects.filter(
            created_at__gte=yesterday
        ).aggregate(
            total_feedback=Count('id'),
            pending_feedback=Count('id', filter=Q(processed=False)),
            correct_feedback=Count('id', filter=Q(feedback_type='correct')),
            incorrect_feedback=Count('id', filter=Q(feedback_type='incorrect'))
        )

        return {
            'date': yesterday.date().isoformat(),
            'daily_metrics': daily_metrics,
            'top_brands': top_brands,
            'attention_needed': attention_needed,
            'feedback_stats': feedback_stats,
            'generated_at': now.isoformat()
        }

    def check_system_anomalies(self) -> List[Alert]:
        """
        Verifica anomalías del sistema que podrían indicar problemas.
        """
        alerts = []
        now = timezone.now()

        # Verificar si hay caída súbita en mappings exitosos
        last_hour = now - timedelta(hours=1)
        recent_failures = MappingMetrics.objects.filter(
            created_at__gte=last_hour
        ).aggregate(
            total_failed=Count('total_processed') - Count('successfully_mapped')
        )['total_failed'] or 0

        if recent_failures > self.ALERT_THRESHOLDS['new_failures_spike']:
            alerts.append(Alert(
                level=AlertLevel.ERROR,
                title="Pico de Fallos de Mapeo",
                message=f"{recent_failures} fallos en la última hora",
                metric_name="recent_failures",
                current_value=recent_failures,
                threshold_value=self.ALERT_THRESHOLDS['new_failures_spike'],
                timestamp=now
            ))

        # Verificar si hay mappings antiguos sin confirmar (posible problema de datos)
        old_mappings = DeviceMapping.objects.filter(
            is_active=True,
            last_confirmed_at__lt=now - timedelta(days=30),
            times_confirmed=1
        ).count()

        if old_mappings > 100:
            alerts.append(Alert(
                level=AlertLevel.WARNING,
                title="Mappings Antiguos Sin Confirmar",
                message=f"{old_mappings} mappings sin confirmar en 30+ días",
                metric_name="old_unconfirmed_mappings",
                current_value=old_mappings,
                threshold_value=100,
                timestamp=now
            ))

        return alerts

    def get_brand_performance_report(self, brand: str, days_back: int = 7) -> Dict[str, Any]:
        """
        Genera reporte de rendimiento específico para una marca.

        Args:
            brand: Nombre de la marca
            days_back: Días hacia atrás para el reporte

        Returns:
            Reporte detallado de rendimiento de la marca
        """
        cutoff_date = timezone.now().date() - timedelta(days=days_back)

        # Métricas de la marca
        brand_metrics = MappingMetrics.objects.filter(
            brand__iexact=brand,
            date__gte=cutoff_date
        ).aggregate(
            total_processed=Count('total_processed'),
            total_successful=Count('successfully_mapped'),
            total_cached=Count('cached_mappings_used'),
            total_new=Count('new_mappings_created'),
            avg_confidence=Avg('avg_confidence_score'),
            avg_processing_time=Avg('avg_processing_time')
        )

        # Mappings activos de la marca
        active_mappings = DeviceMapping.objects.filter(
            source_brand__iexact=brand,
            is_active=True
        )

        mapping_stats = {
            'total_active': active_mappings.count(),
            'needs_review': active_mappings.filter(needs_review=True).count(),
            'high_confidence': active_mappings.filter(confidence_score__gte=80).count(),
            'low_confidence': active_mappings.filter(confidence_score__lt=50).count(),
        }

        # Distribución por algoritmo
        algorithm_distribution = dict(
            active_mappings.values('mapping_algorithm')
            .annotate(count=Count('id'))
            .values_list('mapping_algorithm', 'count')
        )

        # Tendencias por día
        daily_trends = list(
            MappingMetrics.objects.filter(
                brand__iexact=brand,
                date__gte=cutoff_date
            )
            .values('date')
            .annotate(
                processed=Count('total_processed'),
                successful=Count('successfully_mapped')
            )
            .order_by('date')
        )

        return {
            'brand': brand,
            'period': f"{days_back} days",
            'brand_metrics': brand_metrics,
            'mapping_stats': mapping_stats,
            'algorithm_distribution': algorithm_distribution,
            'daily_trends': daily_trends,
            'generated_at': timezone.now().isoformat()
        }