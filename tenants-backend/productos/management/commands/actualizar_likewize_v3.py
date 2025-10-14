import asyncio
import aiohttp
import json
import logging
import re
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
from productos.services.metadata_extractors import (
    AppleMetadataExtractor,
    GoogleMetadataExtractor,
    SamsungMetadataExtractor
)
from productos.likewize_config import get_apple_presets, get_extra_presets

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Actualización de precios Likewize usando sistema de mapeo v4'

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
        parser.add_argument(
            '--mapping-system',
            type=str,
            default='v4',
            choices=['v4'],
            help='Sistema de mapeo (v4 únicamente)'
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

            # Crear sesión de aprendizaje (solo para métricas)
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
                tarea, learning_session, options
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

        # 3. Procesar con v4 (síncrono)
        tarea.subestado = "Procesando con v4"
        tarea.add_log(f"🤖 Procesando {len(likewize_data)} items con v4...", "INFO")
        tarea.save()

        processed_items = self._process_with_v4(
            likewize_data, learning_session, options, tarea
        )

        # 4. Guardar en staging (síncrono)
        if not options['dry_run']:
            tarea.subestado = "Guardando en staging"
            tarea.add_log(f"💾 Guardando {len(processed_items)} items en staging...", "INFO")
            tarea.save()

            self._save_to_staging(processed_items, tarea, learning_session)
            tarea.add_log(f"✅ Items guardados en staging correctamente", "SUCCESS")

        tarea.subestado = "Completado"
        tarea.add_log(f"🎉 Actualización completada exitosamente (sistema: V4)", "SUCCESS")
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
        """
        Obtiene datos para un preset específico.

        ACTUALIZADO: 2025-10-14 - Filtro mejorado para Samsung NO europeos
        incluye sufijos J (Japón), C/E/D (China), SC-/SCV/SCG (códigos japoneses)
        """

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
        if exclude_list or preset.get('marca') == 'Samsung':
            original_count = len(data)

            # Patrones regex para detectar variantes regionales no europeas de Samsung
            # Sufijos: U/U1 (USA), W (Canada), N (Korea), Q (China), V (Verizon), J (Japón)
            # Códigos especiales japoneses: SC-, SCV, SCG
            # Sufijos China: C, E, D
            NON_EUROPEAN_SAMSUNG_PATTERN = re.compile(
                r'(?:SM-[A-Z]\d+[NUWVQJCED](?:1)?|SC-[A-Z0-9]+|SCV\d+|SCG\d+)\b',
                re.IGNORECASE
            )

            # Función auxiliar para verificar si un item debe ser excluido
            def should_exclude_item(item):
                """
                Verifica si el item debe ser excluido basándose en la lista de exclusión
                y patrones regex de variantes regionales.

                Para Samsung, detecta automáticamente variantes no europeas por sufijos:
                - U/U1: Estados Unidos
                - W: Canadá
                - N: Corea del Sur
                - Q: China (Qualcomm)
                - V: Verizon (USA)
                - J: Japón
                - C/E/D: China y otros mercados asiáticos
                - SC-/SCV/SCG: Códigos especiales japoneses

                Busca el código de modelo en los campos M_Model, ModelName y FullName.
                Los códigos excluidos suelen aparecer dentro de strings más largos
                (ej: "Galaxy Note10 Plus 5G SM-N976U" contiene "SM-N976U").
                """
                m_model = item.get('M_Model', '')
                model_name = item.get('ModelName', '')
                full_name = item.get('FullName', '')

                # Concatenar todos los campos para búsqueda
                all_fields = f"{m_model} {model_name} {full_name}"

                # 1. Buscar por lista explícita de exclusión
                if exclude_list:
                    for excluded_code in exclude_list:
                        if (excluded_code in m_model or
                            excluded_code in model_name or
                            excluded_code in full_name):
                            return True

                # 2. Filtro adicional por patrón regex para Samsung
                if preset.get('marca') == 'Samsung':
                    if NON_EUROPEAN_SAMSUNG_PATTERN.search(all_fields):
                        return True

                return False

            # Filtrar items
            data_before_filter = data
            data = [item for item in data if not should_exclude_item(item)]

            filtered_count = original_count - len(data)
            if filtered_count > 0:
                logger.info(f"Filtrados {filtered_count} modelos excluidos de {preset.get('marca', 'Unknown')}")

                # Log adicional para Samsung con detalles de filtrado regex
                if preset.get('marca') == 'Samsung' and filtered_count > 0:
                    # Contar cuántos fueron por lista explícita vs patrón regex
                    explicit_filtered = 0
                    pattern_filtered = 0
                    for item in data_before_filter:
                        if item not in data:
                            m_model = item.get('M_Model', '')
                            model_name = item.get('ModelName', '')
                            full_name = item.get('FullName', '')
                            all_fields = f"{m_model} {model_name} {full_name}"

                            # Verificar si fue por lista explícita
                            explicit_match = any(
                                code in m_model or code in model_name or code in full_name
                                for code in exclude_list
                            )

                            if explicit_match:
                                explicit_filtered += 1
                            elif NON_EUROPEAN_SAMSUNG_PATTERN.search(all_fields):
                                pattern_filtered += 1

                    logger.info(
                        f"Samsung: {explicit_filtered} filtrados por lista explícita, "
                        f"{pattern_filtered} por patrón regex (variantes regionales)"
                    )

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

    def _process_with_v4(
        self,
        likewize_data: List[Dict],
        learning_session: LearningSession,
        options: Dict,
        tarea: TareaActualizacionLikewize
    ) -> List[Dict]:
        """Procesa los datos usando SOLO el sistema v4"""

        processed_items = []
        confidence_threshold = options['confidence_threshold']

        total_items = len(likewize_data)
        learning_session.total_items_processed = total_items

        processed_count = 0
        mapped_count = 0

        # Obtener modelo de capacidades
        CapacidadModel = apps.get_model(settings.CAPACIDAD_MODEL)

        # Import de v4
        from productos.mapping import map_device

        for item in likewize_data:
            try:
                # Extraer precio
                precio = self._extract_price(item)
                if not precio:
                    continue

                # ============================================
                # SOLO V4 - Sin fallbacks
                # ============================================
                result_v4 = map_device(item, system='v4')

                capacidad = None
                confidence = 0.0
                match_type = None

                if result_v4['success']:
                    capacidad_id = result_v4['capacidad_id']
                    capacidad = CapacidadModel.objects.filter(id=capacidad_id).first()
                    confidence = result_v4.get('confidence', 0.0)
                    match_type = f"v4_{result_v4.get('strategy', 'unknown')}"
                    mapped_count += 1

                processed_item = {
                    'likewize_item': item,
                    'capacidad': capacidad,
                    'confidence': confidence,
                    'match_type': match_type,
                    'precio': precio,
                    'needs_review': confidence < confidence_threshold,
                    'result_v4': result_v4  # Incluir resultado completo para metadata
                }

                processed_items.append(processed_item)
                processed_count += 1

                # Mostrar progreso cada 100 items
                if processed_count % 100 == 0:
                    progress_pct = int((processed_count / total_items) * 100)
                    avg_conf = self._calculate_avg_confidence(processed_items)
                    tarea.add_log(
                        f"🔄 Procesados {processed_count}/{total_items} items ({progress_pct}%) - "
                        f"Mapeados: {mapped_count}, Confianza: {avg_conf:.2f}",
                        "INFO"
                    )
                    self.stdout.write(
                        f"Procesados {processed_count}/{total_items} items. "
                        f"Mapeados: {mapped_count}, "
                        f"Confianza promedio: {avg_conf:.3f}"
                    )

            except Exception as e:
                tarea.add_log(f"⚠️ Error procesando item: {str(e)[:100]}", "WARNING")
                logger.error(f"Error procesando item {item.get('ModelName', 'Unknown')}: {e}")
                continue

        # Actualizar métricas de sesión
        learning_session.items_predicted = mapped_count
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
            result_v4 = item_data.get('result_v4')  # Resultado completo de v4

            # Determinar marca y seleccionar extractor apropiado
            brand = likewize_item.get('BrandName') or 'Apple'
            brand_key = brand.lower()
            extractor = extractors.get(brand_key, extractors['apple'])

            # Extraer metadatos usando el extractor apropiado
            metadata = extractor.extract_metadata(likewize_item)

            # Construir mapping_metadata basado en el resultado
            mapping_metadata = None
            if capacidad is not None or result_v4:
                mapping_metadata = {
                    'confidence_score': item_data['confidence'] * 100 if capacidad else None,  # 0-100
                    'mapping_algorithm': item_data['match_type'] if capacidad else None,
                    'needs_review': item_data['needs_review'] if capacidad else False,
                    'is_mapped': capacidad is not None
                }

                # Si hay resultado de v4, incluir campos adicionales
                if result_v4:
                    mapping_metadata['needs_capacity_creation'] = result_v4.get('needs_capacity_creation', False)
                    if result_v4.get('suggested_capacity'):
                        mapping_metadata['suggested_capacity'] = result_v4['suggested_capacity']
                    if result_v4.get('v3_skipped'):
                        mapping_metadata['v3_skipped'] = result_v4['v3_skipped']
                        mapping_metadata['v3_skip_reason'] = result_v4.get('v3_skip_reason')

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
                cpu=metadata.cpu,
                # Metadatos del sistema de mapeo
                mapping_metadata=mapping_metadata
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
        self.stdout.write(self.style.SUCCESS("RESUMEN DE ACTUALIZACIÓN (V4)"))
        self.stdout.write("="*60)

        self.stdout.write(f"Tarea ID: {tarea.id}")
        self.stdout.write(f"Tiempo de ejecución: {execution_time:.2f} segundos")
        self.stdout.write(f"Items procesados: {learning_session.total_items_processed}")
        self.stdout.write(f"Items guardados: {staging_stats['total']}")
        self.stdout.write(f"Items mapeados: {staging_stats['mapped']}")

        if staging_stats['total'] > 0:
            tasa_mapeo = staging_stats['mapped'] / staging_stats['total'] * 100
            self.stdout.write(f"Tasa de mapeo: {tasa_mapeo:.1f}%")

        self.stdout.write("\nMÉTRICAS DE MAPEO:")
        self.stdout.write(f"Items mapeados con v4: {learning_session.items_predicted or 0}")

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
            self.style.SUCCESS("✅ Actualización completada exitosamente (sistema V4)")
        )