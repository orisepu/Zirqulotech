#!/usr/bin/env python3
# Script para probar las correcciones del sistema de mapeo V2.

import os
import sys
import django

# Configurar Django
sys.path.append('/home/oriol/RootProyecto/checkouters/Partners/tenants-backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'checkouters.settings')
django.setup()

from productos.services.ios_mapping_service import iOSMappingService

def test_ios_mapping():
    """Prueba el mapeo de dispositivos iOS."""
    print("=== Prueba de Mapeo iOS ===")
    
    # Datos de prueba
    test_devices = [
        {
            'ProductCategoryName': 'iPhone',
            'M_Model': 'iPhone 11',
            'MasterModelName': 'iPhone 11',
            'ModelName': 'iPhone 11 128GB',
            'FullName': 'Apple iPhone 11 128GB',
            'Capacity': '128GB',
            'BrandName': 'Apple'
        },
        {
            'ProductCategoryName': 'iPhone',
            'M_Model': 'iPhone SE',
            'MasterModelName': 'iPhone SE (3rd generation)',
            'ModelName': 'iPhone SE (3rd generation) 64GB',
            'FullName': 'Apple iPhone SE (3rd generation) 64GB',
            'Capacity': '64GB',
            'BrandName': 'Apple'
        },
        {
            'ProductCategoryName': 'iPhone',
            'M_Model': 'iPhone 15 Pro Max',
            'MasterModelName': 'iPhone 15 Pro Max',
            'ModelName': 'iPhone 15 Pro Max 256GB',
            'FullName': 'Apple iPhone 15 Pro Max 256GB',
            'Capacity': '256GB',
            'BrandName': 'Apple'
        }
    ]
    
    ios_service = iOSMappingService()
    
    for i, device in enumerate(test_devices, 1):
        print(f"\n--- Dispositivo {i} ---")
        print(f"M_Model: {device['M_Model']}")
        print(f"ModelName: {device['ModelName']}")
        
        try:
            # Crear dispositivo de prueba
            from dataclasses import dataclass
            from typing import Optional
            
            @dataclass
            class TestDeviceInfo:
                m_model: str = ""
                master_model_name: str = ""
                model_name: str = ""
                full_name: str = ""
                capacity: str = ""
                brand_name: str = ""
                product_category_name: str = ""
                generation: str = ""
                model_base: str = ""
                model_variant: str = ""
                capacity_gb: Optional[int] = None
                inferred_a_number: str = ""
                inferred_year: Optional[int] = None
                inferred_cpu: str = ""
                knowledge_confidence: int = 0
                device_family: str = ""
                extraction_confidence: int = 0
                extraction_issues: list = None
                
                def __post_init__(self):
                    if self.extraction_issues is None:
                        self.extraction_issues = []
            
            # Crear objeto de dispositivo de prueba
            device_info = TestDeviceInfo(
                m_model=device.get('M_Model', ''),
                master_model_name=device.get('MasterModelName', ''),
                model_name=device.get('ModelName', ''),
                full_name=device.get('FullName', ''),
                capacity=device.get('Capacity', ''),
                brand_name=device.get('BrandName', ''),
                product_category_name=device.get('ProductCategoryName', '')
            )
            
            # Extraer detalles del modelo
            model_base, variant, generation = ios_service._extract_model_details(device_info)
            print(f"Modelo base extraído: {model_base}")
            print(f"Variante extraída: {variant}")
            print(f"Generación extraída: {generation}")
            
        except Exception as e:
            print(f"Error procesando dispositivo: {str(e)}")

if __name__ == '__main__':
    print("Probando correcciones del sistema de mapeo V2...")
    test_ios_mapping()
    print("\nPruebas completadas.")