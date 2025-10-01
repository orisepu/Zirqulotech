/**
 * Sistema de responsive utilities para tablas
 *
 * @description Maneja escalado con DPI, conversión de px a rem,
 * y aplicación de valores responsive según breakpoints.
 *
 * @version 2.0
 * @date 2025-10-01
 */

import { useMemo } from 'react'
import { useDpiDetection } from '@/hooks/useDpiDetection'
import type { ResponsiveSize, ResponsiveColumnMeta, TableDensity, DENSITY_PADDING_MAP } from '@/shared/types/table.types'

/**
 * Mapeo de niveles de DPI a factor de escala
 */
export const DPI_SCALE_MAP = {
  normal: 1.0,        // 100% - Sin ajuste
  medium: 0.95,       // 95% - 125% DPI
  high: 0.85,         // 85% - 150% DPI
  'very-high': 0.75,  // 75% - 200%+ Retina
} as const

/**
 * Convierte píxeles a rem con breakpoints responsivos
 *
 * @param px - Valor en píxeles
 * @returns Objeto ResponsiveSize con valores en rem para cada breakpoint
 *
 * @example
 * ```typescript
 * pxToResponsiveRem(140)
 * // {
 * //   xs: '7.70rem',  // 88% del valor base
 * //   sm: '8.23rem',  // 94% del valor base
 * //   md: '8.75rem'   // 100% del valor base
 * // }
 * ```
 */
export function pxToResponsiveRem(px: number): ResponsiveSize {
  const baseRem = px / 16 // 16px = 1rem

  // Progresión responsive: xs (más pequeño) → sm → md (valor objetivo)
  if (px >= 180) {
    // Valores grandes: progresión más amplia (85% → 92% → 100%)
    return {
      xs: `${(baseRem * 0.85).toFixed(2)}rem`,
      sm: `${(baseRem * 0.92).toFixed(2)}rem`,
      md: `${baseRem.toFixed(2)}rem`,
    }
  } else if (px >= 120) {
    // Valores medios: progresión moderada (88% → 94% → 100%)
    return {
      xs: `${(baseRem * 0.88).toFixed(2)}rem`,
      sm: `${(baseRem * 0.94).toFixed(2)}rem`,
      md: `${baseRem.toFixed(2)}rem`,
    }
  } else {
    // Valores pequeños: progresión sutil (90% → 100%)
    return {
      xs: `${(baseRem * 0.9).toFixed(2)}rem`,
      sm: `${baseRem.toFixed(2)}rem`,
    }
  }
}

/**
 * Escala un valor rem por un factor
 *
 * @param remValue - Valor en formato "XXrem"
 * @param scale - Factor de escala (ej: 0.85 para 85%)
 * @returns Valor escalado en formato "XXrem"
 *
 * @example
 * ```typescript
 * scaleRemString('10rem', 0.85) // '8.50rem'
 * ```
 */
function scaleRemString(remValue: string, scale: number): string {
  const match = remValue.match(/^([\d.]+)rem$/)
  if (!match) return remValue

  const value = parseFloat(match[1])
  return `${(value * scale).toFixed(2)}rem`
}

/**
 * Escala un ResponsiveSize según el nivel de DPI
 *
 * @param value - ResponsiveSize, string, o undefined
 * @param dpiScale - Factor de escala según DPI
 * @returns Valor escalado manteniendo la estructura
 *
 * @example
 * ```typescript
 * const size = { xs: '10rem', sm: '12rem', md: '14rem' }
 * scaleResponsiveValue(size, 0.85)
 * // { xs: '8.50rem', sm: '10.20rem', md: '11.90rem' }
 * ```
 */
export function scaleResponsiveValue(
  value: ResponsiveSize | string | undefined,
  dpiScale: number
): ResponsiveSize | string | undefined {
  if (!value) return undefined

  if (typeof value === 'string') {
    return scaleRemString(value, dpiScale)
  }

  return {
    xs: value.xs ? scaleRemString(value.xs, dpiScale) : undefined,
    sm: value.sm ? scaleRemString(value.sm, dpiScale) : undefined,
    md: value.md ? scaleRemString(value.md, dpiScale) : undefined,
    lg: value.lg ? scaleRemString(value.lg, dpiScale) : undefined,
    xl: value.xl ? scaleRemString(value.xl, dpiScale) : undefined,
  }
}

/**
 * Hook para obtener estilos responsive con escalado por DPI
 *
 * @param meta - Metadata de la columna
 * @returns Objeto con estilos calculados según DPI actual
 *
 * @example
 * ```typescript
 * function MyCell({ meta }) {
 *   const styles = useResponsiveTableStyles(meta)
 *   return <TableCell sx={styles}>...</TableCell>
 * }
 * ```
 */
export function useResponsiveTableStyles(meta: ResponsiveColumnMeta = {}) {
  const { dpiLevel } = useDpiDetection({ enableWarnings: false })
  const scale = DPI_SCALE_MAP[dpiLevel]

  return useMemo(() => {
    // Si dpiScale es 'fixed', no escalar
    const shouldScale = meta.dpiScale !== 'fixed'

    return {
      minWidth: shouldScale
        ? scaleResponsiveValue(meta.minWidth, scale)
        : meta.minWidth,
      maxWidth: shouldScale
        ? scaleResponsiveValue(meta.maxWidth, scale)
        : meta.maxWidth,
      width: shouldScale
        ? scaleResponsiveValue(meta.width, scale)
        : meta.width,
      textAlign: meta.align || 'left',
      verticalAlign: meta.verticalAlign || 'middle',
      whiteSpace: meta.wrap ? 'normal' : 'nowrap',
    }
  }, [meta, scale])
}

/**
 * Calcula el padding según la densidad de la tabla
 *
 * @param density - Densidad de la tabla
 * @returns String con padding CSS
 *
 * @example
 * ```typescript
 * getDensityPadding('compact')  // '0.25rem 0.5rem'
 * getDensityPadding('normal')   // '0.5rem 1rem'
 * ```
 */
export function getDensityPadding(density: TableDensity = 'normal'): string {
  const paddingMap: Record<TableDensity, { x: string; y: string }> = {
    compact: { x: '0.5rem', y: '0.25rem' },
    normal: { x: '1rem', y: '0.5rem' },
    comfortable: { x: '1.5rem', y: '0.75rem' },
  }

  const padding = paddingMap[density]
  return `${padding.y} ${padding.x}`
}

/**
 * Genera estilos para un TableCell con todas las configuraciones aplicadas
 *
 * @param meta - Metadata de la columna
 * @param density - Densidad de la tabla
 * @param dpiLevel - Nivel de DPI actual
 * @returns Objeto con estilos completos para TableCell
 *
 * @example
 * ```typescript
 * const cellStyles = getCellStyles(columnMeta, 'normal', 'very-high')
 * <TableCell sx={cellStyles}>...</TableCell>
 * ```
 */
export function getCellStyles(
  meta: ResponsiveColumnMeta = {},
  density: TableDensity = 'normal',
  dpiLevel: 'normal' | 'medium' | 'high' | 'very-high' = 'normal'
) {
  const scale = DPI_SCALE_MAP[dpiLevel]
  const shouldScale = meta.dpiScale !== 'fixed'

  return {
    minWidth: shouldScale ? scaleResponsiveValue(meta.minWidth, scale) : meta.minWidth,
    maxWidth: shouldScale ? scaleResponsiveValue(meta.maxWidth, scale) : meta.maxWidth,
    width: shouldScale ? scaleResponsiveValue(meta.width, scale) : meta.width,
    textAlign: meta.align || 'left',
    verticalAlign: meta.verticalAlign || 'middle',
    whiteSpace: meta.wrap ? 'normal' : 'nowrap',
    padding: getDensityPadding(density),
    overflow: meta.ellipsis ? 'hidden' : 'visible',
    textOverflow: meta.ellipsis ? 'ellipsis' : 'clip',
  }
}

/**
 * Genera estilos para un TableHeaderCell
 *
 * @param meta - Metadata de la columna
 * @param density - Densidad de la tabla
 * @param dpiLevel - Nivel de DPI actual
 * @returns Objeto con estilos completos para TableHeaderCell
 */
export function getHeaderStyles(
  meta: ResponsiveColumnMeta = {},
  density: TableDensity = 'normal',
  dpiLevel: 'normal' | 'medium' | 'high' | 'very-high' = 'normal'
) {
  const scale = DPI_SCALE_MAP[dpiLevel]
  const shouldScale = meta.dpiScale !== 'fixed'

  const headerAlign = meta.alignHeader || meta.align || 'center'

  return {
    minWidth: shouldScale ? scaleResponsiveValue(meta.minWidth, scale) : meta.minWidth,
    maxWidth: shouldScale
      ? scaleResponsiveValue(meta.headerMaxWidth || meta.maxWidth, scale)
      : meta.headerMaxWidth || meta.maxWidth,
    textAlign: headerAlign,
    verticalAlign: 'middle',
    whiteSpace: meta.nowrapHeader ? 'nowrap' : 'normal',
    padding: getDensityPadding(density),
    fontWeight: 600,
  }
}

/**
 * Genera estilos para el contenedor de la tabla
 *
 * @param maxHeight - Altura máxima (para scroll)
 * @param stickyHeader - Si el header debe ser sticky
 * @returns Objeto con estilos para TableContainer
 *
 * @example
 * ```typescript
 * const containerStyles = getTableContainerStyles('500px', true)
 * <TableContainer sx={containerStyles}>...</TableContainer>
 * ```
 */
export function getTableContainerStyles(
  maxHeight?: string | number,
  stickyHeader?: boolean
) {
  const baseStyles: any = {
    overflowX: 'auto',
    overflowY: maxHeight ? 'auto' : 'visible',
    position: 'relative' as const,
    '& thead': stickyHeader
      ? {
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'background.paper',
        }
      : {},
  }

  if (maxHeight !== undefined) {
    baseStyles.maxHeight = maxHeight
  }

  return baseStyles
}

/**
 * Convierte un número a formato rem
 *
 * @param px - Valor en píxeles
 * @returns String en formato rem
 *
 * @example
 * ```typescript
 * toRem(16)  // '1rem'
 * toRem(24)  // '1.5rem'
 * ```
 */
export function toRem(px: number): string {
  return `${(px / 16).toFixed(2)}rem`
}

/**
 * Convierte un ResponsiveSize a objeto de MUI breakpoints
 *
 * @param responsive - ResponsiveSize
 * @returns Objeto compatible con MUI sx prop
 *
 * @example
 * ```typescript
 * const size = { xs: '10rem', sm: '12rem', md: '14rem' }
 * toMuiBreakpoints(size)
 * // { xs: '10rem', sm: '12rem', md: '14rem' }
 * ```
 */
export function toMuiBreakpoints(responsive: ResponsiveSize | string | undefined) {
  if (!responsive) return undefined
  if (typeof responsive === 'string') return responsive
  return responsive
}

/**
 * Calcula el ancho máximo para ellipsis, restando automáticamente ~20px (1.25rem)
 * para dar espacio visual a los "..." si no hay ellipsisMaxWidth definido
 *
 * @param ellipsisMaxWidth - Ancho máximo específico para ellipsis (opcional)
 * @param maxWidth - Ancho máximo de la columna
 * @returns Ancho calculado para ellipsis con margen
 *
 * @example
 * ```typescript
 * // Sin ellipsisMaxWidth: resta automáticamente 1.25rem
 * calculateEllipsisMaxWidth(undefined, '10rem')  // '8.75rem'
 *
 * // Con ellipsisMaxWidth: usa el valor tal cual
 * calculateEllipsisMaxWidth('8rem', '10rem')  // '8rem'
 * ```
 */
export function calculateEllipsisMaxWidth(
  ellipsisMaxWidth: ResponsiveSize | string | undefined,
  maxWidth: ResponsiveSize | string | undefined
): ResponsiveSize | string | undefined {
  // Si ellipsisMaxWidth está definido, usarlo tal cual
  if (ellipsisMaxWidth) return ellipsisMaxWidth

  // Si no hay maxWidth, retornar undefined
  if (!maxWidth) return undefined

  // Si es string (formato rem)
  if (typeof maxWidth === 'string') {
    const remMatch = maxWidth.match(/^([\d.]+)rem$/)
    if (remMatch) {
      const value = parseFloat(remMatch[1])
      return `${Math.max(0, value - 1.25).toFixed(2)}rem`
    }
    return maxWidth // Si no es rem, devolver tal cual
  }

  // Si es ResponsiveSize: restar 1.25rem de cada breakpoint
  return {
    xs: maxWidth.xs ? `${Math.max(0, parseFloat(maxWidth.xs) - 1.25).toFixed(2)}rem` : undefined,
    sm: maxWidth.sm ? `${Math.max(0, parseFloat(maxWidth.sm) - 1.25).toFixed(2)}rem` : undefined,
    md: maxWidth.md ? `${Math.max(0, parseFloat(maxWidth.md) - 1.25).toFixed(2)}rem` : undefined,
    lg: maxWidth.lg ? `${Math.max(0, parseFloat(maxWidth.lg) - 1.25).toFixed(2)}rem` : undefined,
    xl: maxWidth.xl ? `${Math.max(0, parseFloat(maxWidth.xl) - 1.25).toFixed(2)}rem` : undefined,
  }
}
