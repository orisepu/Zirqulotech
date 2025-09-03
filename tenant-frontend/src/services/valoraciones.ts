import api from '@/services/api'

export type ValoracionComercialResponse = {
  oferta: number
  gate: 'OK' | 'DEFECTUOSO'
  grado_estetico: 'A+' | 'A' | 'B' | 'C'
  V_Aplus: number; V_A: number; V_B: number; V_C: number; V_tope: number
  deducciones: { pr_bat: number; pr_pant: number; pr_chas: number; pp_func: number }
  params: {
    V_suelo: number; pp_A: number; pp_B: number; pp_C: number
    pr_bateria: number; pr_pantalla: number; pr_chasis: number
    v_suelo_regla: { value: number; pct: number; min: number; label: string }
  }
  calculo: { V1: number; aplica_pp_func: boolean; V2: number; redondeo5: number; suelo: number; oferta_final: number }
}

export async function postValoracionIphoneComercial(payload: any): Promise<ValoracionComercialResponse> {
  const { data } = await api.post('/api/valoraciones/iphone/comercial/', payload)
  return data
}
