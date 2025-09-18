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

export type ValoracionComercialInput = Record<string, unknown>
export async function postValoracionIphoneComercial(payload: ValoracionComercialInput): Promise<ValoracionComercialResponse> {
  const { data } = await api.post('/api/valoraciones/iphone/comercial/', payload)
  return data
}

// ===== Auditoría técnica (iPhone) =====
// Reutilizamos el mismo shape de respuesta del backend técnico (equivalente al comercial)
export type ValoracionTecnicaResponse = ValoracionComercialResponse
export type ValoracionTecnicaInput = Record<string, unknown>

// Intenta varios endpoints comunes para auditoría técnica y cae al primero que responda 2xx
export async function postValoracionIphoneAuditoria(payload: ValoracionTecnicaInput, tenantHeader?: string): Promise<ValoracionTecnicaResponse> {
  const dbg = (...args: any[]) => {
    const on = (typeof window !== 'undefined'
      && (((window as any).__AUD_DEBUG__ === true)
        || (typeof window.localStorage !== 'undefined' && window.localStorage.getItem('AUD_DEBUG') === '1')
        || process.env.NODE_ENV !== 'production'
        || process.env.NEXT_PUBLIC_AUD_DEBUG === '1'))
    if (on) console.log('[AUD API]', ...args)
  }
  const endpoints = [
    '/api/valoraciones/iphone/auditoria/',
    // fallback
    '/api/valoraciones/iphone/comercial/',
  ] as const
  let lastError: unknown = null
  for (const url of endpoints) {
    try {
      dbg('POST', url, payload)
      const { data } = await api.post(url, payload, tenantHeader || (payload as any)?.tenant ? { headers: { 'X-Tenant': tenantHeader || (payload as any)?.tenant } } : undefined)
      dbg('OK', url, data)
      return data
    } catch (e: any) {
      // si es 404 probamos el siguiente; otros errores propagamos
      dbg('ERROR', url, e?.response?.status || e?.message)
      if (e?.response?.status === 404) { lastError = e; continue }
      throw e
    }
  }
  throw lastError ?? new Error('No hay endpoint de auditoría disponible')
}
