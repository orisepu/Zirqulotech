import type { CatalogoValoracion } from '../../tipos'
import { buildCatalogFor } from '../../catalogos'
import { buildIPadCatalog } from '../../catalogos-ipad'
import {
  buildMacProCatalog,
  buildMacStudioCatalog,
  buildMacMiniCatalog,
  buildMacBookAirCatalog,
  buildMacBookProCatalog,
  buildIMacCatalog,
} from '../../catalogos-mac'
import type { ModeloSerieCapacidad, DispositivoIds } from './auditoriaTypes'

/**
 * Formatea precio en euros con 2 decimales
 */
export const fmtEUR = (n: number): string =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n || 0)

/**
 * Infiere el tipo de dispositivo desde objeto dispositivo
 */
export function inferTipoFromDispositivo(d?: unknown): string {
  const o = d && typeof d === 'object' ? (d as Record<string, unknown>) : undefined
  const modelo = o?.modelo
  const modeloStr =
    typeof modelo === 'string'
      ? modelo
      : typeof (modelo as Record<string, unknown> | undefined)?.nombre === 'string'
        ? ((modelo as Record<string, unknown>).nombre as string)
        : undefined
  const parts = [o?.tipo, o?.modelo_nombre, modeloStr].filter((v): v is string => typeof v === 'string')
  const txt = parts.join(' ').toLowerCase()

  if (txt.includes('ipad')) return 'iPad'
  if (txt.includes('macbook pro')) return 'MacBook Pro'
  if (txt.includes('macbook air')) return 'MacBook Air'
  if (txt.includes('imac')) return 'iMac'
  if (txt.includes('mac pro')) return 'Mac Pro'
  if (txt.includes('mac studio')) return 'Mac Studio'
  if (txt.includes('mac mini')) return 'Mac Mini'
  return 'iPhone' // fallback más común
}

/**
 * Construye catálogo de valoración según tipo de dispositivo
 */
export function buildCatalogByTipo(tipo: string): CatalogoValoracion {
  const t = (tipo || 'iPhone').toLowerCase()
  if (t.includes('ipad')) return buildIPadCatalog()
  if (t.includes('mac pro')) return buildMacProCatalog()
  if (t.includes('mac studio')) return buildMacStudioCatalog()
  if (t.includes('mac mini')) return buildMacMiniCatalog()
  if (t.includes('macbook air')) return buildMacBookAirCatalog()
  if (t.includes('macbook pro')) return buildMacBookProCatalog()
  if (t.includes('imac')) return buildIMacCatalog()
  return buildCatalogFor(tipo || 'iPhone')
}

/**
 * Extrae primer string válido de un objeto dados varios keys
 */
function pickFirstString(obj: unknown, keys: string[]): string | null {
  const o = obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : undefined
  for (const k of keys) {
    const v = o?.[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (v && typeof v === 'object') {
      if (k === 'modelo') {
        const vv = v as Record<string, unknown>
        const cand = (vv.nombre || vv.name || vv.title || vv.display_name) as unknown
        if (typeof cand === 'string' && cand.trim()) return cand.trim()
      }
      if (k.startsWith('capacidad')) {
        const vv = v as Record<string, unknown>
        const cand = (vv.nombre ||
          vv.name ||
          vv.title ||
          vv.display_name ||
          vv.capacidad ||
          vv.gb ||
          vv.storage ||
          vv.size) as unknown
        if (typeof cand === 'string' && cand.trim()) return cand.trim()
        if (typeof cand === 'number' && Number.isFinite(cand)) return String(cand)
      }
    }
  }
  return null
}

/**
 * Normaliza string de capacidad (GB/TB)
 */
function normalizeCapacityString(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return `${raw} GB`
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    if (/[0-9]\s*(gb|tb)$/i.test(s)) return s
    const n = parseFloat(s.replace(',', '.'))
    if (Number.isFinite(n)) return `${n} GB`
    return s
  }
  return null
}

/**
 * Extrae capacidad de dispositivo
 */
function pickCapacity(d: unknown): string | null {
  const c = pickFirstString(d, [
    'capacidad',
    'capacidad_nombre',
    'capacidad_gb',
    'storage',
    'storage_gb',
    'almacenamiento',
    'rom',
    'capacidad_obj',
    'modelo_capacidad',
  ])
  return normalizeCapacityString(c)
}

/**
 * Extrae modelo, serie y capacidad de dispositivo
 */
export function getModeloSerieCapacidad(d: unknown): ModeloSerieCapacidad {
  const modelo = pickFirstString(d, [
    'modelo_nombre',
    'modelo',
    'nombre_modelo',
    'modelo_comercial',
    'modelo_detalle',
  ])
  const serie = pickFirstString(d, ['imei', 'numero_serie', 'sn', 'serial', 'n_serie', 'identificador'])
  const capacidad = pickCapacity(d)
  return { modelo, serie, capacidad }
}

/**
 * Extrae IDs numéricos de modelo y capacidad
 */
export function pickIdsFromDispositivo(d: unknown): DispositivoIds {
  const o = d && typeof d === 'object' ? (d as Record<string, unknown>) : undefined
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v)
      ? v
      : typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))
        ? Number(v)
        : null

  const tryKeys = (obj: any, keys: string[]): number | null => {
    for (const k of keys) {
      const v = obj?.[k]
      const n = num(v)
      if (n !== null) return n
    }
    return null
  }

  // Modelo: intenta múltiples variantes comunes
  const modelo_id =
    tryKeys(o, ['modelo_id', 'model_id', 'modelo', 'model', 'id_modelo']) ??
    num((o?.modelo as any)?.id) ??
    num((o?.modelo as any)?.modelo_id) ??
    num((o as any)?.modeloId) ??
    num((o as any)?.modelId) ??
    num((o as any)?.modelo_obj?.id) ??
    null

  // Capacidad: intenta múltiples variantes comunes
  const capacidad_id =
    tryKeys(o, ['capacidad_id', 'capacity_id', 'capacidad', 'cap', 'cap_id', 'id_capacidad']) ??
    num((o?.capacidad as any)?.id) ??
    num((o as any)?.capacidadId) ??
    num((o as any)?.capacityId) ??
    num((o as any)?.capacidad_obj?.id) ??
    null

  return { modelo_id, capacidad_id }
}

/**
 * Construye título del diálogo de auditoría
 */
export function buildTituloAuditoria(dispositivo: unknown, tituloCustom?: string): string {
  if (tituloCustom) return tituloCustom

  const { modelo, serie, capacidad } = getModeloSerieCapacidad(dispositivo)

  const parts: string[] = []
  if (modelo) parts.push(modelo)
  if (capacidad) parts.push(capacidad)
  if (serie) parts.push(`(${serie})`)

  return parts.length > 0 ? parts.join(' ') : 'Auditoría de dispositivo'
}
