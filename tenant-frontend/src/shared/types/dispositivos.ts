// Tipos para el sistema de dispositivos personalizados (no-Apple)

// Tipos de dispositivos soportados
export type TipoDispositivo = 'movil' | 'portatil' | 'pc' | 'monitor' | 'tablet' | 'otro'

// Estado general del dispositivo para valoración simple
export type EstadoGeneral = 'excelente' | 'bueno' | 'malo'

// Canal de venta
export type CanalVenta = 'B2B' | 'B2C'

// Precio versionado para dispositivo personalizado
export interface PrecioDispositivoPersonalizado {
  id: number
  dispositivo_personalizado: number
  canal: CanalVenta
  precio_neto: number
  valid_from: string  // ISO 8601 datetime
  valid_to: string | null  // ISO 8601 datetime or null if current
  fuente: string  // 'manual', 'api', etc.
  tenant_schema: string | null
  changed_by: number | null
  created_at: string
  updated_at: string
}

// Dispositivo personalizado completo (backend response con precios versionados)
export interface DispositivoPersonalizado {
  id: number
  marca: string
  modelo: string
  capacidad?: string
  tipo: TipoDispositivo
  caracteristicas: Record<string, any>
  notas?: string
  created_by?: number
  created_by_name?: string
  created_at: string
  updated_at: string
  activo: boolean
  descripcion_completa: string
  precio_b2b_vigente: number | null
  precio_b2c_vigente: number | null
  precios: PrecioDispositivoPersonalizado[]
}

// Versión simplificada para listados y selección
export interface DispositivoPersonalizadoSimple {
  id: number
  marca: string
  modelo: string
  capacidad?: string
  tipo: TipoDispositivo
  descripcion_completa: string
}

// Request para calcular oferta
export interface CalcularOfertaRequest {
  estado: EstadoGeneral
  canal: CanalVenta
}

// Response del endpoint calcular_oferta (con precios versionados)
export interface OfertaPersonalizadaResponse {
  dispositivo_id: number
  estado: EstadoGeneral
  canal: CanalVenta
  precio_vigente: number
  ajuste_aplicado: number  // 1.0 (100%), 0.80 (80%), 0.50 (50%)
  oferta: number
}

// Request para set_precio
export interface SetPrecioRequest {
  canal: CanalVenta
  precio_neto: number
  valid_from?: string  // ISO 8601 datetime, opcional (default: now)
  fuente?: string  // opcional (default: 'manual')
}

// Labels para UI
export const TIPO_DISPOSITIVO_LABELS: Record<TipoDispositivo, string> = {
  movil: 'Móvil',
  portatil: 'Portátil',
  pc: 'PC (Desktop/Torre)',
  monitor: 'Monitor',
  tablet: 'Tablet',
  otro: 'Otro',
}

export const ESTADO_GENERAL_CONFIG: Record<EstadoGeneral, { label: string; descripcion: string; color: string }> = {
  excelente: {
    label: 'Excelente',
    descripcion: 'Dispositivo en perfecto estado, sin marcas visibles, funciona perfectamente',
    color: '#4caf50',
  },
  bueno: {
    label: 'Bueno',
    descripcion: 'Signos leves de uso, pequeños arañazos, funcionalidad completa',
    color: '#ff9800',
  },
  malo: {
    label: 'Malo',
    descripcion: 'Desgaste visible, golpes, arañazos profundos, puede tener fallos funcionales',
    color: '#f44336',
  },
}
