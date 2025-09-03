'use client'
import React, { useMemo, useState } from 'react'
import { Grid, Paper, Stack, Typography, Divider, Button, TextField, MenuItem, Chip, Alert } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import api from '@/services/api'
import { CuestionarioComercialInput, DisplayImageStatus, GlassStatus, GradingParamsPorModelo, HousingStatus } from '@/types/grading'
import { calcularOferta } from '@/utils/gradingCalcs'

export default function CuestionarioComercialIphone(props: {
  paramsModelo: GradingParamsPorModelo
  modelos: Array<{ id: number; nombre: string; capacidades: Array<{ id: number; nombre: string }> }>
  onConfirm?: (r: { oferta: number }) => void
}) {
  const { paramsModelo, modelos } = props
  const [modeloId, setModeloId] = useState<number | ''>('')
  const [capacidadId, setCapacidadId] = useState<number | ''>('')
  const [form, setForm] = useState<CuestionarioComercialInput>({
    identificacion: null,
    enciende: null,
    carga: null,
    funcional_basico_ok: null,
    battery_health_pct: null,
    display_image_status: DisplayImageStatus.OK,
    glass_status: GlassStatus.NONE,
    housing_status: HousingStatus.SIN_SIGNOS,
  })

  const modeloSel = useMemo(() => modelos.find(m => m.id === modeloId) || null, [modelos, modeloId])

  const result = useMemo(() => {
    const hasIds = Number.isFinite(modeloId) && Number.isFinite(capacidadId)
    if (!hasIds) return null
    const input = { ...form, identificacion: hasIds ? {
      modelo_id: Number(modeloId),
      modelo_nombre: modeloSel?.nombre || '',
      capacidad_id: Number(capacidadId),
      capacidad_nombre: (modeloSel?.capacidades || []).find(c => c.id === capacidadId)?.nombre || ''
    } : null }
    return calcularOferta(input, paramsModelo, /*pp_func*/ 0.15)
  }, [form, modeloId, capacidadId, paramsModelo, modeloSel])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, modelo_id: modeloId, capacidad_id: capacidadId, oferta: result?.oferta }
      const { data } = await api.post('/api/valoraciones/', payload)
      return data
    }
  })

  const set = <K extends keyof CuestionarioComercialInput>(k: K, v: CuestionarioComercialInput[K]) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Cuestionario comercial — iPhone</Typography>
        <Typography variant="body2" color="text.secondary">
          No necesitas IMEI/Serie para la estimación. Si aceptas, se requerirá IMEI/SN y la oferta quedará supeditada a la auditoría técnica y de autenticidad.
        </Typography>
        <Divider />

        {/* Identificación */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Modelo" value={modeloId} onChange={e => setModeloId(Number(e.target.value))}>
              {(modelos || []).map(m => (
                <MenuItem key={m.id} value={m.id}>{m.nombre}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Capacidad" value={capacidadId} onChange={e => setCapacidadId(Number(e.target.value))} disabled={!modeloSel}>
              {(modeloSel?.capacidades || []).map(c => (
                <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        {/* Gates básicos (energía/funcional) */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="¿Enciende?" value={form.enciende ?? ''} onChange={e => set('enciende', e.target.value === 'true')}>
              <MenuItem value={'true'}>Sí</MenuItem>
              <MenuItem value={'false'}>No</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="¿Carga por cable?" value={form.carga ?? ''} onChange={e => set('carga', e.target.value === 'true')}>
              <MenuItem value={'true'}>Sí</MenuItem>
              <MenuItem value={'false'}>No</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField select fullWidth label="Funcional básico" value={form.funcional_basico_ok ?? ''} onChange={e => set('funcional_basico_ok', e.target.value === 'true')} helperText="Llamadas, mic, altavoz, cámaras, BT, Wi‑Fi">
              <MenuItem value={'true'}>Todo OK</MenuItem>
              <MenuItem value={'false'}>Algún fallo</MenuItem>
            </TextField>
          </Grid>
        </Grid>

        {/* Pantalla (imagen + cristal) */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Imagen pantalla" value={form.display_image_status} onChange={e => set('display_image_status', e.target.value as any)}>
              {Object.values(DisplayImageStatus).map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Cristal pantalla" value={form.glass_status} onChange={e => set('glass_status', e.target.value as any)}>
              {Object.values(GlassStatus).map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>

        {/* Chasis/trasera + batería */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField select fullWidth label="Chasis / Trasera" value={form.housing_status} onChange={e => set('housing_status', e.target.value as any)}>
              {Object.values(HousingStatus).map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth type="number" inputProps={{ min: 0, max: 100 }} label="Salud batería (%)" value={form.battery_health_pct ?? ''} onChange={e => set('battery_health_pct', e.target.value === '' ? null : Number(e.target.value))} />
          </Grid>
        </Grid>

        {/* Resultado */}
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
          {result ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}><Chip label={`Gate: ${result.gate}`} /></Grid>
              <Grid item xs={12} md={3}><Chip label={`Grado: ${result.grado_estetico}`} /></Grid>
              <Grid item xs={12} md={3}><Chip label={`V_tope: ${result.V_tope}€`} /></Grid>
              <Grid item xs={12} md={3}><Chip label={`Oferta: ${result.oferta}€`} color="primary" /></Grid>
              <Grid item xs={12}>
                <Typography variant="body2">Deducciones → bat: {result.deducciones.pr_bat}€, pant: {result.deducciones.pr_pant}€, chasis: {result.deducciones.pr_chas}€, pp_func: {Math.round(result.deducciones.pp_func*100)}%</Typography>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">Selecciona modelo y capacidad para ver la oferta estimada.</Alert>
          )}
        </Paper>

        <Stack direction="row" spacing={2}>
          <Button variant="contained" disabled={!result || mutation.isPending} onClick={() => mutation.mutate()}>Confirmar</Button>
          {mutation.isError && <Alert severity="error">Error enviando</Alert>}
          {mutation.isSuccess && <Alert severity="success">Guardado</Alert>}
        </Stack>
      </Stack>
    </Paper>
  )
}