import api from '@/services/api'

export type ValoracionComercialResponse = {
  oferta: number
  gate: 'OK' | 'DEFECTUOSO'
  grado_estetico: 'A+' | 'A' | 'B' | 'C' | 'D'
  V_Aplus: number; V_A: number; V_B: number; V_C: number; V_tope: number
  deducciones: { pr_bat: number; pr_pant: number; pr_chas: number; pp_func: number }
  params?: {
    V_suelo: number; pp_A: number; pp_B: number; pp_C: number
    pr_bateria: number; pr_pantalla: number; pr_chasis: number
    v_suelo_regla: { value: number; pct: number; min: number; label: string }
  }
  calculo?: { V1: number; aplica_pp_func: boolean; V2: number; redondeo5: number; suelo: number; oferta_final: number }
  // Campos adicionales de respuesta genérica
  tipo_dispositivo?: string
  modelo_id?: number
  capacidad_id?: number
  canal?: string
  tenant?: string
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

// ===== Valoración genérica (todos los dispositivos) =====

/**
 * Valoración comercial genérica que funciona con todos los tipos de dispositivos.
 *
 * @param tipo - Tipo de dispositivo (iPhone, iPad, MacBook Pro, iMac, etc.)
 * @param payload - Datos de valoración (campos varían según tipo)
 * @param tenantHeader - Header de tenant opcional
 * @returns Respuesta de valoración con oferta, gate, grado estético, etc.
 *
 * Endpoints utilizados:
 * 1. /api/valoraciones/{tipo}/comercial/ (con tipo en URL)
 * 2. /api/valoraciones/comercial/ (auto-detecta tipo desde payload)
 */
export async function postValoracionComercial(
  tipo: string | null,
  payload: ValoracionComercialInput,
  tenantHeader?: string
): Promise<ValoracionComercialResponse> {
  const dbg = (...args: any[]) => {
    const on = (typeof window !== 'undefined'
      && (((window as any).__VAL_DEBUG__ === true)
        || (typeof window.localStorage !== 'undefined' && window.localStorage.getItem('VAL_DEBUG') === '1')
        || process.env.NODE_ENV !== 'production'))
    if (on) console.log('[VAL API]', ...args)
  }

  // Construir URL según si tenemos tipo o no
  const url = tipo
    ? `/api/valoraciones/${encodeURIComponent(tipo)}/comercial/`
    : '/api/valoraciones/comercial/'

  // Agregar tipo al payload si no está presente
  const payloadWithTipo = tipo && !(payload as any).tipo
    ? { ...payload, tipo }
    : payload

  try {
    dbg('POST', url, payloadWithTipo)
    const headers = tenantHeader || (payloadWithTipo as any)?.tenant
      ? { 'X-Tenant': tenantHeader || (payloadWithTipo as any)?.tenant }
      : undefined
    const { data } = await api.post(url, payloadWithTipo, headers ? { headers } : undefined)
    dbg('OK', url, data)
    return data
  } catch (e: any) {
    dbg('ERROR', url, e?.response?.status || e?.message, e?.response?.data)
    throw e
  }
}

/**
 * Valoración de auditoría genérica (más completa que comercial).
 * Intenta endpoint de auditoría, cae a comercial como fallback.
 *
 * @param tipo - Tipo de dispositivo
 * @param payload - Datos de valoración
 * @param tenantHeader - Header de tenant opcional
 */
export async function postValoracionAuditoria(
  tipo: string | null,
  payload: ValoracionTecnicaInput,
  tenantHeader?: string
): Promise<ValoracionTecnicaResponse> {
  const dbg = (...args: any[]) => {
    const on = (typeof window !== 'undefined'
      && (((window as any).__AUD_DEBUG__ === true)
        || (typeof window.localStorage !== 'undefined' && window.localStorage.getItem('AUD_DEBUG') === '1')
        || process.env.NODE_ENV !== 'production'))
    if (on) console.log('[AUD API]', ...args)
  }

  // Construir URLs con y sin tipo
  const endpoints = tipo
    ? [
        `/api/valoraciones/${encodeURIComponent(tipo)}/auditoria/`,
        `/api/valoraciones/${encodeURIComponent(tipo)}/comercial/`, // fallback
      ]
    : [
        '/api/valoraciones/auditoria/',
        '/api/valoraciones/comercial/', // fallback
      ]

  const payloadWithTipo = tipo && !(payload as any).tipo
    ? { ...payload, tipo }
    : payload

  let lastError: unknown = null
  for (const url of endpoints) {
    try {
      dbg('POST', url, payloadWithTipo)
      const headers = tenantHeader || (payloadWithTipo as any)?.tenant
        ? { 'X-Tenant': tenantHeader || (payloadWithTipo as any)?.tenant }
        : undefined
      const { data } = await api.post(url, payloadWithTipo, headers ? { headers } : undefined)
      dbg('OK', url, data)
      return data
    } catch (e: any) {
      dbg('ERROR', url, e?.response?.status || e?.message)
      if (e?.response?.status === 404) {
        lastError = e
        continue
      }
      throw e
    }
  }
  throw lastError ?? new Error('No hay endpoint de auditoría/valoración disponible')
}

/**
 * Alias de postValoracionComercial para MacBook
 */
export async function postValoracionMacBookComercial(
  payload: ValoracionComercialInput,
  tenantHeader?: string
): Promise<ValoracionComercialResponse> {
  // Determinar tipo específico desde payload si está disponible
  const tipo = (payload as any).tipo || 'MacBook Pro'
  return postValoracionComercial(tipo, payload, tenantHeader)
}

/**
 * Alias de postValoracionComercial para iMac
 */
export async function postValoracionIMacComercial(
  payload: ValoracionComercialInput,
  tenantHeader?: string
): Promise<ValoracionComercialResponse> {
  return postValoracionComercial('iMac', payload, tenantHeader)
}

/**
 * Alias de postValoracionComercial para iPad
 */
export async function postValoracionIPadComercial(
  payload: ValoracionComercialInput,
  tenantHeader?: string
): Promise<ValoracionComercialResponse> {
  return postValoracionComercial('iPad', payload, tenantHeader)
}
