import os
import tarfile
import urllib.request
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from pathlib import Path


class Command(BaseCommand):
    help = 'Descarga la base de datos GeoLite2-City de MaxMind'

    # URL de descarga directa de GeoLite2-City (requiere licencia, pero hay alternativa)
    # Alternativa gratuita sin registro:
    GEOLITE2_URL = "https://git.io/GeoLite2-City.mmdb"

    # URL oficial (requiere cuenta MaxMind):
    # https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz

    def add_arguments(self, parser):
        parser.add_argument(
            '--license-key',
            type=str,
            help='License key de MaxMind (opcional, también se puede configurar en .env como MAXMIND_LICENSE_KEY)',
        )

    def handle(self, *args, **options):
        """
        Descarga y extrae la base de datos GeoLite2-City.

        Opciones:
        1. Sin licencia: Usa mirror gratuito (puede estar desactualizado)
        2. Con licencia: Usa API oficial de MaxMind (actualizada)
        """
        # Prioridad: 1) argumento --license-key, 2) variable .env MAXMIND_LICENSE_KEY
        license_key = options.get('license_key') or getattr(settings, 'MAXMIND_LICENSE_KEY', None)
        geoip_path = Path(settings.GEOIP_PATH)

        # Crear directorio si no existe
        geoip_path.mkdir(parents=True, exist_ok=True)

        output_file = geoip_path / 'GeoLite2-City.mmdb'

        self.stdout.write(
            self.style.SUCCESS('📡 Descargando base de datos GeoLite2-City...')
        )

        try:
            if license_key:
                # Informar origen de la license key
                source = "argumento --license-key" if options.get('license_key') else "variable .env MAXMIND_LICENSE_KEY"
                self.stdout.write(f'🔑 Usando license key desde: {source}')
                # Usar API oficial de MaxMind
                self._download_official(license_key, geoip_path, output_file)
            else:
                # Usar método alternativo (mirror gratuito)
                self._download_alternative(geoip_path, output_file)

            # Verificar que el archivo existe y tiene tamaño razonable
            if output_file.exists() and output_file.stat().st_size > 1024 * 1024:  # >1MB
                size_mb = output_file.stat().st_size / (1024 * 1024)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Base de datos descargada exitosamente: '
                        f'{output_file} ({size_mb:.1f} MB)'
                    )
                )
                self.stdout.write(
                    self.style.WARNING(
                        '⚠️  Recuerda ejecutar este comando mensualmente para mantener '
                        'la base de datos actualizada.'
                    )
                )
            else:
                raise CommandError('El archivo descargado es muy pequeño o no existe')

        except Exception as e:
            raise CommandError(f'Error descargando GeoLite2-City: {e}')

    def _download_official(self, license_key, geoip_path, output_file):
        """Descarga usando la API oficial de MaxMind (requiere licencia)"""
        url = (
            f"https://download.maxmind.com/app/geoip_download"
            f"?edition_id=GeoLite2-City"
            f"&license_key={license_key}"
            f"&suffix=tar.gz"
        )

        temp_tar = geoip_path / 'GeoLite2-City.tar.gz'

        self.stdout.write('📥 Descargando desde MaxMind oficial...')

        # Descargar archivo tar.gz
        urllib.request.urlretrieve(url, temp_tar)

        self.stdout.write('📦 Extrayendo base de datos...')

        # Extraer el archivo .mmdb del tarball
        with tarfile.open(temp_tar, 'r:gz') as tar:
            # Buscar el archivo .mmdb dentro del tar
            for member in tar.getmembers():
                if member.name.endswith('.mmdb'):
                    # Extraer solo el archivo .mmdb
                    member.name = os.path.basename(member.name)
                    tar.extract(member, geoip_path)
                    break

        # Renombrar si es necesario
        extracted_mmdb = list(geoip_path.glob('*.mmdb'))[0]
        if extracted_mmdb != output_file:
            extracted_mmdb.rename(output_file)

        # Limpiar archivo temporal
        temp_tar.unlink()

        self.stdout.write(self.style.SUCCESS('✅ Descargado desde API oficial'))

    def _download_alternative(self, geoip_path, output_file):
        """
        Método alternativo sin licencia.

        NOTA: Este método usa un mirror alternativo que puede no estar siempre actualizado.
        Para producción, se recomienda registrarse en MaxMind y usar la API oficial.
        """
        self.stdout.write(
            self.style.WARNING(
                '⚠️  Usando método alternativo sin licencia.\n'
                '   Para mayor precisión, registra una cuenta gratuita en MaxMind:\n'
                '   https://www.maxmind.com/en/geolite2/signup\n'
                '   \n'
                '   Luego configura tu license key:\n'
                '   - Opción 1: Añadir MAXMIND_LICENSE_KEY=tu-key en .env\n'
                '   - Opción 2: python manage.py download_geoip --license-key=TU_KEY'
            )
        )

        # Método 1: Intentar descarga directa desde GitHub (repositorio de mirrors)
        alternative_urls = [
            # Mirror público (puede estar disponible o no)
            "https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb",
            # Otro mirror
            "https://raw.githubusercontent.com/wp-statistics/GeoLite2-City/master/GeoLite2-City.mmdb",
        ]

        for url in alternative_urls:
            try:
                self.stdout.write(f'📥 Intentando descargar desde: {url}')
                urllib.request.urlretrieve(url, output_file)

                # Verificar que se descargó algo
                if output_file.exists() and output_file.stat().st_size > 1024 * 1024:
                    self.stdout.write(self.style.SUCCESS('✅ Descarga exitosa'))
                    return
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'❌ Fallo con esta URL: {e}')
                )
                continue

        # Si todos los métodos fallan, mostrar instrucciones manuales
        raise CommandError(
            'No se pudo descargar la base de datos automáticamente.\n'
            'Por favor, descárgala manualmente:\n\n'
            '1. Regístrate en: https://www.maxmind.com/en/geolite2/signup\n'
            '2. Descarga GeoLite2-City en formato MMDB\n'
            f'3. Coloca el archivo en: {output_file}\n\n'
            'O configura tu license key:\n'
            '  - Opción 1: Añadir MAXMIND_LICENSE_KEY=tu-key en .env y ejecutar: python manage.py download_geoip\n'
            '  - Opción 2: python manage.py download_geoip --license-key=TU_KEY'
        )
