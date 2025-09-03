'use client'
import { Grid, FormControl, InputLabel, Select, MenuItem, FormHelperText, Skeleton, TextField } from '@mui/material'
import { Autocomplete } from '@mui/material'

export default function PasoDatosBasicos({
  tipos, loadingTipos,
  modelos, loadingModelos,
  capacidades, loadingCaps,
  tipo, setTipo,
  modelo, setModelo, modeloInicial,
  capacidad, setCapacidad,
  cantidad, setCantidad,
}: any) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth>
          <InputLabel>Tipo de producto</InputLabel>
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            label="Tipo de producto"
            disabled={loadingTipos}
            error={!tipo}
          >
            {tipos.map((t: string) => (<MenuItem key={t} value={t}>{t}</MenuItem>))}
          </Select>
          {loadingTipos ? <Skeleton variant="text" width={120} /> : (!tipo && <FormHelperText>Requerido</FormHelperText>)}
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <FormControl fullWidth>
          {loadingModelos ? (
            <Skeleton variant="rounded" height={56} />
          ) : (
            <Autocomplete
              options={modelos}
              getOptionLabel={(option: any) => option.descripcion}
              value={
                modelos.find((m: any) => m.id === modelo) ||
                (modeloInicial && { ...modeloInicial, id: modeloInicial.id }) ||
                null
              }
              onChange={(_e, newValue: any) => setModelo(newValue ? newValue.id : '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Modelo"
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
        <FormControl fullWidth>
          <InputLabel>Capacidad</InputLabel>
          <Select
            value={capacidad}
            onChange={(e) => setCapacidad(Number(e.target.value))}
            label="Capacidad"
            disabled={loadingCaps || !modelo}
            error={!capacidad}
          >
            {loadingCaps
              ? <MenuItem value=""><em>Cargando…</em></MenuItem>
              : capacidades.map((c: any) => (<MenuItem key={c.id} value={c.id}>{c.tamaño}</MenuItem>))}
          </Select>
          {!capacidad && !loadingCaps && <FormHelperText>Requerido</FormHelperText>}
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label="Cantidad"
          type="number"
          fullWidth
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          onBlur={() => {
            const parsed = parseInt(cantidad as string)
            setCantidad(isNaN(parsed) ? 1 : parsed)
          }}
          inputProps={{ min: 1 }}
        />
      </Grid>
    </Grid>
  )
}
