import { mockAxios, mockAxiosGlobal } from '../setup'

// Helper to mock successful API response
export const mockApiSuccess = (endpoint: string, data: any, method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get') => {
  switch (method) {
    case 'get':
      mockAxios.onGet(endpoint).reply(200, data)
      break
    case 'post':
      mockAxios.onPost(endpoint).reply(200, data)
      break
    case 'put':
      mockAxios.onPut(endpoint).reply(200, data)
      break
    case 'patch':
      mockAxios.onPatch(endpoint).reply(200, data)
      break
    case 'delete':
      mockAxios.onDelete(endpoint).reply(200, data)
      break
  }
}

// Helper to mock API error
export const mockApiError = (endpoint: string, status: number, message: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get') => {
  const errorData = { detail: message }
  switch (method) {
    case 'get':
      mockAxios.onGet(endpoint).reply(status, errorData)
      break
    case 'post':
      mockAxios.onPost(endpoint).reply(status, errorData)
      break
    case 'put':
      mockAxios.onPut(endpoint).reply(status, errorData)
      break
    case 'patch':
      mockAxios.onPatch(endpoint).reply(status, errorData)
      break
    case 'delete':
      mockAxios.onDelete(endpoint).reply(status, errorData)
      break
  }
}

// Helper to mock authenticated user
export const mockAuthenticatedUser = (userData = {}) => {
  const defaultUser = {
    id: 1,
    email: 'test@example.com',
    tipo_usuario: 'empleado',
    name: 'Test User',
    global_role: {
      es_superadmin: false,
      es_empleado_interno: true,
      roles_por_tenant: {}
    }
  }

  mockApiSuccess('/api/yo/', { ...defaultUser, ...userData })
}

// Helper to mock tenant data
export const mockTenantData = (tenants = []) => {
  const defaultTenants = [
    {
      id: 1,
      schema: 'test-tenant',
      nombre: 'Test Tenant',
      name: 'Test Tenant Company'
    }
  ]

  mockApiSuccess('/api/tenants/', tenants.length > 0 ? tenants : defaultTenants)
}

// Helper to mock dashboard data
export const mockDashboardData = (dashboardData = {}) => {
  const defaultDashboard = {
    resumen: {
      valor_total: 15000,
      ticket_medio: 150,
      margen_medio: 75,
      comision_total: 1500
    },
    evolucion: [
      { periodo: '2024-01', valor: 5000 },
      { periodo: '2024-02', valor: 7500 },
      { periodo: '2024-03', valor: 2500 }
    ],
    rankings: {
      productos: [
        { producto: 'iPhone 13', valor: 8000, ops: 20 },
        { producto: 'iPhone 12', valor: 4500, ops: 15 }
      ],
      usuarios_por_operaciones: [
        { usuario: 'Juan Pérez', ops: 25 },
        { usuario: 'María García', ops: 18 }
      ],
      usuarios_por_valor: [
        { usuario: 'Juan Pérez', valor: 9500 },
        { usuario: 'María García', valor: 5500 }
      ]
    },
    pipeline: {
      por_estado: [
        { estado: 'Presupuestado', count: 10, valor: 5000 },
        { estado: 'Vendido', count: 5, valor: 3000 }
      ]
    }
  }

  const mergedData = { ...defaultDashboard, ...dashboardData }
  mockApiSuccess('/api/dashboard/manager/', mergedData)
  mockApiSuccess('/api/dashboard/admin/', mergedData)
}

// Helper to mock login response
export const mockLoginSuccess = (loginData = {}) => {
  const defaultLogin = {
    refresh: 'mock-refresh-token',
    access: 'mock-access-token',
    schema: 'test-tenant',
    tenantAccess: ['test-tenant'],
    user: {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      tipo_usuario: 'empleado'
    }
  }

  // Mock on global axios since login uses axios directly
  mockAxiosGlobal.onPost('https://zirqulotech.com/api/login/').reply(200, { ...defaultLogin, ...loginData })
}

// Helper to set up localStorage mock with auth data
export const setupAuthenticatedState = () => {
  const mockLocalStorage = localStorage as jest.Mocked<typeof localStorage>
  mockLocalStorage.getItem.mockImplementation((key: string) => {
    switch (key) {
      case 'access':
        return 'mock-access-token'
      case 'refresh':
        return 'mock-refresh-token'
      case 'schema':
        return 'test-tenant'
      default:
        return null
    }
  })

  // Configure secure storage mocks (they should be set up in setup.ts)
  const { getSecureItem, setSecureItem } = require('@/shared/lib/secureStorage')

  if (jest.isMockFunction(getSecureItem)) {
    getSecureItem.mockImplementation((key: string) => {
      switch (key) {
        case 'access':
          return Promise.resolve('mock-access-token')
        case 'refresh':
          return Promise.resolve('mock-refresh-token')
        case 'schema':
          return Promise.resolve('test-tenant')
        case 'currentTenant':
          return Promise.resolve('test-tenant')
        default:
          return Promise.resolve(null)
      }
    })
  }

  if (jest.isMockFunction(setSecureItem)) {
    setSecureItem.mockResolvedValue(undefined)
  }
}

// Helper to simulate API delay
export const mockApiWithDelay = (endpoint: string, data: any, delay: number = 1000, method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get') => {
  const replyWithDelay = () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve([200, data]), delay)
    })
  }

  switch (method) {
    case 'get':
      mockAxios.onGet(endpoint).reply(replyWithDelay)
      break
    case 'post':
      mockAxios.onPost(endpoint).reply(replyWithDelay)
      break
    case 'put':
      mockAxios.onPut(endpoint).reply(replyWithDelay)
      break
    case 'patch':
      mockAxios.onPatch(endpoint).reply(replyWithDelay)
      break
    case 'delete':
      mockAxios.onDelete(endpoint).reply(replyWithDelay)
      break
  }
}

// Helper to check if request has authorization header
export const expectAuthHeader = (endpoint: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get') => {
  return new Promise((resolve) => {
    const handler = (config: any) => {
      const authHeader = config.headers?.Authorization
      resolve(authHeader)
      return [200, {}]
    }

    switch (method) {
      case 'get':
        mockAxios.onGet(endpoint).reply(handler)
        break
      case 'post':
        mockAxios.onPost(endpoint).reply(handler)
        break
      case 'put':
        mockAxios.onPut(endpoint).reply(handler)
        break
      case 'patch':
        mockAxios.onPatch(endpoint).reply(handler)
        break
      case 'delete':
        mockAxios.onDelete(endpoint).reply(handler)
        break
    }
  })
}

// Helper to check if request has tenant header
export const expectTenantHeader = (endpoint: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get') => {
  return new Promise((resolve) => {
    const handler = (config: any) => {
      const tenantHeader = config.headers?.['X-Tenant']
      resolve(tenantHeader)
      return [200, {}]
    }

    switch (method) {
      case 'get':
        mockAxios.onGet(endpoint).reply(handler)
        break
      case 'post':
        mockAxios.onPost(endpoint).reply(handler)
        break
      case 'put':
        mockAxios.onPut(endpoint).reply(handler)
        break
      case 'patch':
        mockAxios.onPatch(endpoint).reply(handler)
        break
      case 'delete':
        mockAxios.onDelete(endpoint).reply(handler)
        break
    }
  })
}