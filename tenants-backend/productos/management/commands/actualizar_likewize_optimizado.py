"""
Comando optimizado para actualización de precios Likewize usando el nuevo sistema de mapeo.
Incluye mapeo inteligente, procesamiento incremental y monitoreo.
"""

import os
import logging
import time
from pathlib import Path
from typing import Dict, List, Any

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from django.db import transaction

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging
from productos.likewize_config import get_apple_presets, get_extra_presets
from productos.services.device_mapping import DeviceMappingService, DeviceMetadata
from productos.services.incremental_mapping import IncrementalMappingService
from productos.services.monitoring import MappingMonitoringService
from productos.services.metadata_extractors import (
    AppleMetadataExtractor, GoogleMetadataExtractor, SamsungMetadataExtractor
)

# Importar funciones necesarias del comando original
from productos.management.commands.actualizar_likewize import (
    obtener_cookies, obtener_modelos_por_categoria, obtener_capacidades_por_master,
    extraer_storage_gb, norm_modelo, set_progress
)


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = """
    Actualización optimizada de precios Likewize con mapeo inteligente.

    Características:
    - Mapeo inteligente en fases (caché → exacto → fuzzy → heurístico)
    - Procesamiento incremental para eficiencia
    - Monitoreo y alertas en tiempo real
    - Extractores específicos por marca
    - Sistema de confianza y feedback
    """

    def add_arguments(self, parser):
        parser.add_argument("--tarea", type=str, required=True, help="ID de la tarea")
        parser.add_argument("--mode", type=str, default="apple", choices=["apple", "others"],
                          help="Modo de actualización (default: apple)")
        parser.add_argument("--brands", nargs="*", type=str, default=None,
                          help="Marcas específicas a procesar")
        parser.add_argument("--incremental", action="store_true",
                          help="Usar procesamiento incremental (solo cambios)")
        parser.add_argument("--force-full", action="store_true",
                          help="Forzar procesamiento completo ignorando caché")
        parser.add_argument("--skip-monitoring", action="store_true",
                          help="Omitir envío de alertas de monitoreo")

    def handle(self, *args, **options):
        tarea_id = options["tarea"]
        mode = options.get("mode", "apple")
        brands = options.get("brands", [])
        incremental = options.get("incremental", False)
        force_full = options.get("force_full", False)
        skip_monitoring = options.get("skip_monitoring", False)

        try:
            # Obtener o crear tarea
            tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
            tarea.estado = "RUNNING"
            tarea.iniciado_en = timezone.now()
            tarea.save()

            # Configurar logging
            self._setup_logging(tarea)

            # Inicializar servicios
            mapping_service = DeviceMappingService()
            incremental_service = IncrementalMappingService()
            monitoring_service = MappingMonitoringService()

            logger.info("🚀 Iniciando actualización optimizada de Likewize")

            if incremental and not force_full:
                # Procesamiento incremental
                result = self._process_incremental_update(incremental_service, tarea_id)
                self._log_incremental_results(result)
            else:
                # Procesamiento completo con mapeo inteligente
                result = self._process_full_update(
                    tarea, mapping_service, mode, brands, force_full
                )
                self._log_full_results(result)

            # Monitoreo y alertas
            if not skip_monitoring:
                self._check_and_send_alerts(monitoring_service)

            # Finalizar tarea
            tarea.estado = "SUCCESS"
            tarea.finalizado_en = timezone.now()
            tarea.save()

            logger.info("✅ Actualización completada exitosamente")

        except Exception as e:
            logger.exception(f"❌ Error en actualización: {e}")

            # Actualizar estado de error
            try:
                tarea.estado = "ERROR"
                tarea.error_message = f"{type(e).__name__}: {e}"
                tarea.finalizado_en = timezone.now()
                tarea.save()
            except:
                pass

            raise

    def _setup_logging(self, tarea):
        """Configura logging para la tarea."""
        if not tarea.log_path:
            stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
            base_dir = Path(settings.MEDIA_ROOT) / "likewize" / stamp
            base_dir.mkdir(parents=True, exist_ok=True)
            log_path = base_dir / "optimized_log.txt"
            tarea.log_path = str(log_path)
            tarea.save(update_fields=["log_path"])

        # Configurar handler para archivo
        file_handler = logging.FileHandler(tarea.log_path, encoding="utf-8")
        file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(file_handler)
        logger.setLevel(logging.INFO)

    def _process_incremental_update(self, incremental_service, tarea_id) -> Dict:
        """Procesa actualización incremental."""
        logger.info("🔄 Iniciando procesamiento incremental")

        start_time = time.time()
        result = incremental_service.process_incremental_update(tarea_id)

        return {
            'type': 'incremental',
            'result': result,
            'total_time': time.time() - start_time
        }

    def _process_full_update(self, tarea, mapping_service, mode, brands, force_full) -> Dict:
        """Procesa actualización completa con mapeo inteligente."""
        logger.info("🔄 Iniciando procesamiento completo con mapeo inteligente")

        start_time = time.time()

        # Descargar datos de Likewize (reutilizar lógica existente)
        raw_devices = self._download_likewize_data(tarea, mode, brands)

        # Procesar con mapeo inteligente
        mapping_results = self._process_devices_with_intelligent_mapping(
            raw_devices, mapping_service, tarea, force_full
        )

        return {
            'type': 'full',
            'raw_devices_count': len(raw_devices),
            'mapping_results': mapping_results,
            'total_time': time.time() - start_time
        }

    def _download_likewize_data(self, tarea, mode, brands) -> List[Dict]:
        """Descarga datos de Likewize (reutiliza lógica existente)."""
        set_progress(tarea, 10, "Obteniendo cookies de Likewize")

        cookies = obtener_cookies()
        if not cookies:
            raise RuntimeError("No se pudieron obtener cookies de Likewize")

        logger.info("🔑 Cookies obtenidas")

        # Obtener presets según modo
        if mode == "others":
            presets = get_extra_presets()
        else:
            presets = get_apple_presets()

        # Filtrar por marcas si se especifica
        if brands:
            brand_filter = {b.strip().lower() for b in brands}
            presets = [
                p for p in presets
                if (p.get("marca") or "").strip().lower() in brand_filter
            ]

        if not presets:
            raise RuntimeError("No hay categorías configuradas para procesar")

        logger.info(f"📦 Procesando {len(presets)} categorías")

        # Descargar datos
        all_devices = []
        for i, preset in enumerate(presets, 1):
            set_progress(tarea, 10 + int(60 * i / len(presets)),
                        f"Descargando {preset.get('marca', 'Unknown')} {preset.get('tipo', '')}")

            devices = self._download_preset_data(cookies, preset)
            all_devices.extend(devices)

            logger.info(f"✅ {len(devices)} dispositivos de {preset.get('marca', 'Unknown')}")

        logger.info(f"📊 Total dispositivos descargados: {len(all_devices)}")
        return all_devices

    def _download_preset_data(self, cookies, preset) -> List[Dict]:
        """Descarga datos para un preset específico."""
        product_id = preset.get("product_id")
        brand_id = preset.get("brand_id")
        marca = preset.get("marca", "Unknown")
        tipo = preset.get("tipo", "Unknown")

        # Obtener modelos base
        models = obtener_modelos_por_categoria(cookies, product_id, brand_id=brand_id)

        # Expandir por capacidades si es necesario
        if brand_id:
            expanded_models = []
            for model in models:
                master_id = model.get("MasterModelId") or model.get("masterModelId")
                if master_id:
                    capacities = obtener_capacidades_por_master(cookies, master_id)
                    if capacities:
                        expanded_models.extend(capacities)
                    else:
                        expanded_models.append(model)
                else:
                    expanded_models.append(model)
            models = expanded_models

        # Agregar metadatos del preset
        for model in models:
            model["_preset_marca"] = marca
            model["_preset_tipo"] = tipo

        return models

    def _process_devices_with_intelligent_mapping(self, raw_devices, mapping_service, tarea, force_full) -> Dict:
        """Procesa dispositivos usando mapeo inteligente."""
        set_progress(tarea, 80, "Procesando con mapeo inteligente")

        # Inicializar extractores
        extractors = {
            'apple': AppleMetadataExtractor(),
            'google': GoogleMetadataExtractor(),
            'samsung': SamsungMetadataExtractor(),
        }

        # Estadísticas
        stats = {
            'total_processed': 0,
            'successfully_mapped': 0,
            'failed_mapping': 0,
            'cached_hits': 0,
            'new_mappings': 0,
            'by_algorithm': {'cached': 0, 'exact': 0, 'fuzzy': 0, 'heuristic': 0, 'failed': 0},
            'by_brand': {}
        }

        # Limpiar staging previo
        LikewizeItemStaging.objects.filter(tarea=tarea).delete()

        staging_objects = []

        for i, device_data in enumerate(raw_devices):
            stats['total_processed'] += 1

            try:
                # Extraer metadatos básicos
                metadata = self._extract_device_metadata(device_data, extractors)

                # Intentar mapeo inteligente
                use_cache = not force_full
                mapping_result = mapping_service.map_device(metadata, use_cache=use_cache)

                # Actualizar estadísticas
                stats['by_algorithm'][mapping_result.algorithm_used] += 1
                stats['by_brand'][metadata.brand] = stats['by_brand'].get(metadata.brand, 0) + 1

                if mapping_result.capacity_id:
                    stats['successfully_mapped'] += 1
                    if mapping_result.algorithm_used == 'cached':
                        stats['cached_hits'] += 1
                    else:
                        stats['new_mappings'] += 1
                else:
                    stats['failed_mapping'] += 1

                # Crear objeto staging
                staging_obj = self._create_staging_object(tarea, device_data, metadata, mapping_result)
                staging_objects.append(staging_obj)

                # Progress update cada 100 dispositivos
                if i % 100 == 0:
                    progress = 80 + int(15 * i / len(raw_devices))
                    set_progress(tarea, progress, f"Procesando dispositivo {i+1}/{len(raw_devices)}")

            except Exception as e:
                stats['failed_mapping'] += 1
                logger.warning(f"Error procesando dispositivo {device_data.get('ModelName', 'Unknown')}: {e}")

        # Bulk create staging objects
        set_progress(tarea, 95, "Guardando resultados")
        LikewizeItemStaging.objects.bulk_create(staging_objects, ignore_conflicts=True)

        logger.info(f"💾 Guardados {len(staging_objects)} dispositivos en staging")

        return stats

    def _extract_device_metadata(self, device_data, extractors) -> DeviceMetadata:
        """Extrae metadatos usando extractor apropiado."""
        brand = device_data.get("BrandName") or device_data.get("_preset_marca", "")
        brand_key = brand.lower()

        # Usar extractor específico si está disponible
        if brand_key in extractors:
            return extractors[brand_key].extract_metadata(device_data)

        # Extractor genérico
        model_name = device_data.get("ModelName") or device_data.get("FullName", "")

        return DeviceMetadata(
            brand=brand,
            device_type=device_data.get("ProductCategoryName") or device_data.get("_preset_tipo", ""),
            model_raw=model_name,
            model_normalized=norm_modelo(model_name),
            capacity_gb=extraer_storage_gb(model_name),
            likewize_model_code=device_data.get("M_Model") or device_data.get("MasterModelName", ""),
            likewize_master_model_id=str(device_data.get("MasterModelId", "")),
            additional_data=device_data
        )

    def _create_staging_object(self, tarea, device_data, metadata, mapping_result):
        """Crea objeto de staging con resultado de mapeo."""
        price = device_data.get("DevicePrice", 0)
        try:
            price_decimal = float(price) if price else 0.0
        except (ValueError, TypeError):
            price_decimal = 0.0

        return LikewizeItemStaging(
            tarea=tarea,
            tipo=metadata.device_type,
            marca=metadata.brand,
            modelo_raw=metadata.model_raw,
            modelo_norm=metadata.model_normalized,
            almacenamiento_gb=metadata.capacity_gb or 0,
            precio_b2b=price_decimal,
            capacidad_id=mapping_result.capacity_id,
            pulgadas=metadata.screen_size,
            any=metadata.year,
            a_number=metadata.a_number,
            cpu=metadata.cpu,
            likewize_model_code=metadata.likewize_model_code,
        )

    def _check_and_send_alerts(self, monitoring_service):
        """Verifica estado y envía alertas si es necesario."""
        logger.info("🔍 Verificando estado del sistema para alertas")

        try:
            # Verificar anomalías
            alerts = monitoring_service.check_system_anomalies()

            # Obtener estado general
            health_status = monitoring_service.get_health_status(2)  # Últimas 2 horas
            alerts.extend(health_status.alerts)

            # Filtrar solo alertas críticas y errores
            critical_alerts = [
                alert for alert in alerts
                if alert.level.value in ['critical', 'error']
            ]

            if critical_alerts:
                monitoring_service.send_alerts(critical_alerts)
                logger.info(f"📧 Enviadas {len(critical_alerts)} alertas críticas")
            else:
                logger.info("✅ Sin alertas críticas detectadas")

        except Exception as e:
            logger.warning(f"Error en verificación de alertas: {e}")

    def _log_incremental_results(self, result):
        """Log de resultados incrementales."""
        incremental_result = result['result']

        logger.info("📊 Resultados del procesamiento incremental:")
        logger.info(f"   Nuevos mapeados: {incremental_result.newly_mapped}")
        logger.info(f"   Mappings actualizados: {incremental_result.updated_mappings}")
        logger.info(f"   Fallos de mapeo: {incremental_result.failed_mappings}")
        logger.info(f"   Mappings invalidados: {incremental_result.invalidated_mappings}")
        logger.info(f"   Tiempo de procesamiento: {incremental_result.processing_time_seconds:.2f}s")

        changes = incremental_result.changes_detected
        logger.info(f"   Dispositivos nuevos: {len(changes.new_devices)}")
        logger.info(f"   Dispositivos sin cambios: {changes.unchanged_count}")
        logger.info(f"   Total procesados: {changes.total_processed}")

    def _log_full_results(self, result):
        """Log de resultados completos."""
        stats = result['mapping_results']

        logger.info("📊 Resultados del procesamiento completo:")
        logger.info(f"   Total procesados: {stats['total_processed']:,}")
        logger.info(f"   Mapeados exitosamente: {stats['successfully_mapped']:,}")
        logger.info(f"   Fallos de mapeo: {stats['failed_mapping']:,}")
        logger.info(f"   Hits de caché: {stats['cached_hits']:,}")
        logger.info(f"   Nuevos mappings: {stats['new_mappings']:,}")
        logger.info(f"   Tiempo total: {result['total_time']:.2f}s")

        # Tasa de éxito
        if stats['total_processed'] > 0:
            success_rate = stats['successfully_mapped'] / stats['total_processed']
            logger.info(f"   Tasa de éxito: {success_rate:.1%}")

        # Distribución por algoritmo
        logger.info("   Por algoritmo:")
        for algo, count in stats['by_algorithm'].items():
            if count > 0:
                percentage = count / stats['total_processed'] * 100
                logger.info(f"     {algo}: {count:,} ({percentage:.1f}%)")

        # Distribución por marca
        logger.info("   Top marcas:")
        sorted_brands = sorted(stats['by_brand'].items(), key=lambda x: x[1], reverse=True)
        for brand, count in sorted_brands[:5]:
            percentage = count / stats['total_processed'] * 100
            logger.info(f"     {brand}: {count:,} ({percentage:.1f}%)")