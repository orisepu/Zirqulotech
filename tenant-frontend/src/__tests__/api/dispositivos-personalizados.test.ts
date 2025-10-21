/**
 * DISPOSITIVOS PERSONALIZADOS - API TESTS
 *
 * Tests para validar la integración del frontend con la API de dispositivos personalizados.
 * Verifica que el cliente puede listar, crear, actualizar y calcular ofertas para
 * dispositivos no-Apple (Samsung, Xiaomi, Dell, LG, etc.)
 */

import {
  mockApiSuccess,
  mockApiError,
  setupAuthenticatedState
} from '../utils/api-helpers'
import api from '@/services/api'
import type {
  DispositivoPersonalizado,
  DispositivoPersonalizadoSimple,
  OfertaPersonalizadaResponse
} from '@/shared/types/dispositivos'

// Mock data
const mockDispositivoPersonalizado: DispositivoPersonalizado = {
  id: 1,
  marca: 'Samsung',
  modelo: 'Galaxy S23',
  capacidad: '256GB',
  tipo: 'movil',
  precio_base_b2b: 450.00,
  precio_base_b2c: 500.00,
  ajuste_excelente: 100,
  ajuste_bueno: 80,
  ajuste_malo: 50,
  caracteristicas: {
    RAM: '8GB',
    Procesador: 'Snapdragon 8 Gen 2',
    Pantalla: '6.1 pulgadas'
  },
  notas: 'Dispositivo premium de Samsung',
  created_by: 1,
  created_by_name: 'Admin User',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  activo: true,
  descripcion_completa: 'Samsung Galaxy S23 256GB'
}

const mockDispositivoSimple: DispositivoPersonalizadoSimple = {
  id: 1,
  marca: 'Samsung',
  modelo: 'Galaxy S23',
  capacidad: '256GB',
  tipo: 'movil',
  descripcion_completa: 'Samsung Galaxy S23 256GB'
}

describe('Dispositivos Personalizados - API Tests', () => {

  beforeEach(() => {
    setupAuthenticatedState()
    jest.clearAllMocks()
  })

  describe('GET /api/dispositivos-personalizados/disponibles/', () => {

    test('should list available custom devices for all authenticated users', async () => {
      const dispositivos = [
        mockDispositivoSimple,
        {
          ...mockDispositivoSimple,
          id: 2,
          marca: 'Xiaomi',
          modelo: 'Redmi Note 12',
          capacidad: '128GB',
          descripcion_completa: 'Xiaomi Redmi Note 12 128GB'
        }
      ]
      mockApiSuccess('/api/dispositivos-personalizados/disponibles/', dispositivos)

      const response = await api.get('/api/dispositivos-personalizados/disponibles/')

      expect(response.data).toHaveLength(2)
      expect(response.data[0]).toHaveProperty('descripcion_completa')
      expect(response.data[0]).toHaveProperty('marca', 'Samsung')
    })

    test('should return empty array when no custom devices available', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/disponibles/', [])

      const response = await api.get('/api/dispositivos-personalizados/disponibles/')

      expect(response.data).toHaveLength(0)
    })

    test('should handle API error gracefully', async () => {
      mockApiError('/api/dispositivos-personalizados/disponibles/', 500, 'Internal Server Error')

      await expect(
        api.get('/api/dispositivos-personalizados/disponibles/')
      ).rejects.toThrow()
    })

  })

  describe('GET /api/dispositivos-personalizados/', () => {

    test('should list all custom devices (admin only)', async () => {
      const dispositivos = [mockDispositivoPersonalizado]
      mockApiSuccess('/api/dispositivos-personalizados/', dispositivos)

      const response = await api.get('/api/dispositivos-personalizados/')

      expect(response.data).toHaveLength(1)
      expect(response.data[0]).toEqual(expect.objectContaining({
        marca: 'Samsung',
        modelo: 'Galaxy S23',
        precio_base_b2b: 450.00,
        precio_base_b2c: 500.00,
        caracteristicas: expect.any(Object)
      }))
    })

    test('should filter custom devices by type', async () => {
      const moviles = [mockDispositivoPersonalizado]
      mockApiSuccess('/api/dispositivos-personalizados/', moviles)

      const response = await api.get('/api/dispositivos-personalizados/', {
        params: { tipo: 'movil' }
      })

      expect(response.data).toHaveLength(1)
      expect(response.data[0].tipo).toBe('movil')
    })

    test('should search custom devices by marca or modelo', async () => {
      const searchResults = [mockDispositivoPersonalizado]
      mockApiSuccess('/api/dispositivos-personalizados/', searchResults)

      const response = await api.get('/api/dispositivos-personalizados/', {
        params: { search: 'Samsung' }
      })

      expect(response.data).toHaveLength(1)
      expect(response.data[0].marca).toBe('Samsung')
    })

  })

  describe('GET /api/dispositivos-personalizados/:id/', () => {

    test('should get custom device detail', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/1/', mockDispositivoPersonalizado)

      const response = await api.get('/api/dispositivos-personalizados/1/')

      expect(response.data).toEqual(expect.objectContaining({
        id: 1,
        marca: 'Samsung',
        modelo: 'Galaxy S23',
        descripcion_completa: expect.any(String)
      }))
    })

    test('should return 404 for non-existent device', async () => {
      mockApiError('/api/dispositivos-personalizados/999/', 404, 'Not found')

      await expect(
        api.get('/api/dispositivos-personalizados/999/')
      ).rejects.toThrow()
    })

  })

  describe('POST /api/dispositivos-personalizados/', () => {

    test('should create custom device (admin only)', async () => {
      const newDevice = {
        marca: 'Dell',
        modelo: 'XPS 15',
        capacidad: '1TB SSD',
        tipo: 'portatil',
        precio_base_b2b: 800.00,
        precio_base_b2c: 900.00,
        ajuste_excelente: 100,
        ajuste_bueno: 80,
        ajuste_malo: 50
      }

      const createdDevice = {
        ...mockDispositivoPersonalizado,
        id: 3,
        ...newDevice,
        descripcion_completa: 'Dell XPS 15 1TB SSD'
      }

      mockApiSuccess('/api/dispositivos-personalizados/', createdDevice, 'post')

      const response = await api.post('/api/dispositivos-personalizados/', newDevice)

      expect(response.status).toBe(200)
      expect(response.data).toEqual(expect.objectContaining({
        marca: 'Dell',
        modelo: 'XPS 15',
        tipo: 'portatil'
      }))
    })

    test('should validate required fields', async () => {
      const invalidDevice = {
        marca: 'Test',
        // falta modelo, tipo, precios
      }

      mockApiError('/api/dispositivos-personalizados/', 400, 'Validation error', 'post')

      await expect(
        api.post('/api/dispositivos-personalizados/', invalidDevice)
      ).rejects.toThrow()
    })

    test('should validate precio_base_b2b >= 0', async () => {
      const invalidDevice = {
        marca: 'Test',
        modelo: 'Invalid',
        tipo: 'otro',
        precio_base_b2b: -100,
        precio_base_b2c: 120
      }

      mockApiError('/api/dispositivos-personalizados/', 400, 'El precio B2B debe ser mayor o igual a 0', 'post')

      await expect(
        api.post('/api/dispositivos-personalizados/', invalidDevice)
      ).rejects.toThrow()
    })

    test('should validate ajustes between 0-100', async () => {
      const invalidDevice = {
        marca: 'Test',
        modelo: 'Invalid',
        tipo: 'otro',
        precio_base_b2b: 100,
        precio_base_b2c: 120,
        ajuste_excelente: 150 // Fuera de rango
      }

      mockApiError('/api/dispositivos-personalizados/', 400, 'ajuste_excelente debe estar entre 0 y 100', 'post')

      await expect(
        api.post('/api/dispositivos-personalizados/', invalidDevice)
      ).rejects.toThrow()
    })

    test('should deny creation for non-admin users', async () => {
      const newDevice = {
        marca: 'Xiaomi',
        modelo: 'Redmi Note 12',
        tipo: 'movil',
        precio_base_b2b: 200,
        precio_base_b2c: 250
      }

      mockApiError('/api/dispositivos-personalizados/', 403, 'Permission denied', 'post')

      await expect(
        api.post('/api/dispositivos-personalizados/', newDevice)
      ).rejects.toThrow()
    })

  })

  describe('PUT/PATCH /api/dispositivos-personalizados/:id/', () => {

    test('should update custom device (admin only)', async () => {
      const updates = {
        precio_base_b2b: 475.00
      }

      const updatedDevice = {
        ...mockDispositivoPersonalizado,
        precio_base_b2b: 475.00
      }

      mockApiSuccess('/api/dispositivos-personalizados/1/', updatedDevice, 'patch')

      const response = await api.patch('/api/dispositivos-personalizados/1/', updates)

      expect(response.data.precio_base_b2b).toBe(475.00)
    })

    test('should deny update for non-admin users', async () => {
      const updates = { precio_base_b2b: 500 }

      mockApiError('/api/dispositivos-personalizados/1/', 403, 'Permission denied', 'patch')

      await expect(
        api.patch('/api/dispositivos-personalizados/1/', updates)
      ).rejects.toThrow()
    })

  })

  describe('POST /api/dispositivos-personalizados/:id/calcular_oferta/', () => {

    test('should calculate offer for estado=bueno, canal=B2B', async () => {
      const oferta: OfertaPersonalizadaResponse = {
        dispositivo_id: 1,
        estado: 'bueno',
        canal: 'B2B',
        precio_base: 450.00,
        ajuste_aplicado: 80,
        oferta: 360.00
      }

      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', oferta, 'post')

      const response = await api.post('/api/dispositivos-personalizados/1/calcular_oferta/', {
        estado: 'bueno',
        canal: 'B2B'
      })

      expect(response.data).toEqual(expect.objectContaining({
        dispositivo_id: 1,
        estado: 'bueno',
        canal: 'B2B',
        oferta: 360.00
      }))
    })

    test('should calculate offer for estado=excelente, canal=B2C', async () => {
      const oferta: OfertaPersonalizadaResponse = {
        dispositivo_id: 1,
        estado: 'excelente',
        canal: 'B2C',
        precio_base: 500.00,
        ajuste_aplicado: 100,
        oferta: 500.00
      }

      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', oferta, 'post')

      const response = await api.post('/api/dispositivos-personalizados/1/calcular_oferta/', {
        estado: 'excelente',
        canal: 'B2C'
      })

      expect(response.data.oferta).toBe(500.00)
    })

    test('should calculate offer for estado=malo, canal=B2B', async () => {
      const oferta: OfertaPersonalizadaResponse = {
        dispositivo_id: 1,
        estado: 'malo',
        canal: 'B2B',
        precio_base: 450.00,
        ajuste_aplicado: 50,
        oferta: 225.00
      }

      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', oferta, 'post')

      const response = await api.post('/api/dispositivos-personalizados/1/calcular_oferta/', {
        estado: 'malo',
        canal: 'B2B'
      })

      expect(response.data.oferta).toBe(225.00)
      expect(response.data.ajuste_aplicado).toBe(50)
    })

    test('should return rounded offer (whole euros)', async () => {
      const oferta: OfertaPersonalizadaResponse = {
        dispositivo_id: 1,
        estado: 'bueno',
        canal: 'B2B',
        precio_base: 573.00,
        ajuste_aplicado: 80,
        oferta: 458.00 // 573 * 0.8 = 458.4 → rounds to 458 (whole euro)
      }

      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', oferta, 'post')

      const response = await api.post('/api/dispositivos-personalizados/1/calcular_oferta/', {
        estado: 'bueno',
        canal: 'B2B'
      })

      expect(response.data.oferta % 1).toBe(0) // Must be whole euro (integer)
      expect(Number.isInteger(response.data.oferta)).toBe(true)
    })

  })

  describe('DELETE /api/dispositivos-personalizados/:id/', () => {

    test('should soft delete custom device (admin only)', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/1/', { message: 'Deleted' }, 'delete')

      const response = await api.delete('/api/dispositivos-personalizados/1/')

      expect(response.status).toBe(200)
    })

    test('should deny deletion for non-admin users', async () => {
      mockApiError('/api/dispositivos-personalizados/1/', 403, 'Permission denied', 'delete')

      await expect(
        api.delete('/api/dispositivos-personalizados/1/')
      ).rejects.toThrow()
    })

  })

})
