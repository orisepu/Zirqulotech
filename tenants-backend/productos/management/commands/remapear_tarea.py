"""
Management command para remapear una tarea con sistema v4.
"""

from django.core.management.base import BaseCommand
from productos.models import TareaActualizacionLikewize, LikewizeItemStaging
from productos.mapping import map_device


class Command(BaseCommand):
    help = 'Remapea una tarea existente usando sistema v4'

    def add_arguments(self, parser):
        parser.add_argument('tarea_id', type=str, help='UUID de la tarea a remapear')
        parser.add_argument(
            '--system',
            type=str,
            default='v4',
            choices=['v4', 'v3', 'auto'],
            help='Sistema de mapeo a usar (default: v4)'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limitar número de items a remapear (para testing)'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Remapear TODOS los items (no solo los sin mapear)'
        )

    def handle(self, *args, **options):
        tarea_id = options['tarea_id']
        mapping_system = options['system']
        limit = options['limit']
        remap_all = options['all']

        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(self.style.SUCCESS(f"Remapeando tarea: {tarea_id}"))
        self.stdout.write(self.style.SUCCESS(f"Sistema: {mapping_system}"))
        if remap_all:
            self.stdout.write(self.style.WARNING(f"Modo: REMAPEAR TODOS (incluye ya mapeados)"))
        self.stdout.write("=" * 70 + "\n")

        # Verificar que existe la tarea
        try:
            tarea = TareaActualizacionLikewize.objects.get(pk=tarea_id)
            self.stdout.write(self.style.SUCCESS(f"✓ Tarea encontrada"))
            self.stdout.write(f"  Estado: {tarea.estado}")
        except TareaActualizacionLikewize.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"✗ Tarea no encontrada: {tarea_id}"))
            return

        # Obtener items a remapear
        if remap_all:
            # Remapear TODOS los items
            items_to_remap = LikewizeItemStaging.objects.filter(tarea=tarea)
            unmapped = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=True)
        else:
            # Solo remapear los sin mapear (comportamiento anterior)
            items_to_remap = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=True)
            unmapped = items_to_remap

        total = LikewizeItemStaging.objects.filter(tarea=tarea).count()
        mapped_before = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=False).count()

        self.stdout.write(f"\nEstadísticas ANTES del remapeo:")
        self.stdout.write(f"  Total items: {total}")
        self.stdout.write(f"  Mapeados: {mapped_before}")
        self.stdout.write(f"  Sin mapear: {unmapped.count()}")
        if remap_all:
            self.stdout.write(self.style.WARNING(f"  Items a remapear: {items_to_remap.count()} (TODOS)"))

        if items_to_remap.count() == 0:
            self.stdout.write(self.style.SUCCESS("\n✓ No hay items para remapear!"))
            return

        # Aplicar límite si se especificó
        if limit:
            items_to_remap = items_to_remap[:limit]
            self.stdout.write(f"\n⚠️  Limitando a {limit} items para remapear")

        if remap_all:
            self.stdout.write(f"\nEjemplos de items a remapear (primeros 5):")
        else:
            self.stdout.write(f"\nEjemplos de items sin mapear (primeros 5):")
        for item in items_to_remap[:5]:
            status = "✓" if item.capacidad_id else "✗"
            self.stdout.write(f"  {status} {item.modelo_raw or item.modelo_norm}")

        # Remapear items
        self.stdout.write(f"\n{'='*70}")
        self.stdout.write(self.style.SUCCESS(f"Iniciando remapeo con {mapping_system}..."))
        self.stdout.write(f"{'='*70}\n")

        mapped_count = 0
        failed_count = 0
        remapped_count = 0  # Items que estaban mapeados y se remapearon
        total_to_process = items_to_remap.count()

        for i, item in enumerate(items_to_remap, 1):
            was_mapped = item.capacidad_id is not None
            try:
                # Mostrar progreso cada 10 items
                if i % 10 == 0 or i == 1:
                    self.stdout.write(f"Procesando {i}/{total_to_process}...", ending='')

                # Preparar datos para v4
                full_name = item.modelo_raw or item.modelo_norm or ""
                if not full_name:
                    failed_count += 1
                    continue

                # Usar sistema de mapeo
                result = map_device(
                    {'FullName': full_name},
                    system=mapping_system
                )

                if result.get('success') and result.get('capacidad_id'):
                    # Actualizar staging con el mapeo exitoso
                    item.capacidad_id = result['capacidad_id']

                    # Guardar metadatos del mapeo
                    item.mapping_metadata = {
                        'confidence_score': result.get('confidence', 0) * 100,
                        'mapping_algorithm': result.get('strategy', 'unknown'),
                        'needs_review': result.get('confidence', 0) < 0.85,
                        'is_mapped': True
                    }

                    item.save(update_fields=['capacidad_id', 'mapping_metadata'])
                    mapped_count += 1
                    if was_mapped:
                        remapped_count += 1

                    # Mostrar mapeos exitosos
                    if i % 10 == 0 or i == 1:
                        self.stdout.write(self.style.SUCCESS(" ✓"))
                else:
                    # No encontró match, pero puede haber sugerencia de crear capacidad
                    # IMPORTANTE: Si estábamos remapeando un item ya mapeado y v4 no encuentra match,
                    # limpiar el capacidad_id anterior (era un mapeo incorrecto)
                    if was_mapped and remap_all:
                        item.capacidad_id = None

                    # Guardar metadata incluso si no hubo match exitoso
                    metadata = {
                        'confidence_score': result.get('confidence', 0) * 100 if result.get('confidence') else None,
                        'mapping_algorithm': result.get('strategy'),
                        'needs_review': True,
                        'is_mapped': False,
                        'needs_capacity_creation': result.get('needs_capacity_creation', False)
                    }

                    # Incluir información adicional si v4 sugiere crear capacidad
                    if result.get('suggested_capacity'):
                        metadata['suggested_capacity'] = result['suggested_capacity']
                    if result.get('v3_skipped'):
                        metadata['v3_skipped'] = result['v3_skipped']
                        metadata['v3_skip_reason'] = result.get('v3_skip_reason')

                    item.mapping_metadata = metadata
                    item.save(update_fields=['capacidad_id', 'mapping_metadata'])

                    failed_count += 1
                    if i % 10 == 0 or i == 1:
                        self.stdout.write(self.style.WARNING(" ✗"))

            except Exception as e:
                failed_count += 1
                if i % 10 == 0 or i == 1:
                    self.stdout.write(self.style.ERROR(f" ERROR: {str(e)}"))

        # Estadísticas finales
        mapped_after = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=False).count()
        unmapped_after = LikewizeItemStaging.objects.filter(tarea=tarea, capacidad_id__isnull=True).count()

        self.stdout.write(f"\n{'='*70}")
        self.stdout.write(self.style.SUCCESS("Remapeo completado"))
        self.stdout.write(f"{'='*70}\n")

        self.stdout.write(f"Estadísticas DESPUÉS del remapeo:")
        self.stdout.write(f"  Total items: {total}")
        self.stdout.write(f"  Mapeados: {mapped_after} (antes: {mapped_before})")
        self.stdout.write(f"  Sin mapear: {unmapped_after} (antes: {unmapped.count()})")
        self.stdout.write(self.style.SUCCESS(f"  ✓ Nuevos mapeos: {mapped_count}"))
        if remap_all and remapped_count > 0:
            self.stdout.write(self.style.WARNING(f"  ↻ Remapeados (cambiados): {remapped_count}"))
        self.stdout.write(self.style.WARNING(f"  ✗ Fallidos: {failed_count}"))

        # Mostrar ejemplos de items recién mapeados
        if mapped_count > 0:
            newly_mapped = LikewizeItemStaging.objects.filter(
                tarea=tarea,
                capacidad_id__isnull=False,
                mapping_metadata__isnull=False
            ).order_by('-id')[:5]

            self.stdout.write(f"\nEjemplos de items recién mapeados (últimos 5):")
            for item in newly_mapped:
                metadata = item.mapping_metadata or {}
                self.stdout.write(f"  - {item.modelo_raw or item.modelo_norm}")
                self.stdout.write(f"    → Capacidad ID: {item.capacidad_id}")
                self.stdout.write(f"    → Confidence: {metadata.get('confidence_score', 0):.1f}%")
                self.stdout.write(f"    → Algorithm: {metadata.get('mapping_algorithm', 'N/A')}")

        self.stdout.write(f"\n{'='*70}\n")
