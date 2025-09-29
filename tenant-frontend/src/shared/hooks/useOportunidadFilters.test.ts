import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOportunidadFilters } from './useOportunidadFilters'

describe('useOportunidadFilters', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
          gcTime: 0,
        },
      },
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const React = require('react')
    const { QueryClientProvider } = require('@tanstack/react-query')
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }

  it('should initialize with default filters', () => {
    const { result } = renderHook(() => useOportunidadFilters(), { wrapper })

    expect(result.current.filters).toEqual({
      cliente: '',
      fechaInicio: '',
      fechaFin: '',
      estado: [],
      finalizadas: 'todas'
    })
  })

  it('should update filters when setFilters is called', () => {
    const { result } = renderHook(() => useOportunidadFilters(), { wrapper })

    const newFilters = {
      cliente: 'Test Cliente',
      fechaInicio: '2024-01-01',
      fechaFin: '2024-12-31',
      estado: ['pendiente', 'en_proceso'],
      finalizadas: 'no' as const
    }

    act(() => {
      result.current.setFilters(newFilters)
    })

    expect(result.current.filters).toEqual(newFilters)
  })

  it('should update partial filters', () => {
    const { result } = renderHook(() => useOportunidadFilters(), { wrapper })

    act(() => {
      result.current.setFilters(prev => ({
        ...prev,
        cliente: 'Updated Cliente'
      }))
    })

    expect(result.current.filters.cliente).toBe('Updated Cliente')
    expect(result.current.filters.fechaInicio).toBe('')
    expect(result.current.filters.fechaFin).toBe('')
  })

  it('should invalidate queries when handleBuscar is called', () => {
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useOportunidadFilters(), { wrapper })

    act(() => {
      result.current.handleBuscar()
    })

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['oportunidades-tenant']
    })
  })

  it('should reset filters and invalidate queries when handleReset is called', () => {
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useOportunidadFilters(), { wrapper })

    // Set some filters first
    act(() => {
      result.current.setFilters({
        cliente: 'Test Cliente',
        fechaInicio: '2024-01-01',
        fechaFin: '2024-12-31',
        estado: ['pendiente'],
        finalizadas: 'si'
      })
    })

    // Verify filters are set
    expect(result.current.filters.cliente).toBe('Test Cliente')

    // Reset filters
    act(() => {
      result.current.handleReset()
    })

    // Verify filters are reset to initial state
    expect(result.current.filters).toEqual({
      cliente: '',
      fechaInicio: '',
      fechaFin: '',
      estado: [],
      finalizadas: 'todas'
    })

    // Verify queries were invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['oportunidades-tenant']
    })
  })

  it('should maintain function references for callbacks', () => {
    const { result, rerender } = renderHook(() => useOportunidadFilters(), { wrapper })

    const initialHandleBuscar = result.current.handleBuscar
    const initialHandleReset = result.current.handleReset

    // Rerender the hook
    rerender()

    // Function references should be stable
    expect(result.current.handleBuscar).toBe(initialHandleBuscar)
    expect(result.current.handleReset).toBe(initialHandleReset)
  })

  it('should handle estado array updates correctly', () => {
    const { result } = renderHook(() => useOportunidadFilters(), { wrapper })

    act(() => {
      result.current.setFilters(prev => ({
        ...prev,
        estado: ['pendiente', 'en_proceso', 'completado']
      }))
    })

    expect(result.current.filters.estado).toEqual(['pendiente', 'en_proceso', 'completado'])
    expect(result.current.filters.estado.length).toBe(3)
  })
})