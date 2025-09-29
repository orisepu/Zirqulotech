import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDebounceValue } from 'usehooks-ts'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Autocomplete,
  TextField,
  CircularProgress,
  Divider,
} from '@mui/material'

import OportunidadForm from '@/features/opportunities/components/OportunidadForm'
import FormularioClientes from '@/features/clients/components/forms/FormularioClientes'
import api from '@/services/api'
import { Cliente, ClienteOption } from '@/shared/types/oportunidades'

interface Props {
  open: boolean
  onClose: () => void
  soloEmpresas: boolean
  clienteSeleccionado: ClienteOption | null
  onClienteChange: (cliente: ClienteOption | null) => void
  onCreateCliente: (cliente: Partial<Cliente>) => void
  isCreatingCliente: boolean
}

export function CreateOportunidadDialog({
  open,
  onClose,
  soloEmpresas,
  clienteSeleccionado,
  onClienteChange,
  onCreateCliente,
  isCreatingCliente,
}: Props) {
  const [modalClienteOpen, setModalClienteOpen] = useState(false)
  const [crearOportunidadOpen, setCrearOportunidadOpen] = useState(false)
  const [clienteBusqueda, setClienteBusqueda] = useState('')
  const [openBusca, setOpenBusca] = useState(false)
  const [debouncedCliente] = useDebounceValue<string>(clienteBusqueda, 300)

  const { data: opcionesClientes = [], isFetching: buscandoClientes } = useQuery<ClienteOption[]>({
    queryKey: ['clientes', debouncedCliente],
    enabled: openBusca && debouncedCliente.trim().length >= 2,
    queryFn: async ({ signal }) => {
      const q = debouncedCliente.trim()
      if (!q) return []
      const params = new URLSearchParams()
      params.set('search', q)
      params.set('page_size', '20')
      const res = await api.get(`/api/clientes/?${params.toString()}`, { signal })
      return res.data.results ?? res.data
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev ?? [],
  })

  const opcionesClientesFiltradas = useMemo(
    () => (soloEmpresas ? opcionesClientes.filter((opt) => opt.tipo_cliente !== 'particular') : opcionesClientes),
    [opcionesClientes, soloEmpresas]
  )

  const getClienteLabel = (cliente: ClienteOption) => {
    const nombre =
      cliente.display_name ||
      cliente.razon_social ||
      [cliente.nombre, cliente.apellidos].filter(Boolean).join(' ').trim() ||
      cliente.nombre_comercial || ''
    const fiscal = cliente.identificador_fiscal || cliente.nif || cliente.dni_nie || ''
    return (nombre || fiscal || '-')
  }

  const handleCreateCliente = (clienteData: Partial<Cliente>) => {
    onCreateCliente(clienteData)
    setModalClienteOpen(false)
  }

  const handleClose = () => {
    setCrearOportunidadOpen(false)
    onClose()
  }

  if (crearOportunidadOpen && clienteSeleccionado) {
    return (
      <Dialog
        open={open}
        disableEscapeKeyDown
        onClose={(_, reason) => {
          if (reason === 'backdropClick') return
          handleClose()
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Crear nueva oportunidad</DialogTitle>
        <DialogContent dividers>
          <OportunidadForm
            clienteId={clienteSeleccionado.id}
            onClose={handleClose}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog
        open={open}
        disableEscapeKeyDown
        onClose={(_, reason) => {
          if (reason === 'backdropClick') return
          onClose()
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Crear nueva oportunidad</DialogTitle>
        <DialogContent>
          <Box sx={{ my: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Selecciona un cliente
            </Typography>
            <Autocomplete<ClienteOption, false, false, false>
              open={openBusca}
              onOpen={() => setOpenBusca(true)}
              onClose={() => setOpenBusca(false)}
              options={opcionesClientesFiltradas}
              value={clienteSeleccionado}
              filterOptions={(x) => x}
              loading={buscandoClientes}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              getOptionLabel={getClienteLabel}
              renderOption={(props, option) => {
                const label =
                  option.display_name ||
                  option.razon_social ||
                  [option.nombre, option.apellidos].filter(Boolean).join(' ').trim() ||
                  option.nombre_comercial ||
                  option.identificador_fiscal || option.nif || option.dni_nie ||
                  '(sin nombre)'
                return (
                  <li {...props} key={String(option.id)}>
                    {label}
                  </li>
                )
              }}
              onInputChange={(_, value) => setClienteBusqueda(value)}
              onChange={(_, nuevo) => onClienteChange(nuevo)}
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
            <Button
              variant="outlined"
              onClick={() => setModalClienteOpen(true)}
              disabled={isCreatingCliente}
            >
              {isCreatingCliente ? 'Creando...' : 'Crear cliente nuevo'}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!clienteSeleccionado}
            onClick={() => setCrearOportunidadOpen(true)}
          >
            Crear oportunidad
          </Button>
        </DialogActions>
      </Dialog>

      <FormularioClientes
        open={modalClienteOpen}
        onClose={() => setModalClienteOpen(false)}
        onCreate={handleCreateCliente}
        soloEmpresas={soloEmpresas}
      />
    </>
  )
}