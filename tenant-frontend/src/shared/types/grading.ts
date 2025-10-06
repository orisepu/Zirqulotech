// Tipos para la página de Lógica del cuestionario comercial (iPhone)

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'R'

// Resultado de grading: puede ser un grado válido o un rechazo (fuera de grading)
export type GradingOutcome =
  | { status: 'GRADED'; grade: Grade; oferta: number; telemetria?: any }
  | { status: 'REJECTED'; reason: 'FMI_ON' | 'BLACKLIST' | 'SIM_LOCKED' | 'MDM_ACTIVE'; mensaje?: string }

// Imagen del panel (no cristal)
export enum DisplayImageStatus {
  OK = 'OK',
  PIX = 'PIX',
  LINES = 'LINES',
  BURN = 'BURN',
  MURA = 'MURA',
}

// Cristal de la pantalla (estética)
export enum GlassStatus {
  NONE = 'NONE',
  MICRO = 'MICRO',
  VISIBLE = 'VISIBLE',
  DEEP = 'DEEP',
  CHIP = 'CHIP',
  CRACK = 'CRACK',
}

// Chasis/trasera
export enum HousingStatus {
  SIN_SIGNOS = 'SIN_SIGNOS',
  MINIMOS = 'MINIMOS',
  ALGUNOS = 'ALGUNOS',
  DESGASTE_VISIBLE = 'DESGASTE_VISIBLE',
  DOBLADO = 'DOBLADO',
}

// Enums legales para Auditoría Técnica (no usados en el comercial)
export enum FMIStatus { OFF = 'OFF', ON = 'ON' }
export enum SimLockStatus { LIBRE = 'LIBRE', BLOQUEADO = 'BLOQUEADO' }
export enum BlacklistStatus { LIMPIO = 'LIMPIO', REPORTADO = 'REPORTADO' }

export interface ModeloCapacidad {
  modelo_id: number
  modelo_nombre: string
  capacidad_id: number
  capacidad_nombre: string
}

export interface CuestionarioComercialInput {
  identificacion: ModeloCapacidad | null
  enciende: boolean | null
  carga: boolean | null
  funcional_basico_ok: boolean | null // llamadas, mic, altavoz, cámaras, BT, Wi‑Fi
  battery_health_pct: number | null
  display_image_status: DisplayImageStatus
  glass_status: GlassStatus
  housing_status: HousingStatus
}

export interface GradingParamsPorModelo {
  V_Aplus: number // tope A+
  pp_A: number // 0..1
  pp_B: number // 0..1
  pp_C: number // 0..1
  V_suelo: number
  pr_bateria: number // coste batería
  pr_pantalla: number // coste módulo pantalla
  pr_chasis: number // coste chasis/backglass
}

export interface ResultadoValoracion {
  gate: 'DEFECTUOSO' | 'OK'
  grado_estetico: Grade // A+/A/B/C cuando gate = OK
  V_A: number
  V_B: number
  V_C: number
  V_tope: number
  deducciones: {
    pr_bat: number
    pr_pant: number
    pr_chas: number
    pp_func: number
  }
  oferta: number
}

// Descripción y criterios de cada grado (según documento oficial v1)
export const GRADE_DESCRIPTIONS: Record<Grade, { label: string; criteria: string[] }> = {
  'A+': {
    label: 'Como nuevo',
    criteria: [
      '100% funcional',
      'Sin marcas en la pantalla',
      'Sin marcas en chasis/trasera',
      'Piezas originales / servicio oficial sin avisos',
      'Aspecto "nuevo"',
    ],
  },
  A: {
    label: 'Excelente',
    criteria: [
      '100% funcional',
      'Sin marcas en la pantalla',
      'Micro-marcas leves en chasis',
      'Piezas originales / servicio oficial sin avisos',
    ],
  },
  B: {
    label: 'Muy bueno',
    criteria: [
      '100% funcional',
      'Micro-arañazos/marcas en la pantalla',
      'Marcas visibles leves-moderadas o 1 pequeño picotazo en chasis/trasera',
      'Piezas originales / servicio oficial sin avisos',
    ],
  },
  C: {
    label: 'Correcto',
    criteria: [
      '100% funcional',
      'Arañazos evidentes en la pantalla (sin roturas)',
      'Arañazos notables y/o pequeños abollones en chasis/trasera',
      'Piezas originales / servicio oficial sin avisos',
    ],
  },
  D: {
    label: 'Defectuoso',
    criteria: [
      'No cumple 100% funcional O presenta:',
      '- Pantalla rota o LCD dañado (líneas, manchas, quemados severos)',
      '- Trasera de vidrio rota',
      '- Chasis doblado',
      '- No enciende/no carga',
      '- Fallos críticos (biometría, SIM, llamadas, mic, altavoz, cámara principal)',
      '- Humedad severa',
      '- Piezas no originales/no oficiales con avisos',
    ],
  },
  R: {
    label: 'Reciclaje',
    criteria: [
      'Múltiples fallos críticos simultáneos (≥3)',
      'Daños severos irreparables',
      'Solo valor de componentes para reciclaje',
    ],
  },
}