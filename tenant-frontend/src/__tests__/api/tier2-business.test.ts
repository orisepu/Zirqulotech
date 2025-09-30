/**
 * TIER 2 - BUSINESS API TESTS
 *
 * These tests cover important business functionality that impacts
 * core operations but won't completely break the app if they fail.
 *
 * Run these tests in CI/CD pipelines and before releases
 */

import {
  mockApiSuccess,
  mockApiError,
  setupAuthenticatedState
} from '../utils/api-helpers'
import {
  mockDispositivo,
  mockDispositivoReal,
  mockOportunidad,
  mockB2CContrato,
  mockChat,
  mockValoracionIphone,
  mockApiErrors
} from '../utils/mock-data'
import api from '@/services/api'

describe('Tier 2 - Business API Tests', () => {

  beforeEach(() => {
    setupAuthenticatedState()
    jest.clearAllMocks()
  })

  describe('Global Opportunities APIs', () => {

    test('should list global opportunities', async () => {
      const globalOpps = [
        { ...mockOportunidad, tenant: 'tenant1' },
        { ...mockOportunidad, id: 2, tenant: 'tenant2' }
      ]
      mockApiSuccess('/api/oportunidades-globales/', globalOpps)

      const response = await api.get('/api/oportunidades-globales/')

      expect(response.data).toHaveLength(2)
      expect(response.data[0]).toHaveProperty('tenant')
    })

    test('should get global opportunity detail', async () => {
      mockApiSuccess('/api/oportunidades-globales/test-tenant/1/', mockOportunidad)

      const response = await api.get('/api/oportunidades-globales/test-tenant/1/')

      expect(response.data).toEqual(expect.objectContaining({
        id: 1,
        uuid: expect.any(String)
      }))
    })

    test('should get complete global opportunity detail', async () => {
      const completeOpp = {
        ...mockOportunidad,
        dispositivos_reales: [mockDispositivoReal],
        comentarios: ['Comentario de prueba'],
        historial: [{ accion: 'creado', timestamp: '2024-01-01T00:00:00Z' }]
      }
      mockApiSuccess('/api/oportunidades-globales/test-tenant/1/detalle-completo/', completeOpp)

      const response = await api.get('/api/oportunidades-globales/test-tenant/1/detalle-completo/')

      expect(response.data).toEqual(expect.objectContaining({
        dispositivos_reales: expect.any(Array),
        comentarios: expect.any(Array),
        historial: expect.any(Array)
      }))
    })

    test('should change global opportunity status', async () => {
      const updatedOpp = { ...mockOportunidad, estado: 'vendido' }
      mockApiSuccess('/api/oportunidades-globales/test-tenant/123e4567-e89b-12d3-a456-426614174000/cambiar-estado/', updatedOpp, 'patch')

      const response = await api.patch('/api/oportunidades-globales/test-tenant/123e4567-e89b-12d3-a456-426614174000/cambiar-estado/', {
        nuevo_estado: 'vendido'
      })

      expect(response.data.estado).toBe('vendido')
    })

    test('should filter global opportunities by status', async () => {
      const filteredOpps = [mockOportunidad]
      mockApiSuccess('/api/oportunidades-globales/filtrar/', filteredOpps)

      const response = await api.get('/api/oportunidades-globales/filtrar/', {
        params: { estado: 'presupuestado' }
      })

      expect(response.data).toHaveLength(1)
    })

    test('should generate global PDF offer', async () => {
      mockApiSuccess('/api/oportunidades-globales/test-tenant/1/generar-pdf/', {
        pdf_url: 'https://example.com/offer.pdf'
      })

      const response = await api.get('/api/oportunidades-globales/test-tenant/1/generar-pdf/')

      expect(response.data.pdf_url).toContain('offer.pdf')
    })
  })

  describe('Device Management APIs', () => {

    test('should list devices', async () => {
      mockApiSuccess('/api/dispositivos/', [mockDispositivo])

      const response = await api.get('/api/dispositivos/')

      expect(response.data).toHaveLength(1)
      expect(response.data[0]).toEqual(expect.objectContaining({
        marca: 'Apple',
        modelo: 'iPhone 13'
      }))
    })

    test('should create device', async () => {
      mockApiSuccess('/api/dispositivos/', mockDispositivo, 'post')

      const deviceData = {
        marca: 'Apple',
        modelo: 'iPhone 14',
        capacidad: '256GB',
        precio_comercial: 600
      }

      const response = await api.post('/api/dispositivos/', deviceData)

      expect(response.data).toEqual(expect.objectContaining({
        marca: 'Apple',
        precio_comercial: expect.any(Number)
      }))
    })

    test('should get device models', async () => {
      const models = [
        { id: 1, nombre: 'iPhone 13', marca: 'Apple' },
        { id: 2, nombre: 'Galaxy S22', marca: 'Samsung' }
      ]
      mockApiSuccess('/api/modelos/', models)

      const response = await api.get('/api/modelos/')

      expect(response.data).toHaveLength(2)
      expect(response.data[0]).toHaveProperty('marca')
    })

    test('should get device capacities', async () => {
      const capacities = [
        { id: 1, capacidad: '128GB' },
        { id: 2, capacidad: '256GB' }
      ]
      mockApiSuccess('/api/capacidades/', capacities)

      const response = await api.get('/api/capacidades/')

      expect(response.data).toHaveLength(2)
    })

    test('should get capacities by model', async () => {
      const capacities = [
        { modelo_id: 1, capacidad: '128GB', disponible: true }
      ]
      mockApiSuccess('/api/capacidades-por-modelo/', capacities)

      const response = await api.get('/api/capacidades-por-modelo/', {
        params: { modelo_id: 1 }
      })

      expect(response.data).toHaveLength(1)
      expect(response.data[0]).toHaveProperty('disponible')
    })
  })

  describe('Real Devices APIs', () => {

    test('should create real device', async () => {
      mockApiSuccess('/api/dispositivos-reales/crear/', mockDispositivoReal, 'post')

      const realDeviceData = {
        dispositivo_id: 1,
        oportunidad_id: 1,
        imei: '123456789012345',
        estado_general: 'A',
        estado_pantalla: 'OK'
      }

      const response = await api.post('/api/dispositivos-reales/crear/', realDeviceData)

      expect(response.data).toEqual(expect.objectContaining({
        imei: '123456789012345',
        estado_general: 'A'
      }))
    })

    test('should get real devices for opportunity', async () => {
      mockApiSuccess('/api/oportunidades/1/dispositivos-reales/', [mockDispositivoReal])

      const response = await api.get('/api/oportunidades/1/dispositivos-reales/')

      expect(response.data).toHaveLength(1)
      expect(response.data[0]).toHaveProperty('imei')
    })

    test('should get global real devices', async () => {
      mockApiSuccess('/api/dispositivos-reales-globales/test-tenant/1/', [mockDispositivoReal])

      const response = await api.get('/api/dispositivos-reales-globales/test-tenant/1/')

      expect(response.data).toHaveLength(1)
    })

    test('should create global real device', async () => {
      mockApiSuccess('/api/dispositivos-reales-globales/test-tenant/crear/', mockDispositivoReal, 'post')

      const response = await api.post('/api/dispositivos-reales-globales/test-tenant/crear/', {
        dispositivo_id: 1,
        oportunidad_id: 1,
        imei: '123456789012345'
      })

      expect(response.data).toHaveProperty('imei')
    })
  })

  describe('Device Valuation APIs', () => {

    test('should perform iPhone commercial valuation', async () => {
      mockApiSuccess('/api/valoraciones/iphone/comercial/', mockValoracionIphone, 'post')

      const valuationData = {
        modelo: 'iPhone 13',
        capacidad: '128GB',
        estado_general: 'A',
        estado_pantalla: 'OK',
        estado_cristal: 'NONE'
      }

      const response = await api.post('/api/valoraciones/iphone/comercial/', valuationData)

      expect(response.data).toEqual(expect.objectContaining({
        valor_comercial: expect.any(Number),
        factores_descuento: expect.any(Object)
      }))
    })

    test('should perform iPhone audit valuation', async () => {
      mockApiSuccess('/api/valoraciones/iphone/auditoria/', mockValoracionIphone, 'post')

      const valuationData = {
        modelo: 'iPhone 13',
        capacidad: '128GB',
        estado_general: 'B',
        estado_pantalla: 'PIX',
        estado_cristal: 'MICRO'
      }

      const response = await api.post('/api/valoraciones/iphone/auditoria/', valuationData)

      expect(response.data).toEqual(expect.objectContaining({
        valor_auditoria: expect.any(Number)
      }))
    })

    test('should handle valuation errors', async () => {
      mockApiError('/api/valoraciones/iphone/comercial/', 400, 'Modelo no soportado', 'post')

      await expect(api.post('/api/valoraciones/iphone/comercial/', {
        modelo: 'iPhone 6',
        capacidad: '32GB'
      })).rejects.toThrow()
    })
  })

  describe('B2C Contracts APIs', () => {

    test('should list B2C contracts', async () => {
      mockApiSuccess('/api/b2c/contratos/', [mockB2CContrato])

      const response = await api.get('/api/b2c/contratos/')

      expect(response.data).toHaveLength(1)
      expect(response.data[0]).toEqual(expect.objectContaining({
        estado: 'borrador',
        kyc_token: expect.any(String)
      }))
    })

    test('should create B2C contract', async () => {
      mockApiSuccess('/api/b2c/contratos/', mockB2CContrato, 'post')

      const contractData = {
        cliente_id: 1,
        oportunidad_id: 1
      }

      const response = await api.post('/api/b2c/contratos/', contractData)

      expect(response.data).toHaveProperty('kyc_token')
    })

    test('should get contract by opportunity', async () => {
      mockApiSuccess('/api/b2c/contratos/por_oportunidad/1/', mockB2CContrato)

      const response = await api.get('/api/b2c/contratos/por_oportunidad/1/')

      expect(response.data.oportunidad).toEqual(expect.objectContaining({
        id: 1
      }))
    })

    test('should upload DNI for contract', async () => {
      mockApiSuccess('/api/b2c/contratos/1/subir_dni/', { success: true }, 'post')

      const formData = new FormData()
      formData.append('anverso', new Blob(['fake-image'], { type: 'image/jpeg' }))
      formData.append('reverso', new Blob(['fake-image'], { type: 'image/jpeg' }))

      const response = await api.post('/api/b2c/contratos/1/subir_dni/', formData)

      expect(response.data.success).toBe(true)
    })

    test('should verify OTP for contract', async () => {
      mockApiSuccess('/api/b2c/contratos/1/verificar_otp/', { verified: true }, 'post')

      const response = await api.post('/api/b2c/contratos/1/verificar_otp/', {
        otp: '123456'
      })

      expect(response.data.verified).toBe(true)
    })

    test('should finalize contract', async () => {
      const finalizedContract = { ...mockB2CContrato, estado: 'firmado' }
      mockApiSuccess('/api/b2c/contratos/1/finalizar/', finalizedContract, 'post')

      const response = await api.post('/api/b2c/contratos/1/finalizar/')

      expect(response.data.estado).toBe('firmado')
    })
  })

  describe('KYC Management APIs', () => {

    test('should get KYC flags by token', async () => {
      const kycFlags = {
        dni_uploaded: true,
        otp_verified: false,
        contract_signed: false
      }
      mockApiSuccess('/api/b2c/contratos/kyc/123e4567-e89b-12d3-a456-426614174001/flags/', kycFlags)

      const response = await api.get('/api/b2c/contratos/kyc/123e4567-e89b-12d3-a456-426614174001/flags/')

      expect(response.data).toEqual(expect.objectContaining({
        dni_uploaded: true,
        otp_verified: false
      }))
    })

    test('should finalize KYC by token', async () => {
      mockApiSuccess('/api/b2c/contratos/kyc/123e4567-e89b-12d3-a456-426614174001/finalizar/', { success: true }, 'post')

      const response = await api.post('/api/b2c/contratos/kyc/123e4567-e89b-12d3-a456-426614174001/finalizar/')

      expect(response.data.success).toBe(true)
    })

    test('should get contract PDF by token', async () => {
      mockApiSuccess('/api/b2c/contratos/pdf/123e4567-e89b-12d3-a456-426614174001/', {
        pdf_url: 'https://example.com/contract.pdf'
      })

      const response = await api.get('/api/b2c/contratos/pdf/123e4567-e89b-12d3-a456-426614174001/')

      expect(response.data.pdf_url).toContain('.pdf')
    })
  })

  describe('Document Management APIs', () => {

    test('should upload invoice', async () => {
      mockApiSuccess('/api/facturas/subir/', { success: true, document_id: 123 }, 'post')

      const formData = new FormData()
      formData.append('factura', new Blob(['fake-pdf'], { type: 'application/pdf' }))

      const response = await api.post('/api/facturas/subir/', formData)

      expect(response.data).toEqual(expect.objectContaining({
        success: true,
        document_id: expect.any(Number)
      }))
    })

    test('should upload global invoice', async () => {
      mockApiSuccess('/api/facturas/test-tenant/subir/', { success: true }, 'post')

      const formData = new FormData()
      formData.append('factura', new Blob(['fake-pdf'], { type: 'application/pdf' }))

      const response = await api.post('/api/facturas/test-tenant/subir/', formData)

      expect(response.data.success).toBe(true)
    })

    test('should download document', async () => {
      mockApiSuccess('/api/documentos/123/descargar/', new Blob(['file-content']))

      const response = await api.get('/api/documentos/123/descargar/')

      expect(response.data).toBeInstanceOf(Blob)
    })

    test('should download global document', async () => {
      mockApiSuccess('/api/documentos/test-tenant/123/descargar/', new Blob(['file-content']))

      const response = await api.get('/api/documentos/test-tenant/123/descargar/')

      expect(response.data).toBeInstanceOf(Blob)
    })
  })

  describe('Chat & Communication APIs', () => {

    test('should get or create support chat', async () => {
      mockApiSuccess('/api/chat/soporte/', mockChat)

      const response = await api.get('/api/chat/soporte/')

      expect(response.data).toEqual(expect.objectContaining({
        titulo: expect.stringContaining('Soporte'),
        estado: 'abierto'
      }))
    })

    test('should create support chat', async () => {
      mockApiSuccess('/api/chat/soporte/', mockChat, 'post')

      const chatData = {
        titulo: 'Nuevo chat de soporte',
        mensaje_inicial: 'Necesito ayuda'
      }

      const response = await api.post('/api/chat/soporte/', chatData)

      expect(response.data).toHaveProperty('id')
    })

    test('should get chat message history', async () => {
      mockApiSuccess('/api/chat/1/mensajes/', mockChat.mensajes)

      const response = await api.get('/api/chat/1/mensajes/')

      expect(response.data).toHaveLength(2)
      expect(response.data[0]).toEqual(expect.objectContaining({
        contenido: expect.any(String),
        autor: expect.any(String)
      }))
    })

    test('should close chat', async () => {
      mockApiSuccess('/api/chat/1/cerrar/', { success: true }, 'post')

      const response = await api.post('/api/chat/1/cerrar/')

      expect(response.data.success).toBe(true)
    })

    test('should list open chats', async () => {
      mockApiSuccess('/api/chats/abiertos/', [mockChat])

      const response = await api.get('/api/chats/abiertos/')

      expect(response.data).toHaveLength(1)
      expect(response.data[0]).toHaveProperty('estado', 'abierto')
    })
  })

  describe('Global Search APIs', () => {

    test('should perform global search', async () => {
      const searchResults = {
        clientes: [mockOportunidad.cliente],
        oportunidades: [mockOportunidad],
        total: 2
      }
      mockApiSuccess('/api/busqueda-global/', searchResults)

      const response = await api.get('/api/busqueda-global/', {
        params: { q: 'test search' }
      })

      expect(response.data).toEqual(expect.objectContaining({
        clientes: expect.any(Array),
        oportunidades: expect.any(Array),
        total: expect.any(Number)
      }))
    })

    test('should handle empty search results', async () => {
      mockApiSuccess('/api/busqueda-global/', { clientes: [], oportunidades: [], total: 0 })

      const response = await api.get('/api/busqueda-global/', {
        params: { q: 'nonexistent' }
      })

      expect(response.data.total).toBe(0)
    })
  })

  describe('Error Handling for Business APIs', () => {

    test('should handle device not found errors', async () => {
      mockApiError('/api/dispositivos/999/', 404, 'Dispositivo no encontrado')

      await expect(api.get('/api/dispositivos/999/')).rejects.toThrow()
    })

    test('should handle contract validation errors', async () => {
      mockApiError('/api/b2c/contratos/', 400, 'Error de validación', 'post')

      await expect(api.post('/api/b2c/contratos/', {})).rejects.toThrow()
    })

    test('should handle global opportunity access errors', async () => {
      mockApiError('/api/oportunidades-globales/forbidden-tenant/1/', 403, 'Acceso denegado')

      await expect(api.get('/api/oportunidades-globales/forbidden-tenant/1/')).rejects.toThrow()
    })

    test('should handle file upload errors', async () => {
      mockApiError('/api/facturas/subir/', 413, 'Archivo demasiado grande', 'post')

      const formData = new FormData()
      formData.append('factura', new Blob(['huge-file'], { type: 'application/pdf' }))

      await expect(api.post('/api/facturas/subir/', formData)).rejects.toThrow()
    })
  })
})