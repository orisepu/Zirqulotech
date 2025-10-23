/**
 * ADVANCED AUTHENTICATION TESTS
 *
 * These tests cover advanced authentication scenarios including:
 * - Tenant not found errors (404)
 * - User blocked by Django Axes (403)
 * - Token refresh with race conditions
 * - Secure storage integration
 * - Error handling and recovery
 */

import {
  mockApiSuccess,
  mockApiError,
  setupAuthenticatedState
} from '../utils/api-helpers'
import {
  mockLoginResponse,
  mockApiErrors
} from '../utils/mock-data'
import { login } from '@/services/api'
import api from '@/services/api'
import { mockAxios, mockAxiosGlobal } from '../setup'

describe('Advanced Authentication Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks()
    mockAxios.reset()
    mockAxiosGlobal.reset()
  })

  describe('Login Error Scenarios', () => {

    test('should handle 404 when tenant does not exist', async () => {
      // Simula el caso del tenant 'progeek' que no existe
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(404, { detail: 'Empresa no encontrada.' })

      await expect(login('progeek', 'user@example.com', 'password123'))
        .rejects.toMatchObject({
          response: {
            status: 404,
            data: { detail: 'Empresa no encontrada.' }
          }
        })
    })

    test('should handle 403 when user is blocked by Django Axes', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(403, {
          detail: 'Cuenta bloqueada por demasiados intentos de inicio de sesión. Por favor, inténtelo de nuevo más tarde.'
        })

      await expect(login('test-tenant', 'blocked@example.com', 'password123'))
        .rejects.toMatchObject({
          response: {
            status: 403,
            data: {
              detail: expect.stringContaining('bloqueada')
            }
          }
        })
    })

    test('should handle 403 when user has no permissions in tenant', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(403, { detail: 'No tienes permisos en esta empresa.' })

      await expect(login('test-tenant', 'nopermissions@example.com', 'password123'))
        .rejects.toMatchObject({
          response: {
            status: 403,
            data: { detail: 'No tienes permisos en esta empresa.' }
          }
        })
    })

    test('should handle 403 when location security blocks login', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(403, {
          detail: 'Login bloqueado por razones de seguridad. Se ha enviado un email a tu cuenta con más información.'
        })

      await expect(login('test-tenant', 'user@example.com', 'password123'))
        .rejects.toMatchObject({
          response: {
            status: 403,
            data: {
              detail: expect.stringContaining('seguridad')
            }
          }
        })
    })

    test('should handle 401 when 2FA is required due to unusual location', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(401, {
          detail: 'Se detectó un login desde una ubicación inusual. Por seguridad, verifica tu email para continuar.',
          require_verification: true
        })

      await expect(login('test-tenant', 'user@example.com', 'password123'))
        .rejects.toMatchObject({
          response: {
            status: 401,
            data: {
              detail: expect.stringContaining('ubicación inusual'),
              require_verification: true
            }
          }
        })
    })

    test('should handle 401 with invalid credentials', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(401, { detail: 'Credenciales incorrectas.' })

      await expect(login('test-tenant', 'wrong@email.com', 'wrongpass'))
        .rejects.toMatchObject({
          response: {
            status: 401,
            data: { detail: 'Credenciales incorrectas.' }
          }
        })
    })

    test('should handle 400 when required fields are missing', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(400, { detail: 'Faltan datos.' })

      await expect(login('', '', ''))
        .rejects.toMatchObject({
          response: {
            status: 400,
            data: { detail: 'Faltan datos.' }
          }
        })
    })

    test('should include X-Tenant header in login request', async () => {
      let capturedHeaders: any = null

      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply((config) => {
          capturedHeaders = config.headers
          return [200, mockLoginResponse]
        })

      await login('my-tenant', 'user@example.com', 'password123')

      expect(capturedHeaders).toBeDefined()
      expect(capturedHeaders?.['X-Tenant']).toBe('my-tenant')
    })
  })

  describe('Token Refresh Scenarios', () => {

    test('should refresh token successfully on 401', async () => {
      setupAuthenticatedState()

      // Primera request falla con 401
      mockAxios.onGet('/api/test-endpoint/').replyOnce(401)

      // Refresh token devuelve nuevo access token (usa axios global)
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/token/refresh/')
        .reply(200, { access: 'new-access-token' })

      // Retry de la request original con nuevo token
      mockAxios.onGet('/api/test-endpoint/').reply(200, { data: 'success' })

      const response = await api.get('/api/test-endpoint/')

      expect(response.data).toEqual({ data: 'success' })
    })

    test('should redirect to login when refresh token fails', async () => {
      setupAuthenticatedState()

      // Primera request falla con 401
      mockAxios.onGet('/api/test-endpoint/').replyOnce(401)

      // Refresh token también falla (usa axios global)
      mockAxiosGlobal.onPost('https://zirqulotech.com/api/token/refresh/').reply(401, {
        detail: 'Token refresh inválido'
      })

      await expect(api.get('/api/test-endpoint/')).rejects.toMatchObject({
        response: {
          status: 401
        }
      })
    })

    test('should handle refresh token expiration', async () => {
      setupAuthenticatedState()

      mockAxios.onGet('/api/test-endpoint/').replyOnce(401)

      mockAxiosGlobal.onPost('https://zirqulotech.com/api/token/refresh/').reply(401, {
        detail: 'Token expirado',
        code: 'token_not_valid'
      })

      await expect(api.get('/api/test-endpoint/')).rejects.toMatchObject({
        response: {
          status: 401,
          data: {
            detail: 'Token expirado'
          }
        }
      })
    })

    test('should not retry request more than once', async () => {
      setupAuthenticatedState()

      let requestCount = 0

      mockAxios.onGet('/api/test-endpoint/').reply(() => {
        requestCount++
        return [401, { detail: 'Unauthorized' }]
      })

      mockAxiosGlobal.onPost('https://zirqulotech.com/api/token/refresh/').reply(200, { access: 'new-token' })

      try {
        await api.get('/api/test-endpoint/')
      } catch (error) {
        // Expected to fail
      }

      // Should attempt original request + 1 retry = 2 attempts max
      // Due to interceptor logic with _retry flag
      expect(requestCount).toBeLessThanOrEqual(2)
    })
  })

  describe('Authorization Header Management', () => {

    test('should include Authorization header when token exists', async () => {
      setupAuthenticatedState()

      let capturedHeaders: any = null

      mockAxios.onGet('/api/test/').reply((config) => {
        capturedHeaders = config.headers
        return [200, {}]
      })

      await api.get('/api/test/')

      expect(capturedHeaders?.Authorization).toBe('Bearer mock-access-token')
    })

    test('should include X-Tenant header when schema exists', async () => {
      setupAuthenticatedState()

      let capturedHeaders: any = null

      mockAxios.onGet('/api/test/').reply((config) => {
        capturedHeaders = config.headers
        return [200, {}]
      })

      await api.get('/api/test/')

      expect(capturedHeaders?.['X-Tenant']).toBe('test-tenant')
    })

    test('should not include Authorization header when token is missing', async () => {
      // Don't setup authenticated state
      const mockLocalStorage = localStorage as jest.Mocked<typeof localStorage>
      mockLocalStorage.getItem.mockReturnValue(null)

      // Also ensure secureStorage returns null
      const { getSecureItem } = require('@/shared/lib/secureStorage')
      if (jest.isMockFunction(getSecureItem)) {
        getSecureItem.mockResolvedValue(null)
      }

      let capturedHeaders: any = null

      mockAxios.onGet('/api/public-endpoint/').reply((config) => {
        capturedHeaders = config.headers
        return [200, {}]
      })

      await api.get('/api/public-endpoint/')

      expect(capturedHeaders?.Authorization).toBeUndefined()
    })
  })

  describe('Current User Endpoint (/api/yo/)', () => {

    test('should fetch current user successfully', async () => {
      setupAuthenticatedState()

      const mockUserData = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        global: {
          es_superadmin: false,
          es_empleado_interno: true,
          roles_por_tenant: {
            'test-tenant': {
              rol: 'empleado',
              tienda_id: 1
            }
          }
        },
        tenant: {
          schema: 'test-tenant',
          name: 'Test Company',
          solo_empresas: false,
          es_demo: false
        }
      }

      mockApiSuccess('/api/yo/', mockUserData)

      const response = await api.get('/api/yo/')

      expect(response.data).toMatchObject({
        id: 1,
        email: 'test@example.com',
        global: expect.objectContaining({
          es_superadmin: false,
          es_empleado_interno: true
        })
      })
    })

    test('should handle 401 when accessing /api/yo/ without token', async () => {
      mockApiError('/api/yo/', 401, 'Token no válido')

      await expect(api.get('/api/yo/')).rejects.toThrow()
    })

    test('should fetch user data with multiple tenant access', async () => {
      setupAuthenticatedState()

      const mockUserWithMultipleTenants = {
        id: 1,
        email: 'multi@example.com',
        name: 'Multi Tenant User',
        global: {
          es_superadmin: false,
          es_empleado_interno: true,
          roles_por_tenant: {
            'tenant-a': { rol: 'empleado', tienda_id: 1 },
            'tenant-b': { rol: 'manager', tienda_id: 2 },
            'tenant-c': { rol: 'empleado', tienda_id: 3 }
          }
        }
      }

      mockApiSuccess('/api/yo/', mockUserWithMultipleTenants)

      const response = await api.get('/api/yo/')

      expect(response.data.global.roles_por_tenant).toHaveProperty('tenant-a')
      expect(response.data.global.roles_por_tenant).toHaveProperty('tenant-b')
      expect(response.data.global.roles_por_tenant).toHaveProperty('tenant-c')
    })
  })

  describe('Special Cases', () => {

    test('should login to public schema when empresa is "zirqulotech"', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(200, {
          ...mockLoginResponse,
          schema: 'public', // Backend returns public schema
          user: {
            ...mockLoginResponse.user,
            global_role: {
              es_superadmin: true,
              es_empleado_interno: true
            }
          }
        })

      const response = await login('zirqulotech', 'admin@zirqulotech.com', 'adminpass')

      expect(response.data.schema).toBe('public')
      expect(response.data.user.global_role.es_empleado_interno).toBe(true)
    })

    test('should handle network errors gracefully', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .networkError()

      await expect(login('test-tenant', 'user@example.com', 'password123'))
        .rejects.toThrow()
    })

    test('should handle timeout errors', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .timeout()

      await expect(login('test-tenant', 'user@example.com', 'password123'))
        .rejects.toThrow()
    })

    test('should handle 500 internal server error', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(500, { detail: 'Error interno del servidor' })

      await expect(login('test-tenant', 'user@example.com', 'password123'))
        .rejects.toMatchObject({
          response: {
            status: 500
          }
        })
    })
  })

  describe('Login Response Structure', () => {

    test('should return all required fields on successful login', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(200, mockLoginResponse)

      const response = await login('test-tenant', 'test@example.com', 'password123')

      expect(response.data).toHaveProperty('refresh')
      expect(response.data).toHaveProperty('access')
      expect(response.data).toHaveProperty('schema')
      expect(response.data).toHaveProperty('user')
      expect(response.data).toHaveProperty('tenantAccess')

      expect(typeof response.data.refresh).toBe('string')
      expect(typeof response.data.access).toBe('string')
      expect(typeof response.data.schema).toBe('string')
      expect(typeof response.data.user).toBe('object')
      expect(Array.isArray(response.data.tenantAccess)).toBe(true)
    })

    test('should return user object with correct structure', async () => {
      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(200, mockLoginResponse)

      const response = await login('test-tenant', 'test@example.com', 'password123')

      expect(response.data.user).toMatchObject({
        id: expect.any(Number),
        email: expect.any(String),
        tipo_usuario: expect.any(String),
        name: expect.any(String)
      })
    })

    test('should return tenantAccess array with accessible schemas', async () => {
      const mockMultiTenantResponse = {
        ...mockLoginResponse,
        tenantAccess: ['tenant-a', 'tenant-b', 'tenant-c']
      }

      mockAxiosGlobal
        .onPost('https://zirqulotech.com/api/login/')
        .reply(200, mockMultiTenantResponse)

      const response = await login('tenant-a', 'multi@example.com', 'password123')

      expect(response.data.tenantAccess).toHaveLength(3)
      expect(response.data.tenantAccess).toContain('tenant-a')
      expect(response.data.tenantAccess).toContain('tenant-b')
      expect(response.data.tenantAccess).toContain('tenant-c')
    })
  })
})
