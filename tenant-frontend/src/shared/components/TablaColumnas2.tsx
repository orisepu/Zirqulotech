/**
 * Definiciones de columnas para tablas responsive
 *
 * @description Sistema modular y type-safe para definir columnas de tabla
 * con soporte completo para responsive, DPI scaling, y personalización.
 *
 * @version 2.0
 * @date 2025-10-01
 */

import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Chip, Box, Typography, Stack, TextField, Select, MenuItem } from '@mui/material'
import { getId } from '@/shared/utils/id'
import { ESTADOS_META, ESTADOS_B2B, ESTADO_LABEL_OVERRIDES } from '@/context/estados'
import { formatoBonito } from '@/context/precios'
import { EllipsisTooltip } from '@/shared/components/ui/EllipsisTooltip'
import { pxToResponsiveRem } from '@/shared/utils/tableResponsive.v2'
import type { ResponsiveColumnDef, ResponsiveColumnMeta } from '@/shared/types/table.types'

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

export interface ModeloMini {
  id: number
  descripcion: string
  tipo?: string
  marca?: string
  pantalla?: string
  año?: number
  procesador?: string
  likewize_modelo_id?: string | number
}

export interface CapacidadRow {
  id: number
  modelo: ModeloMini
  modelo__descripcion?: string
  tamaño?: string | number
  activo: boolean
  precio_b2b: string | number | null
  precio_b2c: string | number | null
  b2b_fuente?: string
  b2c_fuente?: string
  b2b_valid_from?: string | null
  b2b_valid_to?: string | null
  b2c_valid_from?: string | null
  b2c_valid_to?: string | null
}

export interface ClienteLike {
  display_name?: string
  razon_social?: string
  nombre?: string
  apellidos?: string
  identificador_fiscal?: string
  cif?: string
  nif?: string
  dni_nie?: string
  tipo_cliente?: string
  contacto?: string | null
  posicion?: string | null
  correo?: string | null
  telefono?: string | null
  tienda_nombre?: string | null
  oportunidades_count?: number
  valor_total_final?: number
  contacto_financiero?: string | null
  telefono_financiero?: string | null
  correo_financiero?: string | null
}

type GenericRow = Record<string, unknown>

// ============================================================================
// UTILIDADES DE FORMATO
// ============================================================================

export const fmtEUR = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—'
  const num = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

const formatoMoneda = fmtEUR

const formatoTel = (tel?: string | null) => {
  if (!tel) return '—'
  return tel
}

export const nombreVisible = (cliente: ClienteLike): string => {
  const nombreCompuesto = `${cliente.nombre || ""} ${cliente.apellidos || ""}`.trim()
  return cliente.display_name || cliente.razon_social || (nombreCompuesto || "—")
}

const makeTwoLineHeader = (line1: string, line2: string) => (
  <Box sx={{
    display: 'inline-flex',
    flexDirection: 'column',
    textAlign: 'center',
    lineHeight: 1.2
  }}>
    <span>{line1}</span>
    <span>{line2}</span>
  </Box>
)

// ============================================================================
// COLUMN BUILDER - PATRÓN BUILDER PARA DEFINICIÓN DE COLUMNAS
// ============================================================================

/**
 * Builder para crear columnas de forma fluida y type-safe
 *
 * @example
 * ```typescript
 * new ColumnBuilder<MyType>('id')
 *   .header('ID')
 *   .accessor(row => row.id)
 *   .size(90, 130)
 *   .align('center')
 *   .priority(1)
 *   .build()
 * ```
 */
class ColumnBuilder<T> {
  private config: any

  constructor(id: string) {
    this.config = {
      id,
      meta: {},
    }
  }

  header(text: string | React.ReactNode) {
    this.config.header = text as any
    return this
  }

  accessor(key: keyof T | ((row: T) => any)) {
    if (typeof key === 'function') {
      this.config.accessorFn = key
    } else {
      this.config.accessorKey = key as string
    }
    return this
  }

  size(minWidth: number, maxWidth?: number) {
    this.config.meta = {
      ...this.config.meta,
      minWidth: pxToResponsiveRem(minWidth),
      maxWidth: maxWidth ? pxToResponsiveRem(maxWidth) : undefined,
    }
    return this
  }

  align(alignment: 'left' | 'center' | 'right') {
    this.config.meta = { ...this.config.meta, align: alignment }
    return this
  }

  alignHeader(alignment: 'left' | 'center' | 'right') {
    this.config.meta = { ...this.config.meta, alignHeader: alignment }
    return this
  }

  ellipsis(enabled = true, maxWidth?: number) {
    this.config.meta = {
      ...this.config.meta,
      ellipsis: enabled,
      ellipsisMaxWidth: maxWidth ? pxToResponsiveRem(maxWidth) : undefined,
    }
    return this
  }

  priority(level: 1 | 2 | 3 | 4 | 5) {
    this.config.meta = { ...this.config.meta, priority: level }
    return this
  }

  label(text: string) {
    this.config.meta = { ...this.config.meta, label: text }
    return this
  }

  cell(renderer: (props: any) => React.ReactNode) {
    this.config.cell = renderer
    return this
  }

  persist(enabled = true) {
    this.config.meta = { ...this.config.meta, persist: enabled }
    return this
  }

  exportable(enabled = true) {
    this.config.meta = { ...this.config.meta, exportable: enabled }
    return this
  }

  nowrapHeader(enabled = true) {
    this.config.meta = { ...this.config.meta, nowrapHeader: enabled }
    return this
  }

  build(): ResponsiveColumnDef<T> {
    // Defaults finales
    if (!this.config.meta?.alignHeader) {
      this.config.meta = { ...this.config.meta, alignHeader: 'center' }
    }
    return this.config
  }
}

// ============================================================================
// FACTORIES - CREADORES DE COLUMNAS COMUNES
// ============================================================================

/**
 * Crea una columna de ID estándar
 */
export function createIdColumn<T>(
  accessor?: (row: T) => any
): ResponsiveColumnDef<T> {
  return new ColumnBuilder<T>('id')
    .header('ID')
    .accessor(accessor || ((row: any) => getId(row)))
    .size(90, 130)
    .align('center')
    .priority(1)
    .label('ID')
    .cell(({ getValue }) => getValue() ?? '—')
    .build()
}

/**
 * Crea una columna de texto con ellipsis
 */
export function createTextColumn<T>(
  id: string,
  header: string,
  accessor: keyof T | ((row: T) => any),
  minWidth = 140,
  maxWidth?: number
): ResponsiveColumnDef<T> {
  return new ColumnBuilder<T>(id)
    .header(header)
    .accessor(accessor as any)
    .size(minWidth, maxWidth || minWidth * 1.8)
    .align('center')
    .ellipsis(true)
    .label(header)
    .cell(({ getValue }) => getValue() ?? '—')
    .build()
}

/**
 * Crea una columna de moneda (EUR)
 */
export function createCurrencyColumn<T>(
  id: string,
  header: string | React.ReactNode,
  accessor: (row: T) => number | string | null | undefined,
  minWidth = 150,
  maxWidth = 200
): ResponsiveColumnDef<T> {
  return new ColumnBuilder<T>(id)
    .header(header)
    .accessor(accessor)
    .size(minWidth, maxWidth)
    .align('center')
    .alignHeader('center')
    .cell(({ getValue }) => {
      const valor = getValue() as number | string | null | undefined
      return <Box textAlign="center">{fmtEUR(valor)}</Box>
    })
    .label(typeof header === 'string' ? header : id)
    .build()
}

/**
 * Crea una columna de fecha
 */
export function createDateColumn<T>(
  id: string,
  header: string,
  accessor: keyof T | ((row: T) => any),
  minWidth = 110
): ResponsiveColumnDef<T> {
  return new ColumnBuilder<T>(id)
    .header(header)
    .accessor(accessor as any)
    .size(minWidth, 140)
    .align('center')
    .nowrapHeader(true)
    .cell(({ getValue }) => {
      const value = getValue()
      if (!value) return '—'
      return new Date(String(value)).toLocaleDateString('es-ES')
    })
    .label(header)
    .build()
}

/**
 * Crea una columna de estado con Chip
 */
export function createStatusColumn<T>(
  id: string,
  header: string,
  accessor: (row: T) => string,
  minWidth = 140,
  maxWidth = 180
): ResponsiveColumnDef<T> {
  return new ColumnBuilder<T>(id)
    .header(header)
    .accessor(accessor)
    .size(minWidth, maxWidth)
    .align('center')
    .cell(({ getValue }) => {
      const estado = String(getValue() || '')
      const metaInfo = ESTADOS_META[estado]
      const Icono = metaInfo?.icon
      return (
        <Chip
          label={estado}
          icon={Icono ? <Icono /> : undefined}
          color={metaInfo?.color || 'default'}
          size="small"
          sx={{ fontWeight: 500 }}
        />
      )
    })
    .label(header)
    .build()
}

// ============================================================================
// DEFINICIONES DE COLUMNAS - CAPACIDADES ADMIN
// ============================================================================

export const columnasCapacidadesAdmin: ResponsiveColumnDef<CapacidadRow>[] = [
  new ColumnBuilder<CapacidadRow>('modelo__descripcion')
    .header('Modelo')
    .accessor((r) => r.modelo__descripcion || r.modelo?.descripcion || '—')
    .size(180, 280)
    .align('left')
    .alignHeader('center')
    .ellipsis(true)
    .label('Modelo')
    .build(),

  new ColumnBuilder<CapacidadRow>('activo')
    .header('Estado')
    .accessor((r) => (r.activo ? 'Activo' : 'Inactivo'))
    .size(100, 120)
    .align('center')
    .alignHeader('center')
    .cell(({ row }) => (
      <Chip label={row.original.activo ? 'Activo' : 'Inactivo'} color={row.original.activo ? 'success' : 'default'} size="small" />
    ))
    .label('Estado')
    .build(),

  new ColumnBuilder<CapacidadRow>('tamaño')
    .header('Capacidad')
    .accessor((r) => (r.tamaño ? `${r.tamaño} GB` : '—'))
    .size(100, 120)
    .align('center')
    .alignHeader('center')
    .label('Capacidad')
    .build(),

  createCurrencyColumn<CapacidadRow>('_b2b', 'B2B', (r) => r.precio_b2b, 110, 150),
  createCurrencyColumn<CapacidadRow>('_b2c', 'B2C', (r) => r.precio_b2c, 110, 150),

  new ColumnBuilder<CapacidadRow>('fuente')
    .header('Fuente')
    .accessor((r) => ({ b2b: r.b2b_fuente, b2c: r.b2c_fuente }))
    .size(140, 200)
    .align('left')
    .alignHeader('center')
    .cell(({ row }) => (
      <Stack spacing={0}>
        <Typography variant="caption">B2B: {row.original.b2b_fuente || '—'}</Typography>
        <Typography variant="caption">B2C: {row.original.b2c_fuente || '—'}</Typography>
      </Stack>
    ))
    .label('Fuente')
    .build(),

  new ColumnBuilder<CapacidadRow>('vigencia')
    .header('Vigencia')
    .accessor((r) => r)
    .size(180, 280)
    .align('left')
    .alignHeader('center')
    .cell(({ row }) => (
      <Stack spacing={0}>
        <Typography variant="caption">
          B2B: {row.original.b2b_valid_from ? new Date(row.original.b2b_valid_from).toLocaleDateString('es-ES') : '—'} →{' '}
          {row.original.b2b_valid_to ? new Date(row.original.b2b_valid_to).toLocaleDateString('es-ES') : '∞'}
        </Typography>
        <Typography variant="caption">
          B2C: {row.original.b2c_valid_from ? new Date(row.original.b2c_valid_from).toLocaleDateString('es-ES') : '—'} →{' '}
          {row.original.b2c_valid_to ? new Date(row.original.b2c_valid_to).toLocaleDateString('es-ES') : '∞'}
        </Typography>
      </Stack>
    ))
    .label('Vigencia')
    .build(),
]

// ============================================================================
// DEFINICIONES DE COLUMNAS - ADMIN (OPORTUNIDADES GLOBALES)
// ============================================================================

export const columnasAdmin: ResponsiveColumnDef<GenericRow>[] = [
  createIdColumn<GenericRow>(),
  createTextColumn<GenericRow>('partner', 'Partner', (r) => r.partner, 110, 140),
  createTextColumn<GenericRow>('tienda', 'Tienda', (r) => (r as any).tienda?.nombre || '—', 100, 150),
  createTextColumn<GenericRow>('cliente', 'Cliente', (r) => (r as any).cliente?.razon_social || '—', 130, 280),
  createTextColumn<GenericRow>('oportunidad', 'Oportunidad', (r) => r.nombre, 140, 220),
  createDateColumn<GenericRow>('fecha_creacion', 'Fecha', 'fecha_creacion', 110),
  createCurrencyColumn<GenericRow>(
    'valoracion_partner',
    makeTwoLineHeader('Valoración', 'partner'),
    (r) => Number((r as any).valor_total ?? 0),
    140,
    200
  ),
  createCurrencyColumn<GenericRow>(
    'valoracion_final',
    makeTwoLineHeader('Valoración', 'final'),
    (r) => Number((r as any).valor_total_final ?? 0),
    150,
    200
  ),
  createTextColumn<GenericRow>('seguimiento', 'Número de seguimiento', (r) => r.numero_seguimiento, 200, 280),
  createStatusColumn<GenericRow>('estado', 'Estado', (r) => String((r as any).estado ?? ''), 140, 180),
]

// ============================================================================
// DEFINICIONES DE COLUMNAS - TENANT (OPORTUNIDADES LOCALES)
// ============================================================================

export const columnasTenant: ResponsiveColumnDef<GenericRow>[] = [
  createIdColumn<GenericRow>(),
  createTextColumn<GenericRow>('tienda', 'Tienda', (r) => {
    const row = r as any
    return row.tienda_nombre || row.tienda?.nombre || row.tienda_info?.nombre || '—'
  }, 100, 220),
  createTextColumn<GenericRow>('cliente', 'Cliente', (r) => {
    const row = r as any
    // Prioridad: display_name > razon_social > cliente_nombre > nombre+apellidos
    if (row.cliente?.display_name) return row.cliente.display_name
    if (row.cliente?.razon_social) return row.cliente.razon_social
    if (row.cliente_nombre) return row.cliente_nombre
    if (row.cliente?.nombre && row.cliente?.apellidos) {
      return `${row.cliente.nombre} ${row.cliente.apellidos}`
    }
    if (row.cliente?.nombre) return row.cliente.nombre
    return '—'
  }, 130, 280),
  createTextColumn<GenericRow>('oportunidad', 'Oportunidad', (r) => r.nombre, 140, 220),
  createDateColumn<GenericRow>('fecha_creacion', 'Fecha', 'fecha_creacion', 110),
  createCurrencyColumn<GenericRow>(
    'valoracion',
    makeTwoLineHeader('Valoración', 'inicial'),
    (r) => Number((r as any).valor_total ?? 0),
    140,
    200
  ),
  createCurrencyColumn<GenericRow>(
    'valoracion_final',
    makeTwoLineHeader('Valoración', 'final'),
    (r) => Number((r as any).valor_total_final ?? 0),
    150,
    200
  ),
  createTextColumn<GenericRow>('seguimiento', 'Número de seguimiento', (r) => r.numero_seguimiento, 200, 280),
  createStatusColumn<GenericRow>('estado', 'Estado', (r) => String((r as any).estado ?? ''), 140, 180),
]

// ============================================================================
// DEFINICIONES DE COLUMNAS - DISPOSITIVOS REALES
// ============================================================================

export const columnasDispositivosReales: ResponsiveColumnDef<GenericRow>[] = [
  createTextColumn<GenericRow>('modelo', 'Modelo', (r) => {
    // Para dispositivos personalizados, usar descripcion_completa
    if (r.dispositivo_personalizado && typeof r.dispositivo_personalizado === 'object') {
      const dp = r.dispositivo_personalizado as Record<string, unknown>
      return dp.descripcion_completa as string || r.modelo
    }
    return r.modelo
  }, 200, 450),
  createTextColumn<GenericRow>('capacidad', 'Capacidad', (r) => {
    // Para dispositivos personalizados, la capacidad ya está en descripcion_completa
    if (r.dispositivo_personalizado && typeof r.dispositivo_personalizado === 'object') {
      return '—' // O mostrar la capacidad específica si existe
    }
    return r.capacidad
  }, 150),
  createTextColumn<GenericRow>('imei', 'IMEI', (r) => r.imei, 150, 250),
  createTextColumn<GenericRow>('numero_serie', 'Nº Serie', (r) => r.numero_serie, 150, 250),
  createTextColumn<GenericRow>('estado_fisico', 'Estado Físico', (r) => r.estado_fisico, 150),
  createTextColumn<GenericRow>('estado_funcional', 'Estado Funcional', (r) => r.estado_funcional, 150),
  createTextColumn<GenericRow>('estado_valoracion', 'Estado Valoración', (r) => r.estado_valoracion, 150),
  createCurrencyColumn<GenericRow>('precio_final', 'Precio Final', (r) => r.precio_final as any, 160, 200),
]

// ============================================================================
// FUNCIÓN GENERADORA - COLUMNAS CLIENTES
// ============================================================================

export function getColumnasClientes<T extends ClienteLike = ClienteLike>(): {
  columnas: ResponsiveColumnDef<T>[]
  zoom: number
} {
  const columnas: ResponsiveColumnDef<T>[] = [
    createTextColumn<T>('display_name', 'Nombre', (r) => r.display_name || r.razon_social || r.nombre || '—', 190, 200),
    createTextColumn<T>('identificador_fiscal', 'CIF/NIF', (r) => r.identificador_fiscal || r.cif || r.nif || r.dni_nie || '—', 120),
    createTextColumn<T>('tipo_cliente', 'Tipo', (r) => formatoBonito(r.tipo_cliente), 110),
    createTextColumn<T>('contacto', 'Contacto', (r) => r.contacto || '—', 150, 200),
    createTextColumn<T>('posicion', 'Posición', (r) => r.posicion || '—', 140),
    createTextColumn<T>('correo', 'Correo', (r) => r.correo || '—', 190, 280),
    createTextColumn<T>('telefono', 'Teléfono', (r) => formatoTel(r.telefono), 150),
    createTextColumn<T>('tienda_nombre', 'Tienda', (r) => r.tienda_nombre ?? '—', 90),

    new ColumnBuilder<T>('oportunidades_count')
      .header('Nº Opor.')
      .accessor((r) => r.oportunidades_count ?? 0)
      .size(140, 140)
      .align('center')
      .label('Nº Oportunidades')
      .build(),

    createCurrencyColumn<T>('valor_total', makeTwoLineHeader('Valor', 'Total'), (r) => r.valor_total_final ?? 0, 120, 200),
  ]

  return { columnas, zoom: 1.0 }
}

// ============================================================================
// FUNCIÓN GENERADORA - COLUMNAS CONTACTOS
// ============================================================================

export function getColumnasContactos<T extends ClienteLike = ClienteLike>(): {
  columnas: ResponsiveColumnDef<T>[]
  zoom: number
} {
  const columnas: ResponsiveColumnDef<T>[] = [
    createTextColumn<T>('cliente', 'Cliente', (r) => nombreVisible(r), 220, 240),

    createTextColumn<T>('contacto_principal', 'Contacto principal', (r) => {
      return r.tipo_cliente === 'empresa' ? (r.contacto || '—') : nombreVisible(r)
    }, 200, 220),

    createTextColumn<T>('posicion', 'Posición', (r) => {
      return r.tipo_cliente === 'empresa' ? (r.posicion || '—') : '—'
    }, 160, 180),

    createTextColumn<T>('telefono', 'Teléfono', (r) => formatoTel(r.telefono), 130, 150),

    createTextColumn<T>('correo', 'Correo', (r) => r.correo || '—', 220, 240),

    createTextColumn<T>('contacto_financiero', 'Contacto financiero', (r) => r.contacto_financiero || '—', 200, 220),

    createTextColumn<T>('telefono_financiero', 'Tel. financiero', (r) => formatoTel(r.telefono_financiero), 170, 170),

    createTextColumn<T>('correo_financiero', 'Correo financiero', (r) => r.correo_financiero || '—', 200, 220),
  ]

  return { columnas, zoom: 1.0 }
}

// ============================================================================
// FUNCIÓN GENERADORA - COLUMNAS AUDITORÍA
// ============================================================================

/**
 * Generates column definitions for the audit table (consultation mode)
 *
 * @description Creates a readonly table view showing device audit status,
 * grades, and pricing. Used in the /auditorias/[id] page for reviewing
 * audited devices. All editing is done in the modal form, not in the table.
 *
 * @template T - Device type extending DispositivoReal
 * @returns Object with columnas (column definitions) and zoom level
 *
 * @example
 * ```tsx
 * const { columnas, zoom } = getColumnasAuditoria();
 * <TablaReactiva data={devices} columns={columnas} />
 * ```
 */
export function getColumnasAuditoria<T = any>(): {
  columnas: ResponsiveColumnDef<T>[];
  zoom: number;
} {
  const columnas: ResponsiveColumnDef<T>[] = [
    // Identificación del dispositivo
    createTextColumn<T>('modelo', 'Modelo', (r: any) => r.modelo || '—', 300),
    createTextColumn<T>('capacidad', 'Capacidad', (r: any) => r.capacidad || '—', 100),
    createTextColumn<T>('imei', 'IMEI', (r: any) => r.imei || '—', 200),
    createTextColumn<T>('Numero_Serie', 'Nº Serie', (r: any) => r.numero_serie || '—', 200),

    // Estado de auditoría (chip visual)
    new ColumnBuilder<T>('auditado')
      .header('Estado')
      .accessor((r: any) => r.auditado)
      .size(120, 150)
      .align('center')
      .label('Estado Auditoría')
      .cell(({ row }) => {
        const disp = row.original as any
        // Use Boolean() to prevent empty strings from being truthy
        const auditado =
          disp.auditado === true &&
          disp.precio_final != null &&
          Boolean(disp.estado_fisico) &&
          Boolean(disp.estado_funcional)
        return (
          <Chip
            label={auditado ? 'Auditado' : 'Pendiente'}
            color={auditado ? 'success' : 'default'}
            size="small"
            sx={{ fontWeight: 500 }}
            aria-label={
              auditado
                ? 'Estado de auditoría: Completado'
                : 'Estado de auditoría: Pendiente de revisar'
            }
          />
        )
      })
      .build(),

    // Grado (texto readonly)
    new ColumnBuilder<T>('grado')
      .header('Grado')
      .accessor((r: any) => r.estado_valoracion)
      .size(80, 100)
      .align('center')
      .label('Grado')
      .cell(({ getValue }) => {
        const grado = getValue()
        if (!grado) return '—'

        // Use theme colors instead of hardcoded values
        let color: string = 'text.primary'
        if (grado === 'A+' || grado === 'A') color = 'success.main'
        else if (grado === 'B') color = 'warning.main'
        else if (grado === 'C' || grado === 'D') color = 'error.main'
        else if (grado === 'R') color = 'text.disabled' // Reciclaje

        return (
          <Typography
            component="span"
            sx={{
              fontWeight: 600,
              color,
              fontSize: '0.875rem',
            }}
          >
            {grado}
          </Typography>
        )
      })
      .build(),

    // Precios
    createCurrencyColumn<T>('precio_orientativo', 'Precio Orientativo', (r: any) => r.precio_orientativo, 140, 200),
    createCurrencyColumn<T>('precio_final', 'Precio Final', (r: any) => r.precio_final, 140, 200),
  ]

  return { columnas, zoom: 1.0 }
}

// ============================================================================
// DEFINICIONES DE COLUMNAS - OPERACIONES
// ============================================================================

export const columnasOperaciones: ResponsiveColumnDef<GenericRow>[] = [
  createIdColumn<GenericRow>(),
  createTextColumn<GenericRow>('comercial', 'Comercial', (r) => (r as any).usuario_info?.name || '—', 110, 200),

  createTextColumn<GenericRow>('nombre', 'Nombre', (r) => r.nombre, 140, 200),
  createTextColumn<GenericRow>('cliente', 'Cliente', (r) => {
    const row = r as any
    // Prioridad: display_name > razon_social > cliente_nombre > nombre+apellidos
    if (row.cliente?.display_name) return row.cliente.display_name
    if (row.cliente?.razon_social) return row.cliente.razon_social
    if (row.cliente_nombre) return row.cliente_nombre
    if (row.cliente?.nombre && row.cliente?.apellidos) {
      return `${row.cliente.nombre} ${row.cliente.apellidos}`
    }
    if (row.cliente?.nombre) return row.cliente.nombre
    return '—'
  }, 130, 280),
  createCurrencyColumn<GenericRow>(
    'valoracion_partner',
    makeTwoLineHeader('Valoración', 'partner'),
    (r) => Number((r as any).valor_total ?? 0),
    140,
    200
  ),
  createCurrencyColumn<GenericRow>(
    'valoracion_final',
    makeTwoLineHeader('Valoración', 'final'),
    (r) => Number((r as any).valor_total_final ?? 0),
    150,
    200
  ),
  createDateColumn<GenericRow>('fecha_creacion', 'Fecha', 'fecha_creacion', 110),
  createTextColumn<GenericRow>('seguimiento', 'Número de seguimiento', (r) => r.numero_seguimiento, 200, 280),  
  createStatusColumn<GenericRow>('estado', 'Estado', (r) => String(r.estado ?? ''), 120, 160),
]
