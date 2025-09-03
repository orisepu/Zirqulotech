'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box, Button, Typography, Alert, Card, CardHeader, CardContent, Chip, Stack, Divider,
  Checkbox, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import dynamic from 'next/dynamic'

import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PhotoCameraFrontIcon from '@mui/icons-material/PhotoCameraFront'
import PhotoCameraBackIcon from '@mui/icons-material/PhotoCameraBack'
import apiPublic from '@/services/apiPublic'
import CircularProgress from '@mui/material/CircularProgress'


type FlagsResponse = { tiene_dni_anverso: boolean; tiene_dni_reverso: boolean }
type KycInfo = { tipo: 'marco' | 'acta' | string; requiere_dni?: boolean };


function ContratoInline() {
  return (
    <Box sx={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
      {`Contrato de compra-venta (B2C)

1. Objeto
El presente contrato regula la compraventa del/los dispositivo(s) del cliente a PROGEEK (Checkouters), conforme a la oferta aceptada.

2. Proceso
2.1. Recepción y revisión técnica.
2.2. Posible ajuste de oferta si el estado difiere sustancialmente de lo declarado.
2.3. Pago tras aceptación final.

3. Identificación y verificación (KYC)
El cliente declara que es titular legítimo del dispositivo y acepta facilitar su DNI/NIE por motivos legales de prevención del fraude.

4. Datos y privacidad
Los datos se tratan conforme al RGPD. Conservación según obligaciones legales (p. ej. art. 25 LOPDGDD).

5. Garantías y responsabilidad
El cliente garantiza que el equipo no es robado, no tiene cargas y está libre de bloqueo iCloud/MDM, salvo pacto expreso.

6. Precio y pago
El precio se abonará según los métodos ofrecidos por PROGEEK, en el plazo comunicado tras la aceptación final.

7. Jurisdicción
Se aplica la legislación española. Cualquier disputa se resolverá en los juzgados competentes.

Marcando "He leído y acepto", el cliente consiente expresamente los términos anteriores.`}
    </Box>
  )
}

/** fetchFlags: PROPAGA code y detail para depurar */
async function fetchFlags(token: string): Promise<FlagsResponse> {
  try {
    const res = await apiPublic.get<FlagsResponse>(`/api/b2c/contratos/kyc/${token}/flags/`)
    return res.data
  } catch (err: any) {
    const status = err?.response?.status
    const detail = err?.response?.data?.detail
    const e: any = new Error(detail || 'No se pudieron cargar los flags.')
    e.code = status
    e.detail = detail
    throw e
  }
}
async function fetchInfo(token: string): Promise<KycInfo> {
  const res = await apiPublic.get(`/api/b2c/contratos/kyc/${token}/info/`);
  return res.data;
}
export default function KycPage() {
  const { token } = useParams<{ token: string }>()
  const tokenStr = String(token ?? '')
  const router = useRouter()
  const qc = useQueryClient()
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState<number>(0);
  const [hasAccepted, setHasAccepted] = useState(false);
  const CameraDNI = dynamic(() => import('@/components/contratos/cameraDNI'), { ssr: false })
  
  // Paso 0: Contrato
  const storageKey = `kyc-acepto-${tokenStr}`
  const [aceptoContrato, setAceptoContrato] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(storageKey) === '1'
  })
  const [showContrato, setShowContrato] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (aceptoContrato) localStorage.setItem(storageKey, '1')
      else localStorage.removeItem(storageKey)
    }
  }, [aceptoContrato, storageKey])

  // Estados KYC
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const isUuid = uuidRe.test(tokenStr)
  
  if (!isUuid) {
    return (
      <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 1 }}>Enlace no disponible</Typography>
        <Alert severity="warning">El token no tiene formato UUID válido.</Alert>
      </Box>
    )
  }

// Espera a /info antes de decidir nada

  
  const { data: info, isLoading: infoLoading, error: infoError } = useQuery({
    queryKey: ['kyc-info', tokenStr],
    queryFn: () => fetchInfo(tokenStr),
    enabled: !!tokenStr && isUuid,
    retry: false,
  });

  // Si el backend aún no devuelve requiere_dni, asumimos que las ACTAS no lo requieren
  const requiereDni = info?.requiere_dni ?? (info?.tipo !== 'acta');
  const titulo = info?.tipo === 'acta' ? 'Firma de acta' : 'Verificación de identidad';

  const flagsEnabled = !!tokenStr && isUuid && requiereDni === true;
  const { data: flags, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['kyc-flags', tokenStr],
    queryFn: () => fetchFlags(tokenStr),
    enabled: flagsEnabled, 
    retry: false,
  })


  // Título dinámico
  const [optAnverso, setOptAnverso] = useState(false)
  const [optReverso, setOptReverso] = useState(false)
  const [openCamAnverso, setOpenCamAnverso] = useState(false)
  const [openCamReverso, setOpenCamReverso] = useState(false)
  const [hardError, setHardError] = useState<string | null>(null)

  useEffect(() => {
    if (!flags) return
    setOptAnverso(prev => prev || !!flags.tiene_dni_anverso)
    setOptReverso(prev => prev || !!flags.tiene_dni_reverso)
  }, [flags?.tiene_dni_anverso, flags?.tiene_dni_reverso])
  const pasoContratoCompletado = aceptoContrato
  const listo = useMemo(
    () => (requiereDni ? (optAnverso && optReverso) : pasoContratoCompletado),
    [requiereDni, optAnverso, optReverso, pasoContratoCompletado]
  );

  // Subida con manejo explícito de error (no marcar "recibido" si falla)
  async function subirImagen(lado: 'anverso' | 'reverso', file: File) {
    const form = new FormData()
    form.append('lado', lado)
    form.append('imagen', file, file.name || `dni_${lado}.jpg`)
    try {
      await apiPublic.post(`/api/b2c/contratos/kyc/${tokenStr}/subir-dni/`, form, {
        headers: { 'Content-Type': undefined },
        transformRequest: (d) => d,
      })
      return true
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      if (status === 410) {
        setHardError('410: Enlace expirado o ya utilizado.')
      } else {
        setHardError(detail || 'No se pudo subir la imagen.')
      }
      return false
    }
  }

  const onSubidaAnversoOk = useCallback(async (file?: File) => {
    if (file) {
      const ok = await subirImagen('anverso', file)
      if (!ok) return
    }
    setOptAnverso(true)
    qc.invalidateQueries({ queryKey: ['kyc-flags', tokenStr] })
  }, [qc, tokenStr])

  const onSubidaReversoOk = useCallback(async (file?: File) => {
    if (file) {
      const ok = await subirImagen('reverso', file)
      if (!ok) return
    }
    setOptReverso(true)
    qc.invalidateQueries({ queryKey: ['kyc-flags', tokenStr] })
  }, [qc, tokenStr])

  const finalizarKyc = useMutation({
    mutationFn: async () => apiPublic.post(`/api/b2c/contratos/kyc/${tokenStr}/finalizar/`, {}),
    onSuccess: () => router.push('/gracias'),
    onError: (err: any) => {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      if (status === 410) setHardError('410: Enlace expirado o ya utilizado.')
      else setHardError(detail || 'No se pudo finalizar el KYC.')
    },
  })
  // Tick del cooldown de reenvío
  useEffect(() => {
    if (!showOtp || resendIn <= 0) return;
    const t = setInterval(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [showOtp, resendIn]);

  // --- MUTACIÓN: ENVIAR OTP ---
  const enviarOtp = useMutation({
    mutationFn: async () => {
      // si tu backend expone la acción por token:
      // POST /api/b2c/contratos/kyc/{token}/enviar-otp/
      return apiPublic.post(`/api/b2c/contratos/kyc/${tokenStr}/enviar-otp/`, {});
    },
    onSuccess: (r) => {
      // si tu backend devuelve cooldown, por ejemplo { cooldown: 60 }
      const cd = Number(r?.data?.cooldown ?? 0);
      setResendIn(cd > 0 ? cd : 60); // valor por defecto si no viene
      setShowOtp(true);
      setOtp('');
      setOtpError(null);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 410) setHardError('410: Enlace expirado o ya utilizado.');
      else setHardError(detail || 'No se pudo enviar el código OTP.');
    },
  });

  // --- MUTACIÓN: VERIFICAR OTP ---
  const verificarOtp = useMutation({
    mutationFn: async () => {
      // POST /api/b2c/contratos/kyc/{token}/verificar-otp/  { otp: '123456' }
      return apiPublic.post(`/api/b2c/contratos/kyc/${tokenStr}/verificar-otp/`, { otp });
    },
    onSuccess: () => {
      setShowOtp(false);
      router.push('/gracias'); // contrato firmado + PDF generado
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 400) {
        setOtpError(detail || 'OTP incorrecto. Revisa el código.');
      } else if (status === 410) {
        setShowOtp(false);
        setHardError('410: Enlace expirado o ya utilizado.');
      } else {
        setOtpError(detail || 'No se pudo verificar el OTP.');
      }
    },
  });

  // —— Motivo exacto de bloqueo/indisponibilidad ——
  const infoErr = infoError as any
  const infoCode: number | undefined   = infoErr?.code ?? infoErr?.response?.status
  const infoDetail: string | undefined = infoErr?.detail ?? infoErr?.response?.data?.detail

  const fatal: string | null = (() => {
    if (hardError) return hardError
    if (infoCode === 404) return 'Token no reconocido.'
    if (infoCode === 410) return '410: Enlace expirado o ya utilizado.'
    // flags solo existen cuando requiere DNI y se habilitó su query
    const flagsErr = error as any
    const flagsCode: number | undefined = flagsErr?.code ?? flagsErr?.response?.status
    if (flagsCode && flagsCode !== 200) return `${flagsCode}: ${flagsErr?.detail ?? flagsErr?.response?.data?.detail ?? 'No se pudieron cargar los requisitos de DNI.'}`
    return null
  })()

  if (fatal) {
    return (
      <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 1 }}>Enlace no disponible</Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>{fatal}</Alert>
        {!!tokenStr && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Token: {tokenStr}
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={() => location.reload()}>Reintentar</Button>
          <Button variant="text" onClick={() => router.push('/')}>Volver al inicio</Button>
        </Stack>
      </Box>
    )
  }

  if (infoLoading) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Validando enlace…
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 880, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
      {titulo}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      {info?.tipo === 'acta'
        ? 'Revisa el acta y firma con un código OTP. No es necesario subir tu DNI.'
        : 'Primero acepta el contrato y sube las dos caras de tu documento.'}
    </Typography>
      

      {/* Paso 0: aceptar contrato */}
      {!pasoContratoCompletado && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardHeader title="Contrato de compra-venta" />
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Button
                variant="outlined"
                onClick={() =>
                  window.open(`/api/b2c/contratos/kyc/${tokenStr}/pdf-preview/`, '_blank')
                }
              >
                Ver condiciones
              </Button>
              <FormControlLabel
                control={<Checkbox checked={hasAccepted} onChange={(e) => setHasAccepted(e.target.checked)} />}
                label="He leído y acepto las condiciones"
              />
              <Button variant="contained" onClick={() => {
                  if (!hasAccepted) {
                    alert("Debes aceptar el contrato antes de continuar");
                    return;
                  }
                  // Aquí sí pasas al siguiente paso
                  setAceptoContrato(true);
                }}
              >
                Continuar
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}


      {/* Dialog del contrato */}
      <Dialog open={showContrato} onClose={() => setShowContrato(false)} maxWidth="md" fullWidth>
        <DialogTitle>Contrato de compra-venta</DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          <Box sx={{ height: { xs: 500, md: 700 } }}>
            {(() => {
              const kycToken = tokenStr;
              const pdfSrc =
                isUuid && kycToken
                  ? `/api/b2c/contratos/kyc/${kycToken}/pdf-preview/`
                  : null;

              if (!pdfSrc) {
                return (
                  <Box sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      El contrato todavía no está disponible para previsualizar.
                    </Typography>
                    {!isUuid && (
                      <Typography variant="body2" color="text.secondary">
                        El token no tiene formato UUID válido.
                      </Typography>
                    )}
                  </Box>
                );
              }

              return (
                <object data={pdfSrc} type="application/pdf" width="100%" height="100%">
                  <Box sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      No se pudo mostrar el PDF en el navegador.
                    </Typography>
                    <Button variant="outlined" onClick={() => window.open(pdfSrc, '_blank')}>
                      Abrir PDF en otra pestaña
                    </Button>
                  </Box>
                </object>
              );
            })()}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setShowContrato(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
      
<Dialog open={showOtp}  onClose={(_, reason) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      return; // ❌ ignorar clicks fuera y ESC
    }
    setShowOtp(false); // ✅ solo cerramos si viene de botones
  }} maxWidth="xs" fullWidth>
  <DialogTitle>Introduce el código OTP</DialogTitle>
  <DialogContent>
    <Typography variant="body2" sx={{ mb: 2 }}>
      Te hemos enviado un código de verificación. Escríbelo para firmar el contrato.
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={otp}
        onChange={(e: any) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(null); }}
        style={{
          fontSize: 28, letterSpacing: 6, padding: 12, width: '100%',
          textAlign: 'center', borderRadius: 8, border: '1px solid var(--mui-palette-divider)'
        }}
        placeholder="••••••"
      />
    </Box>
    {otpError && (
      <Alert severity="error" sx={{ mt: 2 }}>{otpError}</Alert>
    )}
    <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
      <Button
        variant="text"
        disabled={resendIn > 0 || enviarOtp.isPending}
        onClick={() => enviarOtp.mutate()}
      >
        {resendIn > 0 ? `Reenviar (${resendIn}s)` : 'Reenviar código'}
      </Button>
    </Stack>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setShowOtp(false)}>Cancelar</Button>
    <Button
      variant="contained"
      onClick={() => verificarOtp.mutate()}
      disabled={otp.length < 4 || verificarOtp.isPending}
    >
      {verificarOtp.isPending ? 'Verificando…' : 'Verificar y firmar'}
    </Button>
  </DialogActions>
</Dialog>




      {/* Paso 1: KYC (solo visible cuando se aceptó el contrato) */}
      {pasoContratoCompletado && requiereDni && (
        <>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {/* Anverso */}
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardHeader avatar={<PhotoCameraFrontIcon />} title="DNI - Anverso" subheader="Cara frontal" />
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="body2">Estado:</Typography>
                  <Chip size="small" label={optAnverso ? 'Recibido' : 'Pendiente'} color={optAnverso ? 'success' : 'default'} variant={optAnverso ? 'filled' : 'outlined'} />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" onClick={() => setOpenCamAnverso(true)} disabled={optAnverso}>
                    Usar cámara
                  </Button>
                  <Button component="label" variant="contained" disabled={optAnverso}>
                    Subir archivo
                    <input hidden type="file" accept="image/*" capture="environment"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubidaAnversoOk(f) }} />
                  </Button>
                  <CameraDNI
                    open={openCamAnverso}
                    onClose={() => setOpenCamAnverso(false)}
                    onCapture={async (file) => { const ok = await subirImagen('anverso', file); if (ok) { setOptAnverso(true); qc.invalidateQueries({ queryKey: ['kyc-flags', tokenStr] }) } setOpenCamAnverso(false) }}
                    title="Escanear DNI"
                    lado="anverso"
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Reverso */}
            <Card variant="outlined" sx={{ flex: 1 }}>
              <CardHeader avatar={<PhotoCameraBackIcon />} title="DNI - Reverso" subheader="Cara trasera" />
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="body2">Estado:</Typography>
                  <Chip size="small" label={optReverso ? 'Recibido' : 'Pendiente'} color={optReverso ? 'success' : 'default'} variant={optReverso ? 'filled' : 'outlined'} />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  <Button variant="outlined" onClick={() => setOpenCamReverso(true)} disabled={optReverso}>
                    Usar cámara
                  </Button>
                  <Button component="label" variant="contained" disabled={optReverso}>
                    Subir archivo
                    <input hidden type="file" accept="image/*" capture="environment"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubidaReversoOk(f) }} />
                  </Button>
                  <CameraDNI
                    open={openCamReverso}
                    onClose={() => setOpenCamReverso(false)}
                    onCapture={async (file) => { const ok = await subirImagen('reverso', file); if (ok) { setOptReverso(true); qc.invalidateQueries({ queryKey: ['kyc-flags', tokenStr] }) } setOpenCamReverso(false) }}
                    title="Escanear DNI"
                    lado="reverso"
                  />
                </Stack>
              </CardContent>
            </Card>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              {isLoading ? 'Cargando estado…' : isFetching ? 'Actualizando…' : 'Estado sincronizado con el servidor.'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="text" onClick={() => refetch()} disabled={isLoading}>
                Releer del servidor
              </Button>
              {listo && (
                <Button
                    variant="contained"
                    startIcon={<CheckCircleIcon />}
                    onClick={() => enviarOtp.mutate()}
                    disabled={enviarOtp.isPending}
                  >
                    {enviarOtp.isPending ? 'Enviando código…' : 'Finalizar y continuar'}
                  </Button>
              )}
            </Stack>
          </Stack>
        </>
      )}
      {/* Acta: sin DNI → OTP directo */}
      {pasoContratoCompletado && !requiereDni && (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Para este acta no es necesario subir DNI. Te enviaremos un código para firmar.
          </Alert>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              onClick={() => enviarOtp.mutate()}
              disabled={enviarOtp.isPending || resendIn > 0}
            >
              {enviarOtp.isPending ? 'Enviando código…' : (resendIn > 0 ? `Reenviar (${resendIn}s)` : 'Recibir código')}
            </Button>
            <Button variant="text" onClick={() => router.refresh()}>Actualizar</Button>
          </Stack>
        </>
      )}
    </Box>
  )
}
