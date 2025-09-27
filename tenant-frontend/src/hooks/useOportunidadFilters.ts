import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { OportunidadFilters } from '@/types/oportunidades'

const initialFilters: OportunidadFilters = {
  cliente: '',
  fechaInicio: '',
  fechaFin: '',
  estado: [],
  finalizadas: 'todas'
}

export function useOportunidadFilters() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<OportunidadFilters>(initialFilters)

  const handleBuscar = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['oportunidades-tenant']
    })
  }, [queryClient])

  const handleReset = useCallback(() => {
    setFilters(initialFilters)
    queryClient.invalidateQueries({
      queryKey: ['oportunidades-tenant']
    })
  }, [queryClient])

  return {
    filters,
    setFilters,
    handleBuscar,
    handleReset
  }
}