"""
Tests de integración - Sistema v4 completo.

Estos tests verifican que el sistema v4 funciona correctamente
end-to-end con datos reales.
"""

import pytest
from decimal import Decimal

from productos.models.modelos import Modelo, Capacidad
from productos.mapping import map_device


@pytest.mark.django_db
class TestIntegrationV4:
    """Tests de integración del sistema v4 completo."""

    @pytest.fixture
    def iphone_13_pro_128gb(self):
        """Fixture: iPhone 13 Pro 128GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="iPhone 13 Pro",
            tipo="iPhone",
            marca="Apple",
            año=2021,
            procesador="A15 Bionic"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="128 GB",
            activo=True
        )

    @pytest.fixture
    def iphone_13_128gb(self):
        """Fixture: iPhone 13 regular 128GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="iPhone 13",
            tipo="iPhone",
            marca="Apple",
            año=2021,
            procesador="A15 Bionic"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="128 GB",
            activo=True
        )

    # ===========================
    # Tests de API unificada
    # ===========================

    def test_map_device_with_v4(self, iphone_13_pro_128gb):
        """map_device() con system='v4' funciona correctamente."""
        result = map_device(
            {'FullName': 'iPhone 13 Pro 128GB'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == iphone_13_pro_128gb.id
        assert result['mapping_version'] == 'v4'
        assert 'iPhone 13 Pro' in result['modelo_descripcion']

    def test_map_device_auto_mode(self, iphone_13_pro_128gb):
        """map_device() en modo 'auto' usa v4 por defecto."""
        result = map_device(
            {'FullName': 'iPhone 13 Pro 128GB'},
            system='auto'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == iphone_13_pro_128gb.id
        # En modo auto con v4 habilitado, debe usar v4
        assert result.get('mapping_version') == 'v4'

    def test_map_device_with_price(self, iphone_13_pro_128gb):
        """map_device() incluye precio de Likewize."""
        result = map_device(
            {
                'FullName': 'iPhone 13 Pro 128GB',
                'DevicePrice': '450.00'
            },
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == iphone_13_pro_128gb.id

    def test_map_device_case_insensitive(self, iphone_13_pro_128gb):
        """map_device() es case-insensitive."""
        result = map_device(
            {'FullName': 'iphone 13 pro 128gb'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == iphone_13_pro_128gb.id

    def test_map_device_no_match(self):
        """map_device() retorna no_match cuando no existe en BD."""
        result = map_device(
            {'FullName': 'iPhone 99 Pro 128GB'},
            system='v4'
        )

        assert result['success'] is False
        assert result['capacidad_id'] is None
        assert 'No se encontraron candidatos' in result['error_message']

    def test_map_device_invalid_input(self):
        """map_device() valida input vacío."""
        result = map_device(
            {'FullName': ''},
            system='v4'
        )

        assert result['success'] is False
        assert 'model_name es requerido' in result['error_message']

    # ===========================
    # Tests de formato de resultado
    # ===========================

    def test_result_format_compatible_with_v3(self, iphone_13_pro_128gb):
        """El resultado de v4 es compatible con formato v3."""
        result = map_device(
            {'FullName': 'iPhone 13 Pro 128GB'},
            system='v4'
        )

        # Campos que código legacy espera
        assert 'success' in result
        assert 'capacidad_id' in result
        assert 'modelo_id' in result
        assert 'modelo_descripcion' in result
        assert 'capacidad_tamanio' in result
        assert 'confidence' in result
        assert 'strategy' in result
        assert 'error_message' in result

        # Campos adicionales de v4
        assert 'mapping_version' in result
        assert 'features' in result
        assert 'candidates_count' in result

    def test_result_includes_all_metadata(self, iphone_13_pro_128gb):
        """El resultado incluye toda la metadata esperada."""
        result = map_device(
            {'FullName': 'iPhone 13 Pro 128GB'},
            system='v4'
        )

        assert result['success'] is True

        # Features extraídas
        assert result['features'] is not None
        assert result['features']['device_type'] == 'iPhone'
        assert result['features']['generation'] == 13
        assert result['features']['year'] == 2021
        assert result['features']['variant'] == 'Pro'
        assert result['features']['storage_gb'] == 128

        # Estrategia
        assert result['strategy'] == 'generation'

        # Candidatos
        assert result['candidates_count'] >= 1

        # Timing
        assert 'elapsed_time' in result
        assert result['elapsed_time'] is not None

    # ===========================
    # Tests de filtrado correcto
    # ===========================

    def test_filters_by_variant_correctly(
        self,
        iphone_13_pro_128gb,
        iphone_13_128gb
    ):
        """Filtra correctamente por variante (Pro vs regular)."""
        # Buscar Pro
        result_pro = map_device(
            {'FullName': 'iPhone 13 Pro 128GB'},
            system='v4'
        )

        assert result_pro['success'] is True
        assert 'Pro' in result_pro['modelo_descripcion']
        assert result_pro['capacidad_id'] == iphone_13_pro_128gb.id

        # Buscar regular (sin Pro)
        result_regular = map_device(
            {'FullName': 'iPhone 13 128GB'},
            system='v4'
        )

        assert result_regular['success'] is True
        assert 'Pro' not in result_regular['modelo_descripcion']
        assert result_regular['capacidad_id'] == iphone_13_128gb.id

    # ===========================
    # Tests de diferentes formatos de input
    # ===========================

    def test_supports_different_field_names(self, iphone_13_pro_128gb):
        """Soporta diferentes nombres de campos."""
        # FullName
        result1 = map_device({'FullName': 'iPhone 13 Pro 128GB'}, system='v4')
        assert result1['success'] is True

        # fullName
        result2 = map_device({'fullName': 'iPhone 13 Pro 128GB'}, system='v4')
        assert result2['success'] is True

        # model_name
        result3 = map_device({'model_name': 'iPhone 13 Pro 128GB'}, system='v4')
        assert result3['success'] is True

    def test_extracts_metadata_from_dict(self, iphone_13_pro_128gb):
        """Extrae metadata adicional del dict de Likewize."""
        result = map_device(
            {
                'FullName': 'iPhone 13 Pro 128GB',
                'MModel': 'MLVD3QL/A',
                'Capacity': '128GB',
                'DevicePrice': '450.00',
                'BrandName': 'Apple',
            },
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == iphone_13_pro_128gb.id


@pytest.mark.django_db
class TestIntegrationV4_iPad:
    """Tests de integración E2E para iPads."""

    # ===========================
    # Fixtures de modelos iPad
    # ===========================

    @pytest.fixture
    def ipad_pro_12_9_m2_wifi_256gb(self):
        """Fixture: iPad Pro 12.9\" M2 Wi-Fi 256GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="iPad Pro 12.9-inch (6th generation)",
            tipo="iPad Pro",
            marca="Apple",
            año=2022,
            procesador="M2"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="256 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_pro_12_9_m2_cellular_256gb(self):
        """Fixture: iPad Pro 12.9\" M2 Cellular 256GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="iPad Pro 12.9-inch (6th generation) Cellular",
            tipo="iPad Pro",
            marca="Apple",
            año=2022,
            procesador="M2"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="256 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_pro_11_m4_wifi_512gb(self):
        """Fixture: iPad Pro 11\" M4 Wi-Fi 512GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="iPad Pro 11-inch M4",
            tipo="iPad Pro",
            marca="Apple",
            año=2024,
            procesador="M4"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="512 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_air_6_m2_wifi_256gb(self):
        """Fixture: iPad Air 6 M2 Wi-Fi 256GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="iPad Air 11-inch (6th generation)",
            tipo="iPad Air",
            marca="Apple",
            año=2024,
            procesador="M2"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="256 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_mini_7_cellular_256gb(self):
        """Fixture: iPad mini 7 Cellular 256GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="iPad mini (7th generation) Cellular",
            tipo="iPad mini",
            marca="Apple",
            año=2024,
            procesador="A17 Pro"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="256 GB",
            activo=True
        )

    @pytest.fixture
    def ipad_10_wifi_64gb(self):
        """Fixture: iPad 10 Wi-Fi 64GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="iPad (10th generation)",
            tipo="iPad",
            marca="Apple",
            año=2022,
            procesador="A14 Bionic"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="64 GB",
            activo=True
        )

    # ===========================
    # Tests E2E de iPad Pro
    # ===========================

    def test_map_ipad_pro_12_9_m2_wifi(self, ipad_pro_12_9_m2_wifi_256gb):
        """map_device() mapea iPad Pro 12.9\" M2 Wi-Fi correctamente."""
        result = map_device(
            {'FullName': 'iPad Pro 12.9-inch M2 Wi-Fi 256GB'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_pro_12_9_m2_wifi_256gb.id
        assert result['mapping_version'] == 'v4'
        assert 'iPad Pro' in result['modelo_descripcion']
        assert '12.9' in result['modelo_descripcion']

    def test_map_ipad_pro_11_m4_wifi(self, ipad_pro_11_m4_wifi_512gb):
        """map_device() mapea iPad Pro 11\" M4 Wi-Fi correctamente."""
        result = map_device(
            {'FullName': 'iPad Pro 11-inch M4 Wi-Fi 512GB'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_pro_11_m4_wifi_512gb.id

    def test_ipad_pro_filters_by_connectivity(
        self,
        ipad_pro_12_9_m2_wifi_256gb,
        ipad_pro_12_9_m2_cellular_256gb
    ):
        """Filtra correctamente por conectividad (Wi-Fi vs Cellular)."""
        # Buscar Wi-Fi
        result_wifi = map_device(
            {'FullName': 'iPad Pro 12.9-inch M2 Wi-Fi 256GB'},
            system='v4'
        )

        assert result_wifi['success'] is True
        assert "Cellular" not in result_wifi['modelo_descripcion']

        # Buscar Cellular
        result_cellular = map_device(
            {'FullName': 'iPad Pro 12.9-inch M2 Cellular 256GB'},
            system='v4'
        )

        assert result_cellular['success'] is True
        assert "Cellular" in result_cellular['modelo_descripcion']

    def test_ipad_pro_filters_by_screen_size(
        self,
        ipad_pro_12_9_m2_wifi_256gb,
        ipad_pro_11_m4_wifi_512gb
    ):
        """Filtra correctamente por tamaño de pantalla."""
        # Buscar 12.9"
        result_12_9 = map_device(
            {'FullName': 'iPad Pro 12.9-inch M2 Wi-Fi 256GB'},
            system='v4'
        )

        assert result_12_9['success'] is True
        assert '12.9' in result_12_9['modelo_descripcion']

        # Buscar 11"
        result_11 = map_device(
            {'FullName': 'iPad Pro 11-inch M4 Wi-Fi 512GB'},
            system='v4'
        )

        assert result_11['success'] is True
        assert '11' in result_11['modelo_descripcion']

    def test_ipad_pro_spanish_format(self, ipad_pro_12_9_m2_wifi_256gb):
        """Soporta formato español (pulgadas, coma decimal)."""
        result = map_device(
            {'FullName': 'iPad Pro 12,9 pulgadas M2 Wi-Fi 256GB'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_pro_12_9_m2_wifi_256gb.id

    # ===========================
    # Tests E2E de iPad Air
    # ===========================

    def test_map_ipad_air_6_m2_wifi(self, ipad_air_6_m2_wifi_256gb):
        """map_device() mapea iPad Air 6 M2 Wi-Fi correctamente."""
        result = map_device(
            {'FullName': 'iPad Air 11-inch (M2) Wi-Fi 256GB'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_air_6_m2_wifi_256gb.id
        assert 'iPad Air' in result['modelo_descripcion']

        # Features extraídas
        assert result['features']['variant'] == 'Air'
        assert result['features']['cpu'] == 'M2'
        assert result['features']['year'] == 2024

    # ===========================
    # Tests E2E de iPad mini
    # ===========================

    def test_map_ipad_mini_7_cellular(self, ipad_mini_7_cellular_256gb):
        """map_device() mapea iPad mini 7 Cellular correctamente."""
        result = map_device(
            {'FullName': 'iPad mini 7 Cellular 256GB'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_mini_7_cellular_256gb.id
        assert 'iPad mini' in result['modelo_descripcion']

        # Features extraídas
        assert result['features']['variant'] == 'mini'
        assert result['features']['generation'] == 7
        assert result['features']['year'] == 2024

    # ===========================
    # Tests E2E de iPad regular
    # ===========================

    def test_map_ipad_10_wifi(self, ipad_10_wifi_64gb):
        """map_device() mapea iPad 10 Wi-Fi correctamente."""
        result = map_device(
            {'FullName': 'iPad 10 Wi-Fi 64GB'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_10_wifi_64gb.id
        assert 'iPad' in result['modelo_descripcion']

        # Features extraídas
        assert result['features']['generation'] == 10
        assert result['features']['year'] == 2022

    def test_ipad_10_ordinal_generation_format(self, ipad_10_wifi_64gb):
        """Soporta formato de generación ordinal."""
        result = map_device(
            {'FullName': 'iPad (10.ª generación) Wi-Fi 64GB'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_10_wifi_64gb.id
        assert result['features']['generation'] == 10

    # ===========================
    # Tests E2E de casos especiales
    # ===========================

    def test_ipad_case_insensitive(self, ipad_pro_12_9_m2_wifi_256gb):
        """map_device() es case-insensitive para iPads."""
        result = map_device(
            {'FullName': 'ipad pro 12.9-inch m2 wi-fi 256gb'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_pro_12_9_m2_wifi_256gb.id

    def test_ipad_with_price(self, ipad_pro_12_9_m2_wifi_256gb):
        """map_device() incluye precio de Likewize para iPads."""
        result = map_device(
            {
                'FullName': 'iPad Pro 12.9-inch M2 Wi-Fi 256GB',
                'DevicePrice': '750.00'
            },
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == ipad_pro_12_9_m2_wifi_256gb.id

    def test_ipad_no_match_when_not_in_db(self):
        """map_device() retorna no_match cuando iPad no existe en BD."""
        result = map_device(
            {'FullName': 'iPad Pro 15-inch M5 Wi-Fi 1TB'},
            system='v4'
        )

        assert result['success'] is False
        assert result['capacidad_id'] is None
        assert 'No se encontraron candidatos' in result['error_message']

    def test_ipad_result_format_compatible(self, ipad_pro_12_9_m2_wifi_256gb):
        """El resultado de iPad es compatible con formato v3."""
        result = map_device(
            {'FullName': 'iPad Pro 12.9-inch M2 Wi-Fi 256GB'},
            system='v4'
        )

        # Campos que código legacy espera
        assert 'success' in result
        assert 'capacidad_id' in result
        assert 'modelo_id' in result
        assert 'modelo_descripcion' in result
        assert 'capacidad_tamanio' in result
        assert 'confidence' in result
        assert 'strategy' in result

        # Campos adicionales de v4
        assert 'mapping_version' in result
        assert 'features' in result
        assert 'candidates_count' in result

    def test_ipad_includes_all_metadata(self, ipad_pro_12_9_m2_wifi_256gb):
        """El resultado de iPad incluye toda la metadata esperada."""
        result = map_device(
            {'FullName': 'iPad Pro 12.9-inch M2 Wi-Fi 256GB'},
            system='v4'
        )

        assert result['success'] is True

        # Features extraídas
        assert result['features']['variant'] == 'Pro'
        assert result['features']['screen_size'] == 12.9
        assert result['features']['cpu'] == 'M2'
        assert result['features']['year'] == 2022
        assert result['features']['storage_gb'] == 256
        assert result['features']['has_wifi'] is True
        assert result['features']['has_cellular'] is False

        # Estrategia
        assert result['strategy'] == 'generation'

        # Candidatos
        assert result['candidates_count'] >= 1

        # Timing
        assert 'elapsed_time' in result


@pytest.mark.django_db
class TestIntegrationV4_MacBook:
    """Tests de integración E2E para MacBooks."""

    # ===========================
    # Fixtures de modelos MacBook
    # ===========================

    @pytest.fixture
    def macbook_air_m3_13_512gb(self):
        """Fixture: MacBook Air M3 13" 512GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="MacBook Air (13 pulgadas, 2024) A3113 M3",
            tipo="MacBook Air",
            marca="Apple",
            año=2024,
            procesador="M3"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="512 GB",
            activo=True
        )

    @pytest.fixture
    def macbook_pro_m3_max_16_2tb(self):
        """Fixture: MacBook Pro M3 Max 16" 2TB en BD."""
        modelo = Modelo.objects.create(
            descripcion="MacBook Pro (16 pulgadas, 2023) A2991 M3 Max 16 Core CPU 40 Core GPU",
            tipo="MacBook Pro",
            marca="Apple",
            año=2023,
            procesador="M3 Max"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="2 TB",
            activo=True
        )

    @pytest.fixture
    def macbook_pro_intel_core_i7_13_512gb(self):
        """Fixture: MacBook Pro Intel Core i7 13" 512GB en BD."""
        modelo = Modelo.objects.create(
            descripcion="MacBook Pro (13 pulgadas, 2020) A2251 Core i7 2.3",
            tipo="MacBook Pro",
            marca="Apple",
            año=2020,
            procesador="Core i7 2.3"
        )
        return Capacidad.objects.create(
            modelo=modelo,
            tamaño="512 GB",
            activo=True
        )

    # ===========================
    # Tests E2E de MacBook
    # ===========================

    def test_map_macbook_air_m3_13(self, macbook_air_m3_13_512gb):
        """map_device() mapea MacBook Air M3 13" correctamente."""
        result = map_device(
            {'FullName': 'MacBookAir15 12 M3 8 Core CPU 10 Core GPU 13 inch A3113 3/2024 512GB SSD'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == macbook_air_m3_13_512gb.id
        assert result['mapping_version'] == 'v4'
        assert 'MacBook Air' in result['modelo_descripcion']

    def test_map_macbook_pro_m3_max_16(self, macbook_pro_m3_max_16_2tb):
        """map_device() mapea MacBook Pro M3 Max 16" correctamente."""
        result = map_device(
            {'FullName': 'MacBookPro15 9 M3 Max 16 Core CPU 40 Core GPU 16 inch A2991 10/2023 2TB SSD'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == macbook_pro_m3_max_16_2tb.id
        assert 'MacBook Pro' in result['modelo_descripcion']
        assert 'M3 Max' in result['modelo_descripcion']

    def test_map_macbook_pro_intel_core_i7_13(self, macbook_pro_intel_core_i7_13_512gb):
        """map_device() mapea MacBook Pro Intel Core i7 13" correctamente."""
        result = map_device(
            {'FullName': 'MacBookPro16 2 Core i7 2.3 13 inch A2251 5/2020 512GB SSD'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == macbook_pro_intel_core_i7_13_512gb.id
        assert 'MacBook Pro' in result['modelo_descripcion']
        assert 'Core i7' in result['modelo_descripcion']

    def test_macbook_features_extracted(self, macbook_air_m3_13_512gb):
        """Features de MacBook se extraen correctamente."""
        result = map_device(
            {'FullName': 'MacBookAir15 12 M3 8 Core CPU 10 Core GPU 13 inch A3113 3/2024 512GB SSD'},
            system='v4'
        )

        assert result['success'] is True
        assert result['features']['variant'] == 'Air'
        assert result['features']['cpu'] == 'M3'
        assert result['features']['screen_size'] == 13.0
        assert result['features']['storage_gb'] == 512
        assert result['features']['year'] == 2024
        assert result['features']['has_wifi'] is True
        assert result['features']['has_cellular'] is False

    def test_macbook_case_insensitive(self, macbook_air_m3_13_512gb):
        """map_device() es case-insensitive para MacBooks."""
        result = map_device(
            {'FullName': 'macbookair15 12 m3 13 inch 512gb ssd'},
            system='v4'
        )

        assert result['success'] is True
        assert result['capacidad_id'] == macbook_air_m3_13_512gb.id

    def test_macbook_no_match_when_not_in_db(self):
        """map_device() retorna no_match cuando MacBook no existe en BD."""
        result = map_device(
            {'FullName': 'MacBook Air M5 13 inch 2TB SSD'},
            system='v4'
        )

        assert result['success'] is False
        assert result['capacidad_id'] is None

    def test_macbook_result_format_compatible(self, macbook_air_m3_13_512gb):
        """El resultado de MacBook es compatible con formato v3."""
        result = map_device(
            {'FullName': 'MacBookAir15 12 M3 13 inch 512GB SSD'},
            system='v4'
        )

        # Campos que código legacy espera
        assert 'success' in result
        assert 'capacidad_id' in result
        assert 'modelo_id' in result
        assert 'confidence' in result
        assert 'strategy' in result

        # Campos adicionales de v4
        assert 'mapping_version' in result
        assert 'features' in result
