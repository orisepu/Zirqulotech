import { useMemo } from 'react'
import { GlassStatus, HousingStatus } from '@/shared/types/grading'
import type { Grade } from '@/shared/types/grading'
import { gradoEsteticoDesdeTabla } from '@/shared/utils/gradingCalcs'
import type { EsteticaKey, EsteticaPantallaKey, FuncPantallaValue } from '../../tipos'
import type { ValoracionTecnicaResponse } from '@/services/valoraciones'
import {
  gradeToPrecioKey,
  buildDetalladoFromUI,
  mapBackendGradeToFrontend,
} from '../utils/auditoriaMappers'
import type { BuildDetalladoParams } from '../utils/auditoriaTypes'

// Defaults de deducciones (si no vienen del backend)
const PR_BATERIA_DEFAULT = 20
const PR_PANTALLA_DEFAULT = 40
const PR_CHASIS_DEFAULT = 15

interface UseGradingEngineParams {
  // Estado UI
  saludBateria: number | ''
  ciclosBateria: number | ''
  pantallaIssues: FuncPantallaValue[]
  estadoPantalla: EsteticaPantallaKey | ''
  estadoLados: EsteticaKey | ''
  estadoEspalda: EsteticaKey | ''
  enciende: boolean | null
  cargaOk: boolean | null
  funcChecks: Array<boolean | null>

  // Precios por estado
  precio_por_estado?: Record<string, number>

  // Backend valoración (opcional)
  valoracionTecnica?: ValoracionTecnicaResponse | null

  // Costes de reparación adicionales
  costoReparacion?: number

  // Deducciones manuales (null = usar automáticas)
  deduccionBateriaManual?: number | null
  deduccionPantallaManual?: number | null
  deduccionChasisManual?: number | null

  // Gates
  isSecurityKO?: boolean

  // Flag de edición manual
  editadoPorUsuario?: boolean

  // Grado manual (override)
  gradoManual?: Grade | null
}

interface UseGradingEngineResult {
  // Grado calculado
  grado: Grade

  // Precio final calculado
  precioFinal: number | null

  // Deducciones aplicadas
  deducciones: {
    bateria: number
    pantalla: number
    chasis: number
  }

  // Estado detallado (para persistir)
  estadoDetallado: ReturnType<typeof buildDetalladoFromUI>

  // Base antes de deducciones
  precioBase: number | undefined
}

/**
 * Hook que centraliza toda la lógica de grading y pricing
 */
export function useGradingEngine(params: UseGradingEngineParams): UseGradingEngineResult {
  const {
    saludBateria,
    ciclosBateria,
    pantallaIssues,
    estadoPantalla,
    estadoLados,
    estadoEspalda,
    enciende,
    cargaOk,
    funcChecks,
    precio_por_estado,
    valoracionTecnica,
    costoReparacion = 0,
    deduccionBateriaManual = null,
    deduccionPantallaManual = null,
    deduccionChasisManual = null,
    isSecurityKO = false,
    editadoPorUsuario = false,
    gradoManual = null,
  } = params

  // Construir estado detallado desde UI
  const estadoDetallado = useMemo(() => {
    const buildParams: BuildDetalladoParams = {
      saludBateria,
      ciclosBateria,
      pantallaIssues,
      estadoPantalla,
      estadoLados,
      estadoEspalda,
      enciende,
      cargaOk,
      funcChecks,
    }
    return buildDetalladoFromUI(buildParams)
  }, [
    saludBateria,
    ciclosBateria,
    pantallaIssues,
    estadoPantalla,
    estadoLados,
    estadoEspalda,
    enciende,
    cargaOk,
    funcChecks,
  ])

  // Calcular grado
  const grado = useMemo<Grade>(() => {
    // Gate 1: Seguridad → D (rechazo)
    if (isSecurityKO) return 'D'

    // Usar backend si disponible
    const gradoBackend = mapBackendGradeToFrontend(
      valoracionTecnica?.grado_estetico,
      valoracionTecnica?.gate
    )
    if (gradoBackend) return gradoBackend

    // Calcular local usando tabla oficial
    const gradoEsteticoLocal =
      estadoDetallado.glass_status && estadoDetallado.housing_status
        ? gradoEsteticoDesdeTabla(estadoDetallado.glass_status, estadoDetallado.housing_status)
        : 'C' // fallback conservador

    // Gate 2: Defectuoso → D
    const esDefectuoso =
      estadoDetallado.estado_funcional !== 'funciona' ||
      estadoDetallado.pantalla_funcional_lineas_quemaduras ||
      estadoDetallado.glass_status === GlassStatus.CRACK ||
      estadoDetallado.glass_status === GlassStatus.DEEP ||
      estadoDetallado.glass_status === GlassStatus.CHIP ||
      estadoDetallado.housing_status === HousingStatus.DOBLADO

    return esDefectuoso ? 'D' : gradoEsteticoLocal
  }, [isSecurityKO, valoracionTecnica, estadoDetallado])

  // Calcular deducciones
  const deducciones = useMemo(() => {
    const bat = estadoDetallado.salud_bateria_pct
    const hasPantIssue = Boolean(pantallaIssues.length) || estadoPantalla === 'agrietado_roto' || estadoPantalla === 'astillado'
    const worstExt: EsteticaKey = (() => {
      const arr = [estadoLados, estadoEspalda].filter(Boolean) as EsteticaKey[]
      if (arr.includes('agrietado_roto')) return 'agrietado_roto'
      if (arr.includes('desgaste_visible')) return 'desgaste_visible'
      if (arr.includes('algunos')) return 'algunos'
      if (arr.includes('minimos')) return 'minimos'
      return 'sin_signos'
    })()

    const backendDeducciones = valoracionTecnica?.deducciones

    // Calcular deducción automática de batería
    const bateriaAuto = backendDeducciones
      ? backendDeducciones.pr_bat
      : bat !== null && bat < 85
        ? PR_BATERIA_DEFAULT
        : 0

    // Calcular deducción automática de pantalla
    const pantallaAuto = backendDeducciones
      ? backendDeducciones.pr_pant
      : hasPantIssue
        ? PR_PANTALLA_DEFAULT
        : 0

    // Calcular deducción automática de chasis
    const chasisAuto = backendDeducciones
      ? backendDeducciones.pr_chas
      : worstExt === 'desgaste_visible' || worstExt === 'agrietado_roto'
        ? PR_CHASIS_DEFAULT
        : 0

    // Usar manual si existe, sino usar automático
    const bateria = deduccionBateriaManual !== null ? deduccionBateriaManual : bateriaAuto
    const pantalla = deduccionPantallaManual !== null ? deduccionPantallaManual : pantallaAuto
    const chasis = deduccionChasisManual !== null ? deduccionChasisManual : chasisAuto

    return { bateria, pantalla, chasis }
  }, [
    estadoDetallado,
    pantallaIssues,
    estadoPantalla,
    estadoLados,
    estadoEspalda,
    valoracionTecnica,
    deduccionBateriaManual,
    deduccionPantallaManual,
    deduccionChasisManual,
  ])

  // Calcular precio base
  const precioBase = useMemo<number | undefined>(() => {
    if (!precio_por_estado) return undefined

    // Usar grado manual si existe, sino el calculado
    const gradoParaPrecio = gradoManual ?? grado

    if (gradoParaPrecio !== 'D') {
      return precio_por_estado[gradeToPrecioKey(gradoParaPrecio)]
    }

    // D defectuoso: aplicar reglas espejo simplificadas
    const gradeFromEst = (k: EsteticaKey | EsteticaPantallaKey | ''): Grade => {
      if (k === 'desgaste_visible') return 'C'
      if (k === 'algunos') return 'B'
      if (k === 'astillado') return 'B' // astillado tratado como B
      return 'A+'
    }

    const hasPantIssue = Boolean(pantallaIssues.length) || estadoPantalla === 'agrietado_roto' || estadoPantalla === 'astillado'

    // Determinar peor estado exterior
    const arr = [estadoLados, estadoEspalda].filter(Boolean) as EsteticaKey[]
    let worstExt: EsteticaKey = 'sin_signos'
    if (arr.includes('agrietado_roto')) worstExt = 'agrietado_roto'
    else if (arr.includes('desgaste_visible')) worstExt = 'desgaste_visible'
    else if (arr.includes('algunos')) worstExt = 'algunos'
    else if (arr.includes('minimos')) worstExt = 'minimos'

    const estPant = gradeFromEst(estadoPantalla || '')
    const estExt = gradeFromEst(worstExt)
    const pantalla = estadoPantalla as EsteticaPantallaKey | ''
    const dByPantalla = hasPantIssue || pantalla === 'agrietado_roto' || pantalla === 'astillado'
    const dByChasis = worstExt === 'desgaste_visible' || worstExt === 'agrietado_roto'

    let pick: Grade
    if (dByPantalla && !dByChasis) {
      pick = estExt
    } else if (!dByPantalla && dByChasis) {
      pick = estPant
    } else {
      pick = [estPant, estExt].includes('C') ? 'C' : [estPant, estExt].includes('B') ? 'B' : 'A+'
    }

    return precio_por_estado[gradeToPrecioKey(pick)]
  }, [grado, gradoManual, precio_por_estado, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda])

  // Calcular precio final con lógica de precio suelo
  const precioFinal = useMemo<number | null>(() => {
    // Detectar si hay deducciones manuales aplicadas
    const hayDeduccionesManuales =
      deduccionBateriaManual !== null ||
      deduccionPantallaManual !== null ||
      deduccionChasisManual !== null ||
      costoReparacion > 0

    if (isSecurityKO) return 0
    if (editadoPorUsuario) return null // no sobrescribir si editado manualmente

    // Usar backend solo si NO hay deducciones manuales
    // (porque el backend no recalcula con deducciones manuales)
    if (valoracionTecnica && !hayDeduccionesManuales) {
      const oferta = Number(valoracionTecnica.oferta)
      return Math.max(0, oferta - costoReparacion)
    }

    // Calcular local (cuando hay deducciones manuales o no hay backend)
    if (typeof precioBase !== 'undefined') {
      const totalDeducciones = deducciones.bateria + deducciones.pantalla + deducciones.chasis
      const precioConDeducciones = Number(precioBase) - totalDeducciones - costoReparacion

      // Aplicar precio suelo (floor price): precio final = max(precio_calculado, v_suelo, 0)
      // Intentar múltiples ubicaciones donde puede estar v_suelo
      const vSuelo =
        precio_por_estado?.v_suelo ??
        precio_por_estado?.V_suelo ??
        (precio_por_estado as any)?.params?.V_suelo ??
        (precio_por_estado as any)?.params?.v_suelo ??
        (precio_por_estado as any)?.calculo?.suelo ??
        0

      return Math.max(precioConDeducciones, vSuelo, 0)
    }

    return null
  }, [
    isSecurityKO,
    editadoPorUsuario,
    valoracionTecnica,
    precioBase,
    deducciones,
    costoReparacion,
    precio_por_estado,
    deduccionBateriaManual,
    deduccionPantallaManual,
    deduccionChasisManual,
  ])

  return {
    grado,
    precioFinal,
    deducciones,
    estadoDetallado,
    precioBase,
  }
}
