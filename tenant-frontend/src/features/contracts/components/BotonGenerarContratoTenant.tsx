// src/components/BotonGenerarContratoTenant.tsx
'use client'
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material'
import DescriptionIcon from '@mui/icons-material/Description'
import { useMutation } from '@tanstack/react-query'
import { generarContratoOportunidad, enviarOtpOportunidad, verificarOtpOportunidad } from '@/services/api'
import { useState } from 'react'

export default function BotonGenerarContratoTenant({ oportunidadId, onAfterSuccess }:{
  oportunidadId: string|number, onAfterSuccess?: ()=>void
}) {
  const [openOtp, setOpenOtp] = useState(false)
  const [otp, setOtp] = useState('')

  const mGenerar = useMutation({
    mutationFn: () => generarContratoOportunidad(oportunidadId),
    onSuccess: (data) => {
      if (data?.pdf_url) window.open(data.pdf_url, '_blank', 'noopener,noreferrer')
      onAfterSuccess?.()
    },
    onError: async (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      // Si falta OTP o doc válido, pedimos OTP
      if (status === 428 && /OTP/i.test(detail || '')) {
        await mEnviarOtp.mutateAsync()
        setOpenOtp(true)
      } else if (status === 428 && /Documento/i.test(detail || '')) {
        alert('Falta documento válido (DNI/NIE/CIF). Complétalo antes de generar el contrato.')
      } else {
        alert('No se pudo generar el contrato.')
      }
    }
  })

  const mEnviarOtp = useMutation({
    mutationFn: () => enviarOtpOportunidad(oportunidadId),
  })

  const mVerificarOtp = useMutation({
    mutationFn: () => verificarOtpOportunidad(oportunidadId, otp),
    onSuccess: async () => {
      setOpenOtp(false)
      setOtp('')
      await mGenerar.mutateAsync() // reintenta generación tras OTP ok
    }
  })

  return (
    <>
      <Button
        variant="contained"
        startIcon={<DescriptionIcon />}
        onClick={() => mGenerar.mutate()}
        disabled={mGenerar.isPending}
      >
        {mGenerar.isPending ? 'Generando…' : 'Generar contrato'}
      </Button>

      <Dialog open={openOtp} onClose={() => setOpenOtp(false)}>
        <DialogTitle>Verificación OTP</DialogTitle>
        <DialogContent>
          <TextField
            label="Código OTP"
            value={otp}
            onChange={(e)=>setOtp(e.target.value)}
            autoFocus
            fullWidth
            inputProps={{ inputMode:'numeric', pattern:'[0-9]*', maxLength:6 }}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setOpenOtp(false)}>Cancelar</Button>
          <Button onClick={()=>mVerificarOtp.mutate()} disabled={mVerificarOtp.isPending || otp.length<4}>
            {mVerificarOtp.isPending ? 'Verificando…' : 'Verificar y continuar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
