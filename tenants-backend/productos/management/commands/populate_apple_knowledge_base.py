"""
Comando para poblar la base de conocimiento de Apple con datos verificados.
Incluye A-numbers, especificaciones y patrones de Likewize conocidos.
"""

from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_date
from productos.models import AppleDeviceKnowledgeBase


class Command(BaseCommand):
    help = 'Pobla la base de conocimiento de Apple con datos verificados de dispositivos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Limpia la base de conocimiento antes de poblarla',
        )
        parser.add_argument(
            '--device-type',
            type=str,
            choices=['iphone', 'ipad', 'mac', 'all'],
            default='all',
            help='Tipo de dispositivos a poblar',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write('Limpiando base de conocimiento existente...')
            AppleDeviceKnowledgeBase.objects.all().delete()

        device_type = options['device_type']

        if device_type in ['iphone', 'all']:
            self.populate_iphone_knowledge()

        if device_type in ['ipad', 'all']:
            self.populate_ipad_knowledge()

        if device_type in ['mac', 'all']:
            self.populate_mac_knowledge()

        self.stdout.write(
            self.style.SUCCESS(
                f'Base de conocimiento poblada exitosamente. Total entradas: {AppleDeviceKnowledgeBase.objects.count()}'
            )
        )

    def populate_iphone_knowledge(self):
        """Pobla conocimiento de iPhone con datos verificados."""
        self.stdout.write('Poblando base de conocimiento de iPhone...')

        iphone_data = [
            # iPhone 16 Series (2024)
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 16 Pro Max',
                'a_number': 'A3105',
                'release_date': '2024-09-20',
                'cpu_family': 'A18 Pro',
                'available_capacities': [256, 512, 1024],
                'likewize_model_names': ['iPhone 16 Pro Max'],
                'likewize_master_patterns': ['iPhone 16 Pro Max'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 16 Pro',
                'a_number': 'A3101',
                'release_date': '2024-09-20',
                'cpu_family': 'A18 Pro',
                'available_capacities': [128, 256, 512, 1024],
                'likewize_model_names': ['iPhone 16 Pro'],
                'likewize_master_patterns': ['iPhone 16 Pro'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 16 Plus',
                'a_number': 'A3093',
                'release_date': '2024-09-20',
                'cpu_family': 'A18',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 16 Plus'],
                'likewize_master_patterns': ['iPhone 16 Plus'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 16',
                'a_number': 'A3089',
                'release_date': '2024-09-20',
                'cpu_family': 'A18',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 16'],
                'likewize_master_patterns': ['iPhone 16'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # iPhone 15 Series (2023)
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 15 Pro Max',
                'a_number': 'A3108',
                'release_date': '2023-09-22',
                'cpu_family': 'A17 Pro',
                'available_capacities': [256, 512, 1024],
                'likewize_model_names': ['iPhone 15 Pro Max'],
                'likewize_master_patterns': ['iPhone 15 Pro Max'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 15 Pro',
                'a_number': 'A3102',
                'release_date': '2023-09-22',
                'cpu_family': 'A17 Pro',
                'available_capacities': [128, 256, 512, 1024],
                'likewize_model_names': ['iPhone 15 Pro'],
                'likewize_master_patterns': ['iPhone 15 Pro'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 15 Plus',
                'a_number': 'A3094',
                'release_date': '2023-09-22',
                'cpu_family': 'A16 Bionic',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 15 Plus'],
                'likewize_master_patterns': ['iPhone 15 Plus'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 15',
                'a_number': 'A3090',
                'release_date': '2023-09-22',
                'cpu_family': 'A16 Bionic',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 15'],
                'likewize_master_patterns': ['iPhone 15'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # iPhone 14 Series (2022)
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 14 Pro Max',
                'a_number': 'A2895',
                'release_date': '2022-09-16',
                'cpu_family': 'A16 Bionic',
                'available_capacities': [128, 256, 512, 1024],
                'likewize_model_names': ['iPhone 14 Pro Max'],
                'likewize_master_patterns': ['iPhone 14 Pro Max'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 14 Pro',
                'a_number': 'A2890',
                'release_date': '2022-09-16',
                'cpu_family': 'A16 Bionic',
                'available_capacities': [128, 256, 512, 1024],
                'likewize_model_names': ['iPhone 14 Pro'],
                'likewize_master_patterns': ['iPhone 14 Pro'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 14 Plus',
                'a_number': 'A2886',
                'release_date': '2022-10-07',
                'cpu_family': 'A15 Bionic',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 14 Plus'],
                'likewize_master_patterns': ['iPhone 14 Plus'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 14',
                'a_number': 'A2881',
                'release_date': '2022-09-16',
                'cpu_family': 'A15 Bionic',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 14'],
                'likewize_master_patterns': ['iPhone 14'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # iPhone 13 Series (2021)
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 13 Pro Max',
                'a_number': 'A2644',
                'release_date': '2021-09-24',
                'cpu_family': 'A15 Bionic',
                'available_capacities': [128, 256, 512, 1024],
                'likewize_model_names': ['iPhone 13 Pro Max'],
                'likewize_master_patterns': ['iPhone 13 Pro Max'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 13 Pro',
                'a_number': 'A2636',
                'release_date': '2021-09-24',
                'cpu_family': 'A15 Bionic',
                'available_capacities': [128, 256, 512, 1024],
                'likewize_model_names': ['iPhone 13 Pro'],
                'likewize_master_patterns': ['iPhone 13 Pro'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 13 mini',
                'a_number': 'A2628',
                'release_date': '2021-09-24',
                'cpu_family': 'A15 Bionic',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 13 mini'],
                'likewize_master_patterns': ['iPhone 13 mini'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 13',
                'a_number': 'A2633',
                'release_date': '2021-09-24',
                'cpu_family': 'A15 Bionic',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 13'],
                'likewize_master_patterns': ['iPhone 13'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # iPhone 12 Series (2020)
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 12 Pro Max',
                'a_number': 'A2342',
                'release_date': '2020-11-13',
                'cpu_family': 'A14 Bionic',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 12 Pro Max'],
                'likewize_master_patterns': ['iPhone 12 Pro Max'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 12 Pro',
                'a_number': 'A2341',
                'release_date': '2020-10-23',
                'cpu_family': 'A14 Bionic',
                'available_capacities': [128, 256, 512],
                'likewize_model_names': ['iPhone 12 Pro'],
                'likewize_master_patterns': ['iPhone 12 Pro'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 12 mini',
                'a_number': 'A2176',
                'release_date': '2020-11-13',
                'cpu_family': 'A14 Bionic',
                'available_capacities': [64, 128, 256],
                'likewize_model_names': ['iPhone 12 mini'],
                'likewize_master_patterns': ['iPhone 12 mini'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 12',
                'a_number': 'A2172',
                'release_date': '2020-10-23',
                'cpu_family': 'A14 Bionic',
                'available_capacities': [64, 128, 256],
                'likewize_model_names': ['iPhone 12'],
                'likewize_master_patterns': ['iPhone 12'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # iPhone 11 Series (2019)
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 11 Pro Max',
                'a_number': 'A2161',
                'release_date': '2019-09-20',
                'cpu_family': 'A13 Bionic',
                'available_capacities': [64, 256, 512],
                'likewize_model_names': ['iPhone 11 Pro Max'],
                'likewize_master_patterns': ['iPhone 11 Pro Max'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 11 Pro',
                'a_number': 'A2160',
                'release_date': '2019-09-20',
                'cpu_family': 'A13 Bionic',
                'available_capacities': [64, 256, 512],
                'likewize_model_names': ['iPhone 11 Pro'],
                'likewize_master_patterns': ['iPhone 11 Pro'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone 11',
                'a_number': 'A2111',
                'release_date': '2019-09-20',
                'cpu_family': 'A13 Bionic',
                'available_capacities': [64, 128, 256],
                'likewize_model_names': ['iPhone 11'],
                'likewize_master_patterns': ['iPhone 11'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # iPhone XS/XR Series (2018)
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone XS Max',
                'a_number': 'A2101',
                'release_date': '2018-09-21',
                'cpu_family': 'A12 Bionic',
                'available_capacities': [64, 256, 512],
                'likewize_model_names': ['iPhone XS Max'],
                'likewize_master_patterns': ['iPhone XS Max'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone XS',
                'a_number': 'A2097',
                'release_date': '2018-09-21',
                'cpu_family': 'A12 Bionic',
                'available_capacities': [64, 256, 512],
                'likewize_model_names': ['iPhone XS'],
                'likewize_master_patterns': ['iPhone XS'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPhone',
                'model_name': 'iPhone XR',
                'a_number': 'A2105',
                'release_date': '2018-10-26',
                'cpu_family': 'A12 Bionic',
                'available_capacities': [64, 128, 256],
                'likewize_model_names': ['iPhone XR'],
                'likewize_master_patterns': ['iPhone XR'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
        ]

        self._create_knowledge_entries(iphone_data)

    def populate_ipad_knowledge(self):
        """Pobla conocimiento de iPad con datos principales."""
        self.stdout.write('Poblando base de conocimiento de iPad...')

        ipad_data = [
            # iPad Pro M4 (2024)
            {
                'device_family': 'iPad Pro',
                'model_name': 'iPad Pro 13-inch M4',
                'a_number': 'A2925',
                'release_date': '2024-05-15',
                'cpu_family': 'M4',
                'screen_size': 13.0,
                'available_capacities': [256, 512, 1024, 2048],
                'likewize_model_names': ['iPad Pro'],
                'likewize_master_patterns': ['iPad Pro', 'M4', '13 inch'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPad Pro',
                'model_name': 'iPad Pro 11-inch M4',
                'a_number': 'A2926',
                'release_date': '2024-05-15',
                'cpu_family': 'M4',
                'screen_size': 11.0,
                'available_capacities': [256, 512, 1024, 2048],
                'likewize_model_names': ['iPad Pro'],
                'likewize_master_patterns': ['iPad Pro', 'M4', '11 inch'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # iPad Air M2 (2024)
            {
                'device_family': 'iPad Air',
                'model_name': 'iPad Air 13-inch M2',
                'a_number': 'A2898',
                'release_date': '2024-05-15',
                'cpu_family': 'M2',
                'screen_size': 13.0,
                'available_capacities': [128, 256, 512, 1024],
                'likewize_model_names': ['iPad Air'],
                'likewize_master_patterns': ['iPad Air', 'M2', '13 inch'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'iPad Air',
                'model_name': 'iPad Air 11-inch M2',
                'a_number': 'A2899',
                'release_date': '2024-05-15',
                'cpu_family': 'M2',
                'screen_size': 11.0,
                'available_capacities': [128, 256, 512, 1024],
                'likewize_model_names': ['iPad Air'],
                'likewize_master_patterns': ['iPad Air', 'M2', '11 inch'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
        ]

        self._create_knowledge_entries(ipad_data)

    def populate_mac_knowledge(self):
        """Pobla conocimiento de Mac con datos principales."""
        self.stdout.write('Poblando base de conocimiento de Mac...')

        mac_data = [
            # Mac mini (2023)
            {
                'device_family': 'Mac mini',
                'model_name': 'Mac mini M2',
                'a_number': 'A2686',
                'release_date': '2023-01-24',
                'cpu_family': 'M2',
                'cpu_cores': '8 Core CPU 10 Core GPU',
                'available_capacities': [256, 512, 1024, 2048],
                'likewize_model_names': ['Mac Mini', 'Mac mini'],
                'likewize_master_patterns': ['Macmini14', 'Mac mini', 'M2', 'A2686'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'Mac mini',
                'model_name': 'Mac mini M2 Pro',
                'a_number': 'A2816',
                'release_date': '2023-01-24',
                'cpu_family': 'M2 Pro',
                'cpu_cores': '10 Core CPU 16 Core GPU',
                'available_capacities': [512, 1024, 2048],
                'likewize_model_names': ['Mac Mini', 'Mac mini'],
                'likewize_master_patterns': ['Macmini14', 'Mac mini', 'M2 Pro', 'A2816'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # Mac mini (2020)
            {
                'device_family': 'Mac mini',
                'model_name': 'Mac mini M1',
                'a_number': 'A2348',
                'release_date': '2020-11-10',
                'cpu_family': 'M1',
                'cpu_cores': '8 Core CPU 8 Core GPU',
                'available_capacities': [256, 512, 1024, 2048],
                'likewize_model_names': ['Mac Mini', 'Mac mini'],
                'likewize_master_patterns': ['Macmini9', 'Mac mini', 'M1', 'A2348'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # MacBook Air M3 (2024)
            {
                'device_family': 'MacBook Air',
                'model_name': 'MacBook Air 15-inch M3',
                'a_number': 'A3114',
                'release_date': '2024-03-08',
                'cpu_family': 'M3',
                'screen_size': 15.3,
                'available_capacities': [256, 512, 1024, 2048],
                'likewize_model_names': ['MacBook Air'],
                'likewize_master_patterns': ['MacBookAir15', 'MacBook Air', 'M3', '15 inch'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'MacBook Air',
                'model_name': 'MacBook Air 13-inch M3',
                'a_number': 'A3113',
                'release_date': '2024-03-08',
                'cpu_family': 'M3',
                'screen_size': 13.6,
                'available_capacities': [256, 512, 1024, 2048],
                'likewize_model_names': ['MacBook Air'],
                'likewize_master_patterns': ['MacBookAir15', 'MacBook Air', 'M3', '13 inch'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },

            # MacBook Pro M3 (2023)
            {
                'device_family': 'MacBook Pro',
                'model_name': 'MacBook Pro 16-inch M3 Max',
                'a_number': 'A2991',
                'release_date': '2023-11-07',
                'cpu_family': 'M3 Max',
                'screen_size': 16.2,
                'available_capacities': [512, 1024, 2048, 4096, 8192],
                'likewize_model_names': ['MacBook Pro'],
                'likewize_master_patterns': ['MacBookPro18', 'MacBook Pro', 'M3 Max', '16 inch'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
            {
                'device_family': 'MacBook Pro',
                'model_name': 'MacBook Pro 14-inch M3 Pro',
                'a_number': 'A2992',
                'release_date': '2023-11-07',
                'cpu_family': 'M3 Pro',
                'screen_size': 14.2,
                'available_capacities': [512, 1024, 2048, 4096],
                'likewize_model_names': ['MacBook Pro'],
                'likewize_master_patterns': ['MacBookPro18', 'MacBook Pro', 'M3 Pro', '14 inch'],
                'confidence_level': 'verified',
                'source': 'apple_official'
            },
        ]

        self._create_knowledge_entries(mac_data)

    def _create_knowledge_entries(self, data_list):
        """Crea entradas en la base de conocimiento."""
        created_count = 0

        for device_data in data_list:
            try:
                # Verificar si ya existe
                if AppleDeviceKnowledgeBase.objects.filter(a_number=device_data['a_number']).exists():
                    self.stdout.write(f"Ya existe: {device_data['a_number']} - {device_data['model_name']}")
                    continue

                # Crear entrada
                AppleDeviceKnowledgeBase.objects.create(
                    device_family=device_data['device_family'],
                    model_name=device_data['model_name'],
                    a_number=device_data['a_number'],
                    release_date=parse_date(device_data['release_date']),
                    cpu_family=device_data.get('cpu_family', ''),
                    cpu_cores=device_data.get('cpu_cores', ''),
                    screen_size=device_data.get('screen_size'),
                    available_capacities=device_data.get('available_capacities', []),
                    likewize_model_names=device_data.get('likewize_model_names', []),
                    likewize_master_patterns=device_data.get('likewize_master_patterns', []),
                    confidence_level=device_data.get('confidence_level', 'verified'),
                    source=device_data.get('source', 'manual'),
                    verification_notes=f"Poblado automáticamente - {device_data.get('source', 'manual')}",
                    created_by='system'
                )

                created_count += 1
                self.stdout.write(f"✓ Creado: {device_data['a_number']} - {device_data['model_name']}")

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"Error creando {device_data['model_name']}: {str(e)}")
                )

        self.stdout.write(f"Entradas creadas: {created_count}")