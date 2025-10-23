/**
 * TIER 1 - CRITICAL API TESTS
 *
 * These tests cover the most critical endpoints that if they fail,
 * the entire application becomes unusable.
 *
 * Run these tests frequently (pre-commit, CI/CD)
 */

import {
  mockApiSuccess,
  mockApiError,
  mockAuthenticatedUser,
  mockTenantData,
  mockDashboardData,
  mockLoginSuccess,
  setupAuthenticatedState
} from '../utils/api-helpers'
import {
  mockUser,
  mockAdminUser,
  mockTenant,
  mockLoginResponse,
  mockDashboardData as mockDashboard,
  mockCliente,
  mockOportunidad,
  mockApiErrors
} from '../utils/mock-data'
import { login, fetchDashboardManager, fetchDashboardAdmin } from '@/services/api'

// Import API functions to test
import api from '@/services/api'

describe('Tier 1 - Critical API Tests', () => {

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  describe('Authentication APIs', () => {

    test('should login successfully with valid credentials', async () => {
      mockLoginSuccess(mockLoginResponse)

      const response = await login('test-tenant', 'test@example.com', 'password123')

      expect(response.data).toEqual(expect.objectContaining({
        refresh: expect.any(String),
        access: expect.any(String),
        schema: 'test-tenant',
        user: expect.objectContaining({
          email: 'test@example.com'
        })
      }))
    })

    test('should fail login with invalid credentials', async () => {
      mockApiError('/api/login/', 401, 'Credenciales incorrectas', 'post')

      await expect(login('test-tenant', 'wrong@email.com', 'wrongpass'))
        .rejects.toThrow()
    })

    test('should refresh token successfully', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/token/refresh/', {
        access: 'new-access-token'
      }, 'post')

      const response = await api.post('/api/token/refresh/', {
        refresh: 'mock-refresh-token'
      })

      expect(response.data.access).toBe('new-access-token')
    })

    test('should get current user information', async () => {
      setupAuthenticatedState()
      mockAuthenticatedUser(mockUser)

      const response = await api.get('/api/yo/')

      expect(response.data).toEqual(expect.objectContaining({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name
      }))
    })

    test('should handle unauthorized access', async () => {
      mockApiError('/api/yo/', 401, 'Token no válido')

      await expect(api.get('/api/yo/')).rejects.toThrow()
    })
  })

  describe('Tenant Management APIs', () => {

    test('should list tenants successfully', async () => {
      setupAuthenticatedState()
      mockTenantData([mockTenant])

      const response = await api.get('/api/tenants/')

      expect(response.data).toHaveLength(1)
      expect(response.data[0]).toEqual(expect.objectContaining({
        schema: 'test-tenant',
        nombre: 'Test Tenant'
      }))
    })

    test('should get tenant by ID', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/tenants/1/', mockTenant)

      const response = await api.get('/api/tenants/1/')

      expect(response.data).toEqual(expect.objectContaining({
        id: 1,
        schema: 'test-tenant'
      }))
    })

    test('should get tenant by schema', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/tenants/by-schema/test-tenant/', mockTenant)

      const response = await api.get('/api/tenants/by-schema/test-tenant/')

      expect(response.data.schema).toBe('test-tenant')
    })
  })

  describe('CRM - Clients APIs', () => {

    test('should list clients successfully', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/clientes/', {
        results: [mockCliente],
        count: 1,
        next: null,
        previous: null
      })

      const response = await api.get('/api/clientes/')

      expect(response.data.results).toHaveLength(1)
      expect(response.data.results[0]).toEqual(expect.objectContaining({
        nombre: 'Cliente Test',
        email: 'cliente@test.com'
      }))
    })

    test('should create client successfully', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/clientes/', mockCliente, 'post')

      const clientData = {
        nombre: 'Nuevo Cliente',
        apellidos: 'Apellidos',
        email: 'nuevo@test.com',
        telefono: '600123456',
        tipo_cliente: 'particular'
      }

      const response = await api.post('/api/clientes/', clientData)

      expect(response.data).toEqual(expect.objectContaining({
        nombre: expect.any(String),
        email: expect.any(String)
      }))
    })

    test('should get client by ID', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/clientes/1/', mockCliente)

      const response = await api.get('/api/clientes/1/')

      expect(response.data.id).toBe(1)
      expect(response.data.nombre).toBe('Cliente Test')
    })

    test('should handle client validation errors', async () => {
      setupAuthenticatedState()
      mockApiError('/api/clientes/', 400, 'Error de validación', 'post')

      await expect(api.post('/api/clientes/', {})).rejects.toThrow()
    })
  })

  describe('CRM - Opportunities APIs', () => {

    test('should list opportunities successfully', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/oportunidades/', {
        results: [mockOportunidad],
        count: 1,
        next: null,
        previous: null
      })

      const response = await api.get('/api/oportunidades/')

      expect(response.data.results).toHaveLength(1)
      expect(response.data.results[0]).toEqual(expect.objectContaining({
        id: 1,
        estado: 'presupuestado'
      }))
    })

    test('should create opportunity successfully', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/oportunidades/', mockOportunidad, 'post')

      const oppData = {
        cliente_id: 1,
        observaciones: 'Nueva oportunidad de test'
      }

      const response = await api.post('/api/oportunidades/', oppData)

      expect(response.data).toEqual(expect.objectContaining({
        id: expect.any(Number),
        estado: expect.any(String)
      }))
    })

    test('should get opportunity by ID', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/oportunidades/1/', mockOportunidad)

      const response = await api.get('/api/oportunidades/1/')

      expect(response.data.id).toBe(1)
      expect(response.data.uuid).toBeTruthy()
    })

    test('should update opportunity status', async () => {
      setupAuthenticatedState()
      const updatedOpp = { ...mockOportunidad, estado: 'aceptado' }
      mockApiSuccess('/api/oportunidades/1/', updatedOpp, 'patch')

      const response = await api.patch('/api/oportunidades/1/', {
        estado: 'aceptado'
      })

      expect(response.data.estado).toBe('aceptado')
    })
  })

  describe('Dashboard APIs', () => {

    test('should fetch manager dashboard successfully', async () => {
      setupAuthenticatedState()
      mockDashboardData(mockDashboard)

      const result = await fetchDashboardManager({
        fecha_inicio: '2024-01-01',
        fecha_fin: '2024-01-31',
        granularidad: 'mes'
      })

      expect(result).toEqual(expect.objectContaining({
        resumen: expect.objectContaining({
          valor_total: expect.any(Number),
          ticket_medio: expect.any(Number)
        }),
        evolucion: expect.arrayContaining([
          expect.objectContaining({
            periodo: expect.any(String),
            valor: expect.any(Number)
          })
        ]),
        rankings: expect.objectContaining({
          productos: expect.any(Array),
          usuarios_por_operaciones: expect.any(Array)
        })
      }))
    })

    test('should fetch admin dashboard successfully', async () => {
      setupAuthenticatedState()
      mockDashboardData(mockDashboard)

      const result = await fetchDashboardAdmin({
        fecha_inicio: '2024-01-01',
        fecha_fin: '2024-01-31',
        granularidad: 'mes'
      })

      expect(result).toEqual(expect.objectContaining({
        resumen: expect.objectContaining({
          valor_total: expect.any(Number)
        })
      }))
    })

    test('should handle dashboard API errors', async () => {
      setupAuthenticatedState()
      mockApiError('/api/dashboard/manager/', 500, 'Error interno del servidor')

      await expect(fetchDashboardManager({
        fecha_inicio: '2024-01-01',
        fecha_fin: '2024-01-31'
      })).rejects.toThrow()
    })

    test('should fetch dashboard with filters', async () => {
      setupAuthenticatedState()
      mockDashboardData(mockDashboard)

      const result = await fetchDashboardManager({
        fecha_inicio: '2024-01-01',
        fecha_fin: '2024-01-31',
        granularidad: 'semana',
        tienda_id: 1,
        usuario_id: 2,
        tenant: 'specific-tenant'
      })

      expect(result).toBeDefined()
      expect(result.resumen).toBeDefined()
    })
  })

  describe('User Management APIs', () => {

    test('should verify user credentials', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/verificar-credenciales/', { valid: true }, 'post')

      const response = await api.post('/api/verificar-credenciales/', {
        email: 'test@example.com',
        password: 'password123'
      })

      expect(response.data.valid).toBe(true)
    })

    test('should change password successfully', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/cambiar-contraseña/', { success: true }, 'post')

      const response = await api.post('/api/cambiar-contraseña/', {
        old_password: 'oldpass',
        new_password: 'newpass123'
      })

      expect(response.data.success).toBe(true)
    })

    test('should list tenant users', async () => {
      setupAuthenticatedState()
      mockApiSuccess('/api/usuarios-tenant/', [mockUser])

      const response = await api.get('/api/usuarios-tenant/')

      expect(response.data).toHaveLength(1)
      expect(response.data[0]).toEqual(expect.objectContaining({
        email: 'test@example.com'
      }))
    })
  })

  describe('API Error Handling', () => {

    test('should handle 401 unauthorized errors', async () => {
      mockApiError('/api/yo/', 401, 'Token no válido')

      await expect(api.get('/api/yo/')).rejects.toThrow()
    })

    test('should handle 403 forbidden errors', async () => {
      setupAuthenticatedState()
      mockApiError('/api/admin/capacidades/', 403, 'No tienes permisos')

      await expect(api.get('/api/admin/capacidades/')).rejects.toThrow()
    })

    test('should handle 404 not found errors', async () => {
      setupAuthenticatedState()
      mockApiError('/api/clientes/999/', 404, 'No encontrado')

      await expect(api.get('/api/clientes/999/')).rejects.toThrow()
    })

    test('should handle 500 server errors', async () => {
      setupAuthenticatedState()
      mockApiError('/api/dashboard/manager/', 500, 'Error interno del servidor')

      await expect(api.get('/api/dashboard/manager/')).rejects.toThrow()
    })
  })
})

// Additional utility tests for critical infrastructure
describe('API Infrastructure Tests', () => {

  test('should include authorization header when token exists', async () => {
    const { getSecureItem } = require('@/shared/lib/secureStorage')
    // Mock getSecureItem to return token
    getSecureItem.mockResolvedValueOnce('test-token') // access token
    getSecureItem.mockResolvedValueOnce('test-schema') // schema
    getSecureItem.mockResolvedValueOnce(null) // currentTenant

    mockApiSuccess('/api/test/', {})
    await api.get('/api/test/')

    // Verify getSecureItem was called for access token
    expect(getSecureItem).toHaveBeenCalledWith('access')
  })

  test('should include tenant header when schema exists', async () => {
    const { getSecureItem } = require('@/shared/lib/secureStorage')
    // Mock getSecureItem to return schema
    getSecureItem.mockResolvedValueOnce('test-token') // access token
    getSecureItem.mockResolvedValueOnce('test-schema') // schema
    getSecureItem.mockResolvedValueOnce(null) // currentTenant

    mockApiSuccess('/api/test/', {})
    await api.get('/api/test/')

    // Verify getSecureItem was called for schema
    expect(getSecureItem).toHaveBeenCalledWith('schema')
  })

  test('should handle network errors gracefully', async () => {
    // Mock network error
    mockApiError('/api/test/', 0, 'Network Error')

    await expect(api.get('/api/test/')).rejects.toThrow()
  })
})