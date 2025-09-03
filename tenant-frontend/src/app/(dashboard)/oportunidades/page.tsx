'use client'

import {
  Box, Typography, Paper, Chip, IconButton, CircularProgress, Select, MenuItem,Autocomplete,Divider,Snackbar,Alert,
  OutlinedInput, Popover, TextField, Button, Grid,Dialog,DialogTitle,DialogActions,DialogContent,Stepper, Step, StepLabel
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useQuery,useMutation} from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ESTADOS_B2B } from '@/context/estados'
import TuneIcon from '@mui/icons-material/Tune'
import TablaReactiva from '@/components/TablaReactiva2'
import { columnasTenant } from '@/components/TablaColumnas2'
import api from '@/services/api'
import SectorStep from "@/components/formularios/Clientes/SectorStepCliente";
import DireccionStep from "@/components/formularios/Clientes/DireccionStep";
import FinancieroStep from "@/components/formularios/Clientes/FinancieroStepCliente";
import ComercialStep from "@/components/formularios/Clientes/ComercialStepCliente";
import { useQueryClient } from '@tanstack/react-query'
import { getIdlink } from '@/utils/id'
import { useDebounceValue } from 'usehooks-ts'
interface Cliente {
  id?: number;
  tipo_cliente?: 'empresa' | 'autonomo' | 'particular';
  canal?: 'b2b' | 'b2c';
  razon_social?: string;
  cif?: string;
  contacto?: string;
  posicion?: string;
  nombre?: string;
  apellidos?: string;
  dni_nie?: string;
  nif?: string;
  nombre_comercial?: string;
  telefono?: string;
  correo?: string;
  tienda_nombre?: string;
  display_name?: string;
  identificador_fiscal?: string;
}

type ClienteOption = {
  id: number;
  razon_social?: string;
  nombre?: string;
  apellidos?: string;
  nif?: string;
  dni_nie?: string;
};
export default function OportunidadesTenantPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const columnas = columnasTenant
  const [modalOpen, setModalOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', type: 'success' });
  const pasos = ['Comerciales', 'Financieros', 'Dirección', 'Sector'];
  const ESTADOS_FINALIZADOS = ['pagado', 'recibido por el cliente']
  const handleBack = () => setPasoActivo((prev) => prev - 1);
  const [nuevo, setNuevo] = useState<Partial<Cliente>>({});
  const [pasoActivo, setPasoActivo] = useState(0);
  const [cliente, setCliente] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [estado, setEstado] = useState<string[]>([])
  const [finalizadas, setFinalizadas] = useState<'todas' | 'finalizadas' | 'no_finalizadas'>('todas')

  const [estadoAnchorEl, setEstadoAnchorEl] = useState<null | HTMLElement>(null)
  const estadoPopoverOpen = Boolean(estadoAnchorEl)
  const handleOpenPopover = (event: React.MouseEvent<HTMLElement>) => {
    setEstadoAnchorEl(event.currentTarget)
  }
  const handleClosePopover = () => setEstadoAnchorEl(null)
  const [inputCliente, setInputCliente] = useState('')
  const [clienteBusqueda, setClienteBusqueda] = useState('')
  const [openBusca, setOpenBusca] = useState(false)
  const [debouncedCliente] = useDebounceValue<string>(clienteBusqueda, 300)
  const queryKey = ['oportunidades-tenant', { cliente, fechaInicio, fechaFin, estado, finalizadas }]
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOption | null>(null);
  
  const { data: opcionesClientes = [], isFetching: buscandoClientes } = useQuery<ClienteOption[]>({
    queryKey: ['clientes', debouncedCliente],
    enabled: openBusca && debouncedCliente.trim().length >= 2, // evita spam
    queryFn: async ({ signal }) => {
      const q = debouncedCliente.trim()
      if (!q) return []
      const params = new URLSearchParams()
      params.set('search', q)         // DRF SearchFilter
      params.set('page_size', '20')   // si tienes paginación activada
      const res = await api.get(`/api/clientes/?${params.toString()}`, { signal })
      return res.data.results ?? res.data
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev ?? [],
  })
  const { data: oportunidades = [], isLoading, refetch } = useQuery<any[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (cliente) params.append('cliente', cliente)
      if (fechaInicio) params.append('fecha_inicio', fechaInicio)
      if (fechaFin) params.append('fecha_fin', fechaFin)
      estado.forEach((e) => params.append('estado', e))

      const res = await api.get(`/api/oportunidades/?${params.toString()}`)
      let oportunidades = Array.isArray(res.data) ? res.data : []

      if (finalizadas === 'finalizadas') {
        oportunidades = oportunidades.filter((o) => ESTADOS_FINALIZADOS.includes(o.estado))
      } else if (finalizadas === 'no_finalizadas') {
        oportunidades = oportunidades.filter((o) => !ESTADOS_FINALIZADOS.includes(o.estado))
      }

      return oportunidades
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev ?? [],
  })

  const handleBuscar = () => refetch()
  const handleReset = () => {
    setEstado([])
    setCliente('')
    setFechaInicio('')
    setFechaFin('')
    refetch()
  }
  function esCorreoValido(correo: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  }

  function esTelefonoValido(telefono: string): boolean {
    return /^[0-9]{9}$/.test(telefono.replace(/\s+/g, ''));
  }
  const validarPaso = () => {
    if (pasoActivo === 0) {
      if (!esCorreoValido(nuevo.correo || '') || !esTelefonoValido(nuevo.telefono || '')) {
        setSnackbar({
          open: true,
          message: 'Corrige los errores en correo o teléfono',
          type: 'error',
        });
        return false;
      }
    }
    return true;
  };
  const handleNext = () => {
    if (!validarPaso()) return;
    setPasoActivo((prev) => prev + 1);
  };
  // Crear cliente con React Query Mutation
  const crearCliente = useMutation({
    mutationFn: async (nuevoCliente: Partial<Cliente>) => {
      const res = await api.post("/api/clientes/", nuevoCliente);
      return res.data;
    },
    onSuccess: (clienteCreado) => {
      setModalOpen(false);
      setNuevo({});
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      router.push(`/clientes/${clienteCreado.id}`);
    },
    onError: () => {
      alert("❌ Error al crear cliente");
    },
    
  });
  return (
    <Box >
      <Typography variant="h5" gutterBottom>Oportunidades</Typography>
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid size={{xs: 12, sm:3}} >
          <TextField
            label="Cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            fullWidth
          />
        </Grid>

        <Grid size={{xs: 12, sm:3}}>
          <Button
            variant="outlined"
            onClick={handleOpenPopover}
            fullWidth
            endIcon={<TuneIcon />}
            sx={{ height: '57px', justifyContent: 'space-between', px: 2 }}
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
            <Typography variant="subtitle2" gutterBottom>
              Filtrar por estado
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {Object.entries(ESTADOS_B2B).map(([estadoKey, meta]) => {
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
                        selected ? prev.filter((e) => e !== estadoKey) : [...prev, estadoKey]
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
                <Button size="small" onClick={() => setEstado([])}>
                  Limpiar
                </Button>
              </Box>
            )}
          </Popover>
        </Grid>

        <Grid size={{xs: 12, sm:2}}>
          <TextField
            label="Desde"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Grid>
        <Grid size={{xs: 12, sm:2}}>
          <TextField
            label="Hasta"
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Grid>

        <Grid size={{xs: 12, sm:2}}>
          <Button variant="contained" onClick={handleBuscar} sx={{ mr: 1 }}>
            Buscar
          </Button>
          <Button onClick={handleReset}>Reset</Button>
        </Grid>
        <Button variant="contained" onClick={() => setModalNuevoAbierto(true)}>
          Nueva oportunidad
        </Button>

      </Grid>

      {isLoading ? (
        <CircularProgress />
      ) : (
        <Paper>
          <TablaReactiva
            oportunidades={oportunidades}
            columnas={columnas}
            loading={isLoading}
            defaultSorting={[{ id: 'fecha_creacion', desc: true }]}
            onRowClick={(o: any) => router.push(`/clientes/oportunidades/${getIdlink(o)}`)}
          />
        </Paper>
      )}
      <Dialog open={modalNuevoAbierto} onClose={() => setModalNuevoAbierto(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Crear nueva oportunidad</DialogTitle>
        <DialogContent>
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Selecciona un cliente</Typography>
            <Autocomplete<ClienteOption, false, false, false>
              open={openBusca}
              onOpen={() => setOpenBusca(true)}
              onClose={() => setOpenBusca(false)}
              options={opcionesClientes}
              filterOptions={(x) => x} // no refiltrar en el cliente
              loading={buscandoClientes}
              getOptionLabel={(o) =>
                o.razon_social ||
                [o.nombre, o.apellidos].filter(Boolean).join(' ') ||
                o.nif || o.dni_nie || ''
              }
              onInputChange={(_, value) => setClienteBusqueda(value)}
              onChange={(_, nuevo) => setClienteSeleccionado(nuevo)}
              noOptionsText={
                debouncedCliente.trim().length < 2
                  ? 'Escribe al menos 2 caracteres'
                  : 'Sin resultados'
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Buscar cliente"
                  placeholder="Nombre, apellidos, DNI/NIE, NIF, Razón social…"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {buscandoClientes ? <CircularProgress size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                  fullWidth
                />
              )}
            />

          </Box>
          <Divider sx={{ my: 2 }} />
          <Box>
            
            <Button variant="outlined" onClick={() => {
              setModalOpen(true)
                // asegúrate de tener esta ruta implementada
            }}>
              Crear cliente nuevo
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalNuevoAbierto(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!clienteSeleccionado}
            onClick={() => {
              if (!clienteSeleccionado) return
              router.push(`/clientes/${clienteSeleccionado.id}`)
              setModalNuevoAbierto(false)
            }}
          >
            Ir a la ficha del cliente
          </Button>
        </DialogActions>
      </Dialog>
            {/* Modal de creación */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Nuevo cliente</DialogTitle>
        <DialogContent dividers>
          <Stepper activeStep={pasoActivo} alternativeLabel sx={{ mb: 3 }}>
            {pasos.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {pasoActivo === 0 && <ComercialStep nuevo={nuevo} setNuevo={setNuevo} />}
          {pasoActivo === 1 && <FinancieroStep nuevo={nuevo} setNuevo={setNuevo} />}
          {pasoActivo === 2 && <DireccionStep nuevo={nuevo} setNuevo={setNuevo} />}
          {pasoActivo === 3 && <SectorStep nuevo={nuevo} setNuevo={setNuevo} />}
        </DialogContent>

        <DialogActions>
          {pasoActivo > 0 && (
            <Button onClick={handleBack}>Anterior</Button>
          )}
          {pasoActivo < pasos.length - 1 ? (
            <Button variant="contained" onClick={handleNext}>Siguiente</Button>
          ) : (
            <Button variant="contained" onClick={() => crearCliente.mutate(nuevo)}>Crear</Button>
          )}
        </DialogActions>
      </Dialog>
      <Snackbar
  open={snackbar.open}
  onClose={() => setSnackbar({ ...snackbar, open: false })}
  autoHideDuration={4000}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
>
  <Alert
    onClose={() => setSnackbar({ ...snackbar, open: false })}
    severity={snackbar.type === 'error' ? 'error' : 'success'}
    variant="filled"
    sx={{ width: '100%' }}
  >
    {snackbar.message}
  </Alert>
</Snackbar>
    </Box>
  )
}
