"""
Management command para actualizar precios B2B aplicando +5% y redondeo a múltiplos de 10€.

Uso:
    python manage.py actualizar_precios_b2b --dry-run          # Previsualización
    python manage.py actualizar_precios_b2b --fuente Likewize  # Solo Likewize
    python manage.py actualizar_precios_b2b                    # Aplicar todos
"""
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from productos.models.precios import PrecioRecompra


class Command(BaseCommand):
    help = 'Actualiza precios B2B vigentes aplicando +5% y redondeo a múltiplos de 10€'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Previsualizar cambios sin aplicar',
        )
        parser.add_argument(
            '--fuente',
            type=str,
            help='Filtrar por fuente específica (ej: Likewize, manual)',
        )
        parser.add_argument(
            '--min-precio',
            type=float,
            default=0,
            help='Precio mínimo para filtrar (default: 0)',
        )
        parser.add_argument(
            '--max-precio',
            type=float,
            help='Precio máximo para filtrar (opcional)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        fuente = options.get('fuente')
        min_precio = Decimal(str(options['min_precio']))
        max_precio = Decimal(str(options['max_precio'])) if options.get('max_precio') else None

        self.stdout.write(self.style.WARNING('\n' + '='*70))
        self.stdout.write(self.style.WARNING('  ACTUALIZACIÓN MASIVA DE PRECIOS B2B'))
        self.stdout.write(self.style.WARNING('='*70 + '\n'))

        # Filtrar precios B2B vigentes
        qs = PrecioRecompra.objects.filter(
            canal='B2B',
            valid_to__isnull=True,
            tenant_schema__isnull=True,
        )

        if fuente:
            qs = qs.filter(fuente=fuente)
            self.stdout.write(f"🔍 Filtrando por fuente: {fuente}")

        qs = qs.filter(precio_neto__gte=min_precio)
        if max_precio:
            qs = qs.filter(precio_neto__lte=max_precio)
            self.stdout.write(f"💰 Rango de precios: {min_precio}€ - {max_precio}€")
        else:
            self.stdout.write(f"💰 Precio mínimo: {min_precio}€")

        # Seleccionar campos necesarios con relación a capacidad/modelo
        qs = qs.select_related('capacidad', 'capacidad__modelo').order_by('precio_neto')

        total = qs.count()

        if total == 0:
            self.stdout.write(self.style.WARNING('\n⚠️  No se encontraron precios B2B vigentes con los filtros especificados.\n'))
            return

        self.stdout.write(f"\n📊 Registros encontrados: {total}")

        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 MODO DRY-RUN (no se aplicarán cambios)\n'))
        else:
            self.stdout.write(self.style.ERROR('⚡ MODO EJECUCIÓN (los cambios serán permanentes)\n'))

        # Calcular cambios
        cambios = []
        for precio_obj in qs:
            precio_actual = Decimal(precio_obj.precio_neto)

            # Fórmula: +5% y redondeo a múltiplos de 10€
            precio_con_incremento = precio_actual * Decimal('1.05')
            precio_nuevo = (precio_con_incremento / 10).quantize(Decimal('1')) * 10

            # Solo actualizar si hay cambio real
            if precio_nuevo != precio_actual:
                delta = precio_nuevo - precio_actual
                pct_cambio = (delta / precio_actual * 100) if precio_actual > 0 else 0

                # Obtener info del modelo
                try:
                    modelo_desc = precio_obj.capacidad.modelo.descripcion if precio_obj.capacidad and precio_obj.capacidad.modelo else 'N/A'
                    cap_tamano = precio_obj.capacidad.tamaño if precio_obj.capacidad else 'N/A'
                except Exception:
                    modelo_desc = 'N/A'
                    cap_tamano = 'N/A'

                cambios.append({
                    'obj': precio_obj,
                    'precio_actual': precio_actual,
                    'precio_nuevo': precio_nuevo,
                    'delta': delta,
                    'pct_cambio': pct_cambio,
                    'modelo': modelo_desc,
                    'capacidad': cap_tamano,
                })

        if not cambios:
            self.stdout.write(self.style.SUCCESS('\n✅ Todos los precios ya están correctamente ajustados.\n'))
            return

        # Mostrar resumen estadístico
        self.stdout.write(self.style.SUCCESS(f'\n📈 Cambios a aplicar: {len(cambios)}\n'))

        # Mostrar primeros y últimos cambios
        max_mostrar = 10
        self.stdout.write(self.style.HTTP_INFO('Primeros cambios:'))
        for i, cambio in enumerate(cambios[:max_mostrar], 1):
            self.stdout.write(
                f"  {i:3d}. {cambio['modelo']:30s} {cambio['capacidad']:10s} | "
                f"{float(cambio['precio_actual']):7.2f}€ → {float(cambio['precio_nuevo']):7.2f}€ "
                f"({float(cambio['delta']):+6.2f}€, {float(cambio['pct_cambio']):+5.2f}%)"
            )

        if len(cambios) > max_mostrar * 2:
            self.stdout.write(f"  ... ({len(cambios) - max_mostrar * 2} registros omitidos) ...")

        if len(cambios) > max_mostrar:
            self.stdout.write(self.style.HTTP_INFO('\nÚltimos cambios:'))
            for i, cambio in enumerate(cambios[-max_mostrar:], len(cambios) - max_mostrar + 1):
                self.stdout.write(
                    f"  {i:3d}. {cambio['modelo']:30s} {cambio['capacidad']:10s} | "
                    f"{float(cambio['precio_actual']):7.2f}€ → {float(cambio['precio_nuevo']):7.2f}€ "
                    f"({float(cambio['delta']):+6.2f}€, {float(cambio['pct_cambio']):+5.2f}%)"
                )

        # Estadísticas
        total_delta = sum(c['delta'] for c in cambios)
        promedio_delta = total_delta / len(cambios)
        promedio_pct = sum(c['pct_cambio'] for c in cambios) / len(cambios)

        self.stdout.write('\n' + '─'*70)
        self.stdout.write(self.style.SUCCESS(f'📊 RESUMEN ESTADÍSTICO:'))
        self.stdout.write(f'   Total registros a actualizar: {len(cambios)}')
        self.stdout.write(f'   Incremento total: {float(total_delta):,.2f}€')
        self.stdout.write(f'   Incremento promedio: {float(promedio_delta):,.2f}€ ({float(promedio_pct):.2f}%)')
        self.stdout.write('─'*70 + '\n')

        if dry_run:
            self.stdout.write(self.style.WARNING('✋ DRY-RUN completado. No se realizaron cambios.\n'))
            self.stdout.write('Para aplicar los cambios, ejecuta el comando sin --dry-run\n')
            return

        # Confirmación en modo ejecución
        confirmacion = input('\n⚠️  ¿Deseas aplicar estos cambios? Escribe "SI" para confirmar: ')

        if confirmacion.strip().upper() != 'SI':
            self.stdout.write(self.style.ERROR('\n❌ Operación cancelada por el usuario.\n'))
            return

        # Aplicar cambios con transacción
        self.stdout.write(self.style.WARNING('\n⚡ Aplicando cambios...'))

        now = timezone.now()
        actualizados = 0
        creados = 0

        try:
            with transaction.atomic():
                for cambio in cambios:
                    precio_obj = cambio['obj']

                    # Cerrar el precio actual
                    precio_obj.valid_to = now
                    precio_obj.save(update_fields=['valid_to', 'updated_at'])
                    actualizados += 1

                    # Crear nuevo precio
                    PrecioRecompra.objects.create(
                        capacidad_id=precio_obj.capacidad_id,
                        canal=precio_obj.canal,
                        fuente=precio_obj.fuente,
                        moneda=precio_obj.moneda,
                        precio_neto=cambio['precio_nuevo'],
                        valid_from=now,
                        valid_to=None,
                        tenant_schema=precio_obj.tenant_schema,
                        changed_by=None,  # Sistema automático
                    )
                    creados += 1

                self.stdout.write(self.style.SUCCESS(f'\n✅ Actualización completada exitosamente!'))
                self.stdout.write(f'   • Precios cerrados (historial): {actualizados}')
                self.stdout.write(f'   • Nuevos precios creados: {creados}')
                self.stdout.write(f'   • Incremento total aplicado: {float(total_delta):,.2f}€\n')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Error durante la actualización: {str(e)}\n'))
            raise CommandError(f'La operación falló: {str(e)}')

        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(self.style.SUCCESS('  PROCESO COMPLETADO'))
        self.stdout.write(self.style.SUCCESS('='*70 + '\n'))
