import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useUsuarioActual from './useUsuarioActual'

// Mock simple del hook sin API calls
jest.mock('@/services/api', () => ({
  get: jest.fn().mockRejectedValue(new Error('No data'))
}))

describe('useUsuarioActual - Simple Tests', () => {
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

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const React = require('react')
    const { QueryClientProvider } = require('@tanstack/react-query')
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }

  it('should return null initially when no data', () => {
    const { result } = renderHook(() => useUsuarioActual(), { wrapper })

    // Should start with null when API fails
    expect(result.current).toBeNull()
  })

  it('should be a valid hook', () => {
    const { result } = renderHook(() => useUsuarioActual(), { wrapper })

    // Should not crash and return something (null or data)
    expect(result.current === null || typeof result.current === 'object').toBe(true)
  })

  it('should work with QueryClient provider', () => {
    // Test that hook works within React Query context
    expect(() => {
      renderHook(() => useUsuarioActual(), { wrapper })
    }).not.toThrow()
  })
})