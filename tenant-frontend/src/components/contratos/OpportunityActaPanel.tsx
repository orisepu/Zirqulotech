import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Chip,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SendToMobileIcon from '@mui/icons-material/SendToMobile'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
// import CheckIcon from '@mui/icons-material/Check'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/services/api' // ⚠️ usa tu axios interno autenticado

/**
 * Panel para generar un ACTA de recepción desde la vista de Oportunidad.
 * Flujo esperado (backend):
 * - GET   /api/b2c/contratos/{marcoId}/ → leer estado del contrato MARCO
 * - POST  /api/b2c/contratos/{marcoId}/generar-acta/ → crea el ACTA (child) con dispositivos, total, observaciones
 * - POST  /api/b2c/contratos/{actaId}/enviar-otp/ → envía OTP para firmar el ACTA
 * - POST  /api/b2c/contratos/{actaId}/verificar-otp/ → firma (desde pública)
 *
 * Props mínimos: id del contrato marco (firmado) y opcionalmente la URL base pública
 */
export type ActaDevice = {
  descripcion: string
  imei?: string
  serie?: string
  estado?: string
  precio?: number | ''
}

export type OpportunityActaPanelProps = {
  contratoMarcoId: number
  publicBaseUrl?: string // p.ej. 'https://progeek.es' (fallback: window.location.origin)
}

type ActaMinimal = {
  id: number
  estado?: string
  kyc_token?: string
  contrato_datos?: { total?: number } | null
}

export default function OpportunityActaPanel({ contratoMarcoId, publicBaseUrl }: OpportunityActaPanelProps) {
  const [rows, setRows] = useState<ActaDevice[]>([emptyRow()])
  const [obs, setObs] = useState('')
  const [lastActa, setLastActa] = useState<ActaMinimal | null>(null)
  const [copied, setCopied] = useState(false)

  // --- Datos del contrato marco ---
  const marcoQ = useQuery({
    queryKey: ['b2c-contrato', contratoMarcoId],
    queryFn: async () => {
      const { data } = await api.get(`/api/b2c/contratos/${contratoMarcoId}/`)
      return data as {
        id: number
        estado: string
        pdf_sha256?: string
        contrato_datos?: Record<string, unknown>
        email?: string
        telefono?: string
        tipo?: 'marco' | 'acta'
      }
    },
  })

  const total = useMemo(() =>
    rows.reduce((acc, r) => acc + (toNumber(r.precio) || 0), 0),
    [rows]
  )

  const canGenerate = useMemo(() => {
    if (!rows.length) return false
    const validRow = (r: ActaDevice) =>
      !!r.descripcion && (Boolean(r.imei) || Boolean(r.serie)) && (toNumber(r.precio) || 0) > 0
    return rows.every(validRow) && (marcoQ.data?.estado === 'firmado')
  }, [rows, marcoQ.data?.estado])

  // --- Mutación: generar acta ---
  const generarActa = useMutation({
    mutationFn: async () => {
      const payload = {
        dispositivos: rows.map(r => ({
          descripcion: r.descripcion,
          imei: r.imei || undefined,
          serie: r.serie || undefined,
          estado: r.estado || undefined,
          precio: toNumber(r.precio) || 0,
        })),
        total,
        observaciones: obs || undefined,
      }
      const { data } = await api.post(`/api/b2c/contratos/${contratoMarcoId}/generar-acta/`, payload)
      return data
    },
    onSuccess: (data) => setLastActa(data),
  })

  // --- Mutación: enviar OTP del acta creada ---
  const enviarOtp = useMutation({
    mutationFn: async () => {
      if (!lastActa?.id) throw new Error('No hay acta creada todavía.')
      const { data } = await api.post(`/api/b2c/contratos/${lastActa.id}/enviar-otp/`, {})
      return data
    },
  })

  const kycUrl = useMemo(() => {
    const base = publicBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://progeek.es')
    const token = lastActa?.kyc_token
    return token ? `${base}/b2c/kyc/${token}` : '' // ajusta si usas otra ruta pública
  }, [lastActa?.kyc_token, publicBaseUrl])

  return (
    <Card variant="outlined">
      <CardHeader
        title="Acta de recepción"
        subheader={marcoQ.isLoading ? 'Cargando contrato marco…' : (
          marcoQ.data?.estado === 'firmado' ? 'Contrato marco firmado ✔' : 'El contrato marco debe estar firmado'
        )}
        action={marcoQ.data?.pdf_sha256 && (
          <Chip size="small" label={`SHA-256 marco: ${marcoQ.data.pdf_sha256.slice(0,12)}…`} />
        )}
      />
      <CardContent>
        {marcoQ.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            No se pudo cargar el contrato marco.
          </Alert>
        )}

        {/* Editor de dispositivos */}
        <Typography variant="subtitle2" gutterBottom>
          Dispositivos auditados
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell style={{width: '30%'}}>Descripción</TableCell>
              <TableCell>IMEI</TableCell>
              <TableCell>Nº serie</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right" style={{width: 140}}>Precio (€)</TableCell>
              <TableCell align="center" style={{width: 48}}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>
                  <TextField fullWidth size="small" placeholder="iPhone 12 128GB"
                    value={r.descripcion}
                    onChange={(e) => updateRow(i, { descripcion: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <TextField fullWidth size="small" placeholder="IMEI"
                    value={r.imei || ''}
                    onChange={(e) => updateRow(i, { imei: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <TextField fullWidth size="small" placeholder="Nº serie"
                    value={r.serie || ''}
                    onChange={(e) => updateRow(i, { serie: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <TextField fullWidth size="small" placeholder="Estado (Bueno, Muy bueno…)"
                    value={r.estado || ''}
                    onChange={(e) => updateRow(i, { estado: e.target.value })}
                  />
                </TableCell>
                <TableCell align="right">
                  <TextField fullWidth size="small" placeholder="0,00" inputMode="decimal"
                    value={priceInput(r.precio)}
                    onChange={(e) => updateRow(i, { precio: parseLocaleNumber(e.target.value) })}
                  />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="Eliminar fila">
                    <span>
                      <IconButton size="small" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={6}>
                <Button startIcon={<AddIcon />} onClick={() => setRows(r => [...r, emptyRow()])}>
                  Añadir dispositivo
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <TextField
            label="Observaciones"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            multiline minRows={2} fullWidth
          />
          <Card sx={{ px: 2, py: 1, minWidth: 220 }} variant="outlined">
            <Typography variant="body2">Total</Typography>
            <Typography variant="h6" sx={{ mt: .5 }}>{formatEUR(total)}</Typography>
            <Divider sx={{ my: 1 }} />
            <Button
              variant="contained"
              disabled={!canGenerate || generarActa.isPending}
              onClick={() => generarActa.mutate()}
              startIcon={<PictureAsPdfIcon />}
            >
              {generarActa.isPending ? 'Generando…' : 'Generar acta'}
            </Button>
          </Card>
        </Stack>

        {/* Resultado */}
        {lastActa && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="success" sx={{ mb: 2 }}>
              Acta creada correctamente (ID {lastActa.id}). Total {formatEUR(lastActa?.contrato_datos?.total ?? total)}.
            </Alert>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
              <Chip label={`Estado: ${lastActa.estado || 'pendiente'}`} />
              {lastActa.kyc_token && <Chip label={`KYC token: ${lastActa.kyc_token}`} />}
              <Box sx={{ flex: 1 }} />
              {lastActa.kyc_token && (
                <>
                  <Button
                    variant="outlined"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(kycUrl)
                        setCopied(true); setTimeout(() => setCopied(false), 1500)
                      } catch {}
                    }}
                    startIcon={<ContentCopyIcon />}
                  >
                    {copied ? 'Copiado' : 'Copiar enlace público'}
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => enviarOtp.mutate()}
                    startIcon={<SendToMobileIcon />}
                    disabled={enviarOtp.isPending}
                  >
                    {enviarOtp.isPending ? 'Enviando OTP…' : 'Enviar OTP del acta'}
                  </Button>
                </>
              )}
            </Stack>
          </Box>
        )}

      </CardContent>
    </Card>
  )

  // --- helpers ---
  function updateRow(i: number, patch: Partial<ActaDevice>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  function removeRow(i: number) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }
}

// Utils
function emptyRow(): ActaDevice {
  return { descripcion: '', imei: '', serie: '', estado: '', precio: '' }
}
function toNumber(v: unknown): number | undefined {
  if (v === '' || v === undefined || v === null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
function formatEUR(v: number) {
  try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v) } catch { return `${v} €` }
}
function priceInput(v: number | '' | undefined) {
  if (v === '' || v === undefined) return ''
  return String(v)
}
function parseLocaleNumber(s: string) {
  if (!s) return ''
  // Permite comas o puntos
  const norm = s.replace(/\./g, '').replace(',', '.')
  const n = Number(norm)
  return Number.isFinite(n) ? n : ''
}
