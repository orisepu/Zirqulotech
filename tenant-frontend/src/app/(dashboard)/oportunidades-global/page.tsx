'use client'

import {
  Box, Typography, Paper, CircularProgress, TextField, Button,
  Grid, Popover, Chip
} from '@mui/material'
import { useEffect, useState, useMemo } from 'react'
import api from '@/services/api'
import { useRouter } from 'next/navigation'
import { getIdlink } from '@/shared/utils/id'
import TuneIcon from '@mui/icons-material/Tune'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { ESTADOS_B2B, ESTADOS_META, ESTADOS_OPERACIONESADMIN } from '@/context/estados'
import TablaReactiva from '@/shared/components/TablaReactiva2'
import { columnasAdmin } from '@/shared/components/TablaColumnas2'
import { useUsuario } from '@/context/UsuarioContext'

export default function OportunidadesGlobalPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const usuario = useUsuario()
  const columnas = columnasAdmin
  const ESTADOS_FIJOS = ESTADOS_OPERACIONESADMIN
  const ESTADOS_DEFAULT = useMemo<string[]>(() => {
    // si es array => ya son nombres; si es objeto => usa sus keys (nombres)
    return Array.isArray(ESTADOS_FIJOS) ? ESTADOS_FIJOS : Object.keys(ESTADOS_FIJOS);
  }, [ESTADOS_FIJOS]);

  const normalizeEstado = (e: any) => {
    // si viene índice (número o string numérico), mapéalo al nombre
    if (typeof e === 'number' || /^\d+$/.test(String(e))) {
      const idx = Number(e);
      return ESTADOS_DEFAULT[idx] ?? String(e);
    }
    return String(e);
  };
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [estado, setEstado] = useState<string[]>([])
  const [estadoAnchorEl, setEstadoAnchorEl] = useState<null | HTMLElement>(null)

  const estadoPopoverOpen = Boolean(estadoAnchorEl)
  const handleOpenPopover = (event: React.MouseEvent<HTMLElement>) => setEstadoAnchorEl(event.currentTarget)
  const handleClosePopover = () => setEstadoAnchorEl(null)

  const [busqueda, setBusqueda] = useState('')

  function useDebounced<T>(value: T, delay = 400) {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
      const id = setTimeout(() => setDebounced(value), delay)
      return () => clearTimeout(id)
    }, [value, delay])
    return debounced
  }

  const dBusqueda = useDebounced(busqueda, 400)
  const [orderBy, setOrderBy] = useState<string>('fecha_creacion')
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>('desc')
  const queryKey = useMemo(() => [
    'oportunidades-globales',
    { estado, busqueda: dBusqueda, fechaInicio, fechaFin, orderBy, orderDirection }
  ], [estado, dBusqueda, fechaInicio, fechaFin, orderBy, orderDirection])

  const { data: oportunidades = [], isLoading } = useQuery<any[]>({
    queryKey,
    queryFn: async ({ queryKey }) => {
      const [, f] = queryKey as [string, { estado: string[]; busqueda: string; fechaInicio: string; fechaFin: string; orderBy: string; orderDirection: 'asc' | 'desc' }]
      const params = new URLSearchParams()

      const estadosAEnviar: string[] = (f.estado.length > 0 ? f.estado : ESTADOS_DEFAULT)
        .map(normalizeEstado);

      estadosAEnviar.forEach((e) => params.append("estado", e));

      if (f.busqueda) params.append("busqueda", f.busqueda)
      if (f.fechaInicio) params.append("fecha_inicio", f.fechaInicio)
      if (f.fechaFin) params.append("fecha_fin", f.fechaFin)

      const orderingField =
        f.orderBy === 'valoracion_partner' ? 'valor_total' :
        f.orderBy === 'cliente' ? 'cliente' :
        f.orderBy || 'fecha_creacion'
      const ordering = `${f.orderDirection === 'desc' ? '-' : ''}${orderingField}`
      params.append('ordering', ordering)

      const res = await api.get(`/api/oportunidades-globales/filtrar/?${params.toString()}`)
      return Array.isArray(res.data) ? res.data : []
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev ?? [],
    refetchOnWindowFocus: false,
  })

  
  

  

  const sortedOportunidades = useMemo(() => {
    const getValue = (obj: any): any => {
      if (orderBy === 'valoracion_partner') return obj.valor_total
      if (orderBy === 'cliente') return obj.cliente?.razon_social?.toLowerCase() || ''
      if (orderBy === 'fecha_creacion') return new Date(obj.fecha_creacion).getTime()
      return obj[orderBy]?.toString().toLowerCase?.() || ''
    }

    return [...oportunidades].sort((a, b) => {
      const aValue = getValue(a)
      const bValue = getValue(b)

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return orderDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      return orderDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    })
  }, [oportunidades, orderBy, orderDirection])

  const handleBuscar = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  const handleReset = () => {
    setEstado([])
    setBusqueda('')
    setFechaInicio('')
    setFechaFin('')
    
  }

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Operaciones</Typography>

      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid size={{xs:12, sm:3 }} >
          <TextField
            label="Buscar"
            placeholder="Cliente, tienda u oportunidad"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            fullWidth
          />
        </Grid>

        <Grid size={{xs:12, sm:3 }}>
          <Button
            variant="outlined"
            onClick={handleOpenPopover}
            fullWidth
            endIcon={<TuneIcon />}
            sx={{
              height: '57px',
              color: 'text.primary',
              justifyContent: 'space-between',
              fontWeight: 400,
              px: 2,
              textTransform: 'none',
              backgroundColor: 'transparent',
              borderColor: 'rgba(255, 255, 255, 0.23)',
            }}
          >
            {estado.length > 0 ? `${estado.length} estado(s)` : 'Estados'}
          </Button>

          <Popover
            open={estadoPopoverOpen}
            anchorEl={estadoAnchorEl}
            onClose={handleClosePopover}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            PaperProps={{ sx: { p: 2, maxWidth: 555, width: '100%' } }}
          >
            <Typography variant="subtitle2" gutterBottom>Filtrar por estado</Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {Object.entries(ESTADOS_META).map(([estadoKey, meta]) => {
                const Icono = meta.icon
                const selected = estado.includes(estadoKey)
                return (
                  <Chip
                    key={estadoKey}
                    label={estadoKey}
                    size="small"
                    color={meta.color}
                    icon={Icono ? <Icono fontSize="small" /> : undefined}
                    onClick={() => {
                      setEstado((prev) =>
                        selected
                          ? prev.filter((e) => e !== estadoKey)
                          : [...prev, estadoKey]
                      )
                    }}
                    sx={{
                      cursor: 'pointer',
                      opacity: selected ? 1 : 0.5,
                      border: selected ? '2px solid' : '1px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                    }}
                  />
                )
              })}
            </Box>

            {estado.length > 0 && (
              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button size="small" onClick={() => setEstado([])}>Limpiar</Button>
              </Box>
            )}
          </Popover>
        </Grid>

        <Grid size={{xs:12, sm:2 }}>
          <TextField
            label="Desde"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Grid>

        <Grid size={{xs:12, sm:2 }}>
          <TextField
            label="Hasta"
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Grid>

        <Grid size={{xs:12, sm:3 }}>
          <Button variant="contained" onClick={handleBuscar} sx={{ mr: 1 }}>
            Buscar
          </Button>
          <Button onClick={handleReset}>Reset</Button>
        </Grid>
      </Grid>

      {isLoading ? (
        <CircularProgress />
      ) : (
        <Paper>
          <TablaReactiva
            oportunidades={oportunidades}
            usuarioId={usuario?.id}
            columnas={columnas}
            loading={isLoading}
            defaultSorting={[{ id: 'fecha_creacion', desc: true }]}
            onRowClick={(o) => router.push(`/oportunidades/global/${o.tenant}/${getIdlink(o)}`)}
          />
        </Paper>
      )}
    </Box>
  )
}
