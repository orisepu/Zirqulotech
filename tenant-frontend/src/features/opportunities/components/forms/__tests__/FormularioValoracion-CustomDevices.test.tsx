/**
 * FORMULARIO VALORACIÓN - CUSTOM DEVICES INTEGRATION TESTS (CICLO 7 RED)
 *
 * Tests de integración para verificar que FormularioValoracionOportunidad
 * funciona correctamente con dispositivos personalizados (no-Apple).
 *
 * Escenarios a validar:
 * 1. Toggle de dispositivos personalizados en PasoDatosBasicos funciona
 * 2. Cuando toggle activado: se muestra PasoEstadoGeneral en lugar de cuestionario complejo
 * 3. Se calculan ofertas usando API de dispositivos personalizados
 * 4. Flujo completo: selección → estado → cálculo → guardado
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/test-utils'
import FormularioValoracionOportunidad from '../FormularioValoracionOportunidad'
import { mockApiSuccess, setupAuthenticatedState } from '@/__tests__/utils/api-helpers'
import type { DispositivoPersonalizadoSimple, OfertaPersonalizadaResponse } from '@/shared/types/dispositivos'

const mockDispositivosPersonalizados: DispositivoPersonalizadoSimple[] = [
  {
    id: 1,
    marca: 'Samsung',
    modelo: 'Galaxy S23',
    capacidad: '256GB',
    tipo: 'movil',
    descripcion_completa: 'Samsung Galaxy S23 256GB'
  },
  {
    id: 2,
    marca: 'Dell',
    modelo: 'XPS 15',
    capacidad: '1TB SSD',
    tipo: 'portatil',
    descripcion_completa: 'Dell XPS 15 1TB SSD'
  }
]

const mockOfertaPersonalizada: OfertaPersonalizadaResponse = {
  dispositivo_id: 1,
  estado: 'bueno',
  canal: 'B2B',
  precio_base: 450.00,
  ajuste_aplicado: 80,
  oferta: 360.00
}

const mockOportunidad = {
  id: 1,
  uuid: 'opp-uuid-123',
  cliente: {
    id: 1,
    nombre: 'Test Cliente',
    canal: 'B2B',
    tipo_cliente: 'empresa'
  },
  dispositivos: []
}

describe('FormularioValoracionOportunidad - Custom Devices Integration', () => {

  beforeEach(() => {
    setupAuthenticatedState()
    jest.clearAllMocks()

    // Mock API calls básicos
    mockApiSuccess('/api/marcas-modelo/', ['Apple', 'Samsung', 'Dell'])
    mockApiSuccess('/api/modelos/', [])
    mockApiSuccess('/api/capacidades-por-modelo/', [])
    mockApiSuccess('/api/dispositivos-personalizados/disponibles/', mockDispositivosPersonalizados)
  })

  describe('Toggle Functionality', () => {

    test('should render toggle switch in PasoDatosBasicos step', async () => {
      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      // En paso "Datos básicos"
      await waitFor(() => {
        expect(screen.getByText(/datos básicos/i)).toBeInTheDocument()
      })

      // Toggle should be visible
      expect(screen.getByRole('checkbox', { name: /dispositivo personalizado/i })).toBeInTheDocument()
    })

    test('should enable custom device mode when toggle is activated', async () => {
      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /dispositivo personalizado/i })).toBeInTheDocument()
      })

      const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
      fireEvent.click(toggle)

      // Debería mostrar autocomplete de dispositivos personalizados
      await waitFor(() => {
        expect(screen.getByLabelText(/seleccionar dispositivo personalizado/i)).toBeInTheDocument()
      })
    })

    test('should hide Apple catalog fields when custom device mode enabled', async () => {
      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /dispositivo personalizado/i })).toBeInTheDocument()
      })

      // Antes del toggle: campos Apple visibles
      expect(screen.getByLabelText(/fabricante/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/tipo de producto/i)).toBeInTheDocument()

      const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
      fireEvent.click(toggle)

      // Después del toggle: campos Apple ocultos
      await waitFor(() => {
        expect(screen.queryByLabelText(/fabricante/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/tipo de producto/i)).not.toBeInTheDocument()
      })
    })

  })

  describe('Step Navigation with Custom Devices', () => {

    test('should show PasoEstadoGeneral instead of complex questionnaire', async () => {
      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /dispositivo personalizado/i })).toBeInTheDocument()
      })

      // Activar modo personalizado
      const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
      fireEvent.click(toggle)

      // Seleccionar un dispositivo
      await waitFor(() => {
        expect(screen.getByLabelText(/seleccionar dispositivo personalizado/i)).toBeInTheDocument()
      })

      const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i)
      fireEvent.click(autocomplete)

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy S23 256GB')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Samsung Galaxy S23 256GB'))

      // Avanzar al siguiente paso (debería ser Estado General, no Batería)
      const nextButton = screen.getByRole('button', { name: /siguiente/i })
      fireEvent.click(nextButton)

      // Debería mostrar PasoEstadoGeneral
      await waitFor(() => {
        expect(screen.getByText(/estado general del dispositivo/i)).toBeInTheDocument()
        expect(screen.getByText('Excelente')).toBeInTheDocument()
        expect(screen.getByText('Bueno')).toBeInTheDocument()
        expect(screen.getByText('Malo')).toBeInTheDocument()
      })
    })

    test('should NOT show battery/functionality/aesthetics steps for custom devices', async () => {
      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /dispositivo personalizado/i })).toBeInTheDocument()
      })

      // Activar modo personalizado y seleccionar dispositivo
      const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
      fireEvent.click(toggle)

      await waitFor(() => {
        expect(screen.getByLabelText(/seleccionar dispositivo personalizado/i)).toBeInTheDocument()
      })

      const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i })
      fireEvent.click(autocomplete)

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy S23 256GB')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Samsung Galaxy S23 256GB'))

      // Verificar que los pasos del stepper NO incluyen cuestionario complejo
      expect(screen.queryByText(/batería/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/funcionalidad/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/pantalla.*funcional/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/estética pantalla/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/estética laterales/i)).not.toBeInTheDocument()
    })

    test('should navigate directly to valuation after state selection', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', mockOfertaPersonalizada, 'post')

      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /dispositivo personalizado/i })).toBeInTheDocument()
      })

      // Activar modo y seleccionar dispositivo
      const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
      fireEvent.click(toggle)

      await waitFor(() => {
        const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i)
        fireEvent.click(autocomplete)
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Samsung Galaxy S23 256GB'))
      })

      // Siguiente paso: Estado General
      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      await waitFor(() => {
        expect(screen.getByText(/estado general del dispositivo/i)).toBeInTheDocument()
      })

      // Seleccionar estado "Bueno"
      const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
      if (buenoCard) fireEvent.click(buenoCard)

      // Siguiente paso: debería ir directo a Valoración
      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      await waitFor(() => {
        expect(screen.getByText(/valoración/i)).toBeInTheDocument()
        expect(screen.getByText('360.00')).toBeInTheDocument() // Precio de la oferta
      })
    })

  })

  describe('Offer Calculation', () => {

    test('should call custom device offer calculation API', async () => {
      const mockCalcSuccess = jest.fn((config) => [200, mockOfertaPersonalizada])
      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', mockOfertaPersonalizada, 'post')

      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      await waitFor(() => {
        const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
        fireEvent.click(toggle)
      })

      await waitFor(() => {
        const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i)
        fireEvent.click(autocomplete)
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Samsung Galaxy S23 256GB'))
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      await waitFor(() => {
        const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
        if (buenoCard) fireEvent.click(buenoCard)
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      // Verificar que se llamó el endpoint correcto
      await waitFor(() => {
        expect(screen.getByText('360.00')).toBeInTheDocument()
      })
    })

    test('should display custom device offer correctly', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', mockOfertaPersonalizada, 'post')

      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      // Flujo completo hasta valoración
      await waitFor(() => {
        const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
        fireEvent.click(toggle)
      })

      await waitFor(() => {
        const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i)
        fireEvent.click(autocomplete)
        fireEvent.click(screen.getByText('Samsung Galaxy S23 256GB'))
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      await waitFor(() => {
        const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
        if (buenoCard) fireEvent.click(buenoCard)
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      // Verificar información de la oferta
      await waitFor(() => {
        expect(screen.getByText(/samsung galaxy s23 256gb/i)).toBeInTheDocument()
        expect(screen.getByText('360.00')).toBeInTheDocument()
        expect(screen.getByText(/bueno/i)).toBeInTheDocument()
      })
    })

  })

  describe('Form Submission', () => {

    test('should save custom device to opportunity', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', mockOfertaPersonalizada, 'post')
      const mockSaveSuccess = jest.fn((config) => [200, { id: 100 }])
      mockApiSuccess('/api/dispositivos-reales/crear/', { id: 100 }, 'post')

      const onSuccessMock = jest.fn()

      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={onSuccessMock}
        />
      )

      // Flujo completo
      await waitFor(() => {
        const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
        fireEvent.click(toggle)
      })

      await waitFor(() => {
        const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i)
        fireEvent.click(autocomplete)
        fireEvent.click(screen.getByText('Samsung Galaxy S23 256GB'))
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      await waitFor(() => {
        const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
        if (buenoCard) fireEvent.click(buenoCard)
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      // Guardar dispositivo
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /guardar/i })
        fireEvent.click(saveButton)
      })

      // Verificar que se llamó onSuccess
      await waitFor(() => {
        expect(onSuccessMock).toHaveBeenCalledTimes(1)
      })
    })

    test('should send correct payload for custom device', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/1/calcular_oferta/', mockOfertaPersonalizada, 'post')

      let capturedPayload: any = null
      const mockSaveHandler = jest.fn((config) => {
        capturedPayload = JSON.parse(config.data)
        return [200, { id: 100 }]
      })

      render(
        <FormularioValoracionOportunidad
          oportunidadId={1}
          oportunidadUuid="opp-uuid-123"
          oportunidad={mockOportunidad}
          onClose={jest.fn()}
          onSuccess={jest.fn()}
        />
      )

      // Flujo completo hasta guardado
      await waitFor(() => {
        const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
        fireEvent.click(toggle)
      })

      await waitFor(() => {
        const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i)
        fireEvent.click(autocomplete)
        fireEvent.click(screen.getByText('Samsung Galaxy S23 256GB'))
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      await waitFor(() => {
        const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
        if (buenoCard) fireEvent.click(buenoCard)
      })

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /guardar/i })
        fireEvent.click(saveButton)
      })

      // Verificar payload
      await waitFor(() => {
        expect(capturedPayload).toMatchObject({
          dispositivo_personalizado_id: 1,
          estado_fisico: 'bueno', // Mapeado desde estadoGeneral
          oportunidad: 1,
          cantidad: 1
        })
        expect(capturedPayload).not.toHaveProperty('modelo_id')
        expect(capturedPayload).not.toHaveProperty('capacidad_id')
      })
    })

  })

})
