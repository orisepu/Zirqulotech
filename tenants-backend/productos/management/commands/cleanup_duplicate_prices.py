"""
Management command para detectar y limpiar precios vigentes duplicados.

Este comando identifica capacidades que tienen múltiples precios vigentes
simultáneamente (debido al constraint antiguo que incluía 'fuente') y
cierra automáticamente todos excepto el más reciente.

Uso:
    python manage.py cleanup_duplicate_prices --dry-run  # Previsualización
    python manage.py cleanup_duplicate_prices --apply    # Aplicar cambios
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from productos.models.precios import PrecioRecompra


class Command(BaseCommand):
    help = 'Detecta y limpia precios vigentes duplicados (múltiples fuentes para misma capacidad)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Previsualizar cambios sin aplicar',
        )
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Aplicar cambios (cerrar precios duplicados)',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        apply = options.get('apply', False)

        if not dry_run and not apply:
            self.stdout.write(self.style.ERROR(
                'Debes especificar --dry-run o --apply'
            ))
            return

        self.stdout.write(self.style.WARNING('\n' + '='*70))
        self.stdout.write(self.style.WARNING('  LIMPIEZA DE PRECIOS VIGENTES DUPLICADOS'))
        self.stdout.write(self.style.WARNING('='*70 + '\n'))

        if dry_run:
            self.stdout.write(self.style.NOTICE('Modo: PREVISUALIZACIÓN (no se aplicarán cambios)\n'))
        else:
            self.stdout.write(self.style.ERROR('Modo: APLICAR CAMBIOS\n'))

        # Buscar capacidades con múltiples precios vigentes
        self.stdout.write('🔍 Buscando capacidades con múltiples precios vigentes...\n')

        # Agrupar por (capacidad, canal, tenant_schema) y contar precios vigentes
        duplicates = (
            PrecioRecompra.objects
            .filter(valid_to__isnull=True)  # Solo vigentes
            .values('capacidad_id', 'canal', 'tenant_schema')
            .annotate(count=Count('id'))
            .filter(count__gt=1)  # Más de 1 precio vigente
            .order_by('capacidad_id')
        )

        total_duplicates = duplicates.count()

        if total_duplicates == 0:
            self.stdout.write(self.style.SUCCESS('✅ No se encontraron duplicados. Sistema OK.\n'))
            return

        self.stdout.write(self.style.WARNING(
            f'⚠️  Encontradas {total_duplicates} capacidades con precios duplicados\n'
        ))

        total_closed = 0
        total_kept = 0

        for dup in duplicates:
            capacidad_id = dup['capacidad_id']
            canal = dup['canal']
            tenant_schema = dup['tenant_schema']
            count = dup['count']

            # Obtener todos los precios vigentes para esta capacidad
            precios_vigentes = (
                PrecioRecompra.objects
                .filter(
                    capacidad_id=capacidad_id,
                    canal=canal,
                    valid_to__isnull=True
                )
                .filter(
                    Q(tenant_schema=tenant_schema) if tenant_schema
                    else Q(tenant_schema__isnull=True)
                )
                .order_by('-valid_from', '-created_at')  # Más reciente primero
            )

            # El primero es el que mantenemos, el resto se cierran
            precio_a_mantener = precios_vigentes.first()
            precios_a_cerrar = list(precios_vigentes[1:])

            self.stdout.write(f'\n📦 Capacidad {capacidad_id} ({canal}):')
            self.stdout.write(f'   • Total vigentes: {count}')
            self.stdout.write(
                f'   • Mantener: {precio_a_mantener.precio_neto}€ '
                f'(fuente: {precio_a_mantener.fuente}, '
                f'desde: {precio_a_mantener.valid_from.strftime("%Y-%m-%d %H:%M")})'
            )

            for precio in precios_a_cerrar:
                self.stdout.write(
                    f'   • Cerrar:   {precio.precio_neto}€ '
                    f'(fuente: {precio.fuente}, '
                    f'desde: {precio.valid_from.strftime("%Y-%m-%d %H:%M")})'
                )

            total_kept += 1
            total_closed += len(precios_a_cerrar)

            # Aplicar cambios si no es dry-run
            if apply:
                with transaction.atomic():
                    now = timezone.now()
                    for precio in precios_a_cerrar:
                        precio.valid_to = now
                        precio.save(update_fields=['valid_to'])

        # Resumen final
        self.stdout.write('\n' + '='*70)
        self.stdout.write(self.style.SUCCESS('\n📊 RESUMEN:'))
        self.stdout.write(f'   • Capacidades afectadas: {total_duplicates}')
        self.stdout.write(f'   • Precios a mantener:    {total_kept}')
        self.stdout.write(f'   • Precios a cerrar:      {total_closed}')

        if dry_run:
            self.stdout.write(self.style.NOTICE(
                '\n⚠️  Esto fue una previsualización. '
                'Ejecuta con --apply para aplicar cambios.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'\n✅ Se cerraron {total_closed} precios duplicados correctamente.'
            ))

        self.stdout.write('='*70 + '\n')
