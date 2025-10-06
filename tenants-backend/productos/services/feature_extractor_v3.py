import re
import hashlib
from typing import Dict, List, Optional, Set
from collections import Counter


class FeatureExtractor:
    """
    Extractor de características avanzado para mapeo inteligente de dispositivos
    """

    def __init__(self):
        # Patrones precompilados para eficiencia
        self.year_pattern = re.compile(r'20[1-2][0-9]')
        self.generation_pattern = re.compile(r'(\d{1,2})\s*\.?ª\s*generaci[oó]n', re.I)
        self.screen_size_pattern = re.compile(r'(\d{1,2}(?:[.,]\d)?)\s*["\u201C\u201D]?(?:\s*inch|pulgadas?)?', re.I)
        self.storage_pattern = re.compile(r'(\d+(?:[.,]\d+)?)\s*(TB|GB)', re.I)
        self.processor_pattern = re.compile(r'\b(M[1-4](?:\s+(?:Ultra|Max|Pro))?|A\d{2,3}[A-Z]?|Core\s+i[3579]|Xeon)\b', re.I)
        self.a_number_pattern = re.compile(r'\bA\d{4}\b', re.I)

        # Términos clave por categoría
        self.device_variants = {
            'pro': re.compile(r'\bpro\b', re.I),
            'max': re.compile(r'\bmax\b', re.I),
            'plus': re.compile(r'\bplus\b', re.I),
            'mini': re.compile(r'\bmini\b', re.I),
            'air': re.compile(r'\bair\b', re.I),
            'ultra': re.compile(r'\bultra\b', re.I),
            'studio': re.compile(r'\bstudio\b', re.I),
        }

        # Procesadores Apple por familia
        self.apple_processors = {
            'M4': ['M4', 'M4 Pro', 'M4 Max', 'M4 Ultra'],
            'M3': ['M3', 'M3 Pro', 'M3 Max', 'M3 Ultra'],
            'M2': ['M2', 'M2 Pro', 'M2 Max', 'M2 Ultra'],
            'M1': ['M1', 'M1 Pro', 'M1 Max', 'M1 Ultra'],
            'A_SERIES': ['A14', 'A15', 'A16', 'A17', 'A18']
        }

        # Stop words para tokenización
        self.stop_words = {
            'apple', 'gb', 'tb', 'wifi', 'wi-fi', 'cellular', 'lte', '5g', 'inch'
        }

    def extract_features(self, text: str) -> Dict:
        """
        Extrae características completas de un texto de dispositivo
        """
        if not text:
            return {}

        text_clean = self._clean_text(text)

        features = {
            # Características numéricas (algunas usan texto original para preservar paréntesis/comillas)
            'year': self._extract_year(text_clean),
            'generation': self._extract_generation(text),  # Usar texto original para detectar (3rd generation)
            'screen_size': self._extract_screen_size(text),  # Usar texto original para detectar ''
            'storage_gb': self._extract_storage_gb(text_clean),
            'gpu_cores': self._extract_gpu_cores(text_clean),

            # Características categóricas booleanas
            'has_pro': bool(self.device_variants['pro'].search(text_clean)),
            'has_max': bool(self.device_variants['max'].search(text_clean)),
            'has_plus': bool(self.device_variants['plus'].search(text_clean)),
            'has_mini': bool(self.device_variants['mini'].search(text_clean)),
            'has_air': bool(self.device_variants['air'].search(text_clean)),
            'has_ultra': bool(self.device_variants['ultra'].search(text_clean)),
            'has_studio': bool(self.device_variants['studio'].search(text_clean)),

            # Conectividad
            'has_wifi': bool(re.search(r'\bwi[\-\s]?fi\b', text_clean, re.I)),
            'has_cellular': bool(re.search(r'\bcellular\b', text_clean, re.I)),
            'has_5g': bool(re.search(r'\b5g\b', text_clean, re.I)),

            # Procesadores
            'processor_family': self._extract_processor_family(text_clean),
            'processor_variant': self._extract_processor_variant(text_clean),
            'a_number': self._extract_a_number(text_clean),

            # Análisis de texto
            'tokens': self._tokenize(text_clean),
            'token_count': len(self._tokenize(text_clean)),
            'char_count': len(text_clean),
            'word_count': len(text_clean.split()),

            # Hashes para similitud
            'phonetic_hash': self._phonetic_hash(text_clean),
            'ngram_hash_2': self._ngram_hash(text_clean, n=2),
            'ngram_hash_3': self._ngram_hash(text_clean, n=3),

            # Características específicas de dispositivo
            'device_type': self._infer_device_type(text_clean),
            'model_variant': self._extract_model_variant(text),  # Usar texto original
            'color_mentioned': self._has_color_mention(text_clean),
            'capacity_in_name': self._has_capacity_in_name(text_clean),

            # Metadatos
            'text_length': len(text),
            'text_complexity': self._calculate_complexity(text_clean),
        }

        # Añadir características derivadas
        features.update(self._extract_derived_features(features, text_clean))

        return features

    def _clean_text(self, text: str) -> str:
        """Limpia y normaliza el texto"""
        # Convertir a minúsculas
        text = text.lower()

        # Normalizar espacios
        text = re.sub(r'\s+', ' ', text)

        # Limpiar caracteres especiales manteniendo importantes
        text = re.sub(r'[^\w\s\-\."]', ' ', text)

        return text.strip()

    def _extract_year(self, text: str) -> Optional[int]:
        """Extrae año del dispositivo"""
        match = self.year_pattern.search(text)
        return int(match.group()) if match else None

    def _extract_generation(self, text: str) -> Optional[int]:
        """Extrae generación del dispositivo (recibe texto original sin limpiar)"""
        text_lower = text.lower()

        # PRIMERO: Extraer generación de formato "(3rd generation)", "(2nd generation)", etc.
        generation_parenthesis = re.search(r'\((\d+)(?:st|nd|rd|th)\s+generation\)', text_lower, re.I)
        if generation_parenthesis:
            gen = int(generation_parenthesis.group(1))
            return gen if 1 <= gen <= 20 else None

        # SEGUNDO: Generación en español "1ª generación", "2.ª generación"
        match = self.generation_pattern.search(text_lower)
        if match:
            gen = int(match.group(1))
            return gen if 1 <= gen <= 15 else None

        # TERCERO: Para iPad Air/Pro/mini, mapear procesador M-series a generación
        # iPad Air: M2 = 6ª gen (2024), M1 = 5ª gen (2022)
        # iPad Pro: M4 = 7ª gen (2024), M2 = 6ª gen (2022), M1 = 5ª/3ª gen (2021/2018)
        # iPad mini: A17 Pro = 7ª gen (2024), A15 = 6ª gen (2021)
        if 'ipad air' in text_lower:
            if re.search(r'\(m2\)|\bm2\b', text_lower):
                return 6  # iPad Air M2 es 6ª generación (2024)
            elif re.search(r'\(m1\)|\bm1\b', text_lower):
                return 5  # iPad Air M1 es 5ª generación (2022)
        elif 'ipad pro' in text_lower:
            if re.search(r'\(m4\)|\bm4\b', text_lower):
                return 7  # iPad Pro M4 es 7ª generación (2024)
            elif re.search(r'\(m2\)|\bm2\b', text_lower):
                return 6  # iPad Pro M2 es 6ª generación (2022)
        elif 'ipad mini' in text_lower:
            if re.search(r'a17\s*pro', text_lower):
                return 7  # iPad mini A17 Pro es 7ª generación (2024)
            elif re.search(r'a15', text_lower):
                return 6  # iPad mini A15 es 6ª generación (2021)

        # CUARTO: Para iPad, detectar generación después de tamaño de pantalla
        # Ej: "iPad Pro 12.9'' 6" → generación 6
        ipad_gen_after_screen = re.search(r'ipad\s+(?:pro|air|mini)?\s+\d{1,2}(?:\.\d)?(?:\'\'|"|-inch|inch)\s+(\d{1})(?:\s|$)', text_lower, re.I)
        if ipad_gen_after_screen:
            gen = int(ipad_gen_after_screen.group(1))
            return gen if 1 <= gen <= 10 else None

        # QUINTO: Número de modelo de iPhone/iPad (ej: "iPhone 16 Pro" → 16, "iPad mini 7" → 7)
        # Pero NO detectar iPhone SE donde el número es tamaño de pantalla
        if not re.search(r'\biphone\s+se\b', text_lower, re.I):
            device_model_match = re.search(r'(iphone|ipad(?:\s+(?:air|mini))?)\s+(\d{1,2})(?:\s|$)', text_lower, re.I)
            if device_model_match:
                model_num = int(device_model_match.group(2))
                return model_num if 1 <= model_num <= 20 else None

        return None

    def _extract_model_variant(self, text: str) -> Optional[str]:
        """Extrae variante de modelo (XS, SE, Plus, etc.) para iPhone/iPad"""
        # Detectar variantes especiales de iPhone
        if re.search(r'\biphone\s+xs\s+max\b', text, re.I):
            return 'XS Max'
        elif re.search(r'\biphone\s+xs\b', text, re.I):
            return 'XS'
        elif re.search(r'\biphone\s+xr\b', text, re.I):
            return 'XR'
        elif re.search(r'\biphone\s+x\b', text, re.I):
            return 'X'
        elif re.search(r'\biphone\s+se\b', text, re.I):
            return 'SE'
        # Plus NO es variante especial - se maneja con generation + has_plus

        # Detectar variantes especiales de iPad
        # Air y mini ya se detectan con has_air y has_mini, NO son variantes especiales aquí

        return None

    def _extract_screen_size(self, text: str) -> Optional[float]:
        """Extrae tamaño de pantalla (recibe texto original sin limpiar)"""
        text_lower = text.lower()
        # Buscar tamaño de pantalla con indicadores explícitos: inch, pulgadas, ", ''
        screen_match = re.search(r'(\d{1,2}(?:[.,]\d)?)\s*(?:"|\'\'|-inch|inch|pulgadas?)', text_lower, re.I)
        if screen_match:
            try:
                size = float(screen_match.group(1).replace(',', '.'))
                return size if 3.0 <= size <= 32.0 else None
            except ValueError:
                return None
        return None

    def _extract_storage_gb(self, text: str) -> Optional[int]:
        """Extrae capacidad de almacenamiento en GB"""
        match = self.storage_pattern.search(text)
        if match:
            try:
                value = float(match.group(1).replace(',', '.'))
                unit = match.group(2).upper()
                gb = int(value * 1024) if unit == 'TB' else int(value)
                return gb if gb > 0 else None
            except ValueError:
                return None
        return None

    def _extract_processor_family(self, text: str) -> Optional[str]:
        """Extrae familia de procesador"""
        match = self.processor_pattern.search(text)
        if match:
            processor = match.group(1).upper()

            # Mapear a familias conocidas
            for family, processors in self.apple_processors.items():
                for proc in processors:
                    if proc.upper() in processor:
                        return family

            return processor
        return None

    def _extract_processor_variant(self, text: str) -> Optional[str]:
        """Extrae variante específica del procesador"""
        match = self.processor_pattern.search(text)
        return match.group(1).upper() if match else None

    def _extract_a_number(self, text: str) -> Optional[str]:
        """Extrae número A de Apple (ej: A2337)"""
        match = self.a_number_pattern.search(text)
        return match.group().upper() if match else None

    def _extract_gpu_cores(self, text: str) -> Optional[int]:
        """Extrae número de núcleos GPU (ej: 10-core GPU, 19 core GPU)"""
        match = re.search(r'(\d{1,3})\s*[-\s]?core\s+gpu', text, re.I)
        if match:
            return int(match.group(1))
        return None

    def _tokenize(self, text: str) -> List[str]:
        """Tokeniza el texto eliminando stop words"""
        words = re.findall(r'\b\w+\b', text.lower())
        return [word for word in words if word not in self.stop_words and len(word) > 1]

    def _phonetic_hash(self, text: str) -> str:
        """Genera hash fonético simplificado"""
        # Simplificación de Soundex
        text = re.sub(r'[hw]', '', text.lower())
        text = re.sub(r'[bfpv]+', 'b', text)
        text = re.sub(r'[cgjkqsxz]+', 'c', text)
        text = re.sub(r'[dt]+', 'd', text)
        text = re.sub(r'[l]+', 'l', text)
        text = re.sub(r'[mn]+', 'm', text)
        text = re.sub(r'[r]+', 'r', text)
        text = re.sub(r'[aeiou]+', '', text)

        return hashlib.md5(text.encode()).hexdigest()[:8]

    def _ngram_hash(self, text: str, n: int = 3) -> str:
        """Genera hash de n-gramas"""
        tokens = self._tokenize(text)
        ngrams = []

        for i in range(len(tokens) - n + 1):
            ngram = ''.join(tokens[i:i+n])
            ngrams.append(ngram)

        ngram_str = ''.join(sorted(ngrams))
        return hashlib.md5(ngram_str.encode()).hexdigest()[:8]

    def _infer_device_type(self, text: str) -> Optional[str]:
        """Infiere tipo de dispositivo"""
        if re.search(r'\biphone\b', text):
            return 'iPhone'
        # Detectar iPad con variantes: iPad Pro, iPad Air, iPad mini (ANTES del genérico)
        elif re.search(r'(ipad\s*pro|ipadpro)', text, re.I):
            return 'iPad Pro'
        elif re.search(r'(ipad\s*air|ipadair)', text, re.I):
            return 'iPad Air'
        elif re.search(r'(ipad\s*mini|ipadmini)', text, re.I):
            return 'iPad mini'
        elif re.search(r'\bipad\b', text):
            return 'iPad'
        # Detectar Mac con variantes: MacBook, MacBookPro, MacBookAir, iMac, Macmini, Mac Pro, Mac Studio
        elif re.search(r'(macbook\s*pro|macbookpro)', text, re.I):
            return 'MacBook Pro'
        elif re.search(r'(macbook\s*air|macbookair)', text, re.I):
            return 'MacBook Air'
        elif re.search(r'\bmacbook\b', text, re.I):
            return 'MacBook'
        elif re.search(r'\bimac\b', text, re.I):
            return 'iMac'
        elif re.search(r'(mac\s*mini|macmini)', text, re.I):
            return 'Mac mini'
        elif re.search(r'(mac\s*pro|macpro)', text, re.I):
            return 'Mac Pro'
        elif re.search(r'(mac\s*studio|macstudio)', text, re.I):
            return 'Mac Studio'
        elif re.search(r'\bmac\b', text, re.I):
            return 'Mac'
        elif re.search(r'\bwatch\b', text):
            return 'Watch'
        elif re.search(r'\bairpods\b', text):
            return 'AirPods'
        return None

    def _has_color_mention(self, text: str) -> bool:
        """Detecta si se menciona color"""
        colors = [
            'black', 'white', 'silver', 'gold', 'rose', 'space', 'gray', 'grey',
            'blue', 'red', 'green', 'purple', 'pink', 'yellow', 'orange'
        ]
        return any(color in text for color in colors)

    def _has_capacity_in_name(self, text: str) -> bool:
        """Detecta si la capacidad está en el nombre"""
        return bool(self.storage_pattern.search(text))

    def _calculate_complexity(self, text: str) -> float:
        """Calcula complejidad del texto"""
        words = text.split()
        if not words:
            return 0.0

        avg_word_length = sum(len(word) for word in words) / len(words)
        unique_words = len(set(words))
        complexity = (avg_word_length * unique_words) / len(words)

        return round(complexity, 2)

    def _extract_derived_features(self, features: Dict, text: str) -> Dict:
        """Extrae características derivadas"""
        derived = {}

        # Características combinadas
        derived['is_pro_device'] = features['has_pro'] or features['has_max']
        derived['is_compact_device'] = features['has_mini'] or (
            features['screen_size'] and features['screen_size'] < 6.0
        )
        derived['is_premium_device'] = features['has_pro'] or features['has_ultra']

        # Características de capacidad
        storage = features['storage_gb']
        if storage:
            derived['storage_tier'] = self._categorize_storage(storage)
            derived['is_high_capacity'] = storage >= 512

        # Características de procesador
        proc_family = features['processor_family']
        if proc_family:
            derived['processor_generation'] = self._get_processor_generation(proc_family)
            derived['is_apple_silicon'] = proc_family.startswith('M')

        # Características de año
        year = features['year']
        if year:
            current_year = 2024  # Actualizar según necesidad
            derived['device_age'] = current_year - year
            derived['is_recent_device'] = year >= current_year - 2

        return derived

    def _categorize_storage(self, storage_gb: int) -> str:
        """Categoriza capacidad de almacenamiento"""
        if storage_gb <= 64:
            return 'low'
        elif storage_gb <= 256:
            return 'medium'
        elif storage_gb <= 512:
            return 'high'
        else:
            return 'premium'

    def _get_processor_generation(self, processor_family: str) -> Optional[int]:
        """Extrae generación del procesador"""
        if processor_family.startswith('M'):
            try:
                return int(processor_family[1])
            except (IndexError, ValueError):
                return None
        elif processor_family.startswith('A'):
            try:
                return int(processor_family[1:])
            except ValueError:
                return None
        return None

    def calculate_similarity(self, features1: Dict, features2: Dict) -> float:
        """
        Calcula similitud entre dos conjuntos de características
        """
        if not features1 or not features2:
            return 0.0

        weights = {
            # Características críticas
            'device_type': 0.3,
            'storage_gb': 0.2,
            'processor_family': 0.15,
            'year': 0.1,

            # Características importantes
            'has_pro': 0.05,
            'has_max': 0.05,
            'has_air': 0.03,
            'has_mini': 0.03,
            'generation': 0.04,
            'screen_size': 0.05
        }

        total_score = 0.0
        total_weight = 0.0

        for feature, weight in weights.items():
            if feature in features1 and feature in features2:
                val1 = features1[feature]
                val2 = features2[feature]

                if val1 is None or val2 is None:
                    continue

                if isinstance(val1, bool) and isinstance(val2, bool):
                    score = 1.0 if val1 == val2 else 0.0
                elif isinstance(val1, (int, float)) and isinstance(val2, (int, float)):
                    # Similitud numérica normalizada
                    max_diff = max(abs(val1), abs(val2), 1)
                    diff = abs(val1 - val2)
                    score = max(0.0, 1.0 - (diff / max_diff))
                elif isinstance(val1, str) and isinstance(val2, str):
                    score = 1.0 if val1.lower() == val2.lower() else 0.0
                else:
                    continue

                total_score += score * weight
                total_weight += weight

        # Similitud de tokens (Jaccard)
        if 'tokens' in features1 and 'tokens' in features2:
            tokens1 = set(features1['tokens']) if features1['tokens'] else set()
            tokens2 = set(features2['tokens']) if features2['tokens'] else set()

            if tokens1 or tokens2:
                jaccard = len(tokens1 & tokens2) / len(tokens1 | tokens2) if (tokens1 | tokens2) else 0.0
                total_score += jaccard * 0.1
                total_weight += 0.1

        return total_score / total_weight if total_weight > 0 else 0.0