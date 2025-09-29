import { CuestionarioComercialInput, DisplayImageStatus, GlassStatus, HousingStatus, GradingParamsPorModelo, ResultadoValoracion } from '@/shared/types/grading'

export function pasaGatesComercial(input: CuestionarioComercialInput): { gate: ResultadoValoracion['gate'] } {
  // Sin chequeos legales: sólo energía, pantalla/cristal, chasis, funcional básico
  if (input.enciende === false || input.carga === false) return { gate: 'DEFECTUOSO' }
  if (input.display_image_status !== DisplayImageStatus.OK) return { gate: 'DEFECTUOSO' }
  if ([GlassStatus.DEEP, GlassStatus.CHIP, GlassStatus.CRACK].includes(input.glass_status)) return { gate: 'DEFECTUOSO' }
  if (input.housing_status === HousingStatus.DOBLADO) return { gate: 'DEFECTUOSO' }
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

export function calcularOferta(
  input: CuestionarioComercialInput,
  params: GradingParamsPorModelo,
  pp_func: number // % único por fallo funcional declarado en comercial (si lo hubiera)
): ResultadoValoracion {
  const { gate } = pasaGatesComercial(input)
  const { V_A, V_B, V_C } = topesDesdeV(params.V_Aplus, params.pp_A, params.pp_B, params.pp_C)

  let V_tope = params.V_Aplus
  let grado_estetico: ResultadoValoracion['grado_estetico'] = 'C'

  if (gate === 'OK') {
    grado_estetico = gradoEsteticoDesdeTabla(input.glass_status, input.housing_status)
    V_tope = grado_estetico === 'A+' ? params.V_Aplus : grado_estetico === 'A' ? V_A : grado_estetico === 'B' ? V_B : V_C
  } else {
    const pantallaOk = [GlassStatus.NONE, GlassStatus.MICRO, GlassStatus.VISIBLE].includes(input.glass_status) && input.display_image_status === DisplayImageStatus.OK
    const chasisOk = ![HousingStatus.DOBLADO].includes(input.housing_status)
    if (!pantallaOk && chasisOk) V_tope = params.V_Aplus
    else if (pantallaOk && !chasisOk) V_tope = V_B
    else V_tope = Math.min(params.V_Aplus, V_A, V_B, V_C)
  }

  // Los costes de params ya incluyen MO (horas*tarifa + fija) desde backend
  const pr_bat = input.battery_health_pct !== null && input.battery_health_pct < 85 ? params.pr_bateria : 0
  const pr_pant = (input.display_image_status !== DisplayImageStatus.OK || [GlassStatus.DEEP, GlassStatus.CHIP, GlassStatus.CRACK].includes(input.glass_status)) ? params.pr_pantalla : 0
  const pr_chas = (input.housing_status === HousingStatus.DESGASTE_VISIBLE || input.housing_status === HousingStatus.DOBLADO) ? params.pr_chasis : 0

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
