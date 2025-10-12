"""
Tests para MacBook Feature Extractor.

Cubre parsing de:
- MacBook Air (M1/M2/M3/M4)
- MacBook Pro M-series (M1/M2/M3 + Pro/Max)
- MacBook Pro Intel (Core i5/i7/i9 + velocidades)
"""

import pytest
from productos.mapping.extractors.macbook_extractor import MacBookFeatureExtractor
from productos.mapping.core.types import LikewizeInput, MappingContext


class TestMacBookFeatureExtractor:
    """Tests para MacBookFeatureExtractor."""

    @pytest.fixture
    def extractor(self):
        """Fixture que provee una instancia del extractor."""
        return MacBookFeatureExtractor()

    @pytest.fixture
    def context(self):
        """Fixture que provee un contexto de mapeo."""
        return MappingContext(input_data=LikewizeInput(model_name="test"))

    # ===========================
    # Tests: Variant Detection
    # ===========================

    def test_extract_variant_air(self, extractor, context):
        """Test: Detectar MacBook Air."""
        variant = extractor._extract_variant("MacBookAir15 13 M3", context)
        assert variant == "Air"

    def test_extract_variant_pro(self, extractor, context):
        """Test: Detectar MacBook Pro."""
        variant = extractor._extract_variant("MacBookPro15 9 M3 Max", context)
        assert variant == "Pro"

    def test_extract_variant_case_insensitive(self, extractor, context):
        """Test: Case insensitive."""
        variant = extractor._extract_variant("macbookair14 2 M2", context)
        assert variant == "Air"

    def test_extract_variant_invalid(self, extractor, context):
        """Test: String sin variante retorna None."""
        variant = extractor._extract_variant("iPad Pro", context)
        assert variant is None

    # ===========================
    # Tests: M-series Chip Extraction
    # ===========================

    def test_extract_chip_m3(self, extractor, context):
        """Test: M3 base."""
        chip, variant = extractor._extract_chip("MacBookAir15 13 M3 8 Core", context)
        assert chip == "M3"
        assert variant is None

    def test_extract_chip_m3_pro(self, extractor, context):
        """Test: M3 Pro."""
        chip, variant = extractor._extract_chip("MacBookPro15 8 M3 Pro 12 Core", context)
        assert chip == "M3"
        assert variant == "Pro"

    def test_extract_chip_m3_max(self, extractor, context):
        """Test: M3 Max."""
        chip, variant = extractor._extract_chip("MacBookPro15 9 M3 Max 16 Core", context)
        assert chip == "M3"
        assert variant == "Max"

    def test_extract_chip_m2_pro(self, extractor, context):
        """Test: M2 Pro."""
        chip, variant = extractor._extract_chip("M2 Pro 12 Core CPU", context)
        assert chip == "M2"
        assert variant == "Pro"

    def test_extract_chip_m1_max(self, extractor, context):
        """Test: M1 Max."""
        chip, variant = extractor._extract_chip("M1 Max 10 Core CPU 32 Core GPU", context)
        assert chip == "M1"
        assert variant == "Max"

    def test_extract_chip_m4(self, extractor, context):
        """Test: M4 base."""
        chip, variant = extractor._extract_chip("M4 10 Core CPU", context)
        assert chip == "M4"
        assert variant is None

    # ===========================
    # Tests: Intel Chip Extraction
    # ===========================

    def test_extract_chip_core_i7(self, extractor, context):
        """Test: Core i7 con velocidad."""
        chip, speed = extractor._extract_chip("Core i7 2.3 13 inch", context)
        assert chip == "Core i7"
        assert speed == "2.3"

    def test_extract_chip_core_i5(self, extractor, context):
        """Test: Core i5 con velocidad."""
        chip, speed = extractor._extract_chip("Core i5 2.0 13 inch", context)
        assert chip == "Core i5"
        assert speed == "2.0"

    def test_extract_chip_core_i9(self, extractor, context):
        """Test: Core i9 con velocidad."""
        chip, speed = extractor._extract_chip("Core i9 2.4 16 inch", context)
        assert chip == "Core i9"
        assert speed == "2.4"

    def test_extract_chip_intel_decimal_speed(self, extractor, context):
        """Test: Velocidades con decimales."""
        chip, speed = extractor._extract_chip("Core i7 1.7 13 inch", context)
        assert chip == "Core i7"
        assert speed == "1.7"

    def test_extract_chip_no_chip_found(self, extractor, context):
        """Test: Sin chip detectado."""
        chip, variant = extractor._extract_chip("iPad Pro 12.9 inch", context)
        assert chip is None
        assert variant is None

    # ===========================
    # Tests: CPU/GPU Cores
    # ===========================

    def test_extract_cpu_cores(self, extractor, context):
        """Test: Extraer CPU cores."""
        cores = extractor._extract_cpu_cores("8 Core CPU 10 Core GPU", context)
        assert cores == 8

    def test_extract_cpu_cores_16(self, extractor, context):
        """Test: 16 CPU cores."""
        cores = extractor._extract_cpu_cores("M3 Max 16 Core CPU 40 Core GPU", context)
        assert cores == 16

    def test_extract_gpu_cores(self, extractor, context):
        """Test: Extraer GPU cores."""
        cores = extractor._extract_gpu_cores("8 Core CPU 10 Core GPU", context)
        assert cores == 10

    def test_extract_gpu_cores_40(self, extractor, context):
        """Test: 40 GPU cores."""
        cores = extractor._extract_gpu_cores("M3 Max 16 Core CPU 40 Core GPU", context)
        assert cores == 40

    def test_extract_cores_no_match(self, extractor, context):
        """Test: Sin cores detectados."""
        cpu = extractor._extract_cpu_cores("MacBook Pro Intel", context)
        gpu = extractor._extract_gpu_cores("MacBook Pro Intel", context)
        assert cpu is None
        assert gpu is None

    # ===========================
    # Tests: Screen Size
    # ===========================

    def test_extract_screen_size_13_inch(self, extractor, context):
        """Test: 13 pulgadas."""
        size = extractor._extract_screen_size("13 inch A2337", context)
        assert size == 13.0

    def test_extract_screen_size_14_inch(self, extractor, context):
        """Test: 14 pulgadas."""
        size = extractor._extract_screen_size("14 inch A2992", context)
        assert size == 14.0

    def test_extract_screen_size_15_inch(self, extractor, context):
        """Test: 15 pulgadas."""
        size = extractor._extract_screen_size("15 inch A2941", context)
        assert size == 15.0

    def test_extract_screen_size_16_inch(self, extractor, context):
        """Test: 16 pulgadas."""
        size = extractor._extract_screen_size("16 inch A2991", context)
        assert size == 16.0

    def test_extract_screen_size_no_match(self, extractor, context):
        """Test: Sin tamaño detectado."""
        size = extractor._extract_screen_size("MacBook Pro M3", context)
        assert size is None

    # ===========================
    # Tests: Storage
    # ===========================

    def test_extract_storage_256gb(self, extractor, context):
        """Test: 256GB SSD."""
        storage = extractor._extract_storage("256GB SSD", context)
        assert storage == 256

    def test_extract_storage_512gb(self, extractor, context):
        """Test: 512GB SSD."""
        storage = extractor._extract_storage("512GB SSD", context)
        assert storage == 512

    def test_extract_storage_1tb(self, extractor, context):
        """Test: 1TB SSD."""
        storage = extractor._extract_storage("1TB SSD", context)
        assert storage == 1024  # Convertido a GB

    def test_extract_storage_2tb(self, extractor, context):
        """Test: 2TB SSD."""
        storage = extractor._extract_storage("2TB SSD", context)
        assert storage == 2048

    def test_extract_storage_8tb(self, extractor, context):
        """Test: 8TB SSD."""
        storage = extractor._extract_storage("8TB SSD", context)
        assert storage == 8192

    def test_extract_storage_no_match(self, extractor, context):
        """Test: Sin storage detectado."""
        storage = extractor._extract_storage("MacBook Pro M3", context)
        assert storage is None

    # ===========================
    # Tests: A-number
    # ===========================

    def test_extract_a_number_2337(self, extractor, context):
        """Test: A2337."""
        a_num = extractor._extract_a_number("13 inch A2337 11/2020", context)
        assert a_num == "A2337"

    def test_extract_a_number_2991(self, extractor, context):
        """Test: A2991."""
        a_num = extractor._extract_a_number("16 inch A2991 10/2023", context)
        assert a_num == "A2991"

    def test_extract_a_number_case_insensitive(self, extractor, context):
        """Test: Case insensitive."""
        a_num = extractor._extract_a_number("13 inch a2337", context)
        assert a_num == "A2337"

    def test_extract_a_number_no_match(self, extractor, context):
        """Test: Sin A-number detectado."""
        a_num = extractor._extract_a_number("MacBook Pro M3", context)
        assert a_num is None

    # ===========================
    # Tests: Date
    # ===========================

    def test_extract_date_march_2024(self, extractor, context):
        """Test: 3/2024."""
        month, year = extractor._extract_date("A3114 3/2024 2TB SSD", context)
        assert month == 3
        assert year == 2024

    def test_extract_date_october_2023(self, extractor, context):
        """Test: 10/2023."""
        month, year = extractor._extract_date("A2991 10/2023 8TB SSD", context)
        assert month == 10
        assert year == 2023

    def test_extract_date_may_2020(self, extractor, context):
        """Test: 5/2020."""
        month, year = extractor._extract_date("A2251 5/2020 4TB SSD", context)
        assert month == 5
        assert year == 2020

    def test_extract_date_no_match(self, extractor, context):
        """Test: Sin fecha detectada."""
        month, year = extractor._extract_date("MacBook Pro M3", context)
        assert month is None
        assert year is None

    # ===========================
    # Tests: extract() Full Integration
    # ===========================

    def test_extract_macbook_air_m3_13_512gb(self, extractor):
        """Test: MacBook Air M3 13\" 512GB (caso real)."""
        input_data = LikewizeInput(
            model_name="MacBookAir15 12 M3 8 Core CPU 10 Core GPU 13 inch A3113 3/2024 512GB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == "MacBook"
        assert features.variant == "Air"
        assert features.cpu == "M3"
        assert features.screen_size == 13.0
        assert features.storage_gb == 512
        assert features.year == 2024
        assert features.has_wifi is True
        assert features.has_cellular is False

    def test_extract_macbook_air_m2_15_1tb(self, extractor):
        """Test: MacBook Air M2 15\" 1TB (caso real)."""
        input_data = LikewizeInput(
            model_name="MacBookAir14 15 M2 8 Core CPU 10 Core GPU 15 inch A2941 6/2023 1TB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == "MacBook"
        assert features.variant == "Air"
        assert features.cpu == "M2"
        assert features.screen_size == 15.0
        assert features.storage_gb == 1024
        assert features.year == 2022  # Inferido desde M2

    def test_extract_macbook_pro_m3_max_16_8tb(self, extractor):
        """Test: MacBook Pro M3 Max 16\" 8TB (caso real)."""
        input_data = LikewizeInput(
            model_name="MacBookPro15 9 M3 Max 16 Core CPU 40 Core GPU 16 inch A2991 10/2023 8TB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == "MacBook"
        assert features.variant == "Pro"
        assert features.cpu == "M3 Max"
        assert features.screen_size == 16.0
        assert features.storage_gb == 8192
        assert features.year == 2023

    def test_extract_macbook_pro_m3_pro_14_1tb(self, extractor):
        """Test: MacBook Pro M3 Pro 14\" 1TB (caso real)."""
        input_data = LikewizeInput(
            model_name="MacBookPro15 8 M3 Pro 12 Core CPU 18 Core GPU 14 inch A2992 10/2023 1TB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == "MacBook"
        assert features.variant == "Pro"
        assert features.cpu == "M3 Pro"
        assert features.screen_size == 14.0
        assert features.storage_gb == 1024

    def test_extract_macbook_pro_intel_core_i7_13_512gb(self, extractor):
        """Test: MacBook Pro Intel Core i7 13\" 512GB (caso real)."""
        input_data = LikewizeInput(
            model_name="MacBookPro16 2 Core i7 2.3 13 inch A2251 5/2020 512GB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == "MacBook"
        assert features.variant == "Pro"
        assert features.cpu == "Core i7 2.3"
        assert features.screen_size == 13.0
        assert features.storage_gb == 512
        assert features.year == 2020

    def test_extract_macbook_pro_intel_core_i9_16_8tb(self, extractor):
        """Test: MacBook Pro Intel Core i9 16\" 8TB (caso real)."""
        input_data = LikewizeInput(
            model_name="MacBookPro16 1 Core i9 2.4 16 inch A2141 11/2019 8TB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == "MacBook"
        assert features.variant == "Pro"
        assert features.cpu == "Core i9 2.4"
        assert features.screen_size == 16.0
        assert features.storage_gb == 8192
        assert features.year == 2019

    def test_extract_macbook_pro_intel_core_i5_13_256gb(self, extractor):
        """Test: MacBook Pro Intel Core i5 13\" 256GB."""
        input_data = LikewizeInput(
            model_name="MacBookPro16 3 Core i5 1.4 13 inch A2289 5/2020 256GB SSD"
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        assert features.device_type == "MacBook"
        assert features.variant == "Pro"
        assert features.cpu == "Core i5 1.4"
        assert features.screen_size == 13.0
        assert features.storage_gb == 256

    def test_extract_year_inference_from_chip(self, extractor):
        """Test: Inferir año cuando no viene en fecha."""
        input_data = LikewizeInput(
            model_name="MacBookAir15 13 M3 8 Core CPU 10 Core GPU 13 inch A3113 512GB SSD"
            # Sin fecha
        )
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)

        # M3 Air → 2024 (inferido desde KB)
        assert features.year == 2024

    def test_extract_wifi_always_true(self, extractor):
        """Test: Todos los MacBooks tienen Wi-Fi."""
        input_data = LikewizeInput(model_name="MacBookAir15 13 M3 512GB SSD")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)
        assert features.has_wifi is True

    def test_extract_cellular_always_false(self, extractor):
        """Test: Ningún MacBook tiene Cellular."""
        input_data = LikewizeInput(model_name="MacBookPro15 9 M3 Max 1TB SSD")
        context = MappingContext(input_data=input_data)

        features = extractor.extract(input_data, context)
        assert features.has_cellular is False
