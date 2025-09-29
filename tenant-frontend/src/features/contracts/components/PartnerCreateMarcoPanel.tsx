import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, CardHeader, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography, Divider
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
// import SendToMobileIcon from '@mui/icons-material/SendToMobile'
// import AutorenewIcon from '@mui/icons-material/Autorenew'
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useMutation, useQuery } from '@tanstack/react-query'
import { formatoBonito } from '@/context/precios'
import api from '@/services/api'

// Tipo compartido: usado tanto dentro del componente como en utilidades abajo
type ContratoExistente = {
  id: number
  estado?: string
  estado_legible?: string
  pdf_sha256?: string
  firmado_en?: string
  kyc_token?: string
  url_pdf_firmado?: string
  tiene_dni_anverso?: boolean
  tiene_dni_reverso?: boolean
  kyc_estado?: string
  tipo?: 'acta' | 'marco'
}

type Estimado = {
  modelo: string
  estado_declarado?: string
  precio_provisional?: number | ''
  imei?: string // 👈 nuevo
}

type Props = { oportunidadUUID: string; publicBaseUrl?: string }

export default function PartnerCreateMarcoPanel({ oportunidadUUID, publicBaseUrl }: Props) {
  const [open, setOpen] = useState(false)
  const seeded = useRef(false)
  const [copied, setCopied] = useState(false)
  type CreatedMinimal = { id?: number; pdf_sha256?: string }
  const [created, setCreated] = useState<CreatedMinimal | null>(null)

  const [empresa] = useState({
    nombre: 'PROGEEK S.L.', cif: '', direccion: '', email: '', telefono: '', web: 'https://progeek.es'
  })

  const [cliente, setCliente] = useState({ nombre: '', dni: '', email: '', telefono: '', direccion: '' })
  const [estimados, setEstimados] = useState<Estimado[]>([])
  const [observaciones, setObservaciones] = useState('')
  const [condiciones] = useState<string[]>([
    'Precio sujeto a verificación técnica tras recepción.',
    'Si difiere, se enviará una segunda oferta; si no se acepta, se devolverá el equipo.'
  ])

  const openModal = () => setOpen(true)

  const contratoQ = useQuery({
    queryKey: ['b2c-contrato-por-opp', oportunidadUUID, open],
    queryFn: async () => (await api.get(`/api/b2c/contratos/por-oportunidad/${oportunidadUUID}/`)).data,
    enabled: !!oportunidadUUID && open,
    retry: false,
    meta: { silent: true }
  })
  const existente = contratoQ.data as ContratoExistente | undefined

  const oppQ = useQuery({
    queryKey: ['oportunidad', oportunidadUUID, open],
    queryFn: async () => (await api.get(`/api/oportunidades/${oportunidadUUID}/`)).data,
    enabled: !!oportunidadUUID && open && !existente,
    
  })

  useEffect(() => {
    if (!open || !oppQ.data || existente || seeded.current) return
    const opp = oppQ.data
    const nombre = [opp?.cliente?.nombre, opp?.cliente?.apellidos].filter(Boolean).join(' ').trim() || (opp?.persona_contacto || '')
    const dni    = opp?.cliente?.dni_nie || ''
    const email  = opp?.cliente?.correo || opp?.correo_recogida || ''
    const tel    = opp?.cliente?.telefono || opp?.telefono_contacto || ''
    const direccion = buildAddressFromOpp(opp)
    setCliente({ nombre, dni, email, telefono: tel, direccion })

    type OppDevice = {
      modelo?: { descripcion?: string }
      capacidad?: { tamaño?: string; precio?: unknown }
      estado_valoracion?: string
      estado_fisico?: string
      precio_orientativo?: unknown
    }
    const rows: Estimado[] = Array.isArray(opp?.dispositivos) ? opp.dispositivos.map((d: OppDevice) => ({
      modelo: [d?.modelo?.descripcion, d?.capacidad?.tamaño].filter(Boolean).join(' '),
      estado_declarado: d?.estado_valoracion || d?.estado_fisico || '',
      precio_provisional: parsePrecio(d?.precio_orientativo ?? d?.capacidad?.precio) ?? '',
      imei: '' // 👈 campo editable por el partner
    })) : []
    setEstimados(rows)

    setObservaciones(opp?.instrucciones || '')
    seeded.current = true
  }, [open, oppQ.data, existente])

  const totalProv = useMemo(
    () => estimados.reduce((a, e) => a + (num(e.precio_provisional) || 0), 0),
    [estimados]
  )

  // ---- Validaciones IMEI (front) ----
  const sanitizeIMEI = (v: string) => (v || '').replace(/\D/g, '').slice(0, 15)
  const luhnOk = (digits: string) => {
    // requiere exactamente 15 cifras
    if (!/^\d{15}$/.test(digits)) return false
    let sum = 0
    for (let i = 0; i < 15; i++) {
      let d = Number(digits[14 - i])
      if (i % 2 === 1) {
        d *= 2
        if (d > 9) d -= 9
      }
      sum += d
    }
    return sum % 10 === 0
  }

  const imeis = useMemo(() => estimados.map(e => (e.imei || '').trim()).filter(Boolean), [estimados])
  const dupSet = useMemo(() => {
    const seen = new Map<string, number>()
    const dup = new Set<string>()
    for (const x of imeis) {
      seen.set(x, (seen.get(x) || 0) + 1)
      if ((seen.get(x) || 0) > 1) dup.add(x)
    }
    return dup
  }, [imeis])

  const anyImeiInvalid = useMemo(() => {
    for (const e of estimados) {
      const v = (e.imei || '').trim()
      if (!v) continue // opcional: vacío permitido
      //if (!luhnOk(v)) return true
      if (dupSet.has(v)) return true
    }
    return false
  }, [estimados, dupSet])

  // --- Crear contrato marco ---
  const crearContrato = useMutation({
    mutationFn: async () => {
      const payload = {
        tipo: 'marco',
        oportunidad_id: oportunidadUUID,
        email: cliente.email || undefined,
        telefono: cliente.telefono || undefined,
        dni: cliente.dni,
        contrato_datos: {
          empresa,
          cliente,
          dispositivos_estimados: estimados.map(e => ({
            modelo: e.modelo,
            estado_declarado: e.estado_declarado || undefined,
            precio_provisional: num(e.precio_provisional) || 0,
            imei: (e.imei || '').trim() || undefined, // 👈 guardamos snapshot del IMEI si viene
          })),
          condiciones,
          observaciones: observaciones || undefined,
          total_provisional: totalProv,
        },
      }
      const { data } = await api.post('/api/b2c/contratos/', payload)
      return data
    },
    onSuccess: async (data) => {
      setCreated(data)
      await contratoQ.refetch()
    },
  })

  // --- Acciones sobre contrato existente ---
  const reenviarKyc = useMutation({
    mutationFn: async () => {
      if (!existente?.id) throw new Error('No hay contrato')
      const { data } = await api.post(`/api/b2c/contratos/${existente.id}/reenviar-kyc/`, {
        dias: 7,
        regenerar_token: true
      })
      return data
    },
    onSuccess: () => contratoQ.refetch(),
  })
  const _renovarKyc = useMutation({
    mutationFn: async () => {
      if (!existente?.id) throw new Error('No hay contrato')
      const { data } = await api.post(`/api/b2c/contratos/${existente.id}/renovar-kyc/`, {
        dias: 7,
        regenerar_token: true
      })
      return data
    },
    onSuccess: () => contratoQ.refetch(),
  })
  const _enviarOtp = useMutation({
    mutationFn: async () => {
      if (!existente?.id) throw new Error('No hay contrato')
      const { data } = await api.post(`/api/b2c/contratos/${existente.id}/enviar-otp/`, {})
      return data
    },
  })

  const kycUrlExistente = useMemo(() => {
    if (!existente?.kyc_token) return ''
    const base = publicBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://progeek.es')
    return `${base}/kyc-upload/${existente.kyc_token}`
  }, [existente?.kyc_token, publicBaseUrl])

  function isAxios404(e: unknown): boolean {
    if (typeof e !== 'object' || e === null) return false
    const resp = (e as { response?: { status?: number } }).response
    return !!(resp && resp.status === 404)
  }

  return (
    <>
      <Button variant="contained" onClick={openModal}>Preacuerdo de compra</Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          Preacuerdo de compra
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={() => setOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {contratoQ.isLoading && <Alert severity="info" sx={{ mb: 2 }}>Buscando contrato existente…</Alert>}
          {contratoQ.error && !isAxios404(contratoQ.error) && (
            <Alert severity="error" sx={{ mb: 2 }}>No se pudo comprobar contratos existentes.</Alert>
          )}

          {existente ? (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardHeader title="Contrato" />
                <CardContent>
                  <Stack spacing={2}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" color="text.secondary">Estado:</Typography>
                        <Chip size="small" color="info" label={existente.estado_legible || existente.estado || '—'} />
                        {existente.pdf_sha256 && (
                          <Chip size="small" label={`SHA-256 ${String(existente.pdf_sha256).slice(0,12)}…`} />
                        )}
                        {existente.firmado_en && (
                          <Chip size="small" label={`Firmado: ${formatDate(existente.firmado_en)}`} />
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Documentación:</Typography>
                        {(() => {
                          const ds = getDocsStatus(existente);
                          return (
                            <Tooltip title={ds.tip}>
                              <Chip size="small" color={ds.color} label={ds.label} />
                            </Tooltip>
                          );
                        })()}
                      </Stack>
                
                    <Divider flexItem />

                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Acciones</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {existente.kyc_token && !existente.tiene_dni_anverso && !existente.tiene_dni_reverso && (
                          <Tooltip title={kycUrlExistente}>
                            <span>
                              <Button
                                variant="outlined"
                                startIcon={<ContentCopyIcon />}
                                onClick={async () => {
                                  try { await navigator.clipboard.writeText(kycUrlExistente); setCopied(true); setTimeout(()=>setCopied(false), 1500) } catch {}
                                }}
                              >
                                {copied ? 'Copiado' : 'Copiar enlace'}
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                        {existente.kyc_token && !existente.tiene_dni_anverso && !existente.tiene_dni_reverso && (
                        <Button
                          variant="outlined"
                          startIcon={<MarkEmailReadIcon />}
                          onClick={() => reenviarKyc.mutate()}
                          disabled={reenviarKyc.isPending}
                        >
                          {reenviarKyc.isPending ? 'Reenviando…' : 'Reenviar (email)'}
                        </Button>
                        )}
                        {existente.url_pdf_firmado && (
                          <Button
                            variant="text"
                            startIcon={<OpenInNewIcon />}
                            onClick={async () => {
                              try {
                                const res = await api.get(`/api/b2c/contratos/${existente.id}/pdf-blob/`, {
                                  responseType: 'blob',
                                })
                                const blob = new Blob([res.data], { type: 'application/pdf' })
                                const url = URL.createObjectURL(blob)
                                window.open(url, '_blank')
                                // Evita filtraciones de memoria/reenlaces
                                setTimeout(() => URL.revokeObjectURL(url), 60_000)
                              } catch {
                                // toast opcional
                              }
                            }}
                          >
                            Ver contrato (PDF)
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              
            </>
          ) : (
            <>
              {/* Cliente */}
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardHeader title="Cliente" />
                <CardContent>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 1 }}>
                    <Field label="Nombre" value={cliente.nombre} />
                    <Field label="DNI/NIE" value={cliente.dni} />
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 1 }}>
                    <TextField label="Email" fullWidth value={cliente.email} onChange={(e)=>setCliente({...cliente, email:e.target.value})} />
                    <TextField label="Teléfono" fullWidth value={cliente.telefono} onChange={(e)=>setCliente({...cliente, telefono:e.target.value})} />
                  </Stack>
                  <TextField label="Dirección" fullWidth value={cliente.direccion} onChange={(e)=>setCliente({...cliente, direccion:e.target.value})} />
                </CardContent>
              </Card>

              {/* Dispositivos estimados (con IMEI opcional) */}
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardHeader title="Dispositivos (puedes indicar IMEI si lo conoces)" />
                <CardContent>
                  {estimados.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No hay dispositivos en la oportunidad.</Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Modelo</TableCell>
                          <TableCell>Estado declarado</TableCell>
                          <TableCell width={180}>IMEI (15 dígitos)</TableCell>
                          <TableCell align="right" width={160}>Precio provisional</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {estimados.map((e, i) => {
                          const raw = (e.imei || '').trim()
                          const isEmpty = raw.length === 0
                          const is15 = /^\d{15}$/.test(raw)
                          const valid = isEmpty || (is15 && luhnOk(raw))
                          const dup = !!raw && dupSet.has(raw)
                          const showError = (!isEmpty && !valid) || dup
                          const helper =
                            dup ? 'IMEI repetido en esta oportunidad' :
                            (!isEmpty && !is15) ? 'Debe tener 15 cifras' :
                            (!isEmpty && !luhnOk(raw)) ? 'El IMEI no supera la validación' : ' '

                          return (
                            <TableRow key={i}>
                              <TableCell><Typography variant="body2">{e.modelo || '—'}</Typography></TableCell>
                              <TableCell><Typography variant="body2">{formatoBonito(e.estado_declarado) || '—'}</Typography></TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={raw}
                                  error={showError}
                                  helperText={helper}
                                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 15 }}
                                  onChange={(ev) => {
                                    const val = sanitizeIMEI(ev.target.value)
                                    setEstimados(prev => prev.map((r, idx) => idx === i ? { ...r, imei: val } : r))
                                  }}
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell align="right"><Typography variant="body2">{formatEUR(num(e.precio_provisional) ?? 0)}</Typography></TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
                    <Card variant="outlined" sx={{ px: 2, py: 1, minWidth: 240 }}>
                      <Typography variant="body2">Total provisional</Typography>
                      <Typography variant="h6" sx={{ mt: .5 }}>{formatEUR(totalProv)}</Typography>
                    </Card>
                    <Box sx={{ flex: 1 }} />
                  </Stack>
                  {anyImeiInvalid && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Revisa los IMEIs: deben tener 15 dígitos, pasar la validación y no repetirse dentro de la misma oportunidad.
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Observaciones */}
              <Card variant="outlined">
                <CardHeader title="Observaciones" />
                <CardContent>
                  <TextField
                    fullWidth multiline minRows={2}
                    value={observaciones}
                    onChange={(e)=>setObservaciones(e.target.value)}
                    placeholder="Notas para el contrato (opcional)"
                  />
                </CardContent>
              </Card>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {existente ? (
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          ) : (
            <>
              {created?.id && <Chip label={`ID ${created.id}`} />}
              {created?.pdf_sha256 && <Chip label={`SHA-256: ${String(created.pdf_sha256).slice(0,12)}…`} />}
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => crearContrato.mutate()}
                disabled={crearContrato.isPending || !canCreate(cliente) || anyImeiInvalid}
              >
                {crearContrato.isPending ? 'Creando…' : 'Crear contrato marco'}
              </Button>
              <Button onClick={() => setOpen(false)}>Cerrar</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}

/* ---------- Subcomponentes & utils ---------- */

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 200 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body1">{value || '—'}</Typography>
    </Box>
  )
}
type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'success' | 'info' | 'warning'
function getDocsStatus(c: Partial<ContratoExistente>) {
  const requiereDni = c?.tipo !== 'acta';          // las actas no requieren DNI
  const a = !!c?.tiene_dni_anverso;
  const r = !!c?.tiene_dni_reverso;

  if (!requiereDni) return { label: 'No requerida', color: 'default' as ChipColor, tip: 'Para actas no es necesario DNI.' };
  if (c?.kyc_estado === 'verificado') return { label: 'Verificada', color: 'success' as ChipColor, tip: 'KYC verificado por un agente.' };
  if (a && r) return { label: 'Entregada', color: 'info' as ChipColor, tip: 'Anverso y reverso recibidos.' };
  if (a || r) {
    const falta = a ? 'reverso' : 'anverso';
    return { label: 'Incompleta', color: 'warning' as ChipColor, tip: `Falta ${falta} del DNI.` };
  }
  return { label: 'Faltante', color: 'default' as ChipColor, tip: 'No se han subido imágenes del DNI.' };
}
function num(v: unknown){ if(v===''||v==null) return undefined as number | undefined; const n=Number(v as number | string); return Number.isFinite(n)?n:undefined }
function parsePrecio(v: unknown): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v !== 'string') return undefined
  let s = v.trim().replace(/[€\s]/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    const decSep = lastComma > lastDot ? ',' : '.'
    if (decSep === ',') { s = s.replace(/\./g, ''); s = s.replace(',', '.') }
    else { s = s.replace(/,/g, '') }
  } else if (hasComma) {
    s = s.replace(/\./g, ''); s = s.replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}
function formatEUR(v: number) {
  try {
    const isInt = Math.abs(v - Math.round(v)) < 1e-9
    const fmt = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: isInt ? 0 : 2,
      maximumFractionDigits: isInt ? 0 : 2,
    })
    return fmt.format(v).replace(/\s/g, '')
  } catch {
    const isInt = Math.abs(v - Math.round(v)) < 1e-9
    return isInt ? `${Math.round(v)}€` : `${v.toFixed(2).replace('.', ',')}€`
  }
}
function formatDate(iso?: string){
  if (!iso) return '—'
  try { 
    const d = new Date(iso)
    return d.toLocaleString()
  } catch { 
    return String(iso) 
  }
}
type OppAddress = {
  cliente?: {
    direccion_calle?: string; direccion_piso?: string; direccion_puerta?: string;
    direccion_cp?: string; direccion_poblacion?: string; direccion_provincia?: string; direccion_pais?: string;
  };
  calle?: string; numero?: string; piso?: string; puerta?: string;
  codigo_postal?: string; poblacion?: string; provincia?: string;
}
function buildAddressFromOpp(opp: OppAddress) {
  const c = opp?.cliente || {}
  const parts = [c.direccion_calle, c.direccion_piso, c.direccion_puerta].filter(Boolean).join(' ')
  const loc = [c.direccion_cp, c.direccion_poblacion, c.direccion_provincia].filter(Boolean).join(' ')
  const addr1 = [parts, loc, c.direccion_pais].filter(Boolean).join(', ')
  if (addr1) return addr1
  const p2 = [opp.calle, opp.numero, opp.piso, opp.puerta].filter(Boolean).join(' ')
  const l2 = [opp.codigo_postal, opp.poblacion, opp.provincia].filter(Boolean).join(' ')
  return [p2, l2, 'España'].filter(Boolean).join(', ')
}
function canCreate(c:{dni?:string; email?:string; telefono?:string; direccion?:string}){
  return Boolean(c.dni?.trim() && (c.email?.trim() || c.telefono?.trim()) && c.direccion?.trim())
}
