import { GlassStatus, HousingStatus } from '@/shared/types/grading'
import type { Grade } from '@/shared/types/grading'
import type { EstadoFisico, EstadoFuncional, NivelDesgaste } from '@/shared/utils/gradingCalcs'
import type { EsteticaKey, EsteticaPantallaKey, FuncPantallaValue } from '../../tipos'
import type { BuildDetalladoParams, ValoracionTecnicaDetallada } from './auditoriaTypes'

/**
 * Mapea Grade oficial a clave legacy de precio_por_estado (backend usa claves legacy)
 */
export const gradeToPrecioKey = (grade: Grade): string => {
  const mapping: Record<Grade, string> = {
    'A+': 'excelente',
    'A': 'excelente',
    'B': 'muy_bueno',
    'C': 'bueno',
    'D': 'a_revision',
    'R': 'a_revision',
  }
  return mapping[grade]
}

/**
 * Mapea estados UI de estética a NivelDesgaste
 */
export const MAP_ESTETICA_TO_NIVEL: Record<EsteticaKey, NivelDesgaste> = {
  sin_signos: 'ninguno',
  minimos: 'leve',
  algunos: 'medio',
  desgaste_visible: 'alto',
  agrietado_roto: 'alto',
}

/**
 * Mapea estados UI de estética a GlassStatus oficial (para tabla de grading)
 */
export const MAP_ESTETICA_TO_GLASS: Record<EsteticaPantallaKey, GlassStatus> = {
  sin_signos: GlassStatus.NONE,
  minimos: GlassStatus.MICRO,
  algunos: GlassStatus.VISIBLE,
  desgaste_visible: GlassStatus.VISIBLE,
  agrietado_roto: GlassStatus.CRACK,
  astillado: GlassStatus.CHIP,
}

/**
 * Mapea estados UI de estética a HousingStatus oficial (para tabla de grading)
 */
export const MAP_ESTETICA_TO_HOUSING: Record<EsteticaKey, HousingStatus> = {
  sin_signos: HousingStatus.SIN_SIGNOS,
  minimos: HousingStatus.MINIMOS,
  algunos: HousingStatus.ALGUNOS,
  desgaste_visible: HousingStatus.DESGASTE_VISIBLE,
  agrietado_roto: HousingStatus.DOBLADO,
}

/**
 * Construye objeto detallado de valoración desde parámetros de UI
 */
export function buildDetalladoFromUI(params: BuildDetalladoParams): ValoracionTecnicaDetallada {
  const salud_bateria_pct =
    typeof params.saludBateria === 'number' && Number.isFinite(params.saludBateria)
      ? params.saludBateria
      : null

  const ciclos_bateria =
    typeof params.ciclosBateria === 'number' && Number.isFinite(params.ciclosBateria)
      ? params.ciclosBateria
      : null

  // Pantalla funcional: si hay issues, es error_hardware
  const pantalla_funcional_puntos_bril = params.pantallaIssues.includes('puntos_brillantes')
  const pantalla_funcional_pixeles_muertos = params.pantallaIssues.includes('pixeles_muertos')
  const pantalla_funcional_lineas_quemaduras = params.pantallaIssues.includes('lineas_quemaduras')

  const hayIssuePantalla =
    pantalla_funcional_puntos_bril ||
    pantalla_funcional_pixeles_muertos ||
    pantalla_funcional_lineas_quemaduras

  // Energía
  const enciende = params.enciende
  const carga = params.cargaOk

  // Funcionalidad básica: todos checks deben ser true
  const funcional_basico_ok =
    params.funcChecks.every((c) => c === true) ? true : params.funcChecks.some((c) => c === false) ? false : null

  // Estado funcional: lógica de prioridad (V1 style)
  let estado_funcional: EstadoFuncional = 'funciona'
  if (enciende === false) {
    estado_funcional = 'no_enciende'
  } else if (params.estadoPantalla === 'agrietado_roto') {
    estado_funcional = 'pantalla_rota'
  } else if (hayIssuePantalla || funcional_basico_ok === false) {
    estado_funcional = 'otros'
  }

  // Estética pantalla → glass_status
  const glass_status = params.estadoPantalla
    ? MAP_ESTETICA_TO_GLASS[params.estadoPantalla]
    : GlassStatus.NONE

  // Housing status = peor entre laterales y trasera
  const worstHousing = (() => {
    const lados = params.estadoLados ? MAP_ESTETICA_TO_HOUSING[params.estadoLados] : HousingStatus.SIN_SIGNOS
    const espalda = params.estadoEspalda ? MAP_ESTETICA_TO_HOUSING[params.estadoEspalda] : HousingStatus.SIN_SIGNOS

    const orden = [
      HousingStatus.DOBLADO,
      HousingStatus.DESGASTE_VISIBLE,
      HousingStatus.ALGUNOS,
      HousingStatus.MINIMOS,
      HousingStatus.SIN_SIGNOS,
    ]
    for (const nivel of orden) {
      if (lados === nivel || espalda === nivel) return nivel
    }
    return HousingStatus.SIN_SIGNOS
  })()

  // Estado físico (legacy) desde estética
  const desgaste_lateral = params.estadoLados ? MAP_ESTETICA_TO_NIVEL[params.estadoLados] : 'ninguno'
  const desgaste_trasero = params.estadoEspalda ? MAP_ESTETICA_TO_NIVEL[params.estadoEspalda] : 'ninguno'

  const nivelMax = (a: NivelDesgaste, b: NivelDesgaste): NivelDesgaste => {
    const orden: NivelDesgaste[] = ['ninguno', 'leve', 'medio', 'alto']
    const iA = orden.indexOf(a)
    const iB = orden.indexOf(b)
    return iA > iB ? a : b
  }
  const maxNivel = nivelMax(desgaste_lateral, desgaste_trasero)

  let estado_fisico: EstadoFisico = 'regular'
  if (maxNivel === 'ninguno') estado_fisico = 'perfecto'
  else if (maxNivel === 'leve') estado_fisico = 'bueno'
  else if (maxNivel === 'medio') estado_fisico = 'regular'
  else estado_fisico = 'dañado'

  return {
    glass_status,
    housing_status: worstHousing,
    estado_fisico,
    estado_funcional,
    desgaste_lateral,
    desgaste_trasero,
    salud_bateria_pct,
    ciclos_bateria,
    pantalla_funcional_puntos_bril,
    pantalla_funcional_pixeles_muertos,
    pantalla_funcional_lineas_quemaduras,
    enciende,
    carga,
    funcional_basico_ok,
  }
}

/**
 * Mapea grado backend a Grade frontend
 */
export function mapBackendGradeToFrontend(
  grado?: string,
  gate?: string
): Grade | null {
  if (!grado) return null
  if (gate && gate !== 'OK') return 'D'

  if (grado === 'A+') return 'A+'
  if (grado === 'A') return 'A'
  if (grado === 'B') return 'B'
  if (grado === 'C') return 'C'
  if (grado === 'D') return 'D'
  if (grado === 'R') return 'R'

  return 'D' // fallback conservador
}
