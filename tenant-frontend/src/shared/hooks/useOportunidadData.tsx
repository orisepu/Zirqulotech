'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import { toast } from 'react-toastify'
import { AxiosError } from 'axios'

const _toArray = (v: unknown) => Array.isArray(v) ? v : [v]
const _label = (k: string) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) // codigo_postal -> Codigo Postal

export function toastApiError(err: unknown, fallback = '❌ Error en la petición') {
  const e = err as AxiosError<unknown>
  const data = e?.response?.data
  const msgs: string[] = []

  if (!data) {
    msgs.push(fallback)
  } else if (typeof data === 'string') {
    msgs.push(data)
  } else if (typeof data === 'object' && data !== null) {
    const d = data as { detail?: unknown; non_field_errors?: unknown } & Record<string, unknown>
    if (d.detail !== undefined) msgs.push(String(d.detail))
    if (d.non_field_errors !== undefined) msgs.push(..._toArray(d.non_field_errors).map(String))
    for (const [k, v] of Object.entries(d)) {
      if (k === 'detail' || k === 'non_field_errors') continue
      _toArray(v).forEach(m => msgs.push(`${_label(k)}: ${String(m)}`))
    }
    if (!msgs.length) msgs.push(fallback)
  }

  toast.error(
    msgs.length > 1
      ? (<div><ul style={{margin: 0, paddingLeft: '1.2rem'}}>{msgs.map((m,i)=><li key={i}>{m}</li>)}</ul></div>)
      : msgs[0]
  , { autoClose: 7000 })
}

export const oportunidadKeys = {
  root: (id: string | number) => ['oportunidad', id] as const,
  transiciones: (id: string | number) => ['oportunidad', id, 'transiciones-validas'] as const,
  historial: (id: string | number) => ['oportunidad', id, 'historial'] as const,
  reales: (id: string | number) => ['oportunidad', id, 'dispositivos-reales'] as const,
}
export function useOportunidadData(id: string | number) {
  const qc = useQueryClient()
  
  const oportunidad = useQuery({
    queryKey: ['oportunidad', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/api/oportunidades/${id}/`)).data,
    staleTime: 0,
  })

  const transiciones = useQuery({
    queryKey: ['transiciones-validas', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/api/oportunidades/${id}/transiciones-validas/`)).data,
  })

  const historial = useQuery({
    queryKey: ['historial', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/api/oportunidades/${id}/historial/`)).data,
  })

  const modelos = useQuery({
    queryKey: ['modelos'],
    enabled: !!id,
    queryFn: async () => (await api.get('/api/modelos/')).data,
  })

  const capacidades = useQuery({
    queryKey: ['capacidades'],
    enabled: !!id,
    queryFn: async () => (await api.get('/api/capacidades/')).data,
  })

  const reales = useQuery({
    queryKey: ['dispositivos-reales', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/api/oportunidades/${id}/dispositivos-reales/`)).data,
  })

  type PatchPayload = Record<string, unknown>
  const guardarEstado = useMutation({
    mutationFn: async (payload: PatchPayload) => api.patch(`/api/oportunidades/${id}/`, payload),
    onSuccess: () => {
      toast.success('Estado actualizado')
      qc.invalidateQueries({ queryKey: ['oportunidad', id] })
      qc.invalidateQueries({ queryKey: ['transiciones-validas', id] })
    },
    onError: () => toast.error('❌ Error al cambiar el estado'),
  })

  const enviarComentario = useMutation({
    mutationFn: async (texto: string) => {
      const opp: any | undefined = oportunidad.data as any | undefined
      const pk = typeof opp?.id === 'number' ? opp.id : Number(id)
      if (!Number.isFinite(pk)) throw new Error('ID de oportunidad no numérico para comentarios')
      return api.post('/api/comentarios-oportunidad/', { oportunidad: pk, texto })
    },
    onSuccess: () => {
      toast.success('Comentario añadido')
      qc.invalidateQueries({ queryKey: ['oportunidad', id] })
      qc.invalidateQueries({ queryKey: ['historial', id] })
    },
    onError: () => toast.error('❌ Error al añadir comentario'),
  })

  const eliminarDispositivo = useMutation({
    mutationFn: async (dispositivoId: number) => api.delete(`/api/dispositivos/${dispositivoId}/`),
    onSuccess: () => {
      toast.success('Dispositivo eliminado')
      qc.invalidateQueries({ queryKey: ['oportunidad', id] })
    },
    onError: () => toast.error('❌ Error al eliminar el dispositivo.'),
  })

  const guardarRecogida = useMutation({
    mutationFn: async (payload: PatchPayload) => api.patch(`/api/oportunidades/${id}/`, payload),
    onSuccess: () => {
      toast.success('Datos de recogida actualizados')
      qc.invalidateQueries({ queryKey: ['oportunidad', id] })
    },
    onError: () => toast.error('❌ Error al guardar los datos'),
  })

  const generarPDF = useMutation({
    mutationFn: async () => {
      const opp: any | undefined = oportunidad.data as any | undefined
      const candidates = [opp?.id, id, opp?.uuid, opp?.hashid].filter(Boolean)
      let lastError: unknown = null
      for (const ident of candidates) {
        try {
          const res = await api.get(`/api/oportunidades/${ident}/generar-pdf/`, { responseType: 'blob' })
          return res.data
        } catch (e: any) {
          // Si es 404 probamos con el siguiente identificador; para otros errores, propagamos
          if (e?.response?.status === 404) { lastError = e; continue }
          throw e
        }
      }
      throw lastError ?? new Error('No se pudo generar el PDF')
    },
    onSuccess: (data) => {
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      toast.success('PDF generado')
    },
    onError: () => toast.error('❌ Error al generar el PDF'),
  })

  const subirFactura = useMutation({
    mutationFn: async (file: File) => {
      const opp: any | undefined = oportunidad.data as any | undefined
      const pk = typeof opp?.id === 'number' ? opp.id : Number(id)
      if (!Number.isFinite(pk)) throw new Error('ID de oportunidad no numérico para facturas')
      const fd = new FormData()
      fd.append('archivo', file)
      fd.append('oportunidad', String(pk))
      await api.post('/api/facturas/subir/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      toast.success('✅ Factura subida correctamente')
      qc.invalidateQueries({ queryKey: ['oportunidad', id] })
    },
    onError: () => toast.error('❌ Error al subir la factura'),
  })

  const descargarDocumento = async (docId: number) => {
    const res = await api.get(`/api/documentos/${docId}/descargar/`, { responseType: 'blob' })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  const verDocumentoURL = useMutation({
    mutationFn: async (docId: number) =>
      (await api.get(`/api/documentos/${docId}/descargar/`, { responseType: 'blob' })).data,
  })
  const refetchTodo = () => {
    qc.invalidateQueries({ queryKey: oportunidadKeys.root(id) })
    qc.invalidateQueries({ queryKey: oportunidadKeys.historial(id) })
    qc.invalidateQueries({ queryKey: oportunidadKeys.reales(id) })
  }

  return {
    oportunidad, transiciones, historial, modelos, capacidades, reales,
    guardarEstado, enviarComentario, eliminarDispositivo, guardarRecogida,
    generarPDF, subirFactura, descargarDocumento, verDocumentoURL,refetchTodo,oportunidadKeys
  }
}
