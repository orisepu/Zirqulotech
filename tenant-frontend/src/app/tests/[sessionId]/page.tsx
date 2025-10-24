"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Box, Button, Card, CardContent, CardHeader, Chip, Divider, Grid, Stack, Typography } from '@mui/material'

type ResultKeys = {
  touch_ghost_ok?: boolean
  touch_grid_ok?: boolean
  multitouch_ok?: boolean
  camOk?: boolean
  micOk?: boolean
  geoOk?: boolean
  nfcOk?: boolean
  motionOk?: boolean
  vibrateOk?: boolean
}

async function postResults(sessionId: string, partial: Partial<ResultKeys>) {
  try {
    await fetch(`/api/test-sessions/${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
  } catch {
    // ignore network errors silently (user can retry)
  }
}

export default function MobileTestsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const sid = String(sessionId || '')

  const [results, setResults] = useState<ResultKeys>({})

  // helper to update local + send to server immediately
  const setAndSend = async (patch: Partial<ResultKeys>) => {
    setResults((prev) => ({ ...prev, ...patch }))
    if (sid) await postResults(sid, patch)
  }

  // Quick detectors (best effort) — optional
  const [detectedMulti, setDetectedMulti] = useState(false)
  const touchZoneRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = touchZoneRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => {
      if (e.touches?.length >= 2) setDetectedMulti(true)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    return () => el.removeEventListener('touchstart', onStart)
  }, [])

  const supports = useMemo(() => ({
    vibration: typeof navigator !== 'undefined' && 'vibrate' in navigator,
    geolocation: typeof navigator !== 'undefined' && 'geolocation' in navigator,
    nfc: typeof (globalThis as any).NDEFReader !== 'undefined',
    media: typeof navigator !== 'undefined' && 'mediaDevices' in navigator,
    motion: typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window),
  }), [])

  return (
    <Box sx={{ p: 2, maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>Pruebas rápidas del dispositivo</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Sesión: <b>{sid || '—'}</b>
      </Typography>
      <Divider sx={{ my: 2 }} />

      <Grid container spacing={2}>
        <Grid size={{xs:12}}>
          <Card variant="outlined">
            <CardHeader title="Táctil" subheader="Prueba rápida del panel táctil" />
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="body2">Toca y arrastra sobre el área para comprobar respuesta.</Typography>
                <Box
                  ref={touchZoneRef}
                  sx={{
                    height: 160,
                    border: '2px dashed',
                    borderColor: 'primary.main',
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                  }}
                />
                <Stack direction="row" spacing={1}>
                  <Button variant={results.touch_ghost_ok ? 'contained' : 'outlined'} color="success" onClick={() => setAndSend({ touch_ghost_ok: true })}>Ghost OK</Button>
                  <Button variant={results.touch_ghost_ok === false ? 'contained' : 'outlined'} color="error" onClick={() => setAndSend({ touch_ghost_ok: false })}>Ghost KO</Button>
                  <Button variant={results.touch_grid_ok ? 'contained' : 'outlined'} onClick={() => setAndSend({ touch_grid_ok: true })}>Grid OK</Button>
                  <Button variant={results.touch_grid_ok === false ? 'contained' : 'outlined'} color="error" onClick={() => setAndSend({ touch_grid_ok: false })}>Grid KO</Button>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant={results.multitouch_ok || detectedMulti ? 'contained' : 'outlined'}
                    onClick={() => setAndSend({ multitouch_ok: true })}
                  >Multitouch OK</Button>
                  <Chip size="small" variant="outlined" label={detectedMulti ? '2+ dedos detectados' : 'esperando 2 dedos…'} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs:12}}>
          <Card variant="outlined">
            <CardHeader title="Cámara / Micrófono" subheader="Permisos de acceso y funcionamiento básico" />
            <CardContent>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  disabled={!supports.media}
                  onClick={async () => {
                    try {
                      const s = await navigator.mediaDevices.getUserMedia({ video: true })
                      s.getTracks().forEach(t => t.stop())
                      await setAndSend({ camOk: true })
                    } catch { await setAndSend({ camOk: false }) }
                  }}
                  variant={results.camOk ? 'contained' : 'outlined'}
                >Cam OK</Button>
                <Button
                  disabled={!supports.media}
                  onClick={async () => {
                    try {
                      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
                      s.getTracks().forEach(t => t.stop())
                      await setAndSend({ micOk: true })
                    } catch { await setAndSend({ micOk: false }) }
                  }}
                  variant={results.micOk ? 'contained' : 'outlined'}
                >Mic OK</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{xs:12}}>
          <Card variant="outlined">
            <CardHeader title="Ubicación / Sensores / NFC / Vibración" />
            <CardContent>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  disabled={!supports.geolocation}
                  onClick={() => {
                    if (!navigator.geolocation) return setAndSend({ geoOk: false })
                    navigator.geolocation.getCurrentPosition(
                      () => setAndSend({ geoOk: true }),
                      () => setAndSend({ geoOk: false }),
                      { enableHighAccuracy: false, timeout: 5000 }
                    )
                  }}
                  variant={results.geoOk ? 'contained' : 'outlined'}
                >GPS OK</Button>

                <Button
                  disabled={!supports.motion}
                  onClick={() => {
                    let handled = false
                    const onAny = () => { if (!handled) { handled = true; setAndSend({ motionOk: true }) } cleanup() }
                    const cleanup = () => {
                      window.removeEventListener('devicemotion', onAny as any)
                      window.removeEventListener('deviceorientation', onAny as any)
                    }
                    window.addEventListener('devicemotion', onAny as any, { once: true })
                    window.addEventListener('deviceorientation', onAny as any, { once: true })
                    setTimeout(() => { if (!handled) { handled = true; setAndSend({ motionOk: false }); cleanup() } }, 4000)
                  }}
                  variant={results.motionOk ? 'contained' : 'outlined'}
                >Sensores OK</Button>

                <Button
                  disabled={!supports.nfc}
                  onClick={async () => {
                    try {
                      const reader = new (window as any).NDEFReader()
                      await reader.scan().catch(() => {})
                      await setAndSend({ nfcOk: true })
                    } catch { await setAndSend({ nfcOk: false }) }
                  }}
                  variant={results.nfcOk ? 'contained' : 'outlined'}
                >NFC OK</Button>

                <Button
                  disabled={!supports.vibration}
                  onClick={() => {
                    try { navigator.vibrate?.(200) } catch {}
                    setAndSend({ vibrateOk: true })
                  }}
                  variant={results.vibrateOk ? 'contained' : 'outlined'}
                >Vibración OK</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary">
        Los resultados se envían automáticamente a la sesión y pueden aplicarse en el panel.
      </Typography>
    </Box>
  )
}

