"""
Extractores de metadatos específicos por marca.
Cada extractor conoce las particularidades de formato y nomenclatura de su marca.
"""

import re
from typing import Dict, Any, Optional, List
from decimal import Decimal

from .device_mapping import MetadataExtractor, DeviceMetadata, MappingResult


class AppleMetadataExtractor(MetadataExtractor):
    """Extractor optimizado para dispositivos Apple."""

    def __init__(self):
        self.IPHONE_SUFFIXES = ["Pro Max", "Pro", "Plus", "Mini", "Max"]
        self.MAC_FAMILIES = {
            "MacBook Pro", "MacBook Air", "iMac", "Mac mini",
            "Mac Studio", "Mac Pro", "iMac Pro"
        }
        self.CPU_FAMILIES = [
            "M4 Ultra", "M4 Max", "M4 Pro", "M4",
            "M3 Ultra", "M3 Max", "M3 Pro", "M3",
            "M2 Ultra", "M2 Max", "M2 Pro", "M2",
            "M1 Ultra", "M1 Max", "M1 Pro", "M1",
            "Core i9", "Core i7", "Core i5", "Core i3", "Xeon W"
        ]

    def extract_metadata(self, raw_data: Dict[str, Any]) -> DeviceMetadata:
        """Extrae metadatos específicos para Apple."""
        model_name = raw_data.get("ModelName", "") or raw_data.get("FullName", "")
        brand = raw_data.get("BrandName", "Apple")
        device_type = self._determine_apple_type(model_name)

        # Extraer A-number que es más preciso para Apple
        a_number = self._extract_a_number(model_name)

        # Determinar el mejor código de modelo Likewize
        likewize_model_code = self._get_best_likewize_code(raw_data, a_number, device_type)

        metadata = DeviceMetadata(
            brand=brand,
            device_type=device_type,
            model_raw=model_name,
            model_normalized=self._normalize_apple_model(model_name),
            capacity_gb=self._extract_storage_gb(model_name),
            a_number=a_number,
            screen_size=self._extract_screen_size(model_name),
            year=self._extract_year(model_name),
            cpu=self._extract_cpu(model_name),
            gpu_cores=self._extract_gpu_cores(model_name),
            likewize_model_code=likewize_model_code,
            likewize_master_model_id=str(raw_data.get("MasterModelId", "")),
            additional_data=raw_data
        )

        # Refinamientos específicos por tipo
        if device_type == "iPad":
            metadata = self._refine_ipad_metadata(metadata)
        elif device_type == "iPhone":
            metadata = self._refine_iphone_metadata(metadata)
        elif device_type in self.MAC_FAMILIES:
            metadata = self._refine_mac_metadata(metadata)

        return metadata

    def _determine_apple_type(self, model_name: str) -> str:
        """Determina el tipo de dispositivo Apple."""
        name_lower = model_name.lower()

        if "iphone" in name_lower:
            return "iPhone"
        elif "ipad" in name_lower:
            return "iPad"
        elif "macmini" in name_lower.replace(" ", ""):
            return "Mac mini"
        elif any(mac.lower() in name_lower for mac in self.MAC_FAMILIES):
            for family in self.MAC_FAMILIES:
                if family.lower().replace(" ", "") in name_lower.replace(" ", ""):
                    return family
            return "Mac"
        return "Unknown"

    def _normalize_apple_model(self, model_name: str) -> str:
        """Normaliza nombres de modelos Apple."""
        normalized = model_name.strip()

        # Normalizar Mac mini específicamente
        if "macmini" in normalized.lower().replace(" ", ""):
            # Convertir "Macmini14" a "Mac mini"
            normalized = re.sub(r"\bmacmini\d*\b", "Mac mini", normalized, flags=re.I)

            # Limpiar números de generación extra
            normalized = re.sub(r"\bMac mini\s+\d+\b", "Mac mini", normalized, flags=re.I)

        # Normalizar unidades comunes
        normalized = re.sub(r"\b(Inch|Inches)\b", "inch", normalized, flags=re.I)
        normalized = re.sub(r"\bGb\b", "GB", normalized, flags=re.I)
        normalized = re.sub(r"\bTb\b", "TB", normalized, flags=re.I)
        normalized = re.sub(r"\bSsd\b", "SSD", normalized, flags=re.I)

        # Normalizar CPU Intel
        normalized = re.sub(r"\bCore\s+I([3579])\b", r"Core i\1", normalized, flags=re.I)

        # Limpiar espacios múltiples
        normalized = re.sub(r"\s{2,}", " ", normalized).strip()

        return normalized

    def _get_best_likewize_code(self, raw_data: Dict[str, Any], a_number: str, device_type: str) -> str:
        """Determina el mejor código de modelo Likewize para Apple."""
        # Prioridad 1: A-number si está disponible (más preciso para Apple)
        if a_number:
            return a_number

        # Obtener códigos disponibles de Likewize
        m_model = raw_data.get("M_Model", "")
        master_model = raw_data.get("MasterModelName", "")

        # Prioridad 2: Evitar códigos genéricos problemáticos para Mac mini
        if device_type == "Mac mini":
            # "MINI" es demasiado genérico, buscar algo más específico
            if m_model and m_model.upper() != "MINI" and len(m_model) > 4:
                return m_model
            elif master_model and master_model.upper() != "MINI" and len(master_model) > 4:
                return master_model
            # Si solo tenemos "MINI", intentar extraer A-number de otros campos
            full_text = f"{raw_data.get('ModelName', '')} {raw_data.get('FullName', '')} {m_model} {master_model}"
            extracted_a = self._extract_a_number(full_text)
            if extracted_a:
                return extracted_a

        # Prioridad 3: Usar M_Model o MasterModelName normalmente
        return m_model or master_model

    def _extract_storage_gb(self, text: str) -> Optional[int]:
        """Extrae capacidad de almacenamiento en GB."""
        match = re.search(r"(\d+(?:[.,]\d+)?)\s*(TB|GB)\b", text, flags=re.I)
        if not match:
            return None

        qty_str = match.group(1).replace(",", ".")
        unit = match.group(2).upper()

        try:
            qty = float(qty_str)
            return int(qty * 1024) if unit == "TB" else int(qty)
        except ValueError:
            return None

    def _extract_a_number(self, text: str) -> str:
        """Extrae código A-number de Apple."""
        match = re.search(r"\bA(\d{4})\b", text, flags=re.I)
        return f"A{match.group(1)}" if match else ""

    def _extract_screen_size(self, text: str) -> Optional[int]:
        """Extrae tamaño de pantalla en pulgadas."""
        match = re.search(r"\b(\d{1,2}(?:[.,]\d)?)\s*(?:''|\"|″|inch(?:es)?|pulgadas)\b", text, flags=re.I)
        if match:
            try:
                size = float(match.group(1).replace(",", "."))
                return int(round(size))
            except ValueError:
                pass
        return None

    def _extract_year(self, text: str) -> Optional[int]:
        """Extrae año del modelo."""
        match = re.search(r"\b(20\d{2})\b", text)
        return int(match.group(1)) if match else None

    def _extract_cpu(self, text: str) -> str:
        """Extrae información de CPU."""
        # Apple Silicon - más específico para M2 Pro
        # Buscar patrón específico "M2 Pro" antes que genérico
        if re.search(r"\bM2\s+Pro\b", text, flags=re.I):
            return "M2 Pro"
        elif re.search(r"\bM2\b", text, flags=re.I):
            return "M2"

        # Apple Silicon genérico
        match = re.search(r"\b(M[1-4])(?:\s|-)?(Ultra|Max|Pro)?\b", text, flags=re.I)
        if match:
            base = match.group(1).upper()
            suffix = (match.group(2) or "").title()
            return f"{base} {suffix}".strip()

        # Intel Core con frecuencia
        match = re.search(r"\bCore\s+i([3579])\s*([0-9](?:\.[0-9])?)\b", text, flags=re.I)
        if match:
            return f"Core i{match.group(1)} {match.group(2)}"

        # Xeon W
        match = re.search(r"\bXeon\s*W\b.*?\b([0-9](?:\.[0-9])?)\b", text, flags=re.I)
        if match:
            return f"Xeon W {match.group(1)}"

        # Buscar familias conocidas
        for family in self.CPU_FAMILIES:
            if re.search(rf"\b{re.escape(family)}\b", text, flags=re.I):
                return family

        return ""

    def _extract_gpu_cores(self, text: str) -> Optional[int]:
        """Extrae número de núcleos GPU."""
        match = re.search(r"\b(\d{1,3})\s*Core\s*GPU\b", text, flags=re.I)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        return None

    def _refine_ipad_metadata(self, metadata: DeviceMetadata) -> DeviceMetadata:
        """Refinamientos específicos para iPad."""
        # Detectar subfamily (Pro, Air, mini)
        text = metadata.model_raw.lower()
        if "ipad pro" in text:
            metadata.device_type = "iPad Pro"
        elif "ipad air" in text:
            metadata.device_type = "iPad Air"
        elif "ipad mini" in text:
            metadata.device_type = "iPad mini"
        else:
            metadata.device_type = "iPad"

        # Detectar conectividad
        connectivity = {"wifi": False, "cellular": False}
        if re.search(r"\bwi[\-\s]?fi\b", text) or "wifi" in text:
            connectivity["wifi"] = True
        if "cellular" in text:
            connectivity["cellular"] = True

        metadata.additional_data.update(connectivity)
        return metadata

    def _refine_iphone_metadata(self, metadata: DeviceMetadata) -> DeviceMetadata:
        """Refinamientos específicos para iPhone."""
        # Detectar sufijos (Pro, Max, Plus, Mini)
        suffixes = []
        for suffix in self.IPHONE_SUFFIXES:
            if re.search(rf"\b{re.escape(suffix)}\b", metadata.model_raw, flags=re.I):
                suffixes.append(suffix)

        if suffixes:
            metadata.additional_data["suffixes"] = suffixes

        return metadata

    def _refine_mac_metadata(self, metadata: DeviceMetadata) -> DeviceMetadata:
        """Refinamientos específicos para Mac."""
        # Detectar si es torre vs all-in-one
        is_tower = not bool(metadata.screen_size) or "pulgadas" not in metadata.model_raw.lower()
        metadata.additional_data["is_tower"] = is_tower

        # Casos específicos conocidos (Mac mini 2023)
        if metadata.device_type == "Mac mini" and metadata.year == 2023:
            metadata = self._handle_mac_mini_2023_special_case(metadata)

        return metadata

    def _handle_mac_mini_2023_special_case(self, metadata: DeviceMetadata) -> DeviceMetadata:
        """Maneja caso especial de Mac mini 2023 con A-numbers mezclados."""
        if metadata.a_number in ["A2686", "A2816"]:
            # Inferir CPU basado en A-number si no está presente
            if not metadata.cpu:
                if metadata.a_number == "A2686":
                    metadata.cpu = "M2"
                elif metadata.a_number == "A2816":
                    metadata.cpu = "M2 Pro"

            metadata.additional_data["special_case"] = "mac_mini_2023_mixed_anumbers"

        return metadata

    def heuristic_mapping(self, metadata: DeviceMetadata, service) -> Optional[MappingResult]:
        """Heurísticas específicas para Apple."""
        # Mac mini 2023: caso especial con A-numbers mezclados
        if (metadata.device_type == "Mac mini" and
            metadata.year == 2023 and
            metadata.a_number in ["A2686", "A2816"]):

            return self._mac_mini_2023_heuristic(metadata, service)

        # iPad con chip M4: tratar como caso especial
        if metadata.device_type.startswith("iPad") and "M4" in metadata.cpu:
            return self._ipad_m4_heuristic(metadata, service)

        return None

    def _mac_mini_2023_heuristic(self, metadata: DeviceMetadata, service) -> Optional[MappingResult]:
        """Heurística para Mac mini 2023."""
        try:
            from django.db.models import Q

            # Buscar por cualquier A-number de Mac mini 2023
            candidates = service.ModeloClass.objects.filter(
                tipo="Mac mini",
                **{f"{service.REL_NAME}__iregex": r"\b(A2686|A2816)\b"}
            )

            # Filtrar por CPU si está disponible
            if metadata.cpu:
                cpu_candidates = candidates.filter(
                    Q(procesador__icontains=metadata.cpu) |
                    Q(**{f"{service.REL_NAME}__icontains": metadata.cpu})
                )
                if cpu_candidates.exists():
                    candidates = cpu_candidates

            # Buscar capacidad
            if metadata.capacity_gb and candidates.exists():
                capacity_id = service._find_capacity_for_models(candidates, metadata.capacity_gb)
                if capacity_id:
                    return MappingResult(
                        capacity_id,
                        65,
                        "heuristic",
                        {"heuristic": "mac_mini_2023_anumber_mixed"}
                    )

            # Caso especial: si el código Likewize es "MINI" y detectamos Mac mini 2023
            # intentar mapear directamente a A2816 (M2 Pro) o A2686 (M2 base)
            if (metadata.likewize_model_code.upper() == "MINI" and
                metadata.device_type == "Mac mini" and
                metadata.year == 2023):

                # Determinar A-number basado en CPU detectado
                target_a_number = None
                if "M2 Pro" in metadata.cpu:
                    target_a_number = "A2816"
                elif "M2" in metadata.cpu and "Pro" not in metadata.cpu:
                    target_a_number = "A2686"
                elif not metadata.cpu:
                    # Sin CPU detectado, usar A2816 como default (más común)
                    target_a_number = "A2816"

                if target_a_number:
                    specific_candidates = service.ModeloClass.objects.filter(
                        tipo="Mac mini",
                        **{f"{service.REL_NAME}__icontains": target_a_number}
                    )

                    if metadata.capacity_gb and specific_candidates.exists():
                        capacity_id = service._find_capacity_for_models(specific_candidates, metadata.capacity_gb)
                        if capacity_id:
                            return MappingResult(
                                capacity_id,
                                70,  # Slightly higher confidence for this specific fix
                                "heuristic",
                                {"heuristic": "mac_mini_2023_mini_code_fix", "inferred_a_number": target_a_number}
                            )

        except Exception as e:
            pass

        return None

    def _ipad_m4_heuristic(self, metadata: DeviceMetadata, service) -> Optional[MappingResult]:
        """Heurística para iPad con M4."""
        # Los iPad M4 no usan nomenclatura "generación", usar chip como señal principal
        try:
            from django.db.models import Q

            candidates = service.ModeloClass.objects.filter(
                tipo__icontains="iPad",
                **{f"{service.REL_NAME}__icontains": "M4"}
            )

            # Filtrar por subfamily si aplica
            if "Pro" in metadata.device_type:
                candidates = candidates.filter(**{f"{service.REL_NAME}__icontains": "Pro"})
            elif "Air" in metadata.device_type:
                candidates = candidates.filter(**{f"{service.REL_NAME}__icontains": "Air"})

            # Filtrar por tamaño de pantalla
            if metadata.screen_size:
                size_candidates = candidates.filter(
                    Q(pantalla__icontains=f"{metadata.screen_size} pulgadas") |
                    Q(**{f"{service.REL_NAME}__icontains": f"{metadata.screen_size} pulgadas"})
                )
                if size_candidates.exists():
                    candidates = size_candidates

            # Buscar capacidad
            if metadata.capacity_gb and candidates.exists():
                capacity_id = service._find_capacity_for_models(candidates, metadata.capacity_gb)
                if capacity_id:
                    return MappingResult(
                        capacity_id,
                        60,
                        "heuristic",
                        {"heuristic": "ipad_m4_chip_based"}
                    )

        except Exception as e:
            pass

        return None


class GoogleMetadataExtractor(MetadataExtractor):
    """Extractor optimizado para dispositivos Google (Pixel)."""

    def __init__(self):
        # Códigos específicos de Google a filtrar
        self.GOOGLE_CODE_PATTERN = re.compile(r'\b(?!A\d{4})(?=[A-Z0-9]{5,6}\b)[A-Z0-9]{5,6}\b')
        self.CAPACITY_PATTERN = re.compile(r'\b(\d+\s?TB|\d+\s?GB)\b', re.I)

    def extract_metadata(self, raw_data: Dict[str, Any]) -> DeviceMetadata:
        """Extrae metadatos específicos para Google Pixel."""
        model_name = raw_data.get("ModelName", "") or raw_data.get("FullName", "")
        brand = raw_data.get("BrandName", "Google")

        # Normalizar nombre de modelo Google
        normalized_model = self._normalize_google_model(model_name)

        metadata = DeviceMetadata(
            brand=brand,
            device_type="SmartPhone",  # Google solo tiene smartphones en Likewize
            model_raw=model_name,
            model_normalized=normalized_model,
            capacity_gb=self._extract_storage_gb(model_name),
            year=self._extract_year(model_name),
            likewize_model_code=raw_data.get("M_Model", "") or raw_data.get("MasterModelName", ""),
            likewize_master_model_id=str(raw_data.get("MasterModelId", "")),
            additional_data=raw_data
        )

        # Detectar variante (5G, Dual SIM, etc.)
        metadata.additional_data.update(self._detect_google_variants(model_name))

        return metadata

    def _normalize_google_model(self, model_name: str) -> str:
        """Normaliza nombres de modelos Google."""
        if not model_name:
            return ""

        normalized = model_name

        # Quitar prefijo "Google"
        normalized = re.sub(r'^\s*Google\s+', '', normalized, flags=re.I)

        # Quitar capacidades
        normalized = self.CAPACITY_PATTERN.sub('', normalized)

        # Quitar variantes de conectividad
        normalized = re.sub(r'\b5G\b', '', normalized, flags=re.I)
        normalized = re.sub(r'\bDual\s*SIM\b', '', normalized, flags=re.I)

        # Quitar códigos específicos de Google (pero preservar A-numbers de Apple)
        normalized = self.GOOGLE_CODE_PATTERN.sub('', normalized)

        # Limpiar espacios
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        return normalized

    def _extract_storage_gb(self, text: str) -> Optional[int]:
        """Extrae capacidad específica para Google."""
        match = re.search(r"(\d+(?:[.,]\d+)?)\s*(TB|GB)\b", text, flags=re.I)
        if not match:
            return None

        qty_str = match.group(1).replace(",", ".")
        unit = match.group(2).upper()

        try:
            qty = float(qty_str)
            return int(qty * 1024) if unit == "TB" else int(qty)
        except ValueError:
            return None

    def _extract_year(self, text: str) -> Optional[int]:
        """Extrae año del modelo."""
        match = re.search(r"\b(20\d{2})\b", text)
        return int(match.group(1)) if match else None

    def _detect_google_variants(self, model_name: str) -> Dict[str, Any]:
        """Detecta variantes específicas de Google (5G, Dual SIM, etc.)."""
        variants = {
            "has_5g": bool(re.search(r'\b5G\b', model_name, re.I)),
            "has_dual_sim": bool(re.search(r'\bDual\s*SIM\b', model_name, re.I)),
        }

        # Detectar códigos específicos del modelo
        google_codes = self.GOOGLE_CODE_PATTERN.findall(model_name)
        if google_codes:
            variants["model_codes"] = google_codes

        return variants

    def heuristic_mapping(self, metadata: DeviceMetadata, service) -> Optional[MappingResult]:
        """Heurísticas específicas para Google."""
        # Google usa códigos de modelo muy específicos, usar base normalizada
        try:
            from django.db.models import Q

            # Buscar por nombre base normalizado
            candidates = service.ModeloClass.objects.filter(
                marca__iexact="Google",
                **{f"{service.REL_NAME}__icontains": metadata.model_normalized}
            )

            if not candidates.exists():
                # Fallback: buscar por palabras clave principales
                words = metadata.model_normalized.split()
                if len(words) >= 2:
                    main_words = words[:2]  # "Pixel 6", "Pixel 7", etc.
                    search_term = " ".join(main_words)
                    candidates = service.ModeloClass.objects.filter(
                        marca__iexact="Google",
                        **{f"{service.REL_NAME}__icontains": search_term}
                    )

            # Buscar capacidad
            if metadata.capacity_gb and candidates.exists():
                capacity_id = service._find_capacity_for_models(candidates, metadata.capacity_gb)
                if capacity_id:
                    return MappingResult(
                        capacity_id,
                        55,
                        "heuristic",
                        {"heuristic": "google_normalized_base_match"}
                    )

        except Exception as e:
            pass

        return None


class SamsungMetadataExtractor(MetadataExtractor):
    """Extractor optimizado para dispositivos Samsung."""

    def __init__(self):
        self.EXCLUDED_REGION_PATTERNS = [
            r'SM-[A-Z]\d+[NU]$',  # Variantes US/Korea (N/U al final)
            r'SC-\d+[A-Z]$',      # Variantes japonesas
            r'SCV\d+$',           # Variantes Verizon
        ]

    def extract_metadata(self, raw_data: Dict[str, Any]) -> DeviceMetadata:
        """Extrae metadatos específicos para Samsung."""
        model_name = raw_data.get("ModelName", "") or raw_data.get("FullName", "")
        brand = raw_data.get("BrandName", "Samsung")

        # Detectar si es variante excluida
        is_excluded_variant = self._is_excluded_regional_variant(model_name)

        metadata = DeviceMetadata(
            brand=brand,
            device_type="SmartPhone",  # Samsung principalmente smartphones en Likewize
            model_raw=model_name,
            model_normalized=self._normalize_samsung_model(model_name),
            capacity_gb=self._extract_storage_gb(model_name),
            year=self._extract_year(model_name),
            likewize_model_code=raw_data.get("M_Model", "") or raw_data.get("MasterModelName", ""),
            likewize_master_model_id=str(raw_data.get("MasterModelId", "")),
            additional_data=raw_data
        )

        # Marcar variantes regionales excluidas
        if is_excluded_variant:
            metadata.additional_data["excluded_regional_variant"] = True

        # Detectar serie y características
        metadata.additional_data.update(self._detect_samsung_series(model_name))

        return metadata

    def _normalize_samsung_model(self, model_name: str) -> str:
        """Normaliza nombres de modelos Samsung."""
        normalized = model_name.strip()

        # Normalizar espacios y caracteres
        normalized = re.sub(r'\s+', ' ', normalized)

        return normalized

    def _extract_storage_gb(self, text: str) -> Optional[int]:
        """Extrae capacidad de almacenamiento."""
        match = re.search(r"(\d+(?:[.,]\d+)?)\s*(TB|GB)\b", text, flags=re.I)
        if not match:
            return None

        qty_str = match.group(1).replace(",", ".")
        unit = match.group(2).upper()

        try:
            qty = float(qty_str)
            return int(qty * 1024) if unit == "TB" else int(qty)
        except ValueError:
            return None

    def _extract_year(self, text: str) -> Optional[int]:
        """Extrae año del modelo."""
        match = re.search(r"\b(20\d{2})\b", text)
        return int(match.group(1)) if match else None

    def _is_excluded_regional_variant(self, model_name: str) -> bool:
        """Verifica si es una variante regional excluida."""
        for pattern in self.EXCLUDED_REGION_PATTERNS:
            if re.search(pattern, model_name):
                return True
        return False

    def _detect_samsung_series(self, model_name: str) -> Dict[str, Any]:
        """Detecta serie Samsung (Galaxy S, Note, etc.)."""
        series_info = {}

        # Detectar serie Galaxy S
        if re.search(r'Galaxy\s+S\d+', model_name, re.I):
            series_match = re.search(r'Galaxy\s+S(\d+)', model_name, re.I)
            if series_match:
                series_info["galaxy_s_series"] = int(series_match.group(1))

        # Detectar Galaxy Note
        if re.search(r'Galaxy\s+Note', model_name, re.I):
            note_match = re.search(r'Galaxy\s+Note\s*(\d+)?', model_name, re.I)
            if note_match and note_match.group(1):
                series_info["galaxy_note_series"] = int(note_match.group(1))
            else:
                series_info["galaxy_note_series"] = True

        # Detectar Galaxy Z (Fold/Flip)
        if re.search(r'Galaxy\s+Z', model_name, re.I):
            if re.search(r'Fold', model_name, re.I):
                series_info["galaxy_z_type"] = "Fold"
            elif re.search(r'Flip', model_name, re.I):
                series_info["galaxy_z_type"] = "Flip"

        return series_info

    def heuristic_mapping(self, metadata: DeviceMetadata, service) -> Optional[MappingResult]:
        """Heurísticas específicas para Samsung."""
        # Excluir variantes regionales automáticamente
        if metadata.additional_data.get("excluded_regional_variant"):
            return MappingResult(
                None,
                0,
                "heuristic",
                {"heuristic": "samsung_excluded_regional_variant"}
            )

        # Mapeo por código de modelo Samsung
        if metadata.likewize_model_code.startswith("SM-"):
            return self._samsung_model_code_heuristic(metadata, service)

        return None

    def _samsung_model_code_heuristic(self, metadata: DeviceMetadata, service) -> Optional[MappingResult]:
        """Heurística basada en códigos de modelo Samsung."""
        try:
            from django.db.models import Q

            # Buscar por código exacto primero
            candidates = service.ModeloClass.objects.filter(
                marca__iexact="Samsung",
                **{f"{service.REL_NAME}__icontains": metadata.likewize_model_code}
            )

            if not candidates.exists():
                # Buscar por modelo base (sin sufijo regional)
                base_code = re.sub(r'[A-Z]$', '', metadata.likewize_model_code)
                if base_code != metadata.likewize_model_code:
                    candidates = service.ModeloClass.objects.filter(
                        marca__iexact="Samsung",
                        **{f"{service.REL_NAME}__icontains": base_code}
                    )

            # Buscar capacidad
            if metadata.capacity_gb and candidates.exists():
                capacity_id = service._find_capacity_for_models(candidates, metadata.capacity_gb)
                if capacity_id:
                    return MappingResult(
                        capacity_id,
                        50,
                        "heuristic",
                        {"heuristic": "samsung_model_code_match"}
                    )

        except Exception as e:
            pass

        return None