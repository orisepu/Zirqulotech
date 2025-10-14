"""
Feature Extractor para Samsung Galaxy.

Extrae información estructurada desde nombres crudos de Samsung
que vienen de Likewize:
- Serie (S10-S25, Note9-Note20, Z Fold2-6, Z Flip3-5)
- Variantes (Plus, Ultra, FE)
- Código de modelo (SM-G991B, SM-S921F, etc.)
- Capacidad de almacenamiento (128GB, 256GB, 512GB, 1TB)
- **FILTRO CRÍTICO:** Solo modelos compatibles con España (F, B)
"""

import re
from typing import Optional

from productos.mapping.extractors.base import BaseFeatureExtractor
from productos.mapping.core.types import (
    LikewizeInput,
    ExtractedFeatures,
    MappingContext,
    DeviceType,
)


class SamsungFeatureExtractor(BaseFeatureExtractor):
    """
    Extractor de features para Samsung Galaxy.

    Maneja todos los casos de Samsung incluyendo:
    - Galaxy S series (S10, S20, S21, S22, S23, S24, S25)
    - Galaxy Note series (Note9, Note10, Note20)
    - Galaxy Z Fold series (Fold2, Fold3, Fold4, Fold5, Fold6)
    - Galaxy Z Flip series (Flip3, Flip4, Flip5)
    - Variantes: Plus, Ultra, FE (Fan Edition)

    **FILTRO CRÍTICO DE REGIÓN:**
    Solo acepta modelos compatibles con España:
    - SM-XXXF (Europa)
    - SM-XXXB (UK)
    - SM-XXXF DS / SM-XXXB DS (Dual SIM Europa/UK)

    Rechaza:
    - SM-XXXU / SM-XXXU1 (USA)
    - SM-XXXN (Korea)
    - SM-XXX0 (China)
    """

    def __init__(self):
        """Inicializa el extractor con patrones regex."""

        # Patrones regex precompilados para eficiencia
        self.device_pattern = re.compile(r'\bgalaxy\b', re.I)
        self.storage_pattern = re.compile(r'(\d+(?:\.\d+)?)\s*(TB|GB)', re.I)

        # Patrón para código de modelo Samsung (SM-XXXXX)
        self.model_code_pattern = re.compile(r'\b(SM-[A-Z]\d{3,4}[A-Z0-9]{0,2})\b', re.I)

        # Patrones para series
        # S series: S10, S20, S21, S22, S23, S24, S25
        # También captura sufijo 'e' para S10e, S20e
        self.s_series_pattern = re.compile(r'\bS\s*(\d{2})(e)?\b', re.I)

        # Note series: Note9, Note10, Note20
        self.note_series_pattern = re.compile(r'\bNote\s*(\d{1,2})', re.I)

        # Z Fold series: Fold2, Fold3, Fold4, Fold5, Fold6
        self.fold_series_pattern = re.compile(r'\b(?:Z\s*)?Fold\s*(\d)', re.I)

        # Z Flip series: Flip3, Flip4, Flip5
        self.flip_series_pattern = re.compile(r'\b(?:Z\s*)?Flip\s*(\d)', re.I)

        # Z Flip primera generación (sin número, solo "5G")
        # Ej: "Galaxy Z Flip 5G" (2020) - NO confundir con "Z Flip5" (2023)
        self.flip_5g_pattern = re.compile(r'\b(?:Z\s*)?Flip\s+5G\b(?!\d)', re.I)

        # Patrones para variantes (orden importa: más específico primero)
        self.variant_ultra_pattern = re.compile(r'\bultra\b', re.I)
        self.variant_plus_pattern = re.compile(r'\bplus\b', re.I)
        self.variant_fe_pattern = re.compile(r'\bFE\b', re.I)
        self.variant_lite_pattern = re.compile(r'\blite\b', re.I)

        # Patrón para región España-compatible (F o B, con o sin DS)
        # Ejemplos: SM-G991B, SM-S921F, SM-G991B/DS, SM-S921F/DS
        self.spain_region_pattern = re.compile(r'\bSM-[A-Z]\d{3,4}[FB](?:/DS)?\b', re.I)

    def _do_extract(
        self,
        input_data: LikewizeInput,
        features: ExtractedFeatures,
        context: MappingContext
    ) -> ExtractedFeatures:
        """
        Extrae features específicas de Samsung Galaxy.

        Args:
            input_data: Input de Likewize
            features: Features a rellenar
            context: Contexto de mapeo

        Returns:
            Features rellenadas
        """
        text = self._normalize_text(input_data.model_name)

        # 1. Verificar que es un Samsung Galaxy
        if not self._is_samsung(text):
            context.debug("No es un Samsung Galaxy, saltando extracción")
            return features

        features.device_type = DeviceType.SAMSUNG
        features.add_note("Device type detectado: Samsung Galaxy")
        context.info("Device type: Samsung Galaxy")

        # 2. **FILTRO CRÍTICO:** Verificar región España antes de continuar
        model_code = self._extract_model_code(text, context)
        if model_code and not self._is_spain_compatible(model_code, context):
            # Marcar como error - no compatible con España
            context.error(
                f"Samsung {model_code} no es compatible con España. "
                f"Solo se aceptan códigos F (Europa) y B (UK). "
                f"Código detectado no válido para el mercado español."
            )
            features.add_note(
                f"⛔ RECHAZADO: {model_code} no compatible con España "
                f"(solo se aceptan F/B)"
            )
            # No continuar con la extracción - este dispositivo no es válido
            return features

        # Si llegamos aquí, el modelo ES compatible con España
        if model_code:
            features.model_code = model_code
            features.add_note(f"✅ Código de modelo compatible con España: {model_code}")
            context.info(f"Código de modelo: {model_code}")

            # Detectar si es 5G basándose en el código de modelo
            if self._is_5g_model(model_code, context):
                features.has_5g = True
                features.add_note("5G detectado desde código de modelo")
                context.info("Modelo 5G detectado")

            # Detectar Dual SIM desde el código o texto
            if self._is_dual_sim(text, model_code, context):
                features.has_dual_sim = True
                features.add_note("Dual SIM detectado")
                context.info("Modelo Dual SIM detectado")

        # 3. Extraer serie (S, Note, Z Fold, Z Flip)
        series = self._extract_series(text, context)
        if series:
            features.series = series
            features.add_note(f"Serie detectada: {series}")
            context.info(f"Serie: {series}")

            # Si la serie incluye "5G" explícitamente (ej: "Z Flip 5G"), marcar como 5G
            if "5G" in series and not features.has_5g:
                features.has_5g = True
                features.add_note("5G detectado desde nombre de serie")
                context.info("Modelo 5G detectado desde serie")

        # 4. Extraer variante (Ultra, Plus, FE)
        variant = self._extract_variant(text, context)
        if variant:
            features.variant = variant
            features.add_note(f"Variante detectada: {variant}")
            context.info(f"Variante: {variant}")

        # 5. Extraer capacidad de almacenamiento
        storage = self._extract_storage(text, context)

        # Si no se encontró en model_name, buscar en el campo capacity separado
        if not storage and input_data.capacity:
            storage = self._extract_storage(input_data.capacity, context)
            if storage:
                context.debug(f"Capacidad extraída del campo separado: {storage}GB")

        if storage:
            features.storage_gb = storage
            features.add_note(f"Almacenamiento detectado: {storage}GB")
            context.info(f"Almacenamiento: {storage}GB")

        return features

    def _is_samsung(self, text: str) -> bool:
        """
        Verifica si el texto corresponde a un Samsung Galaxy.

        Args:
            text: Texto normalizado

        Returns:
            True si es Samsung Galaxy
        """
        return bool(self.device_pattern.search(text))

    def _extract_model_code(
        self,
        text: str,
        context: MappingContext
    ) -> Optional[str]:
        """
        Extrae el código de modelo de Samsung.

        Formato: SM- seguido de letra + 3-4 dígitos + sufijo alfanumérico
        Ejemplos: SM-G991B, SM-S921F, SM-N981B/DS

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Código de modelo o None
        """
        match = self.model_code_pattern.search(text)
        if match:
            code = match.group(1).upper()
            context.debug(f"Código de modelo detectado: {code}")
            return code

        context.debug("No se detectó código de modelo")
        return None

    def _is_spain_compatible(self, model_code: str, context: MappingContext) -> bool:
        """
        Verifica si el código de modelo es compatible con España.

        **FILTRO CRÍTICO:**
        Solo acepta:
        - SM-XXXF (Europa)
        - SM-XXXB (UK)
        - SM-XXXF/DS, SM-XXXB/DS (Dual SIM Europa/UK)

        Rechaza:
        - SM-XXXU, SM-XXXU1 (USA)
        - SM-XXXN (Korea)
        - SM-XXX0 (China)
        - Cualquier otro código regional

        Args:
            model_code: Código de modelo (ej: SM-G991B, SM-S921U)
            context: Contexto de mapeo

        Returns:
            True si es compatible con España, False en caso contrario
        """
        # Verificar si tiene F o B (con o sin /DS)
        if self.spain_region_pattern.search(model_code):
            region = 'F' if 'F' in model_code else 'B'
            dual_sim = '/DS' in model_code or ' DS' in model_code
            ds_text = " Dual SIM" if dual_sim else ""
            region_name = "Europa" if region == 'F' else "UK"
            context.info(
                f"✅ Modelo compatible con España: {model_code} "
                f"(región {region_name}{ds_text})"
            )
            return True

        # Si no tiene F o B, verificar qué región tiene para dar feedback claro
        if re.search(r'SM-[A-Z]\d{3,4}U1?', model_code, re.I):
            context.warning(f"❌ Modelo USA (U/U1) no compatible con España: {model_code}")
        elif re.search(r'SM-[A-Z]\d{3,4}N', model_code, re.I):
            context.warning(f"❌ Modelo Korea (N) no compatible con España: {model_code}")
        elif re.search(r'SM-[A-Z]\d{3,4}0', model_code, re.I):
            context.warning(f"❌ Modelo China (0) no compatible con España: {model_code}")
        else:
            context.warning(f"❌ Región desconocida no compatible con España: {model_code}")

        return False

    def _extract_series(self, text: str, context: MappingContext) -> Optional[str]:
        """
        Extrae la serie de Samsung Galaxy.

        Series soportadas:
        - S series: S10, S20, S21, S22, S23, S24, S25
        - Note series: Note9, Note10, Note20
        - Z Fold series: Fold2, Fold3, Fold4, Fold5, Fold6
        - Z Flip series: Flip3, Flip4, Flip5

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Serie (ej: "S21", "Note20", "Z Fold5", "Z Flip4") o None
        """
        # Intentar Z Fold primero (más específico)
        match = self.fold_series_pattern.search(text)
        if match:
            num = match.group(1)
            series = f"Z Fold{num}"
            context.debug(f"Serie Z Fold detectada: {series}")
            return series

        # Intentar Z Flip primera generación (sin número, solo "5G") PRIMERO
        # Esto debe ir antes del patrón numerado para evitar confusión
        match = self.flip_5g_pattern.search(text)
        if match:
            series = "Z Flip 5G"
            context.debug(f"Serie Z Flip 5G (primera generación 2020) detectada: {series}")
            return series

        # Intentar Z Flip numerado (Flip3, Flip4, Flip5)
        match = self.flip_series_pattern.search(text)
        if match:
            num = match.group(1)
            series = f"Z Flip{num}"
            context.debug(f"Serie Z Flip detectada: {series}")
            return series

        # Intentar Note
        match = self.note_series_pattern.search(text)
        if match:
            num = match.group(1)
            series = f"Note{num}"
            context.debug(f"Serie Note detectada: {series}")
            return series

        # Intentar S series
        match = self.s_series_pattern.search(text)
        if match:
            num = match.group(1)
            has_e = match.group(2)  # Captura el sufijo 'e' si existe
            series = f"S{num}{'e' if has_e else ''}"
            context.debug(f"Serie S detectada: {series}")
            return series

        context.warning("No se pudo detectar serie Samsung")
        return None

    def _extract_variant(self, text: str, context: MappingContext) -> Optional[str]:
        """
        Extrae la variante de Samsung Galaxy.

        Variantes soportadas:
        - Ultra (S21 Ultra, S22 Ultra, S23 Ultra, S24 Ultra)
        - Plus (S21 Plus, S22 Plus, S23 Plus)
        - FE (Fan Edition - S20 FE, S21 FE, S23 FE, S24 FE)
        - Lite (S10 Lite, S20 Lite)
        - e (S10e, S20 FE - detectado en serie)

        Orden de prioridad:
        1. Ultra (más específico)
        2. Plus
        3. Lite
        4. FE
        5. None (modelo regular)

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Nombre de la variante o None
        """
        # Ultra (más específico primero)
        if self.variant_ultra_pattern.search(text):
            context.debug("Variante Ultra detectada")
            return "Ultra"

        # Plus
        if self.variant_plus_pattern.search(text):
            context.debug("Variante Plus detectada")
            return "Plus"

        # Lite (detectar antes que FE para evitar confusión)
        if self.variant_lite_pattern.search(text):
            context.debug("Variante Lite detectada")
            return "Lite"

        # FE (Fan Edition)
        if self.variant_fe_pattern.search(text):
            context.debug("Variante FE detectada")
            return "FE"

        context.debug("No se detectó variante (Samsung regular)")
        return None

    def _extract_storage(self, text: str, context: MappingContext) -> Optional[int]:
        """
        Extrae capacidad de almacenamiento en GB.

        Soporta formatos:
        - "128GB", "256 GB"
        - "1TB", "1 TB" (convertido a GB)

        Args:
            text: Texto normalizado
            context: Contexto de mapeo

        Returns:
            Capacidad en GB o None
        """
        match = self.storage_pattern.search(text)
        if not match:
            context.warning("No se detectó capacidad de almacenamiento")
            return None

        try:
            value = float(match.group(1))
            unit = match.group(2).upper()

            # Convertir a GB
            if unit == "TB":
                gb = int(value * 1024)
            else:
                gb = int(value)

            context.debug(f"Almacenamiento detectado: {gb}GB (raw: {value}{unit})")
            return gb

        except (ValueError, AttributeError) as e:
            context.error(f"Error parseando capacidad: {e}")
            return None

    def _is_5g_model(self, model_code: str, context: MappingContext) -> bool:
        """
        Detecta si el código de modelo Samsung corresponde a un dispositivo 5G.

        Patrones conocidos:
        - Note10 Plus: SM-N976X = 5G, SM-N975X = 4G
        - Note10: SM-N971X = 5G, SM-N970X = 4G
        - Note20: SM-N986X = 5G, SM-N985X = 4G
        - S20/S21/S22: Mayormente 5G (SM-G98XX, SM-G99XX, SM-S9XXX)

        Regla general:
        - Si el penúltimo dígito es 6, 7, 8, 9 → probablemente 5G
        - Si es 5 → probablemente 4G
        - Si no se puede determinar → False (asumir 4G)

        Args:
            model_code: Código de modelo (ej: SM-N976F, SM-N975F)
            context: Contexto de mapeo

        Returns:
            True si es 5G, False si es 4G o no se puede determinar
        """
        import re

        # Buscar el patrón numérico en el código (ej: N976, G991, S908)
        match = re.search(r'SM-([A-Z])(\d{3,4})', model_code.upper())
        if not match:
            context.debug(f"No se pudo detectar patrón numérico en {model_code}")
            return False

        letter = match.group(1)
        numbers = match.group(2)

        # Obtener el ÚLTIMO dígito (el más crítico para 5G vs 4G)
        if len(numbers) >= 3:
            ultimo_digito = int(numbers[-1])

            # Note series: N976 = 5G (último=6), N975 = 4G (último=5)
            if letter == 'N':
                if ultimo_digito in [6, 7, 8, 9]:
                    context.debug(f"5G detectado: Note series con último dígito {ultimo_digito}")
                    return True
                elif ultimo_digito in [0, 1, 2, 3, 4, 5]:
                    context.debug(f"4G detectado: Note series con último dígito {ultimo_digito}")
                    return False

            # S/G series: mayoría de S20+ son 5G
            # S908 = S22 Ultra 5G, G991 = S21 5G, G981 = S20 5G
            elif letter in ['S', 'G']:
                # A partir de S20 (G98X), la mayoría son 5G
                if len(numbers) >= 3:
                    first_digit = int(numbers[0])
                    second_digit = int(numbers[1])

                    # G98X, G99X, S90X, S91X, S92X = S20/S21/S22/S23 (5G)
                    if first_digit == 9 and second_digit >= 8:
                        context.debug(f"5G detectado: S/G series >= S20")
                        return True
                    # S908, S918, S928 = S22/S23/S24 Ultra (5G)
                    elif first_digit == 9 and second_digit == 0:
                        context.debug(f"5G detectado: S series Ultra")
                        return True

        context.debug(f"No se pudo determinar 5G, asumiendo 4G para {model_code}")
        return False

    def _is_dual_sim(self, text: str, model_code: str, context: MappingContext) -> bool:
        """
        Detecta si el dispositivo Samsung es Dual SIM.

        Patrones:
        - SM-N975F DS (con "DS" explícito)
        - SM-N975F/DS (con "/DS")
        - "Dual SIM" o "Dual Sim" en el texto

        Args:
            text: Texto normalizado del nombre del modelo
            model_code: Código de modelo (ej: SM-N975F)
            context: Contexto de mapeo

        Returns:
            True si es Dual SIM, False en caso contrario
        """
        text_lower = text.lower()

        # Buscar "DS" como sufijo (más común)
        if ' ds' in text_lower or '/ds' in text_lower or text_lower.endswith('ds'):
            context.debug("Dual SIM detectado: sufijo 'DS' en texto")
            return True

        # Buscar "Dual SIM" o "Dual Sim" explícito
        if 'dual sim' in text_lower or 'dual-sim' in text_lower:
            context.debug("Dual SIM detectado: texto 'dual sim' explícito")
            return True

        # Si el modelo code tiene DS
        if model_code and (' DS' in model_code.upper() or '/DS' in model_code.upper()):
            context.debug("Dual SIM detectado: sufijo 'DS' en código de modelo")
            return True

        return False
