'use client'
import { useEffect, useState } from 'react'
import { Grid, FormControl, InputLabel, Select, MenuItem, FormHelperText, Skeleton, TextField, Switch, FormControlLabel, Button } from '@mui/material'
import { Autocomplete } from '@mui/material'
import { AddCircleOutline } from '@mui/icons-material'
import api from '@/services/api'
import type { DispositivoPersonalizadoSimple } from '@/shared/types/dispositivos'

type ModelOpt = { id: number | string; descripcion: string }
type CapOpt = { id: number | string; tamaño: string }

export default function PasoDatosBasicos({
  marcas, loadingMarcas,
  tipos, loadingTipos,
  modelos, loadingModelos,
  capacidades, loadingCaps,
  marca, setMarca,
  tipo, setTipo,
  modelo, setModelo, modeloInicial,
  capacidad, setCapacidad,
  cantidad, setCantidad,
  isB2C,
  esDispositivoPersonalizado = false,
  onToggleDispositivoPersonalizado,
  dispositivoPersonalizado = null,
  onDispositivoPersonalizadoChange,
  onCrearPersonalizado,
}: {
  marcas: string[]
  loadingMarcas: boolean
  tipos: string[]
  loadingTipos: boolean
  modelos: ModelOpt[]
  loadingModelos: boolean
  capacidades: CapOpt[]
  loadingCaps: boolean
  marca: string
  setMarca: (v: string) => void
  tipo: string
  setTipo: (v: string) => void
  modelo: number | string
  setModelo: (v: number | string) => void
  modeloInicial?: ModelOpt | null
  capacidad: number | string
  setCapacidad: (v: number | string) => void
  cantidad: number | string
  setCantidad: (v: number | string) => void
  isB2C?: boolean
  esDispositivoPersonalizado?: boolean
  onToggleDispositivoPersonalizado?: (value: boolean) => void
  dispositivoPersonalizado?: DispositivoPersonalizadoSimple | null
  onDispositivoPersonalizadoChange?: (device: DispositivoPersonalizadoSimple | null) => void
  onCrearPersonalizado?: () => void
}) {
  // Estado para dispositivos personalizados
  const [dispositivosPersonalizados, setDispositivosPersonalizados] = useState<DispositivoPersonalizadoSimple[]>([])
  const [loadingPersonalizados, setLoadingPersonalizados] = useState(false)

  // Si es B2C/Particular, la cantidad debe ser 1 y no editable
  useEffect(() => {
    if (isB2C) setCantidad(1)
  }, [isB2C])

  // Cargar dispositivos personalizados cuando el toggle esté activado
  useEffect(() => {
    if (esDispositivoPersonalizado) {
      setLoadingPersonalizados(true)
      api.get('/api/dispositivos-personalizados/disponibles/')
        .then((res) => {
          setDispositivosPersonalizados(res.data || [])
        })
        .catch((err) => {
          console.error('Error loading custom devices:', err)
          setDispositivosPersonalizados([])
        })
        .finally(() => {
          setLoadingPersonalizados(false)
        })
    }
  }, [esDispositivoPersonalizado])

  // Handler para el toggle
  const handleToggleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked
    if (onToggleDispositivoPersonalizado) {
      onToggleDispositivoPersonalizado(newValue)
    }
  }

  return (
    <Grid container spacing={2}>
      {/* Toggle para dispositivos personalizados */}
      <Grid size={{ xs: 12 }}>
        <FormControlLabel
          control={
            <Switch
              checked={esDispositivoPersonalizado}
              onChange={handleToggleChange}
              color="primary"
            />
          }
          label="Dispositivo personalizado (no Apple)"
        />
      </Grid>

      {/* Flujo normal: Apple catalog */}
      {!esDispositivoPersonalizado && (
        <>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Fabricante</InputLabel>
              <Select
                value={marca}
                onChange={(e) => setMarca(e.target.value as string)}
                label="Marca"
                size="small"
                disabled={loadingMarcas}
                error={!marca}
              >
                <MenuItem value=""><em>Selecciona un fabricante</em></MenuItem>
                {marcas.map((m) => (<MenuItem key={m} value={m}>{m}</MenuItem>))}
              </Select>
              {loadingMarcas ? <Skeleton variant="text" width={120} /> : (!marca && <FormHelperText>Requerido</FormHelperText>)}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de producto</InputLabel>
              <Select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                label="Tipo de producto"
                size="small"
                disabled={loadingTipos || !marca}
                error={!tipo}
              >
                {tipos.map((t: string) => (<MenuItem key={t} value={t}>{t}</MenuItem>))}
              </Select>
              {loadingTipos ? <Skeleton variant="text" width={120} /> : (!tipo && marca && <FormHelperText>Requerido</FormHelperText>)}
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
                  onChange={(_e, newValue) => {
                    setModelo(newValue ? newValue.id : '')
                    setCapacidad('')
                  }}
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
        </>
      )}

      {/* Flujo personalizado: Custom devices */}
      {esDispositivoPersonalizado && (
        <>
          <Grid size={{ xs: 12, md: 8 }}>
            <FormControl fullWidth size="small">
              {loadingPersonalizados ? (
                <Skeleton variant="rounded" height={56} />
              ) : (
                <Autocomplete<DispositivoPersonalizadoSimple>
                  options={dispositivosPersonalizados}
                  getOptionLabel={(option) => option.descripcion_completa || `${option.marca} ${option.modelo} ${option.capacidad || ''}`}
                  size="small"
                  value={dispositivoPersonalizado}
                  onChange={(_e, newValue) => {
                    if (onDispositivoPersonalizadoChange) {
                      onDispositivoPersonalizadoChange(newValue)
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Seleccionar dispositivo personalizado"
                      size="small"
                      error={!dispositivoPersonalizado}
                      helperText={!dispositivoPersonalizado ? 'Seleccione un dispositivo o cree uno nuevo' : ''}
                    />
                  )}
                />
              )}
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              startIcon={<AddCircleOutline />}
              onClick={onCrearPersonalizado}
              disabled={!onCrearPersonalizado}
              sx={{ height: '40px' }}
            >
              Crear nuevo dispositivo personalizado
            </Button>
          </Grid>
        </>
      )}

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
