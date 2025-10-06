import {
  CuestionarioComercialInput,
  DisplayImageStatus,
  GlassStatus,
  HousingStatus,
  GradingParamsPorModelo,
  ResultadoValoracion,
  GradingOutcome,
  FMIStatus,
  SimLockStatus,
  BlacklistStatus,
  type Grade,
} from '@/shared/types/grading'

/**
 * Detecta si un dispositivo debe ser RECHAZADO (fuera de grading) por motivos legales/seguridad
 * según documento oficial (línea 27, 194, 362)
 */
export function detectarRechazo(input: {
  fmi_status?: FMIStatus
  sim_lock?: SimLockStatus
  blacklist?: BlacklistStatus
  mdm_active?: boolean
}): GradingOutcome | null {
  if (input.fmi_status === FMIStatus.ON) {
    return {
      status: 'REJECTED',
      reason: 'FMI_ON',
      mensaje: 'Bloqueo de activación (FMI) activo. Activar protocolo de desactivación remota.',
    }
  }
  if (input.blacklist === BlacklistStatus.REPORTADO) {
    return {
      status: 'REJECTED',
      reason: 'BLACKLIST',
      mensaje: 'IMEI/serie reportado/robado o con deuda. No se procesa.',
    }
  }
  if (input.sim_lock === SimLockStatus.BLOQUEADO) {
    return {
      status: 'REJECTED',
      reason: 'SIM_LOCKED',
      mensaje: 'SIM bloqueado por operador. Requiere desbloqueo.',
    }
  }
  if (input.mdm_active === true) {
    return {
      status: 'REJECTED',
      reason: 'MDM_ACTIVE',
      mensaje: 'MDM/Supervisión activo. Requiere desbloqueo corporativo.',
    }
  }
  return null // No rechazado
}

/**
 * Detecta si un dispositivo debe clasificarse como grado R (Reciclaje)
 * según documento oficial (línea 49, 357, 370)
 *
 * Criterios:
 * - Múltiples fallos críticos simultáneos (≥3)
 * - Daños severos irreparables
 * - Solo valor de componentes para reciclaje
 */
export function detectarReciclaje(
  input: CuestionarioComercialInput,
  tipo?: string
): boolean {
  const capabilities = getDeviceCapabilities(tipo)

  // Conteo de fallos críticos
  const fallosCriticos: boolean[] = []

  // 1. No enciende (siempre crítico)
  if (input.enciende === false) fallosCriticos.push(true)

  // 2. No carga (crítico si tiene batería)
  if (capabilities.hasBattery && input.carga === false) fallosCriticos.push(true)

  // 3. Display dañado (crítico si tiene pantalla)
  if (capabilities.hasDisplay && input.display_image_status && input.display_image_status !== DisplayImageStatus.OK) {
    fallosCriticos.push(true)
  }

  // 4. Cristal agrietado severo (crítico si tiene pantalla)
  if (capabilities.hasDisplay && input.glass_status === GlassStatus.CRACK) {
    fallosCriticos.push(true)
  }

  // 5. Chasis doblado (siempre crítico)
  if (input.housing_status === HousingStatus.DOBLADO) fallosCriticos.push(true)

  // 6. Fallo funcional básico (siempre crítico)
  if (input.funcional_basico_ok === false) fallosCriticos.push(true)

  // Si tiene ≥3 fallos críticos → Reciclaje
  return fallosCriticos.filter(Boolean).length >= 3
}

/**
 * Configuración de capacidades por tipo de dispositivo
 */
export interface DeviceCapabilities {
  hasBattery: boolean
  hasDisplay: boolean
}

export function getDeviceCapabilities(tipo?: string): DeviceCapabilities {
  if (!tipo) return { hasBattery: true, hasDisplay: true }

  const tipoLower = tipo.toLowerCase()

  // Dispositivos sin batería ni pantalla (desktop sin display integrado)
  if (tipoLower.includes('mac pro') || tipoLower.includes('mac studio') || tipoLower.includes('mac mini')) {
    return { hasBattery: false, hasDisplay: false }
  }

  // Dispositivos con pantalla pero sin batería (desktop con display)
  if (tipoLower.includes('imac')) {
    return { hasBattery: false, hasDisplay: true }
  }

  // Dispositivos con batería y pantalla (portátiles, móviles, tablets)
  return { hasBattery: true, hasDisplay: true }
}

export function pasaGatesComercial(
  input: CuestionarioComercialInput,
  tipo?: string
): { gate: ResultadoValoracion['gate'] } {
  const capabilities = getDeviceCapabilities(tipo)

  // Gate básico: enciende
  if (input.enciende === false) return { gate: 'DEFECTUOSO' }

  // Gate de carga: solo si tiene batería
  if (capabilities.hasBattery && input.carga === false) return { gate: 'DEFECTUOSO' }

  // Gates de pantalla: solo si tiene pantalla integrada
  if (capabilities.hasDisplay) {
    if (input.display_image_status && input.display_image_status !== DisplayImageStatus.OK) {
      return { gate: 'DEFECTUOSO' }
    }
    if (input.glass_status && [GlassStatus.DEEP, GlassStatus.CHIP, GlassStatus.CRACK].includes(input.glass_status)) {
      return { gate: 'DEFECTUOSO' }
    }
  }

  // Gate de housing: todos los dispositivos
  if (input.housing_status === HousingStatus.DOBLADO) return { gate: 'DEFECTUOSO' }

  // Gate funcional: todos los dispositivos
  if (input.funcional_basico_ok === false) return { gate: 'DEFECTUOSO' }

  return { gate: 'OK' }
}

export function gradoEsteticoDesdeTabla(glass: GlassStatus, housing: HousingStatus): 'A+' | 'A' | 'B' | 'C' {
  if (glass === GlassStatus.NONE && housing === HousingStatus.SIN_SIGNOS) return 'A+'
  if ((glass === GlassStatus.NONE || glass === GlassStatus.MICRO) && (housing === HousingStatus.MINIMOS || housing === HousingStatus.SIN_SIGNOS)) return 'A'
  if ((glass === GlassStatus.VISIBLE || glass === GlassStatus.MICRO) && (housing === HousingStatus.ALGUNOS || housing === HousingStatus.MINIMOS)) return 'B'
  return 'C'
}

export function topesDesdeV(V_Aplus: number, pp_A: number, pp_B: number, pp_C: number) {
  const V_A = Math.round(V_Aplus * (1 - pp_A))
  const V_B = Math.round(V_A * (1 - pp_B))
  const V_C = Math.round(V_B * (1 - pp_C))
  return { V_A, V_B, V_C }
}

// Interfaz extendida para incluir parámetros de seguridad (auditoría técnica)
export interface CuestionarioConSeguridad extends CuestionarioComercialInput {
  fmi_status?: FMIStatus
  blacklist?: BlacklistStatus
  sim_lock?: SimLockStatus
  mdm_active?: boolean
}

export function calcularOferta(
  input: CuestionarioComercialInput | CuestionarioConSeguridad,
  params: GradingParamsPorModelo,
  pp_func: number, // % único por fallo funcional declarado en comercial (si lo hubiera)
  tipo?: string // Tipo de dispositivo para determinar capacidades
): ResultadoValoracion & { rechazo?: GradingOutcome; esReciclaje?: boolean } {
  const capabilities = getDeviceCapabilities(tipo)

  // 1. VERIFICAR RECHAZO (legal/seguridad) - prioridad máxima
  const inputConSeguridad = input as CuestionarioConSeguridad
  const rechazo = detectarRechazo({
    fmi_status: inputConSeguridad.fmi_status,
    blacklist: inputConSeguridad.blacklist,
    sim_lock: inputConSeguridad.sim_lock,
    mdm_active: inputConSeguridad.mdm_active,
  })

  if (rechazo) {
    // Dispositivo RECHAZADO (fuera de grading): devolver con oferta 0
    return {
      gate: 'DEFECTUOSO',
      grado_estetico: 'D',
      V_A: 0,
      V_B: 0,
      V_C: 0,
      V_tope: 0,
      deducciones: { pr_bat: 0, pr_pant: 0, pr_chas: 0, pp_func: 0 },
      oferta: 0,
      rechazo, // Información del rechazo
    }
  }

  // 2. VERIFICAR RECICLAJE (≥3 fallos críticos)
  const esReciclaje = detectarReciclaje(input, tipo)
  if (esReciclaje) {
    // Grado R: valor de suelo (solo componentes)
    return {
      gate: 'DEFECTUOSO',
      grado_estetico: 'R',
      V_A: 0,
      V_B: 0,
      V_C: 0,
      V_tope: params.V_suelo,
      deducciones: { pr_bat: 0, pr_pant: 0, pr_chas: 0, pp_func: 0 },
      oferta: params.V_suelo,
      esReciclaje: true,
    }
  }

  // 3. LÓGICA NORMAL (A+, A, B, C, D)
  const { gate } = pasaGatesComercial(input, tipo)
  const { V_A, V_B, V_C } = topesDesdeV(params.V_Aplus, params.pp_A, params.pp_B, params.pp_C)

  let V_tope = params.V_Aplus
  let grado_estetico: ResultadoValoracion['grado_estetico'] = 'C'

  if (gate === 'OK') {
    // Para dispositivos con pantalla, usar glass_status; sino, usar housing solo
    const glass = capabilities.hasDisplay && input.glass_status ? input.glass_status : GlassStatus.NONE
    const housing = input.housing_status || HousingStatus.SIN_SIGNOS
    grado_estetico = gradoEsteticoDesdeTabla(glass, housing)
    V_tope = grado_estetico === 'A+' ? params.V_Aplus : grado_estetico === 'A' ? V_A : grado_estetico === 'B' ? V_B : V_C
  } else {
    // Gate DEFECTUOSO: asignar grado D explícitamente
    grado_estetico = 'D'

    // Lógica de grado D: evaluar dimensiones sanas para calcular V_tope
    const pantallaOk = capabilities.hasDisplay
      ? (input.glass_status && [GlassStatus.NONE, GlassStatus.MICRO, GlassStatus.VISIBLE].includes(input.glass_status) &&
         input.display_image_status === DisplayImageStatus.OK)
      : true // Si no tiene pantalla, siempre OK para esta dimensión

    const chasisOk = ![HousingStatus.DOBLADO].includes(input.housing_status || HousingStatus.SIN_SIGNOS)

    if (!pantallaOk && chasisOk) V_tope = params.V_Aplus
    else if (pantallaOk && !chasisOk) V_tope = V_B
    else V_tope = Math.min(params.V_Aplus, V_A, V_B, V_C)
  }

  // Deducciones (solo aplicar si el dispositivo tiene esa característica)
  // Batería: solo si tiene batería
  const pr_bat = capabilities.hasBattery && input.battery_health_pct !== null && input.battery_health_pct !== undefined && input.battery_health_pct < 85
    ? params.pr_bateria
    : 0

  // Pantalla: solo si tiene pantalla
  const pr_pant = capabilities.hasDisplay && (
    (input.display_image_status && input.display_image_status !== DisplayImageStatus.OK) ||
    (input.glass_status && [GlassStatus.DEEP, GlassStatus.CHIP, GlassStatus.CRACK].includes(input.glass_status))
  ) ? params.pr_pantalla : 0

  // Chasis: todos los dispositivos
  const pr_chas = (input.housing_status === HousingStatus.DESGASTE_VISIBLE || input.housing_status === HousingStatus.DOBLADO)
    ? params.pr_chasis
    : 0

  let V1 = V_tope - (pr_bat + pr_pant + pr_chas)
  if (!Number.isFinite(V1)) V1 = 0
  const V2 = (gate === 'OK' && input.funcional_basico_ok === true) ? V1 : Math.round(V1 * (1 - pp_func))
  const oferta = Math.max(Math.round(V2 / 5) * 5, params.V_suelo, 0)

  return { gate, grado_estetico, V_A, V_B, V_C, V_tope, deducciones: { pr_bat, pr_pant, pr_chas, pp_func }, oferta }
}

// Suelo dinámico basado en V_Aplus, con horquillas y redondeo a múltiplos de 5€
export function vSueloDesdeMax(V_Aplus: number): number {
  const bands = [
    /*     hasta   %min   €mín */
    { to: 100,     pct: 0.20, min: 10 },
    { to: 200,     pct: 0.18, min: 15 },
    { to: 300,     pct: 0.15, min: 20 },
    { to: 500,     pct: 0.12, min: 25 },
    { to: 800,     pct: 0.10, min: 35 },
    { to: Infinity,pct: 0.08, min: 50 },
  ]
  const band = bands.find(b => V_Aplus < b.to)!;
  const raw = Math.max(band.min, Math.round(V_Aplus * band.pct))
  return Math.round(raw / 5) * 5 // coherente con el redondeo general
}

// (Opcional) si quieres mostrar en la telemetría qué regla aplicó:
export function vSueloReglaInfo(V_Aplus: number) {
  const bands = [
    { to: 100,     pct: 0.20, min: 10, label: '<100: 20% / min 10€' },
    { to: 200,     pct: 0.18, min: 15, label: '100–199: 18% / min 15€' },
    { to: 300,     pct: 0.15, min: 20, label: '200–299: 15% / min 20€' },
    { to: 500,     pct: 0.12, min: 25, label: '300–499: 12% / min 25€' },
    { to: 800,     pct: 0.10, min: 35, label: '500–799: 10% / min 35€' },
    { to: Infinity,pct: 0.08, min: 50, label: '>=800: 8% / min 50€' },
  ]
  const band = bands.find(b => V_Aplus < b.to)!;
  const value = vSueloDesdeMax(V_Aplus)
  return { value, pct: band.pct, min: band.min, label: band.label }
}

// ===== Auditoría: estado derivado simple (compat con componentes) =====
export type NivelDesgaste = 'ninguno' | 'leve' | 'medio' | 'alto';
export type EstadoFisico = 'perfecto' | 'bueno' | 'aceptable' | 'dañado' | string;
export type EstadoFuncional = 'funciona' | 'no_enciende' | 'pantalla_rota' | 'otros' | string;
export interface BaseValoracionInput {
  estado_fisico?: EstadoFisico;
  estado_funcional?: EstadoFuncional;
  salud_bateria_pct?: number | null;
  ciclos_bateria?: number | null;
  pantalla_funcional_puntos_bril?: boolean;
  pantalla_funcional_pixeles_muertos?: boolean;
  pantalla_funcional_lineas_quemaduras?: boolean;
  desgaste_lateral?: NivelDesgaste;
  desgaste_trasero?: NivelDesgaste;
}
export function calcularEstadoDetallado(input: BaseValoracionInput): 'excelente' | 'muy_bueno' | 'bueno' | 'a_revision' {
  const { estado_fisico, estado_funcional } = input;
  if (estado_fisico === 'dañado') return 'a_revision';
  if (estado_funcional === 'no_enciende' || estado_funcional === 'pantalla_rota') return 'a_revision';
  if (estado_funcional && estado_funcional !== 'funciona') return 'a_revision';
  if (input.pantalla_funcional_lineas_quemaduras) return 'a_revision';
  let score = 100;
  const bat = Number.isFinite(input.salud_bateria_pct ?? NaN) ? (input.salud_bateria_pct as number) : null;
  if (bat !== null) {
    if (bat < 70) score -= 35;
    else if (bat < 75) score -= 25;
    else if (bat < 80) score -= 10;
    else if (bat < 85) score -= 5;
  }
  const penaliza = (n?: NivelDesgaste) => (n === 'alto' ? 15 : n === 'medio' ? 8 : n === 'leve' ? 3 : 0);
  score -= penaliza(input.desgaste_lateral);
  score -= penaliza(input.desgaste_trasero);
  if (input.pantalla_funcional_puntos_bril) score -= 5;
  if (input.pantalla_funcional_pixeles_muertos) score -= 5;
  if (estado_fisico === 'perfecto' && estado_funcional === 'funciona') score += 3;
  if (score >= 90) return 'excelente';
  if (score >= 80) return 'muy_bueno';
  if (score >= 65) return 'bueno';
  return 'a_revision';
}

// ===== Funciones de mapeo: Grados Comerciales ↔ Estados Legacy =====

/**
 * Convierte estados legacy (perfecto/bueno/regular/dañado + funciona/no_enciende/etc)
 * a grados comerciales (A+/A/B/C/D/R)
 *
 * Basado en el mapeo del documento oficial y la lógica de precios.ts
 */
export function legacyToGrade(fisico: string, funcional: string): Grade {
  const criticos = ['no_enciende', 'pantalla_rota', 'error_hardware']

  // Fallos críticos → D (Defectuoso)
  if (fisico === 'dañado' || criticos.includes(funcional)) return 'D'

  // Estados funcionales completos → grados por estética
  if (funcional === 'funciona') {
    if (fisico === 'perfecto') return 'A+' // Como nuevo
    if (fisico === 'bueno') return 'A' // Excelente
    if (fisico === 'regular') return 'B' // Muy bueno
    // Si no es ninguno de los anteriores, es 'aceptable' o similar → C
    return 'C' // Correcto
  }

  // Otros casos → C (Correcto) o D si hay problemas
  return 'C'
}

/**
 * Convierte grados comerciales (A+/A/B/C/D/R) a estados legacy
 * (perfecto/bueno/regular/dañado + funciona/no_enciende/etc)
 *
 * Nota: Esta conversión es aproximada porque los grados comerciales son más específicos.
 * Se pierde información en la conversión.
 */
export function gradeToLegacy(grade: Grade): { fisico: string; funcional: string } {
  const map: Record<Grade, { fisico: string; funcional: string }> = {
    'A+': { fisico: 'perfecto', funcional: 'funciona' },
    A: { fisico: 'bueno', funcional: 'funciona' },
    B: { fisico: 'regular', funcional: 'funciona' },
    C: { fisico: 'regular', funcional: 'funciona' },
    D: { fisico: 'dañado', funcional: 'no_enciende' },
    R: { fisico: 'dañado', funcional: 'no_enciende' },
  }
  return map[grade]
}
