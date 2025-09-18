'use client'
import { useEffect } from 'react'
import { Grid, FormControl, InputLabel, Select, MenuItem, FormHelperText, Skeleton, TextField } from '@mui/material'
import { Autocomplete } from '@mui/material'

type ModelOpt = { id: number | string; descripcion: string }
type CapOpt = { id: number | string; tamaño: string }

export default function PasoDatosBasicos({
  tipos, loadingTipos,
  modelos, loadingModelos,
  capacidades, loadingCaps,
  tipo, setTipo,
  modelo, setModelo, modeloInicial,
  capacidad, setCapacidad,
  cantidad, setCantidad,
  isB2C,
}: {
  tipos: string[]
  loadingTipos: boolean
  modelos: ModelOpt[]
  loadingModelos: boolean
  capacidades: CapOpt[]
  loadingCaps: boolean
  tipo: string
  setTipo: (v: string) => void
  modelo: number | string
  setModelo: (v: number | string) => void
  modeloInicial?: ModelOpt | null
  capacidad: number | string
  setCapacidad: (v: number) => void
  cantidad: number | string
  setCantidad: (v: number | string) => void
  isB2C?: boolean
}) {
  // Si es B2C/Particular, la cantidad debe ser 1 y no editable
  useEffect(() => {
    if (isB2C) setCantidad(1)
  }, [isB2C])
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Tipo de producto</InputLabel>
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            label="Tipo de producto"
            size="small"
            disabled={loadingTipos}
            error={!tipo}
          >
            {tipos.map((t: string) => (<MenuItem key={t} value={t}>{t}</MenuItem>))}
          </Select>
          {loadingTipos ? <Skeleton variant="text" width={120} /> : (!tipo && <FormHelperText>Requerido</FormHelperText>)}
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth size="small">
          {loadingModelos ? (
            <Skeleton variant="rounded" height={56} />
          ) : (
            <Autocomplete<ModelOpt>
              options={modelos}
              getOptionLabel={(option) => option.descripcion}
              size="small"
              value={
                modelos.find((m) => m.id === modelo) ||
                (modeloInicial && { ...modeloInicial, id: modeloInicial.id }) ||
                null
              }
              onChange={(_e, newValue) => setModelo(newValue ? newValue.id : '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Modelo"
                  size="small"
                  error={!modelo}
                  helperText={!modelo ? 'Requerido' : ''}
                />
              )}
              disabled={!tipo}
            />
          )}
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Capacidad</InputLabel>
          <Select
            value={capacidad}
            onChange={(e) => setCapacidad(Number(e.target.value))}
            label="Capacidad"
            size="small"
            disabled={loadingCaps || !modelo}
            error={!capacidad}
          >
            {loadingCaps
              ? <MenuItem value=""><em>Cargando…</em></MenuItem>
              : capacidades.map((c) => (<MenuItem key={c.id} value={c.id}>{c.tamaño}</MenuItem>))}
          </Select>
          {!capacidad && !loadingCaps && <FormHelperText>Requerido</FormHelperText>}
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label="Cantidad"
          type="number"
          fullWidth
          size="small"
          value={isB2C ? 1 : cantidad}
          onChange={(e) => { if (!isB2C) setCantidad(e.target.value) }}
          onBlur={() => {
            const parsed = parseInt(cantidad as string)
            setCantidad(isNaN(parsed) ? 1 : parsed)
          }}
          inputProps={{ min: 1, ...(isB2C ? { max: 1 } : {}) }}
          disabled={!!isB2C}
        />
      </Grid>
    </Grid>
  )
}
