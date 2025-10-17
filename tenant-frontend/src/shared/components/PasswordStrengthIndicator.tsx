/**
 * SECURITY FIX (MED-02): Password Strength Indicator con zxcvbn
 *
 * Componente que evalúa la fortaleza de una contraseña en tiempo real usando
 * zxcvbn (algoritmo de Dropbox) y proporciona feedback visual al usuario.
 *
 * Features:
 * - Cálculo de score 0-4 (muy débil a muy fuerte)
 * - Estimación de tiempo de crackeo
 * - Sugerencias específicas para mejorar la contraseña
 * - Feedback visual con colores y barra de progreso
 * - Warnings sobre patrones comunes
 *
 * Referencias:
 * - OWASP ASVS 4.0: 2.1.7 - Password strength meter
 * - CWE-521: Weak Password Requirements
 * - NIST SP 800-63B: Password strength feedback
 */

import { useEffect, useState, useMemo } from 'react';
import { Box, Typography, LinearProgress, Chip } from '@mui/material';
import zxcvbn from 'zxcvbn';

interface PasswordStrengthIndicatorProps {
  password: string;
  /** Información adicional del usuario para detectar contraseñas débiles (email, nombre, etc.) */
  userInputs?: string[];
  /** Mostrar sugerencias de mejora */
  showSuggestions?: boolean;
  /** Mostrar tiempo estimado de crackeo */
  showCrackTime?: boolean;
}

type StrengthLevel = {
  label: string;
  color: 'error' | 'warning' | 'info' | 'success';
  bgColor: string;
  value: number; // 0-100 para LinearProgress
};

const STRENGTH_LEVELS: StrengthLevel[] = [
  { label: 'Muy débil', color: 'error', bgColor: '#f44336', value: 20 },
  { label: 'Débil', color: 'warning', bgColor: '#ff9800', value: 40 },
  { label: 'Aceptable', color: 'info', bgColor: '#2196f3', value: 60 },
  { label: 'Fuerte', color: 'success', bgColor: '#4caf50', value: 80 },
  { label: 'Muy fuerte', color: 'success', bgColor: '#2e7d32', value: 100 },
];

const CRACK_TIME_LABELS: Record<string, string> = {
  'less than a second': 'menos de 1 segundo',
  'second': 'segundo',
  'seconds': 'segundos',
  'minute': 'minuto',
  'minutes': 'minutos',
  'hour': 'hora',
  'hours': 'horas',
  'day': 'día',
  'days': 'días',
  'month': 'mes',
  'months': 'meses',
  'year': 'año',
  'years': 'años',
  'century': 'siglo',
  'centuries': 'siglos',
};

// Traducciones de warnings y sugerencias de zxcvbn
const TRANSLATIONS: Record<string, string> = {
  // Warnings
  'Straight rows of keys are easy to guess': 'Las filas rectas de teclas son fáciles de adivinar',
  'Short keyboard patterns are easy to guess': 'Los patrones de teclado cortos son fáciles de adivinar',
  'Repeats like "aaa" are easy to guess': 'Las repeticiones como "aaa" son fáciles de adivinar',
  'Repeats like "abcabcabc" are only slightly harder to guess than "abc"': 'Las repeticiones como "abcabcabc" son solo un poco más difíciles de adivinar que "abc"',
  'Avoid repeated words and characters': 'Evita palabras y caracteres repetidos',
  'Sequences like abc or 6543 are easy to guess': 'Las secuencias como abc o 6543 son fáciles de adivinar',
  'Avoid sequences': 'Evita secuencias',
  'Recent years are easy to guess': 'Los años recientes son fáciles de adivinar',
  'Avoid recent years': 'Evita años recientes',
  'Avoid years that are associated with you': 'Evita años asociados contigo',
  'Dates are often easy to guess': 'Las fechas suelen ser fáciles de adivinar',
  'Avoid dates and years that are associated with you': 'Evita fechas y años asociados contigo',
  'This is a top-10 common password': 'Esta es una de las 10 contraseñas más comunes',
  'This is a top-100 common password': 'Esta es una de las 100 contraseñas más comunes',
  'This is a very common password': 'Esta es una contraseña muy común',
  'This is similar to a commonly used password': 'Es similar a una contraseña comúnmente usada',
  'A word by itself is easy to guess': 'Una palabra por sí sola es fácil de adivinar',
  'Names and surnames by themselves are easy to guess': 'Los nombres y apellidos por sí solos son fáciles de adivinar',
  'Common names and surnames are easy to guess': 'Los nombres y apellidos comunes son fáciles de adivinar',

  // Suggestions
  'Use a few words, avoid common phrases': 'Usa varias palabras, evita frases comunes',
  'No need for symbols, digits, or uppercase letters': 'No necesitas símbolos, dígitos o mayúsculas',
  'Add another word or two. Uncommon words are better.': 'Agrega una o dos palabras más. Palabras poco comunes son mejores.',
  'Capitalization doesn\'t help very much': 'Las mayúsculas no ayudan mucho',
  'All-uppercase is almost as easy to guess as all-lowercase': 'Todo en mayúsculas es casi tan fácil de adivinar como todo en minúsculas',
  'Reversed words aren\'t much harder to guess': 'Las palabras invertidas no son mucho más difíciles de adivinar',
  'Predictable substitutions like \'@\' instead of \'a\' don\'t help very much': 'Las sustituciones predecibles como \'@\' en lugar de \'a\' no ayudan mucho',
};

export default function PasswordStrengthIndicator({
  password,
  userInputs = [],
  showSuggestions = true,
  showCrackTime = true,
}: PasswordStrengthIndicatorProps) {
  const [result, setResult] = useState<ReturnType<typeof zxcvbn> | null>(null);

  useEffect(() => {
    if (!password || password.length === 0) {
      setResult(null);
      return;
    }

    // Debounce para evitar cálculos excesivos
    const timer = setTimeout(() => {
      const analysis = zxcvbn(password, userInputs);
      setResult(analysis);
    }, 100);

    return () => clearTimeout(timer);
  }, [password, userInputs]);

  const strength = useMemo(() => {
    if (!result) return null;
    return STRENGTH_LEVELS[result.score];
  }, [result]);

  const crackTime = useMemo(() => {
    if (!result) return null;

    const display = result.crack_times_display.offline_slow_hashing_1e4_per_second;

    // Traducir al español
    let translated = String(display);
    Object.entries(CRACK_TIME_LABELS).forEach(([en, es]) => {
      translated = translated.replace(new RegExp(en, 'gi'), es);
    });

    return translated;
  }, [result]);

  // Función para traducir texto de zxcvbn
  const translate = (text: string): string => {
    return TRANSLATIONS[text] || text;
  };

  // No mostrar nada si no hay contraseña
  if (!password || password.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 1 }}>
      {/* Barra de progreso con color dinámico */}
      {strength && (
        <LinearProgress
          variant="determinate"
          value={strength.value}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(0,0,0,0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: strength.bgColor,
              transition: 'all 0.3s ease',
            },
          }}
        />
      )}

      {/* Label de fortaleza */}
      {strength && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Fortaleza:
          </Typography>
          <Chip
            label={strength.label}
            color={strength.color}
            size="small"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        </Box>
      )}

      {/* Tiempo estimado de crackeo */}
      {showCrackTime && crackTime && result && result.score < 4 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          💻 Tiempo de crackeo estimado: <strong>{crackTime}</strong>
        </Typography>
      )}

      {/* Warnings (patrones comunes) */}
      {result?.feedback.warning && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
          ⚠️ {translate(result.feedback.warning)}
        </Typography>
      )}

      {/* Sugerencias de mejora */}
      {showSuggestions && result?.feedback.suggestions && result.feedback.suggestions.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          {result.feedback.suggestions.map((suggestion: string, idx: number) => (
            <Typography
              key={idx}
              variant="caption"
              color="info.main"
              sx={{ display: 'block', mt: 0.25 }}
            >
              💡 {translate(suggestion)}
            </Typography>
          ))}
        </Box>
      )}

      {/* Indicador de longitud mínima (complementa validación CRIT-01) */}
      {password.length < 8 && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
          ❌ Mínimo 8 caracteres requeridos (actual: {password.length})
        </Typography>
      )}
    </Box>
  );
}
