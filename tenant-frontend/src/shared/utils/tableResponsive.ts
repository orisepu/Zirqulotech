import type { SxProps, Theme } from '@mui/material/styles'

/** Type helper for responsive values (shared with TanStack Table types) */
export type ResponsiveValue = number | string | {
  xs?: number | string
  sm?: number | string
  md?: number | string
  lg?: number | string
  xl?: number | string
  xxl?: number | string
  xxxl?: number | string
}

/**
 * Configuración para definir el comportamiento de una columna
 */
export interface ColumnConfig {
  /** Ancho mínimo de la columna */
  minWidth: number
  /** Tipo de dato que determina el comportamiento por defecto */
  type?: 'id' | 'text' | 'date' | 'currency' | 'status' | 'custom'
  /** Si debe aplicarse ellipsis con tooltip */
  ellipsis?: boolean
  /** Alineación personalizada (si no se especifica, usa la del tipo) */
  align?: 'left' | 'center' | 'right'
  /** maxWidth personalizado (sobrescribe el calculado) */
  maxWidth?: ResponsiveValue
}

/**
 * Metadata calculada para una columna de tabla
 */
export interface ColumnMeta {
  minWidth: ResponsiveValue
  maxWidth?: ResponsiveValue
  ellipsisMaxWidth?: ResponsiveValue
  headerMaxWidth?: ResponsiveValue
  align: 'left' | 'center' | 'right'
  alignHeader: 'left' | 'center' | 'right'
  ellipsis?: boolean
}

/**
 * Calcula el zoom adaptativo según el ancho del viewport
 *
 * @param viewportWidth - Ancho del viewport en píxeles
 * @returns Factor de zoom (siempre 1.0 - sin zoom)
 *
 * @example
 * getResponsiveTableZoom(1920) // 1.0
 * getResponsiveTableZoom(2880) // 1.0
 * getResponsiveTableZoom(3840) // 1.0
 *
 * @remarks
 * Esta función ahora retorna siempre 1.0 (sin zoom).
 * El aprovechamiento del espacio en pantallas ultra-anchas
 * se maneja mediante maxWidth dinámico en lugar de zoom.
 */
export function getResponsiveTableZoom(viewportWidth: number): number {
  return 1.0 // Sin zoom - texto tamaño normal en todas las resoluciones
}

/**
 * Calcula el maxWidth recomendado basado en minWidth y breakpoint
 *
 * @param minWidth - Ancho mínimo de la columna
 * @param breakpoint - Breakpoint de MUI
 * @returns Ancho máximo recomendado
 */
export function getColumnMaxWidth(
  minWidth: number,
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
): number {
  const factors = {
    xs: 1.5,
    sm: 1.5,
    md: 1.8,
    lg: 2.0,
    xl: 2.2,
  }
  return Math.round(minWidth * factors[breakpoint])
}

/**
 * Genera metadata optimizada para una columna según su configuración y tipo
 *
 * @param config - Configuración de la columna
 * @returns Metadata completa para la columna
 *
 * @example
 * // Columna de ID
 * getResponsiveColumnMeta({ minWidth: 90, type: 'id' })
 * // { minWidth: 90, maxWidth: 130, align: 'center', ... }
 *
 * @example
 * // Columna de texto con ellipsis
 * getResponsiveColumnMeta({ minWidth: 200, type: 'text', ellipsis: true })
 * // { minWidth: 200, maxWidth: { xl: 440 }, ellipsisMaxWidth: 420, ... }
 */
export function getResponsiveColumnMeta(config: ColumnConfig): ColumnMeta {
  const { minWidth, type = 'custom', ellipsis = false, align, maxWidth: customMaxWidth } = config

  // Configuración por defecto según tipo
  const defaults: Record<
    NonNullable<ColumnConfig['type']>,
    { maxWidth: number | object; align: 'left' | 'center' | 'right'; ellipsis: boolean }
  > = {
    id: { maxWidth: 130, align: 'center', ellipsis: false },
    date: { maxWidth: 140, align: 'center', ellipsis: false },
    status: { maxWidth: 160, align: 'center', ellipsis: false },
    currency: { maxWidth: 180, align: 'right', ellipsis: false },
    text: {
      maxWidth: {
        xs: Math.round(minWidth * 1.5),
        sm: Math.round(minWidth * 1.6),
        md: Math.round(minWidth * 1.8),
        lg: Math.round(minWidth * 2.0),
        xl: Math.round(minWidth * 2.2),
        xxl: Math.round(minWidth * 2.4),
        xxxl: Math.round(minWidth * 2.6),
      },
      align: 'left',
      ellipsis: true,
    },
    custom: {
      maxWidth: {
        md: Math.round(minWidth * 1.8),
        lg: Math.round(minWidth * 2.0),
        xl: Math.round(minWidth * 2.2),
        xxl: Math.round(minWidth * 2.4),
        xxxl: Math.round(minWidth * 2.6),
      },
      align: 'left',
      ellipsis: false,
    },
  }

  const typeDefaults = defaults[type]
  const finalAlign = align ?? typeDefaults.align
  const finalEllipsis = ellipsis || typeDefaults.ellipsis
  const finalMaxWidth = customMaxWidth ?? typeDefaults.maxWidth

  // Calcular ellipsisMaxWidth
  let ellipsisMaxWidth: number | undefined
  if (finalEllipsis) {
    if (typeof finalMaxWidth === 'number') {
      ellipsisMaxWidth = finalMaxWidth - 20
    } else if (typeof finalMaxWidth === 'object') {
      // Usar el valor más grande disponible (xxxl > xxl > xl > lg...)
      const maxVal = (finalMaxWidth as any).xxxl ?? (finalMaxWidth as any).xxl ?? (finalMaxWidth as any).xl ?? minWidth * 2
      ellipsisMaxWidth = maxVal - 20
    } else {
      ellipsisMaxWidth = minWidth * 2
    }
  }

  return {
    minWidth,
    maxWidth: finalMaxWidth,
    ellipsisMaxWidth,
    align: finalAlign,
    alignHeader: 'center',
    ellipsis: finalEllipsis,
  }
}

/**
 * Genera sx props optimizados para TableContainer con zoom y maxWidth responsivos
 *
 * @param zoom - Factor de zoom (opcional, se calcula automáticamente si no se proporciona)
 * @returns SxProps para TableContainer
 *
 * @example
 * <TableContainer sx={getTableContainerSx(0.9)}>
 *
 * @remarks
 * Usa CSS zoom property en lugar de transform: scale() para mejor compatibilidad
 * con escalado del SO y zoom del navegador. Fallback a transform para navegadores antiguos.
 */
export function getTableContainerSx(zoom?: number): SxProps<Theme> {
  return {
    overflowX: 'auto',
    ...(zoom && zoom < 1
      ? {
          // Usar CSS zoom property (mejor compatibilidad con OS scaling)
          zoom: zoom,
          // Fallback para navegadores que no soportan zoom
          '@supports not (zoom: 1)': {
            transform: `scale(${zoom}) translateZ(0)`,
            transformOrigin: 'top left',
            width: `${100 / zoom}%`,
          },
        }
      : {}),
  }
}

/**
 * Genera sx props para un Box contenedor que centra la tabla con maxWidth responsivo
 *
 * @param customMaxWidth - maxWidth personalizado (opcional)
 * @returns SxProps para Box contenedor
 *
 * @example
 * <Box sx={getTableWrapperSx()}>
 *   <TableContainer>...</TableContainer>
 * </Box>
 */
export function getTableWrapperSx(customMaxWidth?: {
  xs?: number | string
  sm?: number | string
  md?: number | string
  lg?: number | string
  xl?: number | string
  xxl?: number | string
  xxxl?: number | string
}): SxProps<Theme> {
  const defaultMaxWidth = {
    xs: '100%',
    sm: '100%',
    md: '100%',
    lg: 1600,   // Desktop HD (1920px → 83%)
    xl: 2200,   // QHD (2560px → 86%)
    xxl: 2600,  // 2K Retina (2880px → 90%)
    xxxl: 3400, // 4K (3840px → 88%)
  }

  return {
    maxWidth: customMaxWidth ?? defaultMaxWidth,
    margin: '0 auto',
    width: '100%',
  }
}

/**
 * Hook para detectar el viewport width actual (client-side only)
 *
 * @returns Ancho del viewport en píxeles
 */
export function useViewportWidth(): number {
  if (typeof window === 'undefined') return 1920 // SSR default
  return window.innerWidth
}

/**
 * Presets de configuración para tablas comunes
 */
export const TABLE_PRESETS = {
  /**
   * Preset para tablas de oportunidades (muchas columnas, texto largo)
   */
  oportunidades: {
    wrapperMaxWidth: { xs: '100%', md: '100%', lg: 1600, xl: 2200, xxl: 2600, xxxl: 3400 },
    autoZoom: false,
  },
  /**
   * Preset para tablas de clientes (columnas medias, ellipsis necesario)
   */
  clientes: {
    wrapperMaxWidth: { xs: '100%', md: '100%', lg: 1500, xl: 2100, xxl: 2500, xxxl: 3300 },
    autoZoom: false,
  },
  /**
   * Preset para tablas de auditoría (muchas columnas, zoom reducido custom)
   */
  auditoria: {
    wrapperMaxWidth: { xs: '100%', md: '100%', lg: '100%', xl: 2400, xxl: 2800, xxxl: 3600 },
    autoZoom: false,
    customZoom: 0.82,
  },
  /**
   * Preset para tablas compactas (pocas columnas)
   */
  compact: {
    wrapperMaxWidth: { xs: '100%', md: '100%', lg: 1200, xl: 1800, xxl: 2200, xxxl: 2800 },
    autoZoom: false,
  },
} as const