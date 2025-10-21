import type { Grade, GlassStatus, HousingStatus } from '@/shared/types/grading'
import type { EstadoFisico, EstadoFuncional, NivelDesgaste } from '@/shared/utils/gradingCalcs'
import type { CatalogoValoracion, FuncPantallaValue, EsteticaKey, EsteticaPantallaKey } from '../../tipos'

/**
 * Valores de auditoría de un dispositivo.
 * Contiene todos los campos necesarios para valoración técnica.
 */
export type ValoresAuditoria = {
  id: number
  // calculado
  estado_valoracion?: Grade

  // batería
  salud_bateria_pct?: number | null
  ciclos_bateria?: number | null

  // pantalla (funcional)
  pantalla_funcional_puntos_bril?: boolean
  pantalla_funcional_pixeles_muertos?: boolean
  pantalla_funcional_lineas_quemaduras?: boolean

  // exterior
  desgaste_lateral?: NivelDesgaste
  desgaste_trasero?: NivelDesgaste
  estado_fisico?: EstadoFisico
  estado_funcional?: EstadoFuncional

  // precio y notas
  precio_por_estado?: Record<string, number>
  precio_orientativo?: number | null
  precio_final?: number | null
  observaciones?: string

  // identificadores (para el título)
  modelo_nombre?: string
  modelo?: { nombre?: string; name?: string; title?: string; display_name?: string } | string
  imei?: string
  numero_serie?: string
  sn?: string
  serial?: string
  identificador?: string
  n_serie?: string

  // flags
  editado_por_usuario?: boolean
}

/**
 * Props para componentes de pasos de auditoría
 */
export interface AuditoriaStepProps {
  // Estado del formulario
  form: any // TODO: tipar mejor según cada paso
  setForm: (updater: (prev: any) => any) => void

  // Catálogo de opciones
  catalog: CatalogoValoracion

  // Tipo de dispositivo
  tipo: string
  isLaptop?: boolean

  // Callbacks
  onNext?: () => void
  onBack?: () => void

  // UI
  disabled?: boolean
}

/**
 * Opciones de piezas y mano de obra para costes de reparación
 */
export type PiezaOption = {
  value: number
  label: string
}

export type ManoObraOption = {
  value: number
  label: string
  tarifa_h?: string | null
}

export type CostoPiezaRow = {
  id?: number
  modelo_id: number
  pieza_tipo_id: number | undefined
  mano_obra_tipo_id: number | null
  horas: number | null
  coste_neto: string
  mano_obra_fija_neta?: string | null
  proveedor?: string | null
}

/**
 * Parámetros para construir objeto detallado desde UI
 */
export interface BuildDetalladoParams {
  // Batería
  saludBateria: number | ''
  ciclosBateria: number | ''

  // Pantalla (funcional - issues)
  pantallaIssues: FuncPantallaValue[]
  // Pantalla (estética rápida - usa EsteticaPantallaKey para incluir 'astillado')
  estadoPantalla: EsteticaPantallaKey | ''

  // Exterior
  estadoLados: EsteticaKey | ''
  estadoEspalda: EsteticaKey | ''

  // Energía
  enciende: boolean | null
  cargaOk: boolean | null

  // Funcionalidad básica detallada
  funcChecks: Array<boolean | null>
}

/**
 * Resultado de valoración técnica desde backend
 */
export interface ValoracionTecnicaDetallada {
  glass_status: GlassStatus
  housing_status: HousingStatus
  estado_fisico: EstadoFisico
  estado_funcional: EstadoFuncional
  desgaste_lateral: NivelDesgaste
  desgaste_trasero: NivelDesgaste
  salud_bateria_pct: number | null
  ciclos_bateria: number | null
  pantalla_funcional_puntos_bril: boolean
  pantalla_funcional_pixeles_muertos: boolean
  pantalla_funcional_lineas_quemaduras: boolean
  enciende: boolean | null
  carga: boolean | null
  funcional_basico_ok: boolean | null
}

/**
 * Info de modelo/serie/capacidad extraída del dispositivo
 */
export interface ModeloSerieCapacidad {
  modelo: string | null
  serie: string | null
  capacidad: string | null
}

/**
 * IDs extraídos del dispositivo
 */
export interface DispositivoIds {
  modelo_id: number | null
  capacidad_id: number | null
  dispositivo_personalizado_id: number | null
}
