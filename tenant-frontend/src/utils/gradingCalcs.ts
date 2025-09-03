import { CuestionarioComercialInput, DisplayImageStatus, GlassStatus, HousingStatus, GradingParamsPorModelo, ResultadoValoracion } from '@/types/grading'

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

  const pr_bat = input.battery_health_pct !== null && input.battery_health_pct < 85 ? params.pr_bateria + 35 : 0
  const pr_pant = (input.display_image_status !== DisplayImageStatus.OK || [GlassStatus.DEEP, GlassStatus.CHIP, GlassStatus.CRACK].includes(input.glass_status)) ? params.pr_pantalla + 35 : 0
  const pr_chas = (input.housing_status === HousingStatus.DESGASTE_VISIBLE || input.housing_status === HousingStatus.DOBLADO) ? params.pr_chasis + 35 : 0

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