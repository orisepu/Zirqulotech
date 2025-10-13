"""
Management command para probar el mapeo de Mac mini.
"""

from django.core.management.base import BaseCommand
from productos.mapping.services.device_mapper_service import DeviceMapperService
from productos.mapping.core.types import LikewizeInput


class Command(BaseCommand):
    help = 'Prueba el mapeo de Mac mini con v4'

    def handle(self, *args, **options):
        # Input problemático del usuario
        input_str = "Macmini14 12 M2 10 Core CPU 16 Core GPU A2816 1/2023 512GB SSD"

        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(self.style.SUCCESS("Testing Mac mini mapping with v4"))
        self.stdout.write("=" * 70 + "\n")
        self.stdout.write(f"Input: {input_str}\n")

        # Crear input
        input_data = LikewizeInput(model_name=input_str)

        # Crear servicio y mapear
        service = DeviceMapperService()
        result = service.map(input_data)

        # Mostrar resultado
        self.stdout.write(f"Status: {result.status.value}")
        self.stdout.write(f"Success: {result.success}")

        if result.success:
            self.stdout.write("\n" + self.style.SUCCESS("✅ MATCH EXITOSO:"))
            self.stdout.write(f"   - Capacidad ID: {result.matched_capacidad_id}")
            self.stdout.write(f"   - Modelo: {result.matched_modelo_descripcion}")
            self.stdout.write(f"   - Capacidad: {result.matched_capacidad_tamanio}")
            self.stdout.write(f"   - Confidence: {result.match_score:.2%}")
            self.stdout.write(f"   - Strategy: {result.match_strategy.value if result.match_strategy else 'N/A'}")

            # Verificar que NO es M2 Pro
            if "M2 Pro" in result.matched_modelo_descripcion:
                self.stdout.write("\n" + self.style.ERROR("❌ ERROR: Mapeó incorrectamente a M2 Pro!"))
                self.stdout.write("   Debería mapear a M2 base (10 CPU cores, 16 GPU cores)")
            else:
                self.stdout.write("\n" + self.style.SUCCESS("✅ CORRECTO: No mapeó a M2 Pro"))
        else:
            self.stdout.write("\n" + self.style.ERROR("❌ NO MATCH:"))
            self.stdout.write(f"   - Error: {result.error_message}")
            self.stdout.write(f"   - Error Code: {result.error_code}")

        # Mostrar features extraídas
        if result.features:
            self.stdout.write("\nFeatures extraídas:")
            self.stdout.write(f"   - device_type: {result.features.device_type}")
            self.stdout.write(f"   - variant: {result.features.variant}")
            self.stdout.write(f"   - cpu: {result.features.cpu}")
            self.stdout.write(f"   - cpu_cores: {result.features.cpu_cores}")
            self.stdout.write(f"   - gpu_cores: {result.features.gpu_cores}")
            self.stdout.write(f"   - storage_gb: {result.features.storage_gb}")
            self.stdout.write(f"   - year: {result.features.year}")

        # Mostrar logs (últimos 15)
        if result.context and result.context.logs:
            self.stdout.write("\nLogs del contexto (últimos 15):")
            for log in result.context.logs[-15:]:
                level = log.level.upper()
                msg = log.message
                style_func = self.style.SUCCESS if level == "INFO" else (
                    self.style.WARNING if level == "WARNING" else self.style.ERROR
                )
                self.stdout.write(style_func(f"   [{level}] {msg}"))

        self.stdout.write("\n" + "=" * 70 + "\n")
