'use client'

import { useState,useEffect } from 'react'
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Stack, TextField, Typography, Alert, IconButton, CircularProgress } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import api from '@/services/api'
import { useMutation } from '@tanstack/react-query'

type Props = {
  oportunidadId?: number | string
  clienteId?: number | string
  defaultEmail?: string
  defaultTelefono?: string
  defaultDni?: string
  kycRequerido?: boolean
  variant?: 'text' | 'outlined' | 'contained'
  size?: 'small' | 'medium' | 'large'
  onFirmado?: (data: { pdf?: string; sha256?: string }) => void
}

type Contrato = {
  id: number
  email?: string
  telefono?: string
  dni?: string
  kyc_token?: string
  estado?: string
}

export default function BotonContratoB2C({
  oportunidadId,
  clienteId,
  defaultEmail = '',
  defaultTelefono = '',
  defaultDni = '',
  kycRequerido = true,
  variant = 'contained',
  size = 'small',
  onFirmado,
}: Props) {
  const [open, setOpen] = useState(false)
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [email, setEmail] = useState(defaultEmail)
  const [telefono, setTelefono] = useState(defaultTelefono)
  const [dni, setDni] = useState(defaultDni)
  const [otp, setOtp] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function buscarContratoAbierto(
    oportunidadId?: number | string,
    clienteIdToSearch?: number | string
  ): Promise<Contrato | null> {
    if (!oportunidadId && !clienteIdToSearch) return null
    const params = new URLSearchParams()
    if (oportunidadId) params.append('oportunidad', String(oportunidadId))
    if (clienteIdToSearch) params.append('cliente', String(clienteIdToSearch))
    params.append('ordering', '-creado_en')

    try {
      const { data } = await api.get(`/api/b2c/contratos/?${params.toString()}`)
      const lista = (Array.isArray(data) ? data : (data?.results || [])) as Array<Partial<Contrato>>
      const abierto = lista.find((c) => c?.estado !== 'firmado' && c?.estado !== 'finalizado')
      return (abierto as Contrato) || null
    } catch (err) {
      console.warn('No se pudo recuperar contrato abierto', err)
      return null
    }
  }
  const crearContrato = useMutation({
    mutationFn: async () => {
      setError(null)
      type CrearPayload = {
        email?: string
        telefono?: string
        dni?: string
        kyc_requerido: boolean
        oportunidad_id?: number | string
        cliente_id?: number | string
      }
      const payload: CrearPayload = {
        email: email || undefined,
        telefono: telefono || undefined,
        dni: dni?.toUpperCase() || undefined,
        kyc_requerido: kycRequerido,
        // si quieres vincularlo:
        oportunidad_id: oportunidadId,
        cliente_id: clienteId,
      }
      const { data } = await api.post('/api/b2c/contratos/', payload)
      return data as Contrato
    },
    onSuccess: (data) => {
      if (data && typeof data.id === 'number') {
        setContrato(data)
      } else {
        setError('Contrato inválido devuelto por la API')
      }
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'No se pudo crear el contrato')
    },
  })

  const reenviarKyc = useMutation({
    mutationFn: async () => {
      if (!contrato?.id) return
      setError(null)
      await api.post(`/api/b2c/contratos/kyc/${contrato.id}/reenviar-kyc/`, {
        dias: 3,
        regenerar_token: true,
        email: email || contrato.email,
      })
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'No se pudo reenviar el KYC')
    },
  })

  const enviarOtp = useMutation({
    mutationFn: async () => {
      if (!contrato?.id) return
      setError(null)
      await api.post(`/api/b2c/contratos/${contrato.id}/enviar-otp/`)
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Error al enviar OTP')
    },
  })

  const verificarOtp = useMutation({
    mutationFn: async () => {
      if (!contrato?.id) return
      setError(null)
      const { data } = await api.post(`/api/b2c/contratos/${contrato.id}/verificar-otp/`, { otp })
      setPdfUrl(data?.pdf || null)
      onFirmado?.({ pdf: data?.pdf, sha256: data?.sha256 })
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'OTP incorrecto')
    },
  })

  const kycLink =
    contrato?.kyc_token
      ? `${process.env.NEXT_PUBLIC_FRONTEND_BASE_URL?.replace(/\/$/, '') || ''}/kyc-upload/${contrato.kyc_token}`
      : null
  useEffect(() => {
    if (!open || contrato) return
    ;(async () => {
      const c = await buscarContratoAbierto(oportunidadId, clienteId)
      if (c && typeof c.id === 'number') {
        setContrato(c)
      }
    })()
  }, [open, contrato, oportunidadId, clienteId])
  const canCreate = !!dni && (!!email || !!telefono)

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        Iniciar contrato (B2C)
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Contrato B2C · KYC + OTP</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {!contrato && (
              <>
                <Typography variant="body2">Introduce los datos del cliente (mínimo DNI y email o teléfono):</Typography>
                <Stack direction="row" spacing={1}>
                  <TextField label="DNI/NIE" value={dni} onChange={(e) => setDni(e.target.value)} fullWidth />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
                  <TextField label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} fullWidth />
                </Stack>
                {error && <Alert severity="error">{error}</Alert>}
              </>
            )}

            {contrato && (
              <>
                <Alert severity="info">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      Enlace KYC (móvil): {kycLink || '—'}
                    </Typography>
                    {kycLink && (
                      <IconButton
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(kycLink)
                            setCopied(true)
                            setTimeout(() => setCopied(false), 1200)
                          } catch {}
                        }}
                        size="small"
                      >
                        {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                      </IconButton>
                    )}
                  </Stack>
                </Alert>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={() => reenviarKyc.mutate()}
                    disabled={reenviarKyc.isPending}
                  >
                    {reenviarKyc.isPending ? 'Reenviando…' : 'Reenviar KYC'}
                  </Button>

                  <Button
                    variant="contained"
                    onClick={() => enviarOtp.mutate()}
                    disabled={enviarOtp.isPending}
                  >
                    {enviarOtp.isPending ? 'Enviando OTP…' : 'Enviar OTP'}
                  </Button>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Código OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    sx={{ flex: 1 }}
                  />
                  <Button
                    variant="contained"
                    onClick={() => verificarOtp.mutate()}
                    disabled={!otp || verificarOtp.isPending}
                  >
                    {verificarOtp.isPending ? 'Verificando…' : 'Verificar'}
                  </Button>
                </Stack>

                {pdfUrl && (
                  <Alert severity="success" action={
                    <Button size="small" variant="outlined" onClick={() => window.open(pdfUrl!, '_blank')}>
                      Abrir PDF
                    </Button>
                  }>
                    Contrato firmado correctamente.
                  </Alert>
                )}

                {error && <Alert severity="error">{error}</Alert>}
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          {!contrato ? (
            <Button
              variant="contained"
              onClick={() => crearContrato.mutate()}
              disabled={!canCreate || crearContrato.isPending}
              startIcon={crearContrato.isPending ? <CircularProgress size={16} /> : undefined}
            >
              {crearContrato.isPending ? 'Creando…' : 'Crear contrato'}
            </Button>
          ) : (
            <Button onClick={() => setOpen(false)}>Cerrar</Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  )
}
