import React, { useState } from 'react'
import {
  Box,
  TextField,
  Button,
  Grid,
  Popover,
  Typography,
  Chip,
  InputAdornment,
} from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import {
  ESTADOS_B2B,
  ESTADOS_OPERACIONEPARTNER,
} from '@/context/estados'
import type { OportunidadFilters } from '@/shared/types/oportunidades'
import { CONTROL_H } from '@/shared/constants/oportunidades'

interface Props {
  filters: OportunidadFilters
  onFiltersChange: (filters: OportunidadFilters) => void
  onSearch: () => void
  onReset: () => void
  onCreateNew: () => void
}

export function OportunidadFilters({
  filters,
  onFiltersChange,
  onSearch,
  onReset,
  onCreateNew,
}: Props) {
  const [estadoAnchorEl, setEstadoAnchorEl] = useState<null | HTMLElement>(null)
  const estadoPopoverOpen = Boolean(estadoAnchorEl)

  const handleOpenPopover = (event: React.MouseEvent<HTMLElement>) => {
    setEstadoAnchorEl(event.currentTarget)
  }

  const handleClosePopover = () => setEstadoAnchorEl(null)

  const updateFilter = <K extends keyof OportunidadFilters>(
    key: K,
    value: OportunidadFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const handleEstadoToggle = (estadoKey: string) => {
    const isSelected = filters.estado.includes(estadoKey)
    const newEstados = isSelected
      ? filters.estado.filter((e) => e !== estadoKey)
      : [...filters.estado, estadoKey]

    updateFilter('estado', newEstados)
  }

  return (
    <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
      <Grid size={{ xs: 12, sm: 3 }}>
        <TextField
          label="Cliente"
          value={filters.cliente}
          onChange={(e) => updateFilter('cliente', e.target.value)}
          fullWidth
          size="medium"
          sx={{ '& .MuiInputBase-root': { height: CONTROL_H } }}
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 3 }}>
        <TextField
          label="Estados"
          value={filters.estado.length ? `${filters.estado.length} estado(s)` : ''}
          placeholder="Estados"
          onClick={handleOpenPopover}
          fullWidth
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <TuneIcon />
              </InputAdornment>
            ),
          }}
          sx={{
            cursor: 'pointer',
            '& .MuiInputBase-root': { height: CONTROL_H },
            '& .MuiInputBase-input': { cursor: 'pointer' },
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleOpenPopover(e as any)
          }}
        />
        <Popover
          open={estadoPopoverOpen}
          anchorEl={estadoAnchorEl}
          onClose={handleClosePopover}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          PaperProps={{ sx: { p: 2, maxWidth: 420, width: '100%' } }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Filtrar por estado
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {ESTADOS_OPERACIONEPARTNER.map((estadoKey) => {
              const meta = ESTADOS_B2B[estadoKey] || { color: 'default' }
              const Icono = meta.icon
              const selected = filters.estado.includes(estadoKey)
              return (
                <Chip
                  key={estadoKey}
                  label={estadoKey}
                  size="small"
                  variant={selected ? 'filled' : 'outlined'}
                  color={meta.color}
                  icon={Icono ? <Icono fontSize="small" /> : undefined}
                  onClick={() => handleEstadoToggle(estadoKey)}
                  sx={{ cursor: 'pointer' }}
                />
              )
            })}
          </Box>
          {filters.estado.length !== ESTADOS_OPERACIONEPARTNER.length && (
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button
                size="small"
                onClick={() => updateFilter('estado', [...ESTADOS_OPERACIONEPARTNER])}
              >
                Mostrar todos
              </Button>
            </Box>
          )}
        </Popover>
      </Grid>

      <Grid size={{ xs: 12, sm: 2 }}>
        <TextField
          label="Desde"
          type="date"
          value={filters.fechaInicio}
          onChange={(e) => updateFilter('fechaInicio', e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 2 }}>
        <TextField
          label="Hasta"
          type="date"
          value={filters.fechaFin}
          onChange={(e) => updateFilter('fechaFin', e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 2 }}>
        <Button variant="contained" onClick={onSearch} sx={{ mr: 1 }}>
          Buscar
        </Button>
        <Button onClick={onReset}>Reset</Button>
      </Grid>

      <Button variant="contained" onClick={onCreateNew}>
        Nueva oportunidad
      </Button>
    </Grid>
  )
}