// src/lib/toastApiError.ts
import type { AxiosError } from 'axios'
import { toast } from 'react-toastify'

const toArray = (v: any) => (Array.isArray(v) ? v : [v])
const label = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

const looksLikeHTML = (s: string) =>
  /^\s*<!doctype html/i.test(s) || /^\s*<html[\s>]/i.test(s) || /<\/[a-z][\s\S]*>/i.test(s)

function toastLines(lines: string[], fallback = '❌ Error en la petición', status?: number) {
  const base = lines.length ? lines.join('\n') : fallback
  const withStatus = status ? `${base} (HTTP ${status})` : base
  toast.error(withStatus, { autoClose: 7000, style: { whiteSpace: 'pre-line' } })
}

function buildMessagesFromData(data: any): string[] {
  const out: string[] = []
  if (!data) return out
  if (data.detail) out.push(String(data.detail))
  if (data.non_field_errors) toArray(data.non_field_errors).forEach((m: any) => out.push(String(m)))
  for (const [k, v] of Object.entries(data)) {
    if (k === 'detail' || k === 'non_field_errors') continue
    toArray(v).forEach((m: any) => out.push(`${label(k)}: ${m}`))
  }
  return out
}

/**
 * Muestra un toast de error evitando volcar HTML (páginas 500/NGINX/Django).
 * Soporta data como string/JSON o Blob (lee el texto y decide).
 */
export function toastApiError(err: unknown, fallback = '❌ Error en la petición') {
  const e = err as AxiosError<any>
  const resp = e?.response

  // Caso Blob (responseType: 'blob'): leemos el texto para decidir
  if (resp?.data instanceof Blob) {
    const ct = resp.headers?.['content-type'] || resp.data.type || ''
    resp.data
      .text()
      .then((text) => {
        if (/text\/html/i.test(ct) || looksLikeHTML(text)) {
          // 🔒 No mostramos HTML del servidor
          toastLines([`❌ Error del servidor`], fallback, resp.status)
          return
        }
        try {
          const json = JSON.parse(text)
          toastLines(buildMessagesFromData(json), fallback, resp.status)
        } catch {
          // Texto plano
          if (looksLikeHTML(text)) {
            toastLines([`❌ Error del servidor`], fallback, resp.status)
          } else {
            toastLines([text.toString?.() ?? ''], fallback, resp.status)
          }
        }
      })
      .catch(() => toastLines([`❌ Error del servidor`], fallback, resp?.status))
    return
  }

  // No-Blob
  const data = resp?.data
  if (!data) {
    toastLines([], fallback, resp?.status)
    return
  }
  if (typeof data === 'string') {
    const ct = resp?.headers?.['content-type'] || ''
    if (/text\/html/i.test(ct) || looksLikeHTML(data)) {
      toastLines([`❌ Error del servidor`], fallback, resp?.status)
    } else {
      toastLines([data], fallback, resp?.status)
    }
    return
  }

  toastLines(buildMessagesFromData(data), fallback, resp?.status)
}
