/**
 * Sistema de tipos centralizado para tablas responsive y escalables
 *
 * @description Define todos los tipos necesarios para construir tablas
 * que sean responsive, escalables según DPI, y altamente personalizables.
 *
 * @version 2.0
 * @date 2025-10-01
 */

import type { ColumnDef as TanstackColumnDef } from '@tanstack/react-table'

/**
 * Valor responsive que admite diferentes tamaños por breakpoint
 *
 * @example
 * ```typescript
 * const width: ResponsiveSize = {
 *   xs: '10rem',  // Mobile
 *   sm: '12rem',  // Tablet
 *   md: '14rem',  // Desktop
 *   lg: '16rem'   // Large desktop
 * }
 * ```
 */
export type ResponsiveSize = {
  xs?: string  // 0px - 600px (mobile)
  sm?: string  // 600px - 960px (tablet)
  md?: string  // 960px - 1280px (desktop)
  lg?: string  // 1280px - 1920px (large desktop)
  xl?: string  // 1920px+ (ultra-wide)
}

/**
 * Nivel de prioridad de una columna para responsive design
 *
 * - 1: Esencial - Siempre visible (ID, nombre, estado)
 * - 2: Importante - Oculta solo en mobile pequeño
 * - 3: Normal - Oculta en mobile
 * - 4: Secundaria - Oculta en mobile y tablet
 * - 5: Opcional - Solo visible en desktop grande
 */
export type ColumnPriority = 1 | 2 | 3 | 4 | 5

/**
 * Modo de escalado con DPI
 *
 * - 'auto': Escala automáticamente según el DPI del sistema (default)
 * - 'fixed': Mantiene tamaño fijo sin escalar
 */
export type DpiScaleMode = 'auto' | 'fixed'

/**
 * Densidad de la tabla
 *
 * - 'compact': Padding y altura de filas reducidos (0.25rem / 0.5rem)
 * - 'normal': Padding y altura estándar (0.5rem / 1rem)
 * - 'comfortable': Padding y altura amplios (0.75rem / 1.5rem)
 */
export type TableDensity = 'compact' | 'normal' | 'comfortable'

/**
 * Configuración de estilo de una columna
 */
export interface ColumnStyleConfig {
  /** Ancho mínimo de la columna (responsive o string fijo) */
  minWidth?: ResponsiveSize | string

  /** Ancho máximo de la columna (responsive o string fijo) */
  maxWidth?: ResponsiveSize | string

  /** Ancho fijo de la columna (responsive o string fijo) */
  width?: ResponsiveSize | string

  /** Alineación horizontal del contenido */
  align?: 'left' | 'center' | 'right'

  /** Alineación vertical del contenido */
  verticalAlign?: 'top' | 'middle' | 'bottom'

  /** Si el contenido debe truncarse con ellipsis y tooltip */
  ellipsis?: boolean

  /** Ancho máximo para ellipsis (si es diferente de maxWidth) */
  ellipsisMaxWidth?: ResponsiveSize | string

  /** Si la columna debe ser sticky (fija al hacer scroll horizontal) */
  sticky?: boolean | 'left' | 'right'

  /** Prioridad para responsive (1 = esencial, 5 = opcional) */
  priority?: ColumnPriority

  /** Modo de escalado con DPI */
  dpiScale?: DpiScaleMode

  /** Si la columna debe envolver el texto (nowrap por defecto) */
  wrap?: boolean
}

/**
 * Metadata extendida para columnas de tabla
 * Combina estilo con comportamiento
 */
export interface ResponsiveColumnMeta extends ColumnStyleConfig {
  /** Label legible para humanos (usado en selector de columnas) */
  label?: string

  /** Alineación del header (si es diferente de align) */
  alignHeader?: 'left' | 'center' | 'right'

  /** Ancho máximo del header (para headers multi-línea) */
  headerMaxWidth?: ResponsiveSize | string

  /** Si el header no debe envolver (nowrap) */
  nowrapHeader?: boolean

  /** Si la columna puede exportarse a CSV/Excel */
  exportable?: boolean

  /** Si la columna está oculta por defecto */
  hidden?: boolean

  /** Si la columna debe persistir su visibilidad en localStorage */
  persist?: boolean

  /** Función custom de formateo para export */
  exportFormatter?: (value: any) => string

  /** Clase CSS custom para la columna */
  className?: string
}

/**
 * Props para el componente principal de tabla
 */
export interface ResponsiveTableProps<TData> {
  /** Datos a mostrar en la tabla */
  data?: TData[]

  /** Definición de columnas */
  columns?: ResponsiveColumnDef<TData>[] | TanstackColumnDef<TData, any>[]

  /** Estado de carga */
  loading?: boolean

  /** Callback al hacer click en una fila */
  onRowClick?: (row: TData) => void

  /** ID del usuario para persistencia de configuración */
  userId?: string | number

  /** Key única para localStorage (si no se especifica, se usa un default) */
  storageKey?: string

  // === Paginación ===

  /** Modo de paginación */
  paginationMode?: 'client' | 'server'

  /** Total de registros (server-side) */
  totalCount?: number

  /** Página actual (0-indexed) */
  pageIndex?: number

  /** Tamaño de página */
  pageSize?: number

  /** Callback al cambiar de página */
  onPageChange?: (pageIndex: number) => void

  /** Callback al cambiar tamaño de página */
  onPageSizeChange?: (pageSize: number) => void

  /** Opciones de tamaño de página */
  pageSizeOptions?: number[]

  // === Features ===

  /** Ocultar selector de columnas */
  hideColumnSelector?: boolean

  /** Ocultar botón de exportación */
  hideExport?: boolean

  /** Habilitar virtualización para tablas grandes (>100 filas) */
  enableVirtualization?: boolean

  /** Altura estimada de cada fila para virtualización */
  estimatedRowHeight?: number

  /** Habilitar ordenamiento */
  enableSorting?: boolean

  /** Habilitar filtrado global */
  enableGlobalFilter?: boolean

  /** Placeholder para filtro global */
  globalFilterPlaceholder?: string

  // === Styling ===

  /** Densidad de la tabla */
  density?: TableDensity

  /** Filas alternas con color de fondo */
  striped?: boolean

  /** Efecto hover en filas */
  hoverEffect?: boolean

  /** Header sticky al hacer scroll */
  stickyHeader?: boolean

  /** Altura máxima del contenedor (para scroll) */
  maxHeight?: string | number

  /** Clases CSS custom */
  className?: string

  /** Estilos sx custom de MUI */
  sx?: any

  // === Responsive ===

  /** Breakpoint para considerar "mobile" */
  mobileBreakpoint?: 'xs' | 'sm'

  /** Auto-ocultar columnas de baja prioridad en mobile */
  autoHideLowPriority?: boolean

  /** Modo de escalado con DPI */
  dpiScaling?: DpiScaleMode

  // === Advanced ===

  /** Ordenamiento inicial */
  defaultSorting?: Array<{ id: string; desc: boolean }>

  /** Filtros iniciales */
  defaultColumnFilters?: any[]

  /** Metadata custom (para casos avanzados) */
  meta?: any
}

/**
 * ColumnDef extendido con metadata responsive
 */
export type ResponsiveColumnDef<TData> = TanstackColumnDef<TData, any> & {
  meta?: ResponsiveColumnMeta
}

/**
 * Configuración de padding según densidad
 */
export const DENSITY_PADDING_MAP: Record<TableDensity, { x: string; y: string }> = {
  compact: { x: '0.5rem', y: '0.25rem' },
  normal: { x: '1rem', y: '0.5rem' },
  comfortable: { x: '1.5rem', y: '0.75rem' },
}

/**
 * Mapeo de prioridades a breakpoints donde se ocultan
 */
export const PRIORITY_BREAKPOINT_MAP: Record<ColumnPriority, ('xs' | 'sm' | 'md' | 'lg')[]> = {
  1: [],                    // Nunca oculta
  2: ['xs'],                // Oculta solo en xs (mobile pequeño)
  3: ['xs', 'sm'],          // Oculta en mobile
  4: ['xs', 'sm', 'md'],    // Oculta hasta tablet
  5: ['xs', 'sm', 'md', 'lg'], // Solo visible en xl+
}
