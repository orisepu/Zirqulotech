"""
Script de debugging para el sistema v4.

Muestra paso a paso qué está pasando en el matching.
"""

from django.core.management.base import BaseCommand
from django.db.models import Q

from productos.mapping.core.types import LikewizeInput
from productos.mapping.extractors.iphone_extractor import iPhoneFeatureExtractor
from productos.mapping.matchers.generation_matcher import GenerationMatcher
from productos.mapping.core.types import MappingContext
from productos.models.modelos import Modelo, Capacidad


class Command(BaseCommand):
    help = 'Debug del sistema v4 paso a paso'

    def add_arguments(self, parser):
        parser.add_argument('device_name', type=str)

    def handle(self, *args, **options):
        device_name = options['device_name']

        self.stdout.write(f"\n=== Debugging: {device_name} ===\n")

        # 1. Crear input y context
        input_data = LikewizeInput(model_name=device_name)
        context = MappingContext(input_data=input_data)
        self.stdout.write(f"1. Input creado: {input_data.model_name}\n")

        # 2. Extraer features
        extractor = iPhoneFeatureExtractor()
        features = extractor.extract(input_data, context)

        self.stdout.write(f"2. Features extraídas:")
        self.stdout.write(f"   - device_type: {features.device_type}")
        self.stdout.write(f"   - generation: {features.generation}")
        self.stdout.write(f"   - year: {features.year}")
        self.stdout.write(f"   - variant: {features.variant}")
        self.stdout.write(f"   - storage_gb: {features.storage_gb}\n")

        # 3. Buscar modelos en BD
        self.stdout.write(f"3. Buscando modelos en BD:")

        # Query inicial
        queryset = Modelo.objects.filter(tipo__iexact=features.device_type.value)
        self.stdout.write(f"   - Por tipo '{features.device_type.value}': {queryset.count()} modelos")

        # Filtrar por año
        if features.year:
            models_with_year = Modelo.objects.filter(
                tipo__iexact=features.device_type.value
            ).exclude(año__in=[0, None])
            self.stdout.write(f"   - Modelos con año configurado: {models_with_year.count()}")

            if models_with_year.exists():
                queryset_year = queryset.filter(año=features.year)
                self.stdout.write(f"   - Con año {features.year}: {queryset_year.count()} modelos")
            else:
                self.stdout.write(f"   - No hay modelos con año, omitiendo filtro")

        # Filtrar por variante
        if features.variant:
            if features.variant == "Pro":
                queryset_var = queryset.filter(
                    descripcion__icontains="Pro"
                ).exclude(descripcion__icontains="Max")
                self.stdout.write(f"   - Con variante 'Pro' (sin Max): {queryset_var.count()} modelos")

                # Mostrar qué modelos son
                for m in queryset_var[:5]:
                    self.stdout.write(f"     * {m.descripcion} (año={m.año})")

        # 4. Verificar capacidades
        self.stdout.write(f"\n4. Verificando capacidades:")
        if queryset_var.exists():
            modelo = queryset_var.first()
            capacidades = Capacidad.objects.filter(modelo=modelo, activo=True)
            self.stdout.write(f"   - Modelo: {modelo.descripcion}")
            self.stdout.write(f"   - Capacidades activas: {capacidades.count()}")
            for cap in capacidades:
                self.stdout.write(f"     * {cap.tamaño} (id={cap.id})")

            # Verificar si 128GB está
            if features.storage_gb:
                cap_match = capacidades.filter(
                    Q(tamaño__icontains=f"{features.storage_gb} GB") |
                    Q(tamaño__icontains=f"{features.storage_gb}GB")
                )
                self.stdout.write(f"\n   - Buscando {features.storage_gb} GB: {cap_match.count()} encontradas")
                if cap_match.exists():
                    self.stdout.write(f"     ✓ Match: {cap_match.first().tamaño} (id={cap_match.first().id})")

        # 5. Probar el matcher completo
        self.stdout.write(f"\n5. Ejecutando GenerationMatcher:")
        matcher = GenerationMatcher()

        result = matcher.match(input_data, features, context)

        self.stdout.write(f"   - Success: {result.success}")
        if result.success:
            self.stdout.write(f"   - Capacidad ID: {result.matched_capacidad_id}")
            self.stdout.write(f"   - Modelo: {result.matched_modelo_descripcion}")
            self.stdout.write(f"   - Score: {result.match_score:.2f}")
        else:
            self.stdout.write(f"   - Error: {result.error_message}")

        # Mostrar logs del contexto
        self.stdout.write(f"\n6. Logs del matcher:")
        for log in context.logs:
            level = log['level'].upper()
            msg = log['message']
            self.stdout.write(f"   [{level}] {msg}")
