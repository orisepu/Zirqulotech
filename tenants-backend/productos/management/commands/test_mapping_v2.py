"""
Comando para probar el sistema de mapeo V2 con datos reales.
Permite comparar resultados con el sistema anterior y validar mejoras.
"""

import json
import time
from typing import Dict, List, Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from productos.models import (
    TareaActualizacionLikewize,
    LikewizeItemStaging,
    DeviceMappingV2,
    MappingSessionReport
)
from productos.services.device_mapping_v2_service import DeviceMappingV2Service


class Command(BaseCommand):
    help = 'Prueba el sistema de mapeo V2 con datos de una tarea específica'

    def add_arguments(self, parser):
        parser.add_argument(
            'tarea_id',
            type=str,
            help='ID de la tarea de Likewize para probar'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=50,
            help='Número máximo de dispositivos a procesar (default: 50)'
        )
        parser.add_argument(
            '--device-type',
            type=str,
            choices=['mac', 'iphone', 'ipad', 'all'],
            default='all',
            help='Filtrar por tipo de dispositivo'
        )
        parser.add_argument(
            '--compare',
            action='store_true',
            help='Comparar con sistema de mapeo anterior'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Ejecutar sin guardar resultados'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Mostrar información detallada'
        )

    def handle(self, *args, **options):
        tarea_id = options['tarea_id']
        limit = options['limit']
        device_type_filter = options['device_type']
        compare_mode = options['compare']
        dry_run = options['dry_run']
        verbose = options['verbose']

        self.stdout.write(f"\n🧪 PRUEBA DEL SISTEMA DE MAPEO V2")
        self.stdout.write(f"Tarea: {tarea_id}")
        self.stdout.write(f"Límite: {limit} dispositivos")
        self.stdout.write(f"Filtro: {device_type_filter}")
        self.stdout.write(f"Dry run: {'Sí' if dry_run else 'No'}")
        self.stdout.write("-" * 60)

        # 1. Obtener datos de la tarea
        try:
            tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
        except TareaActualizacionLikewize.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Tarea {tarea_id} no encontrada"))
            return

        # 2. Obtener dispositivos de staging
        staging_items = LikewizeItemStaging.objects.filter(tarea=tarea)

        if not staging_items.exists():
            self.stdout.write(self.style.ERROR("No hay dispositivos en staging para esta tarea"))
            return

        # 3. Preparar datos para el sistema V2
        likewize_devices = []
        service = DeviceMappingV2Service()

        for item in staging_items[:limit]:
            # Convertir modelo de staging a formato de datos de Likewize
            device_data = {
                'M_Model': item.m_model or '',
                'MasterModelName': item.master_model_name or '',
                'ModelName': item.model_name or '',
                'FullName': item.full_name or '',
                'Capacity': item.capacity or '',
                'ModelValue': item.model_value or 0,
                'BrandName': item.brand_name or 'Apple',
                'ProductCategoryName': self._infer_category(item),
                'MasterModelId': str(item.master_model_id or ''),
                'PhoneModelId': item.phone_model_id or 0
            }

            # Filtrar por tipo si se especifica
            if device_type_filter != 'all':
                detected_type = service._determine_device_type(device_data)
                if detected_type != device_type_filter:
                    continue

            likewize_devices.append({
                'staging_item': item,
                'device_data': device_data,
                'detected_type': service._determine_device_type(device_data)
            })

        if not likewize_devices:
            self.stdout.write(self.style.WARNING("No hay dispositivos que coincidan con los filtros"))
            return

        self.stdout.write(f"📱 Dispositivos a procesar: {len(likewize_devices)}")

        # 4. Mostrar distribución por tipo
        type_distribution = {}
        for device in likewize_devices:
            device_type = device['detected_type']
            type_distribution[device_type] = type_distribution.get(device_type, 0) + 1

        self.stdout.write(f"\n📊 Distribución por tipo:")
        for device_type, count in type_distribution.items():
            self.stdout.write(f"  {device_type}: {count}")

        # 5. Ejecutar mapeo V2
        if not dry_run:
            self.stdout.write(f"\n🚀 Ejecutando mapeo V2...")
            start_time = time.time()

            # Preparar datos para el servicio
            device_data_list = [device['device_data'] for device in likewize_devices]

            # Ejecutar mapeo en lote
            results = service.map_device_batch(device_data_list, f"TEST_V2_{tarea_id}")

            processing_time = time.time() - start_time

            # 6. Mostrar resultados
            self._show_results(results, processing_time, verbose)

            # 7. Análisis detallado por tipo
            self._analyze_by_device_type(results, likewize_devices, verbose)

            # 8. Comparación con sistema anterior (si se solicita)
            if compare_mode:
                self._compare_with_legacy_system(likewize_devices, results, verbose)

        else:
            self.stdout.write(f"\n🔍 DRY RUN - Analizando dispositivos sin procesar...")

            # Mostrar muestra de dispositivos que se procesarían
            self._show_device_samples(likewize_devices[:10], verbose)

    def _infer_category(self, staging_item) -> str:
        """Infiere la categoría del dispositivo desde staging."""
        model_text = (staging_item.m_model or '').lower()
        master_text = (staging_item.master_model_name or '').lower()

        if 'iphone' in model_text or 'iphone' in master_text:
            return 'iPhone'
        elif 'ipad' in model_text or 'ipad' in master_text:
            return 'iPad'
        elif any(mac in model_text for mac in ['imac', 'macbook', 'mac mini', 'mac pro', 'mac studio']):
            return 'Mac'
        elif any(mac in master_text for mac in ['imac', 'macbook', 'mac mini', 'mac pro', 'mac studio']):
            return 'Mac'
        else:
            return 'Unknown'

    def _show_results(self, results: Dict[str, Any], processing_time: float, verbose: bool):
        """Muestra resultados del procesamiento."""
        self.stdout.write(f"\n✅ RESULTADOS DEL MAPEO V2")
        self.stdout.write("-" * 40)

        total = results['total_devices']
        successful = results['successful_mappings']
        failed = results['failed_mappings']
        success_rate = (successful / max(total, 1)) * 100

        self.stdout.write(f"Total dispositivos: {total}")
        self.stdout.write(f"Mapeados exitosamente: {successful}")
        self.stdout.write(f"Fallos: {failed}")
        self.stdout.write(f"Tasa de éxito: {success_rate:.1f}%")
        self.stdout.write(f"Tiempo de procesamiento: {processing_time:.2f}s")
        self.stdout.write(f"Tiempo promedio por dispositivo: {(processing_time/max(total,1)*1000):.1f}ms")

        # Estadísticas de confianza
        stats = results['statistics']
        self.stdout.write(f"\n📊 Distribución de confianza:")
        self.stdout.write(f"  Alta confianza (≥85%): {stats['high_confidence']}")
        self.stdout.write(f"  Confianza media (60-84%): {stats['medium_confidence']}")
        self.stdout.write(f"  Baja confianza (<60%): {stats['low_confidence']}")

        # Algoritmos utilizados
        if verbose and stats['by_algorithm']:
            self.stdout.write(f"\n🔧 Algoritmos utilizados:")
            for algorithm, count in stats['by_algorithm'].items():
                percentage = (count / max(successful, 1)) * 100
                self.stdout.write(f"  {algorithm}: {count} ({percentage:.1f}%)")

    def _analyze_by_device_type(self, results: Dict[str, Any], devices: List[Dict], verbose: bool):
        """Analiza resultados por tipo de dispositivo."""
        self.stdout.write(f"\n📱 ANÁLISIS POR TIPO DE DISPOSITIVO")
        self.stdout.write("-" * 40)

        type_stats = results['statistics']['by_type']

        for device_type, stats in type_stats.items():
            success_rate = (stats['successful'] / max(stats['total'], 1)) * 100
            avg_confidence = stats.get('avg_confidence', 0)

            self.stdout.write(f"\n{device_type.upper()}:")
            self.stdout.write(f"  Total: {stats['total']}")
            self.stdout.write(f"  Exitosos: {stats['successful']}")
            self.stdout.write(f"  Tasa de éxito: {success_rate:.1f}%")
            self.stdout.write(f"  Confianza promedio: {avg_confidence:.1f}")

            if verbose:
                # Mostrar ejemplos de dispositivos de este tipo
                type_devices = [d for d in devices if d['detected_type'] == device_type]
                if type_devices:
                    self.stdout.write(f"  Ejemplos:")
                    for device in type_devices[:3]:
                        model_name = device['device_data'].get('M_Model', 'N/A')
                        self.stdout.write(f"    - {model_name}")

    def _compare_with_legacy_system(self, devices: List[Dict], v2_results: Dict, verbose: bool):
        """Compara resultados con el sistema anterior."""
        self.stdout.write(f"\n🔄 COMPARACIÓN CON SISTEMA ANTERIOR")
        self.stdout.write("-" * 40)

        # Aquí se implementaría la comparación con el sistema anterior
        # Por ahora, solo mostramos un placeholder

        self.stdout.write("⚠️  Comparación con sistema anterior no implementada aún")
        self.stdout.write("   Esto requeriría ejecutar el algoritmo anterior en paralelo")

    def _show_device_samples(self, devices: List[Dict], verbose: bool):
        """Muestra muestras de dispositivos en dry run."""
        self.stdout.write(f"\n📋 MUESTRA DE DISPOSITIVOS (primeros 10):")
        self.stdout.write("-" * 40)

        for i, device in enumerate(devices, 1):
            device_data = device['device_data']
            detected_type = device['detected_type']

            self.stdout.write(f"\n{i}. Tipo: {detected_type}")
            self.stdout.write(f"   M_Model: {device_data.get('M_Model', 'N/A')}")
            self.stdout.write(f"   ModelName: {device_data.get('ModelName', 'N/A')}")
            self.stdout.write(f"   Capacity: {device_data.get('Capacity', 'N/A')}")

            if verbose:
                self.stdout.write(f"   MasterModelName: {device_data.get('MasterModelName', 'N/A')}")
                self.stdout.write(f"   ModelValue: {device_data.get('ModelValue', 0)}")

    def _get_recent_test_results(self) -> List[Dict]:
        """Obtiene resultados de pruebas recientes para comparación."""
        recent_reports = MappingSessionReport.objects.filter(
            tarea_id__startswith='TEST_V2_'
        ).order_by('-created_at')[:5]

        results = []
        for report in recent_reports:
            success_rate = (report.successfully_mapped / max(report.total_devices_processed, 1)) * 100
            results.append({
                'tarea_id': report.tarea_id,
                'total_devices': report.total_devices_processed,
                'success_rate': success_rate,
                'avg_confidence': sum([
                    report.high_confidence_mappings * 90,
                    report.medium_confidence_mappings * 75,
                    report.low_confidence_mappings * 45
                ]) / max(report.successfully_mapped, 1),
                'created_at': report.created_at
            })

        return results