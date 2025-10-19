// Tipos para el sistema de dispositivos personalizados (no-Apple)

// Tipos de dispositivos soportados
export type TipoDispositivo = 'movil' | 'portatil' | 'monitor' | 'tablet' | 'otro'

// Estado general del dispositivo para valoración simple
export type EstadoGeneral = 'excelente' | 'bueno' | 'malo'

// Canal de venta
export type CanalVenta = 'B2B' | 'B2C'

// Dispositivo personalizado completo (backend response)
export interface DispositivoPersonalizado {
  id: number
  marca: string
  modelo: string
  capacidad?: string
  tipo: TipoDispositivo
  precio_base_b2b: number
  precio_base_b2c: number
  ajuste_excelente: number
  ajuste_bueno: number
  ajuste_malo: number
  caracteristicas: Record<string, any>
  notas?: string
  created_by?: number
  created_by_name?: string
  created_at: string
  updated_at: string
  activo: boolean
  descripcion_completa: string
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

// Response del endpoint calcular_oferta
export interface OfertaPersonalizadaResponse {
  dispositivo_id: number
  estado: EstadoGeneral
  canal: CanalVenta
  precio_base: number
  ajuste_aplicado: number
  oferta: number
}

// Labels para UI
export const TIPO_DISPOSITIVO_LABELS: Record<TipoDispositivo, string> = {
  movil: 'Móvil',
  portatil: 'Portátil',
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
