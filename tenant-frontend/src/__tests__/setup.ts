import '@testing-library/jest-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/services/api'
import axios from 'axios'

// Create axios mock adapters
export const mockAxios = new MockAdapter(api)
export const mockAxiosGlobal = new MockAdapter(axios)

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock secureStorage
jest.mock('@/shared/lib/secureStorage', () => ({
  getSecureItem: jest.fn().mockResolvedValue(null),
  setSecureItem: jest.fn().mockResolvedValue(undefined),
  removeSecureItem: jest.fn().mockResolvedValue(undefined),
  secureTokens: {
    removeAllTokens: jest.fn()
  }
}))

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to hide logs during tests
  // log: jest.fn(),
  // error: jest.fn(),
  // warn: jest.fn(),
  // info: jest.fn(),
}

// Setup axios mock before all tests
beforeAll(() => {
  // Default mock responses for api instance
  mockAxios.onGet('/api/yo/').reply(200, {
    id: 1,
    email: 'test@example.com',
    tipo_usuario: 'empleado',
    name: 'Test User'
  })

  // Default mock responses for global axios (for login function)
  mockAxiosGlobal.onPost('https://zirqulotech.com/api/login/').reply(200, {
    refresh: 'mock-refresh-token',
    access: 'mock-access-token',
    schema: 'test-tenant',
    user: {
      id: 1,
      email: 'test@example.com',
      name: 'Test User'
    }
  })
})

// Reset mocks after each test
afterEach(() => {
  mockAxios.reset()
  mockAxiosGlobal.reset()
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
})

// Restore axios adapter after all tests
afterAll(() => {
  mockAxios.restore()
  mockAxiosGlobal.restore()
})

// window.location is now mocked in jest.setup.js

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock environment variables
process.env.NODE_ENV = 'test'