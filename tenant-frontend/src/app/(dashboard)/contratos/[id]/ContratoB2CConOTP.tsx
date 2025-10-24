'use client'

import {  useState } from 'react'
import {
  Box, Button, TextField, Checkbox, FormControlLabel, Stack, Snackbar, Alert, Typography,
  Card, CardHeader, CardContent, Divider, LinearProgress, Grid, Chip, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/services/api'

type DetalleContrato = {
  id: string | number
  dni: string
  email?: string
  telefono?: string
  estado: string
  estado_legible?: string
  kyc_requerido?: boolean
  url_pdf_firmado?: string | null
  firmado?: boolean
  otp_vigente?: boolean
  intentos_restantes?: number
  dias_restantes_otp?: number
  // Flags KYC
  dni_anverso?: string | null
  dni_reverso?: string | null
  // Otros
  pdf?: string | null
}

export default function ContratoB2CConOTP({ contratoId }: { contratoId: string | number }) {
  const [acepto, setAcepto] = useState(false)
  const [otp, setOtp] = useState('')
  const [snack, setSnack] = useState<{open:boolean; msg:string; type:'success'|'error' }>({open:false,msg:'',type:'success'})
  const [openOTP, setOpenOTP] = useState(false)

  // 1) Cargar detalle (usa tu serializer enriquecido)
  const { data: contrato, isLoading, refetch } = useQuery<DetalleContrato>({
    queryKey: ['contrato-b2c', contratoId],
    queryFn: async () => {
      const { data } = await api.get(`/api/b2c/contratos/${contratoId}/`)
      return data
    },
  })

  const kycRequerido = !!contrato?.kyc_requerido
  const tieneAnverso = !!contrato?.dni_anverso
  const tieneReverso = !!contrato?.dni_reverso
  const puedeEnviarOTP = !isLoading && acepto && (!kycRequerido || (tieneAnverso && tieneReverso))

  // 2) Subir imagen DNI (anverso/reverso)
  const subirDNI = useMutation({
    mutationFn: async ({ lado, file }: { lado: 'anverso'|'reverso'; file: File }) => {
      // Validación rápida en cliente
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
        throw new Error('Formato no permitido. Usa JPG/PNG/WEBP.')
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('La imagen supera el tamaño máximo (8MB).')
      }
      const form = new FormData()
      form.append('lado', lado)
      form.append('imagen', file)
      const { data } = await api.post(`/api/b2c/contratos/${contratoId}/subir-dni/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      setSnack({open:true,msg:'Imagen subida correctamente.',type:'success'})
      refetch()
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.detail || e?.message || 'No se pudo subir la imagen'
      setSnack({open:true,msg,type:'error'})
    }
  })

  // 3) Enviar OTP
  const enviarOTP = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/api/b2c/contratos/${contratoId}/enviar-otp/`, {})
      return data
    },
    onSuccess: () => {
      setSnack({open:true,msg:'Código enviado. Revisa tu correo/SMS.',type:'success'})
      setOpenOTP(true)
      refetch()
    },
    onError: (e:any) => {
      const msg = e?.response?.data?.detail || 'No se pudo enviar el código'
      setSnack({open:true,msg,type:'error'})
    },
  })

  // 4) Verificar OTP
  const verificarOTP = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/api/b2c/contratos/${contratoId}/verificar-otp/`, { otp })
      return data
    },
    onSuccess: () => {
      setSnack({open:true,msg:'Contrato firmado con éxito.',type:'success'})
      setOpenOTP(false)
      setOtp('')
      // refresca para obtener url_pdf_firmado
      refetch()
    },
    onError: (e:any) => {
      const msg = e?.response?.data?.detail || 'Código incorrecto o caducado'
      setSnack({open:true,msg,type:'error'})
      refetch()
    },
  })

  const handleFile = (lado: 'anverso'|'reverso') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) subirDNI.mutate({ lado, file })
    e.target.value = '' // reset input
  }

  const bloqueKYC = (
    <Card variant="outlined">
      <CardHeader title="Verificación de identidad (DNI)" />
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{xs:12, md:6}} >
            <Stack direction="row" spacing={2} alignItems="center">
              <Button component="label" variant="outlined" disabled={subirDNI.isPending}>
                Subir anverso
                <input hidden type="file" accept="image/*" onChange={handleFile('anverso')} />
              </Button>
              <Tooltip title={tieneAnverso ? 'Anverso recibido' : 'Pendiente'}>
                <Chip label={tieneAnverso ? 'Anverso ✓' : 'Anverso —'} color={tieneAnverso ? 'success' : 'default'} />
              </Tooltip>
            </Stack>
          </Grid>
          <Grid size={{xs:12, md:6}}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button component="label" variant="outlined" disabled={subirDNI.isPending}>
                Subir reverso
                <input hidden type="file" accept="image/*" onChange={handleFile('reverso')} />
              </Button>
              <Tooltip title={tieneReverso ? 'Reverso recibido' : 'Pendiente'}>
                <Chip label={tieneReverso ? 'Reverso ✓' : 'Reverso —'} color={tieneReverso ? 'success' : 'default'} />
              </Tooltip>
            </Stack>
          </Grid>
        </Grid>
        {kycRequerido && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            KYC requerido: debes subir anverso y reverso antes de enviar el código.
          </Typography>
        )}
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <Box>
        <LinearProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardHeader
          title="Contrato de compra-venta (B2C)"
          subheader={contrato?.estado_legible ? `Estado: ${contrato.estado_legible}` : `Estado: ${contrato?.estado}`}
        />
        <CardContent>
          <Box sx={{ p:2, border:'1px solid', borderColor:'divider', borderRadius:2, maxHeight:260, overflow:'auto', mb:2 }}>
            <Typography variant="body2">
              {/* Aquí puedes renderizar los términos desde API si los traes en contrato_datos */}
              [Términos y condiciones del contrato...]
            </Typography>
          </Box>

          {bloqueKYC}

          <Divider sx={{ my: 2 }} />

          <FormControlLabel
            control={<Checkbox checked={acepto} onChange={e=>setAcepto(e.target.checked)} />}
            label="He leído y acepto las condiciones"
          />

          <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              onClick={() => enviarOTP.mutate()}
              disabled={!puedeEnviarOTP || enviarOTP.isPending || contrato?.firmado}
            >
              Enviar código y firmar
            </Button>

            {!!contrato?.url_pdf_firmado && (
              <Button variant="outlined" href={contrato.url_pdf_firmado} target="_blank" rel="noopener">
                Ver contrato firmado (PDF)
              </Button>
            )}
          </Stack>

          {contrato?.otp_vigente && (
            <Typography variant="caption" sx={{ display:'block', mt:1 }}>
              OTP vigente. Intentos restantes: {contrato?.intentos_restantes ?? '—'} · Días restantes: {contrato?.dias_restantes_otp ?? '—'}
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Diálogo OTP */}
      <Dialog open={openOTP} onClose={() => setOpenOTP(false)}>
        <DialogTitle>Firma con código</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Te hemos enviado un código de 6 dígitos (válido unos minutos).
          </Typography>
          <TextField
            label="Código (6 dígitos)"
            value={otp}
            onChange={e=>setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
            inputProps={{ inputMode:'numeric', pattern:'[0-9]*', maxLength:6 }}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpenOTP(false)}>Cancelar</Button>
          <Button onClick={()=>verificarOTP.mutate()} disabled={otp.length !== 6 || verificarOTP.isPending}>
            Validar y firmar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={()=>setSnack(s=>({...s, open:false}))}>
        <Alert severity={snack.type} variant="filled">{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
