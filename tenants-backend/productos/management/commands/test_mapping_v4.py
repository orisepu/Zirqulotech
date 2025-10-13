"""
Management command para testear el sistema de mapeo v4.

Permite probar el sistema v4 con datos reales de Likewize,
comparar con v3, y ver resultados detallados.

Uso:
    # Testear un dispositivo especifico
    python manage.py test_mapping_v4 "iPhone 13 Pro 128GB"

    # Comparar v3 vs v4
    python manage.py test_mapping_v4 "iPhone 13 Pro 128GB" --compare

    # Usar solo v3
    python manage.py test_mapping_v4 "iPhone 13 Pro 128GB" --system v3

    # Probar varios dispositivos
    python manage.py test_mapping_v4 --batch

    # Ver logs detallados
    python manage.py test_mapping_v4 "iPhone 13 Pro 128GB" --verbose
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from decimal import Decimal
import json

from productos.mapping import map_device


class Command(BaseCommand):
    help = 'Testea el sistema de mapeo v4 con datos reales'

    def add_arguments(self, parser):
        # Dispositivo a testear
        parser.add_argument(
            'device_name',
            nargs='?',
            type=str,
            help='Nombre del dispositivo a testear (ej: "iPhone 13 Pro 128GB")'
        )

        # Sistema a usar
        parser.add_argument(
            '--system',
            type=str,
            default='auto',
            choices=['v3', 'v4', 'auto'],
            help='Que sistema usar (default: auto)'
        )

        # Comparar con v3
        parser.add_argument(
            '--compare',
            action='store_true',
            help='Comparar resultado de v4 con v3'
        )

        # Modo batch (testear varios dispositivos)
        parser.add_argument(
            '--batch',
            action='store_true',
            help='Probar una lista de dispositivos comunes'
        )

        # Verbose mode
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Mostrar logs detallados'
        )

        # JSON output
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output en formato JSON'
        )

    def handle(self, *args, **options):
        if options['batch']:
            self._run_batch_tests(options)
        elif options['device_name']:
            self._test_single_device(options['device_name'], options)
        else:
            raise CommandError(
                'Debes especificar un device_name o usar --batch'
            )

    def _test_single_device(self, device_name, options):
        """Testea un solo dispositivo."""
        self.stdout.write(self.style.NOTICE(f"\n=== Testing: {device_name} ===\n"))

        # Preparar input
        likewize_data = {
            'FullName': device_name,
        }

        # Mapear
        system = options['system']
        compare = options['compare']

        result = map_device(
            likewize_data,
            system=system,
            compare_with_v3=compare
        )

        # Output
        if options['json']:
            self.stdout.write(json.dumps(result, indent=2, default=str))
        else:
            self._print_result(result, options['verbose'])

        # Si hay comparacion, mostrarla
        if compare and 'comparison' in result:
            self._print_comparison(result['comparison'])

    def _run_batch_tests(self, options):
        """Ejecuta tests con una lista de dispositivos comunes."""
        test_devices = [
            # iPhones recientes
            'iPhone 13 Pro 128GB',
            'iPhone 13 Pro Max 256GB',
            'iPhone 13 128GB',
            'iPhone 13 Mini 512GB',

            # iPhone 14 series
            'iPhone 14 Pro 128GB',
            'iPhone 14 Pro Max 1TB',
            'iPhone 14 Plus 256GB',
            'iPhone 14 128GB',

            # iPhone 15 series
            'iPhone 15 Pro Max 256GB',
            'iPhone 15 Pro 128GB',
            'iPhone 15 Plus 512GB',
            'iPhone 15 128GB',

            # iPhone 16 series
            'iPhone 16 Pro Max 1TB',
            'iPhone 16 Pro 256GB',
            'iPhone 16 Plus 128GB',
            'iPhone 16 512GB',

            # Casos especiales
            'iPhone SE (3rd generation) 64GB',
            'iPhone XR 128GB',
            'iPhone 11 Pro Max 256GB',
        ]

        results = {
            'total': len(test_devices),
            'success': 0,
            'failed': 0,
            'details': []
        }

        self.stdout.write(self.style.NOTICE(f"\n=== Batch Testing: {len(test_devices)} devices ===\n"))

        for device_name in test_devices:
            result = map_device(
                {'FullName': device_name},
                system=options['system'],
                compare_with_v3=options['compare']
            )

            if result['success']:
                results['success'] += 1
                status = self.style.SUCCESS('✓')
            else:
                results['failed'] += 1
                status = self.style.ERROR('✗')

            self.stdout.write(
                f"{status} {device_name:50} -> "
                f"{result.get('modelo_descripcion', 'NO MATCH'):30} "
                f"(confidence: {result.get('confidence', 0):.2f})"
            )

            results['details'].append({
                'device': device_name,
                'success': result['success'],
                'modelo': result.get('modelo_descripcion'),
                'confidence': result.get('confidence', 0),
                'strategy': result.get('strategy'),
            })

        # Summary
        self.stdout.write(f"\n=== Summary ===")
        self.stdout.write(f"Total: {results['total']}")
        self.stdout.write(self.style.SUCCESS(f"Success: {results['success']}"))
        self.stdout.write(self.style.ERROR(f"Failed: {results['failed']}"))
        self.stdout.write(
            f"Success Rate: {results['success'] / results['total'] * 100:.1f}%"
        )

        if options['json']:
            self.stdout.write(f"\n=== JSON Output ===")
            self.stdout.write(json.dumps(results, indent=2, default=str))

    def _print_result(self, result, verbose=False):
        """Imprime el resultado de forma legible."""
        if result['success']:
            self.stdout.write(self.style.SUCCESS("\n✓ MATCH ENCONTRADO\n"))
            self.stdout.write(f"Modelo: {result['modelo_descripcion']}")
            self.stdout.write(f"Capacidad: {result['capacidad_tamanio']}")
            self.stdout.write(f"Capacidad ID: {result['capacidad_id']}")
            self.stdout.write(f"Modelo ID: {result['modelo_id']}")
            self.stdout.write(f"Confidence: {result['confidence']:.2f}")
            self.stdout.write(f"Strategy: {result['strategy']}")
            self.stdout.write(f"Version: {result.get('mapping_version', 'N/A')}")

            if verbose and result.get('features'):
                self.stdout.write(f"\n--- Features ---")
                features = result['features']
                self.stdout.write(f"Device Type: {features.get('device_type')}")
                self.stdout.write(f"Generation: {features.get('generation')}")
                self.stdout.write(f"Year: {features.get('year')}")
                self.stdout.write(f"Variant: {features.get('variant')}")
                self.stdout.write(f"Storage: {features.get('storage_gb')} GB")

            if verbose and result.get('candidates_count', 0) > 1:
                self.stdout.write(f"\n--- Candidates ({result['candidates_count']}) ---")
                for i, cand in enumerate(result.get('all_candidates', [])[:5], 1):
                    self.stdout.write(
                        f"{i}. {cand['modelo_descripcion']} {cand['capacidad_tamanio']} "
                        f"(score: {cand['score']:.2f})"
                    )

            if verbose and result.get('elapsed_time'):
                self.stdout.write(f"\nElapsed Time: {result['elapsed_time']:.3f}s")

        else:
            self.stdout.write(self.style.ERROR("\n✗ NO MATCH\n"))
            self.stdout.write(f"Error: {result.get('error_message', 'Unknown error')}")
            self.stdout.write(f"Error Code: {result.get('error_code', 'N/A')}")
            self.stdout.write(f"Version: {result.get('mapping_version', 'N/A')}")

            if verbose and result.get('features'):
                self.stdout.write(f"\n--- Extracted Features ---")
                features = result['features']
                self.stdout.write(f"Device Type: {features.get('device_type')}")
                self.stdout.write(f"Generation: {features.get('generation')}")
                self.stdout.write(f"Year: {features.get('year')}")
                self.stdout.write(f"Variant: {features.get('variant')}")
                self.stdout.write(f"Storage: {features.get('storage_gb')} GB")

    def _print_comparison(self, comparison):
        """Imprime la comparacion v3 vs v4."""
        self.stdout.write(f"\n=== Comparison v3 vs v4 ===\n")

        v3_matched = comparison['v3_matched']
        v4_matched = comparison['v4_matched']
        same = comparison['same_result']

        if same:
            self.stdout.write(self.style.SUCCESS("✓ SAME RESULT"))
        else:
            self.stdout.write(self.style.WARNING("⚠ DIFFERENT RESULTS"))

        self.stdout.write(f"\nv3: {'✓' if v3_matched else '✗'} {comparison['v3_modelo_descripcion']}")
        self.stdout.write(f"    Capacidad ID: {comparison['v3_capacidad_id']}")
        self.stdout.write(f"    Confidence: {comparison['v3_confidence']:.2f}")

        self.stdout.write(f"\nv4: {'✓' if v4_matched else '✗'} {comparison['v4_modelo_descripcion']}")
        self.stdout.write(f"    Capacidad ID: {comparison['v4_capacidad_id']}")
        self.stdout.write(f"    Confidence: {comparison['v4_confidence']:.2f}")

        if not same:
            self.stdout.write(self.style.WARNING(
                f"\n⚠ Los sistemas devolvieron resultados diferentes!"
            ))
