import asyncio
import aiohttp
import json
import logging
import time
from decimal import Decimal
from typing import Dict, List, Optional

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.db import models
from django.apps import apps
from django.conf import settings
from playwright.async_api import async_playwright
from asgiref.sync import sync_to_async

from productos.models import TareaActualizacionLikewize, LikewizeItemStaging
from productos.models.autoaprendizaje import LearningSession
from productos.services.auto_learning_engine_v3 import AutoLearningEngine
from productos.services.feedback_system_v3 import FeedbackSystem
from productos.services.metadata_extractors import (
    AppleMetadataExtractor,
    GoogleMetadataExtractor,
    SamsungMetadataExtractor
)
from productos.likewize_config import get_apple_presets, get_extra_presets
from productos.management.commands.actualizar_likewize import resolver_capacidad_id

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Actualización V3 de precios Likewize con sistema de autoaprendizaje'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tarea',
            type=str,
            help='ID de tarea existente para continuar'
        )
        parser.add_argument(
            '--mode',
            type=str,
            default='apple',
            choices=['apple', 'others'],
            help='Modo de actualización: apple o others'
        )
        parser.add_argument(
            '--brands',
            nargs='*',
            help='Marcas específicas a sincronizar'
        )
        parser.add_argument(
            '--confidence-threshold',
            type=float,
            default=0.7,
            help='Umbral mínimo de confianza para mapeo automático'
        )
        parser.add_argument(
            '--max-concurrent',
            type=int,
            default=10,
            help='Máximo número de requests concurrentes'
        )
        parser.add_argument(
            '--skip-cache',
            action='store_true',
            help='Omitir cache de cookies'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Ejecutar sin guardar cambios'
        )

    def handle(self, *args, **options):
        start_time = time.time()

        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

        try:
            # Obtener o crear tarea
            if options['tarea']:
                tarea = TareaActualizacionLikewize.objects.get(pk=options['tarea'])
                self.stdout.write(f"Continuando tarea existente: {tarea.id}")
            else:
                tarea = self._create_task(options)
                self.stdout.write(f"Nueva tarea creada: {tarea.id}")

            # Inicializar sistemas
            learning_engine = AutoLearningEngine()
            feedback_system = FeedbackSystem()

            # Crear sesión de aprendizaje
            learning_session = LearningSession.objects.create(
                tarea=tarea,
                session_metadata={
                    'mode': options['mode'],
                    'confidence_threshold': options['confidence_threshold'],
                    'max_concurrent': options['max_concurrent'],
                    'version': '3.0'
                }
            )

            # Ejecutar actualización (síncrona con async donde sea necesario)
            self._run_update(
                tarea, learning_engine, learning_session, options
            )

            # Calcular métricas finales
            learning_session.calculate_metrics()

            execution_time = time.time() - start_time
            learning_session.processing_time_seconds = execution_time
            learning_session.save()

            # Finalizar tarea
            tarea.estado = "SUCCESS"
            tarea.finalizado_en = timezone.now()
            tarea.save()

            # Mostrar resumen
            self._show_summary(tarea, learning_session, execution_time)

        except Exception as e:
            logger.error(f"Error en actualización V3: {e}")
            if 'tarea' in locals():
                tarea.estado = "ERROR"
                tarea.error_message = str(e)
                tarea.finalizado_en = timezone.now()
                tarea.save()
            self.stdout.write(
                self.style.ERROR(f'Error: {e}')
            )
            raise

    def _create_task(self, options) -> TareaActualizacionLikewize:
        """Crea nueva tarea de actualización"""
        return TareaActualizacionLikewize.objects.create(
            meta={
                'mode': options['mode'],
                'brands': options.get('brands', []),
                'version': '3.0',
                'confidence_threshold': options['confidence_threshold'],
                'features': [
                    'auto_learning',
                    'feature_extraction',
                    'async_scraping',
                    'feedback_system'
                ]
            }
        )

    def _run_update(
        self,
        tarea: TareaActualizacionLikewize,
        learning_engine: AutoLearningEngine,
        learning_session: LearningSession,
        options: Dict
    ):
        """Ejecuta la actualización (síncrona con async donde sea necesario)"""

        # Actualizar estado
        tarea.estado = "RUNNING"
        tarea.iniciado_en = timezone.now()
        tarea.subestado = "Obteniendo cookies"
        tarea.save()

        # 1. Obtener cookies (async)
        tarea.add_log("🔑 Obteniendo cookies de Likewize...", "INFO")
        cookies = asyncio.run(self._get_cookies())
        tarea.add_log(f"✅ Cookies obtenidas exitosamente", "SUCCESS")
        self.stdout.write("Cookies obtenidas exitosamente")

        # 2. Obtener datos de Likewize (async)
        tarea.subestado = "Descargando datos de Likewize"
        tarea.add_log("📥 Descargando datos de Likewize...", "INFO")
        tarea.save()

        likewize_data = asyncio.run(self._fetch_likewize_data(
            cookies, options, tarea
        ))

        tarea.add_log(f"✅ Descargados {len(likewize_data)} items de Likewize", "SUCCESS")
        self.stdout.write(f"Descargados {len(likewize_data)} items de Likewize")

        # 3. Procesar con autoaprendizaje (síncrono)
        tarea.subestado = "Procesando con autoaprendizaje"
        tarea.add_log(f"🤖 Procesando {len(likewize_data)} items con autoaprendizaje...", "INFO")
        tarea.save()

        processed_items = self._process_with_learning(
            likewize_data, learning_engine, learning_session, options, tarea
        )

        # 4. Guardar en staging (síncrono)
        if not options['dry_run']:
            tarea.subestado = "Guardando en staging"
            tarea.add_log(f"💾 Guardando {len(processed_items)} items en staging...", "INFO")
            tarea.save()

            self._save_to_staging(processed_items, tarea, learning_session)
            tarea.add_log(f"✅ Items guardados en staging correctamente", "SUCCESS")

        tarea.subestado = "Completado"
        tarea.add_log("🎉 Actualización V3 completada exitosamente", "SUCCESS")
        tarea.save()

    async def _get_cookies(self) -> Dict[str, str]:
        """Obtiene cookies usando Playwright"""
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                await page.goto(
                    "https://appleb2bonlineesp.likewize.com/",
                    wait_until="domcontentloaded"
                )
                await page.wait_for_timeout(3000)

                cookies = await page.context.cookies()
                return {c["name"]: c["value"] for c in cookies}
            finally:
                await browser.close()

    async def _fetch_likewize_data(
        self,
        cookies: Dict[str, str],
        options: Dict,
        tarea: TareaActualizacionLikewize
    ) -> List[Dict]:
        """Obtiene datos de Likewize de forma asíncrona"""

        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Origin": "https://appleb2bonlineesp.likewize.com",
            "Referer": "https://appleb2bonlineesp.likewize.com/",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        }

        connector = aiohttp.TCPConnector(limit=options['max_concurrent'])
        timeout = aiohttp.ClientTimeout(total=60)

        async with aiohttp.ClientSession(
            cookies=cookies,
            headers=headers,
            connector=connector,
            timeout=timeout
        ) as session:

            all_data = []

            # Obtener configuración de presets
            if options['mode'] == 'apple':
                presets = get_apple_presets()
            else:
                presets = get_extra_presets()

            # Filtrar por marcas si se especificaron
            if options.get('brands'):
                presets = [p for p in presets if p.get('marca') in options['brands']]

            total_presets = len(presets)
            processed_presets = 0

            for preset in presets:
                try:
                    # Actualizar progreso
                    progress = int((processed_presets / total_presets) * 100)
                    tarea.progreso = progress
                    await sync_to_async(tarea.save)()

                    marca = preset.get('marca', 'Unknown')
                    await sync_to_async(tarea.add_log)(f"⏳ Procesando {marca}...", "INFO")
                    preset_data = await self._fetch_preset_data(session, preset)
                    all_data.extend(preset_data)

                    processed_presets += 1

                    await sync_to_async(tarea.add_log)(f"✅ {marca}: {len(preset_data)} items descargados", "SUCCESS")
                    self.stdout.write(
                        f"Procesado preset {marca}: {len(preset_data)} items"
                    )

                except Exception as e:
                    await sync_to_async(tarea.add_log)(f"❌ Error procesando {preset.get('marca', 'Unknown')}: {str(e)}", "ERROR")
                    logger.error(f"Error procesando preset {preset}: {e}")
                    continue

        return all_data

    async def _fetch_preset_data(
        self,
        session: aiohttp.ClientSession,
        preset: Dict
    ) -> List[Dict]:
        """Obtiene datos para un preset específico"""

        data = []

        # Obtener modelos maestros
        if preset.get('brand_id'):
            # Para marcas específicas
            url = "https://appleb2bonlineesp.likewize.com/Home.aspx/GetSelectedModels"
            payload = {
                "productId": str(preset['product_id']),
                "brandId": str(preset['brand_id'])
            }
        else:
            # Para Apple (sin brand_id)
            url = "https://appleb2bonlineesp.likewize.com/Home.aspx/GetList"
            payload = {"id": preset['product_id']}

        try:
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    models = result.get('d', [])
                else:
                    logger.error(f"Error obteniendo modelos: {response.status}")
                    return data

            # Para cada modelo maestro, obtener capacidades
            tasks = []
            for model in models:
                master_id = model.get('MasterModelId')
                if master_id:
                    task = self._fetch_model_capacities(session, master_id)
                    tasks.append(task)
                else:
                    # Modelo sin variantes (respuesta directa de GetList)
                    if model.get('ModelValue'):
                        data.append(model)

            # Ejecutar tareas concurrentemente
            if tasks:
                capacity_results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in capacity_results:
                    if isinstance(result, list):
                        data.extend(result)
                    elif isinstance(result, Exception):
                        logger.error(f"Error obteniendo capacidades: {result}")

        except Exception as e:
            logger.error(f"Error en fetch_preset_data: {e}")

        # Filtrar modelos excluidos (variantes regionales no europeas)
        exclude_list = preset.get('exclude_m_models', [])
        if exclude_list:
            original_count = len(data)
            data = [
                item for item in data
                if item.get('M_Model') not in exclude_list
            ]
            filtered_count = original_count - len(data)
            if filtered_count > 0:
                logger.info(f"Filtrados {filtered_count} modelos excluidos de {preset.get('marca', 'Unknown')}")

        return data

    async def _fetch_model_capacities(
        self,
        session: aiohttp.ClientSession,
        master_model_id: str
    ) -> List[Dict]:
        """Obtiene capacidades para un modelo maestro"""

        url = "https://appleb2bonlineesp.likewize.com/Home.aspx/GetSelectedCapacitys"
        payload = {"masterModelId": str(master_model_id)}

        try:
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get('d', [])
                else:
                    logger.error(f"Error obteniendo capacidades para {master_model_id}: {response.status}")
                    return []

        except Exception as e:
            logger.error(f"Error en fetch_model_capacities para {master_model_id}: {e}")
            return []

    def _process_with_learning(
        self,
        likewize_data: List[Dict],
        learning_engine: AutoLearningEngine,
        learning_session: LearningSession,
        options: Dict,
        tarea: TareaActualizacionLikewize
    ) -> List[Dict]:
        """Procesa los datos con el sistema de autoaprendizaje"""

        processed_items = []
        confidence_threshold = options['confidence_threshold']

        total_items = len(likewize_data)
        learning_session.total_items_processed = total_items

        processed_count = 0
        learned_count = 0
        predicted_count = 0

        # Obtener modelos para mapeo tradicional
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)
        equivalencias = {}  # Puede poblarse desde la BD si existe tabla de equivalencias

        # Inicializar extractores de metadatos
        extractors = {
            'apple': AppleMetadataExtractor(),
            'google': GoogleMetadataExtractor(),
            'samsung': SamsungMetadataExtractor(),
        }

        for item in likewize_data:
            try:
                # Extraer precio
                precio = self._extract_price(item)
                if not precio:
                    continue

                # Intentar mapeo con autoaprendizaje
                capacidad, confidence, match_type = learning_engine.predict_mapping(item)

                # Si no encontró mapeo, usar sistema tradicional como fallback
                if not capacidad:
                    # Seleccionar extractor apropiado
                    brand = (item.get('BrandName') or 'Apple').lower()
                    extractor = extractors.get(brand, extractors['apple'])
                    metadata = extractor.extract_metadata(item)

                    capacidad_id = resolver_capacidad_id(
                        modelo_norm=metadata.model_normalized or '',
                        almacenamiento_gb=metadata.capacity_gb,
                        equivalencias=equivalencias,
                        a_number=metadata.a_number,
                        pulgadas=metadata.screen_size,
                        anio=metadata.year,
                        cpu=metadata.cpu or '',
                        tipo=metadata.device_type,
                        marca=metadata.brand,
                        likewize_code=metadata.likewize_model_code,
                        likewize_code_raw=item.get('M_Model')
                    )

                    if capacidad_id:
                        capacidad = CapacidadModel.objects.filter(id=capacidad_id).first()
                        confidence = 0.85  # Confianza alta para mapeo tradicional
                        match_type = 'traditional_fallback'

                processed_item = {
                    'likewize_item': item,
                    'capacidad': capacidad,
                    'confidence': confidence,
                    'match_type': match_type,
                    'precio': precio,
                    'needs_review': confidence < confidence_threshold
                }

                if capacidad:
                    if match_type.endswith('knowledge'):
                        predicted_count += 1
                    else:
                        learned_count += 1

                processed_items.append(processed_item)
                processed_count += 1

                # Mostrar progreso cada 100 items
                if processed_count % 100 == 0:
                    progress_pct = int((processed_count / total_items) * 100)
                    mapped_total = predicted_count + learned_count
                    avg_conf = self._calculate_avg_confidence(processed_items)
                    tarea.add_log(
                        f"🔄 Procesados {processed_count}/{total_items} items ({progress_pct}%) - "
                        f"Mapeados: {mapped_total}, Confianza: {avg_conf:.2f}",
                        "INFO"
                    )
                    self.stdout.write(
                        f"Procesados {processed_count}/{total_items} items. "
                        f"Mapeados: {mapped_total}, "
                        f"Confianza promedio: {avg_conf:.3f}"
                    )

            except Exception as e:
                tarea.add_log(f"⚠️ Error procesando item: {str(e)[:100]}", "WARNING")
                logger.error(f"Error procesando item {item.get('ModelName', 'Unknown')}: {e}")
                continue

        # Actualizar métricas de sesión
        learning_session.items_learned = learned_count
        learning_session.items_predicted = predicted_count
        learning_session.save()

        return processed_items

    def _extract_price(self, item: Dict) -> Optional[Decimal]:
        """
        Extrae precio del item de Likewize y quita el IVA.

        Likewize devuelve precios CON IVA del 21%, pero el sistema almacena
        todos los precios B2B SIN IVA. Por tanto, dividimos por 1.21 para
        obtener el precio neto.

        Ejemplo: 121€ (con IVA) → 100€ (sin IVA)
        """
        model_value = item.get('ModelValue')
        if model_value and model_value > 0:
            # Precio con IVA → Precio sin IVA (dividir por 1.21)
            precio_con_iva = Decimal(str(model_value))
            precio_sin_iva = precio_con_iva / Decimal('1.21')
            return precio_sin_iva.quantize(Decimal('0.01'))  # Redondear a 2 decimales
        return None

    def _calculate_avg_confidence(self, processed_items: List[Dict]) -> float:
        """Calcula confianza promedio"""
        if not processed_items:
            return 0.0

        confidences = [item['confidence'] for item in processed_items if item['capacidad']]
        return sum(confidences) / len(confidences) if confidences else 0.0

    def _save_to_staging(
        self,
        processed_items: List[Dict],
        tarea: TareaActualizacionLikewize,
        learning_session: LearningSession
    ):
        """Guarda los items procesados en staging"""

        # Inicializar extractores de metadatos para cada marca
        extractors = {
            'apple': AppleMetadataExtractor(),
            'google': GoogleMetadataExtractor(),
            'samsung': SamsungMetadataExtractor(),
        }

        staging_items = []

        for item_data in processed_items:
            likewize_item = item_data['likewize_item']
            capacidad = item_data['capacidad']

            # Determinar marca y seleccionar extractor apropiado
            brand = likewize_item.get('BrandName') or 'Apple'
            brand_key = brand.lower()
            extractor = extractors.get(brand_key, extractors['apple'])

            # Extraer metadatos usando el extractor apropiado
            metadata = extractor.extract_metadata(likewize_item)

            # Crear staging item con metadatos correctos
            staging_item = LikewizeItemStaging(
                tarea=tarea,
                tipo=metadata.device_type,  # ✅ Usa tipo específico (Mac Pro, MacBook Pro, etc.)
                marca=metadata.brand or brand,  # Fallback a la marca del item si metadata.brand es None
                modelo_norm=metadata.model_normalized,
                modelo_raw=metadata.model_raw,
                almacenamiento_gb=metadata.capacity_gb,
                precio_b2b=item_data['precio'],
                capacidad_id=capacidad.id if capacidad else None,
                likewize_model_code=metadata.likewize_model_code,  # ✅ A-number o M_Model inteligente
                pulgadas=metadata.screen_size,
                any=metadata.year,
                a_number=metadata.a_number,
                cpu=metadata.cpu
            )

            staging_items.append(staging_item)

        # Guardar en lotes para eficiencia
        batch_size = 1000
        total_saved = 0

        with transaction.atomic():
            for i in range(0, len(staging_items), batch_size):
                batch = staging_items[i:i + batch_size]
                LikewizeItemStaging.objects.bulk_create(batch, ignore_conflicts=True)
                total_saved += len(batch)

        self.stdout.write(f"Guardados {total_saved} items en staging")

    def _parse_storage(self, capacity_str: str) -> Optional[int]:
        """Parsea capacidad de almacenamiento"""
        if not capacity_str:
            return None

        import re
        match = re.search(r'(\d+(?:\.\d+)?)\s*(TB|GB)', capacity_str, re.I)
        if match:
            value = float(match.group(1))
            unit = match.group(2).upper()
            return int(value * 1024) if unit == 'TB' else int(value)

        return None

    def _show_summary(
        self,
        tarea: TareaActualizacionLikewize,
        learning_session: LearningSession,
        execution_time: float
    ):
        """Muestra resumen de la ejecución"""

        # Obtener estadísticas de staging
        staging_stats = LikewizeItemStaging.objects.filter(tarea=tarea).aggregate(
            total=models.Count('id'),
            mapped=models.Count('id', filter=models.Q(capacidad_id__isnull=False))
        )

        self.stdout.write("\n" + "="*60)
        self.stdout.write(self.style.SUCCESS("RESUMEN DE ACTUALIZACIÓN V3"))
        self.stdout.write("="*60)

        self.stdout.write(f"Tarea ID: {tarea.id}")
        self.stdout.write(f"Tiempo de ejecución: {execution_time:.2f} segundos")
        self.stdout.write(f"Items procesados: {learning_session.total_items_processed}")
        self.stdout.write(f"Items guardados: {staging_stats['total']}")
        self.stdout.write(f"Items mapeados: {staging_stats['mapped']}")

        if staging_stats['total'] > 0:
            tasa_mapeo = staging_stats['mapped'] / staging_stats['total'] * 100
            self.stdout.write(f"Tasa de mapeo: {tasa_mapeo:.1f}%")

        self.stdout.write("\nMÉTRICAS DE AUTOAPRENDIZAJE:")
        self.stdout.write(f"Items aprendidos: {learning_session.items_learned or 0}")
        self.stdout.write(f"Items predichos: {learning_session.items_predicted or 0}")

        avg_conf = learning_session.avg_confidence
        if avg_conf is not None:
            self.stdout.write(f"Confianza promedio: {avg_conf:.3f}")
        else:
            self.stdout.write(f"Confianza promedio: N/A")

        self.stdout.write("\n" + "="*60)

        unmapped_count = staging_stats['total'] - staging_stats['mapped']
        if unmapped_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"⚠️  {unmapped_count} items sin mapear necesitan revisión manual"
                )
            )

        self.stdout.write(
            self.style.SUCCESS("✅ Actualización V3 completada exitosamente")
        )