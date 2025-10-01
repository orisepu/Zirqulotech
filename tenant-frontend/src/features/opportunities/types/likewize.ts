/**
 * Types for Likewize Price Update System
 *
 * These types are used across the Likewize device pricing and mapping functionality.
 */

/**
 * Represents a single change (insert/update/delete) in a Likewize price update task
 */
export type Cambio = {
  id: string
  kind: 'INSERT' | 'UPDATE' | 'DELETE'
  tipo: string
  modelo_norm: string
  almacenamiento_gb: number
  capacidad_id?: number | null
  marca?: string
  antes: string | null
  despues: string | null
  delta: number | null
  nombre_likewize_original?: string
  nombre_normalizado?: string
  confianza_mapeo?: 'alta' | 'media' | 'baja'
  necesita_revision?: boolean
}

/**
 * Complete diff data structure for a Likewize task
 * Supports both V1/V2 (legacy) and V3 (learning system) formats
 */
export type DiffData = {
  // V1/V2 format
  summary: { inserts: number; updates: number; deletes: number; total: number }
  changes: Cambio[]

  // V3 specific fields
  is_v3?: boolean
  resumen?: {
    inserciones?: number
    actualizaciones?: number
    eliminaciones?: number
    sin_cambios?: number
    total_comparaciones?: number
  }
  v3_stats?: {
    confidence_stats?: {
      promedio?: number
      alta_confianza?: number
      media_confianza?: number
      baja_confianza?: number
    }
  }
  comparaciones?: Array<{
    change_type?: string
    likewize_info?: {
      modelo_raw?: string
      modelo_norm?: string
      likewize_model_code?: string
      marca?: string
      almacenamiento_gb?: string | number
    }
    [key: string]: any
  }>
}

/**
 * Task state enum for Likewize update tasks
 */
export type TareaEstado = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'ERROR'

/**
 * Task status response from API
 */
export type EstadoTarea = {
  estado: TareaEstado
  error_message?: string
}

/**
 * Preset configuration for Likewize updates
 */
export type Preset = {
  id: string
  nombre: string
  descripcion?: string
  config: Record<string, any>
}

/**
 * Price data from Likewize API
 */
export type PrecioLikewize = {
  modelo_norm: string
  almacenamiento_gb: number | null
  precio_b2b: number
  marca?: string
  likewize_model_code?: string | null
}
