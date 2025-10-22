/**
 * API Tests: Tiendas Deletion and Enable/Disable with Password Confirmation
 * Tests the tienda deletion and enable/disable endpoints with password verification
 */

import MockAdapter from 'axios-mock-adapter'
import api from '@/services/api'

describe('API: Tiendas Management', () => {
  let mock: MockAdapter

  beforeEach(() => {
    mock = new MockAdapter(api)
  })

  afterEach(() => {
    mock.reset()
  })

  describe('DELETE /api/tiendas/:id/', () => {
    it('should delete tienda with correct password', async () => {
      const tiendaId = 1
      const schema = 'partner_test'
      const password = 'correct_password'

      mock
        .onDelete(`/api/tiendas/${tiendaId}/`, {
          params: { schema },
          data: { password }
        })
        .reply(204)

      const response = await api.delete(`/api/tiendas/${tiendaId}/`, {
        params: { schema },
        data: { password }
      })

      expect(response.status).toBe(204)
    })

    it('should fail to delete tienda with incorrect password', async () => {
      const tiendaId = 1
      const schema = 'partner_test'
      const password = 'wrong_password'

      mock
        .onDelete(`/api/tiendas/${tiendaId}/`, {
          params: { schema },
          data: { password }
        })
        .reply(403, {
          detail: 'Contraseña incorrecta'
        })

      await expect(
        api.delete(`/api/tiendas/${tiendaId}/`, {
          params: { schema },
          data: { password }
        })
      ).rejects.toThrow()
    })

    it('should fail to delete tienda without password', async () => {
      const tiendaId = 1
      const schema = 'partner_test'

      mock
        .onDelete(`/api/tiendas/${tiendaId}/`, {
          params: { schema }
        })
        .reply(400, {
          detail: 'Se requiere contraseña para eliminar tienda'
        })

      await expect(
        api.delete(`/api/tiendas/${tiendaId}/`, {
          params: { schema }
        })
      ).rejects.toThrow()
    })

    it('should fail to delete tienda with assigned users', async () => {
      const tiendaId = 1
      const schema = 'partner_test'
      const password = 'correct_password'

      mock
        .onDelete(`/api/tiendas/${tiendaId}/`, {
          params: { schema },
          data: { password }
        })
        .reply(400, {
          detail: 'No se puede eliminar una tienda con usuarios asignados'
        })

      await expect(
        api.delete(`/api/tiendas/${tiendaId}/`, {
          params: { schema },
          data: { password }
        })
      ).rejects.toThrow()
    })

    it('should fail to delete non-existent tienda', async () => {
      const tiendaId = 999
      const schema = 'partner_test'
      const password = 'correct_password'

      mock
        .onDelete(`/api/tiendas/${tiendaId}/`, {
          params: { schema },
          data: { password }
        })
        .reply(404, {
          detail: 'Tienda no encontrada'
        })

      await expect(
        api.delete(`/api/tiendas/${tiendaId}/`, {
          params: { schema },
          data: { password }
        })
      ).rejects.toThrow()
    })
  })

  describe('POST /api/verificar-credenciales/', () => {
    it('should verify user password successfully', async () => {
      const email = 'admin@example.com'
      const password = 'correct_password'

      mock
        .onPost('/api/verificar-credenciales/', { email, password })
        .reply(200, { valid: true })

      const response = await api.post('/api/verificar-credenciales/', {
        email,
        password
      })

      expect(response.status).toBe(200)
      expect(response.data.valid).toBe(true)
    })

    it('should fail with incorrect password', async () => {
      const email = 'admin@example.com'
      const password = 'wrong_password'

      mock
        .onPost('/api/verificar-credenciales/', { email, password })
        .reply(401, { valid: false, detail: 'Credenciales inválidas' })

      await expect(
        api.post('/api/verificar-credenciales/', { email, password })
      ).rejects.toThrow()
    })
  })

  describe('PATCH /api/tiendas/:id/', () => {
    it('should enable tienda successfully', async () => {
      const tiendaId = 1
      const schema = 'partner_test'

      mock
        .onPatch(`/api/tiendas/${tiendaId}/`, { is_active: true }, {
          params: { schema }
        })
        .reply(200, {
          id: tiendaId,
          nombre: 'Tienda Test',
          is_active: true
        })

      const response = await api.patch(
        `/api/tiendas/${tiendaId}/`,
        { is_active: true },
        { params: { schema } }
      )

      expect(response.status).toBe(200)
      expect(response.data.is_active).toBe(true)
    })

    it('should disable tienda successfully', async () => {
      const tiendaId = 1
      const schema = 'partner_test'

      mock
        .onPatch(`/api/tiendas/${tiendaId}/`, { is_active: false }, {
          params: { schema }
        })
        .reply(200, {
          id: tiendaId,
          nombre: 'Tienda Test',
          is_active: false
        })

      const response = await api.patch(
        `/api/tiendas/${tiendaId}/`,
        { is_active: false },
        { params: { schema } }
      )

      expect(response.status).toBe(200)
      expect(response.data.is_active).toBe(false)
    })

    it('should fail to update non-existent tienda', async () => {
      const tiendaId = 999
      const schema = 'partner_test'

      mock
        .onPatch(`/api/tiendas/${tiendaId}/`, { is_active: false }, {
          params: { schema }
        })
        .reply(404, {
          detail: 'Tienda no encontrada'
        })

      await expect(
        api.patch(
          `/api/tiendas/${tiendaId}/`,
          { is_active: false },
          { params: { schema } }
        )
      ).rejects.toThrow()
    })
  })
})
