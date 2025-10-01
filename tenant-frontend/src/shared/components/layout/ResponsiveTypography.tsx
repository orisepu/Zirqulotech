'use client';

import { useEffect } from 'react';
import { useDpiDetection } from '@/hooks/useDpiDetection';

/**
 * Mapeo de niveles de DPI a escalas de fuente
 *
 * Basado en experiencia real con pantallas Retina + escalado 200%
 * donde se requiere zoom 70-80% del navegador para legibilidad óptima
 */
const DPI_FONT_SCALE_MAP = {
  normal: 1.0,    // 100% - Sin ajuste en DPI normal
  medium: 0.95,   // 95% - 125% reduce ligeramente
  high: 0.85,     // 85% - 150% DPI reduce más
  'very-high': 0.75, // 75% - 200%+ Retina (equivalente a zoom navegador 70-80%)
} as const;

/**
 * Componente que aplica ajustes de tipografía dinámicos según el DPI
 * usando CSS custom properties.
 *
 * Debe montarse una sola vez en el layout principal.
 *
 * @example
 * ```tsx
 * // En layout.tsx
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <ThemeProvider>
 *           <ResponsiveTypography />
 *           {children}
 *         </ThemeProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function ResponsiveTypography() {
  const { dpiLevel } = useDpiDetection({ enableWarnings: false });

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const scale = DPI_FONT_SCALE_MAP[dpiLevel];
    const root = document.documentElement;

    // Aplicar escala como CSS custom property
    root.style.setProperty('--font-scale', scale.toString());

    // Opcional: también ajustar el font-size base del html
    // Esto afectará a todos los valores rem
    const baseFontSize = 16; // px
    const scaledFontSize = baseFontSize * scale;
    root.style.fontSize = `${scaledFontSize}px`;

    // Log para debugging en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `📝 Tipografía ajustada para DPI ${dpiLevel}: escala ${scale}x (${scaledFontSize}px base)`
      );
    }

    // Cleanup
    return () => {
      root.style.removeProperty('--font-scale');
      root.style.fontSize = ''; // Restaurar default
    };
  }, [dpiLevel]);

  // Este componente no renderiza nada visible
  return null;
}

/**
 * Hook para obtener la escala de fuente actual
 *
 * @returns Escala de fuente actual (0.95 - 1.0)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const fontScale = useFontScale();
 *
 *   return (
 *     <Typography sx={{ fontSize: `${1.5 * fontScale}rem` }}>
 *       Texto ajustado
 *     </Typography>
 *   );
 * }
 * ```
 */
export function useFontScale(): number {
  const { dpiLevel } = useDpiDetection({ enableWarnings: false });
  return DPI_FONT_SCALE_MAP[dpiLevel];
}
