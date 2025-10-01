import { useMemo } from 'react';
import { useDpiDetection } from './useDpiDetection';

/**
 * Configuración de escala de fuente según nivel de DPI
 */
interface FontScaleConfig {
  /** Escala para DPI normal (1x) */
  normal: number;
  /** Escala para DPI medium (>1x - 1.5x) */
  medium: number;
  /** Escala para DPI high (1.5x - 2x) */
  high: number;
  /** Escala para DPI very-high (>2x) */
  veryHigh: number;
}

/**
 * Configuración por defecto para escalas de fuente
 *
 * Basado en experiencia real: pantallas Retina con escalado 200%
 * requieren zoom navegador 70-80% sin estos ajustes
 */
const DEFAULT_FONT_SCALE: FontScaleConfig = {
  normal: 1.0,    // 100% - Sin ajuste
  medium: 0.95,   // 95% - 125% DPI reduce ligeramente
  high: 0.85,     // 85% - 150% DPI reduce notablemente
  veryHigh: 0.75, // 75% - 200%+ Retina (equivale a zoom navegador 70-80%)
};

/**
 * Tamaños de fuente base en rem
 */
export const BASE_FONT_SIZES = {
  h1: 2.5,    // 40px
  h2: 2,      // 32px
  h3: 1.75,   // 28px
  h4: 1.5,    // 24px
  h5: 1.25,   // 20px
  h6: 1.125,  // 18px
  body1: 1,   // 16px (base)
  body2: 0.875, // 14px
  caption: 0.75, // 12px
  button: 0.875, // 14px
} as const;

/**
 * Hook para obtener tamaños de fuente ajustados según el DPI
 *
 * @param customScale - Configuración personalizada de escalas (opcional)
 * @returns Objeto con tamaños de fuente ajustados
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const fontSize = useResponsiveFontSize();
 *
 *   return (
 *     <Typography sx={{ fontSize: fontSize.h1 }}>
 *       Título responsive
 *     </Typography>
 *   );
 * }
 * ```
 */
export function useResponsiveFontSize(customScale?: Partial<FontScaleConfig>) {
  const { dpiLevel } = useDpiDetection({ enableWarnings: false });

  const scale = useMemo(() => {
    const config = { ...DEFAULT_FONT_SCALE, ...customScale };

    switch (dpiLevel) {
      case 'very-high':
        return config.veryHigh;
      case 'high':
        return config.high;
      case 'medium':
        return config.medium;
      case 'normal':
      default:
        return config.normal;
    }
  }, [dpiLevel, customScale]);

  const fontSizes = useMemo(() => {
    return Object.entries(BASE_FONT_SIZES).reduce((acc, [key, size]) => {
      acc[key as keyof typeof BASE_FONT_SIZES] = `${size * scale}rem`;
      return acc;
    }, {} as Record<keyof typeof BASE_FONT_SIZES, string>);
  }, [scale]);

  return {
    ...fontSizes,
    scale,
    dpiLevel,
  };
}

/**
 * Utilidad para calcular tamaño de fuente custom ajustado por DPI
 *
 * @param baseSize - Tamaño base en rem
 * @param dpiLevel - Nivel de DPI actual
 * @param customScale - Escalas personalizadas (opcional)
 * @returns Tamaño ajustado en rem como string
 *
 * @example
 * ```tsx
 * const { dpiLevel } = useDpiDetection();
 * const customSize = getAdjustedFontSize(1.5, dpiLevel);
 * // En DPI normal: "1.5rem"
 * // En DPI very-high: "1.425rem"
 * ```
 */
export function getAdjustedFontSize(
  baseSize: number,
  dpiLevel: 'normal' | 'medium' | 'high' | 'very-high',
  customScale?: Partial<FontScaleConfig>
): string {
  const config = { ...DEFAULT_FONT_SCALE, ...customScale };

  let scale: number;
  switch (dpiLevel) {
    case 'very-high':
      scale = config.veryHigh;
      break;
    case 'high':
      scale = config.high;
      break;
    case 'medium':
      scale = config.medium;
      break;
    case 'normal':
    default:
      scale = config.normal;
  }

  return `${baseSize * scale}rem`;
}

/**
 * Hook simplificado que retorna solo la escala actual
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const fontScale = useFontScale();
 *
 *   return (
 *     <Box sx={{ fontSize: `${1.5 * fontScale}rem` }}>
 *       Texto escalado
 *     </Box>
 *   );
 * }
 * ```
 */
export function useFontScale(customScale?: Partial<FontScaleConfig>): number {
  const { scale } = useResponsiveFontSize(customScale);
  return scale;
}

/**
 * Genera configuración de tipografía para MUI Theme basada en DPI
 *
 * @param dpiLevel - Nivel de DPI
 * @param customScale - Escalas personalizadas (opcional)
 * @returns Objeto de configuración de tipografía para MUI
 *
 * @example
 * ```tsx
 * const theme = createTheme({
 *   typography: getMuiTypographyConfig(dpiLevel)
 * });
 * ```
 */
export function getMuiTypographyConfig(
  dpiLevel: 'normal' | 'medium' | 'high' | 'very-high',
  customScale?: Partial<FontScaleConfig>
) {
  const config = { ...DEFAULT_FONT_SCALE, ...customScale };

  let scale: number;
  switch (dpiLevel) {
    case 'very-high':
      scale = config.veryHigh;
      break;
    case 'high':
      scale = config.high;
      break;
    case 'medium':
      scale = config.medium;
      break;
    case 'normal':
    default:
      scale = config.normal;
  }

  return {
    h1: { fontSize: `${BASE_FONT_SIZES.h1 * scale}rem` },
    h2: { fontSize: `${BASE_FONT_SIZES.h2 * scale}rem` },
    h3: { fontSize: `${BASE_FONT_SIZES.h3 * scale}rem` },
    h4: { fontSize: `${BASE_FONT_SIZES.h4 * scale}rem` },
    h5: { fontSize: `${BASE_FONT_SIZES.h5 * scale}rem` },
    h6: { fontSize: `${BASE_FONT_SIZES.h6 * scale}rem` },
    body1: { fontSize: `${BASE_FONT_SIZES.body1 * scale}rem` },
    body2: { fontSize: `${BASE_FONT_SIZES.body2 * scale}rem` },
    caption: { fontSize: `${BASE_FONT_SIZES.caption * scale}rem` },
    button: { fontSize: `${BASE_FONT_SIZES.button * scale}rem` },
  };
}
