'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
} from '@mui/material'

import TablaReactiva from '@/shared/components/TablaReactiva2'
import { columnasTenant } from '@/shared/components/TablaColumnas2'
import useUsuarioActual from '@/shared/hooks/useUsuarioActual'
import { getIdlink } from '@/shared/utils/id'
import api from '@/services/api'

// Refactored components
import { OportunidadFilters } from '@/features/opportunities/components/OportunidadFilters'
import { CreateOportunidadDialog } from '@/features/opportunities/components/CreateOportunidadDialog'
import { useOportunidadFilters } from '@/shared/hooks/useOportunidadFilters'
import { useClienteSearch } from '@/shared/hooks/useClienteSearch'
import { ESTADOS_FINALIZADOS, ESTADOS_OPERACIONES_SET } from '@/shared/constants/oportunidades'
export default function OportunidadesTenantPage() {
  const router = useRouter()
  const usuario = useUsuarioActual()
  const soloEmpresas = usuario?.tenant?.solo_empresas ?? false
  const columnas = columnasTenant

  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false)

  const {
    filters,
    setFilters,
    handleBuscar,
    handleReset
  } = useOportunidadFilters()

  const {
    clienteSeleccionado,
    setClienteSeleccionado,
    crearCliente
  } = useClienteSearch()
  const queryKey = ['oportunidades-tenant', filters]

  const { data: oportunidades = [], isLoading } = useQuery<any[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.cliente) params.append('cliente', filters.cliente)
      if (filters.fechaInicio) params.append('fecha_inicio', filters.fechaInicio)
      if (filters.fechaFin) params.append('fecha_fin', filters.fechaFin)
      filters.estado.forEach((e) => params.append('estado', e))

      const res = await api.get(`/api/oportunidades/?${params.toString()}`)
      let oportunidades = Array.isArray(res.data) ? res.data : []

      oportunidades = oportunidades.filter((o) => !ESTADOS_OPERACIONES_SET.has(String(o.estado || '').toLowerCase()))

      if (filters.finalizadas === 'finalizadas') {
        oportunidades = oportunidades.filter((o) => ESTADOS_FINALIZADOS.includes(o.estado))
      } else if (filters.finalizadas === 'no_finalizadas') {
        oportunidades = oportunidades.filter((o) => !ESTADOS_FINALIZADOS.includes(o.estado))
      }

      return oportunidades
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev ?? [],
  })


  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Oportunidades
      </Typography>

      <OportunidadFilters
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={handleBuscar}
        onReset={handleReset}
        onCreateNew={() => setModalNuevoAbierto(true)}
      />

      {isLoading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
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
      <CreateOportunidadDialog
        open={modalNuevoAbierto}
        onClose={() => setModalNuevoAbierto(false)}
        soloEmpresas={soloEmpresas}
        clienteSeleccionado={clienteSeleccionado}
        onClienteChange={setClienteSeleccionado}
        onCreateCliente={crearCliente.mutate}
        isCreatingCliente={crearCliente.isPending}
      />
    </Box>
  )
}
