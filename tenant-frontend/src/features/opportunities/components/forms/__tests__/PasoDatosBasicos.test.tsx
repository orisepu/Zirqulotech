/**
 * PASO DATOS BÁSICOS - COMPONENT TESTS (CICLO 5 RED)
 *
 * Tests para el toggle de dispositivos personalizados en PasoDatosBasicos.
 * Este componente ahora debe soportar dos flujos:
 * 1. Flujo normal: Apple catalog (marca → tipo → modelo → capacidad)
 * 2. Flujo personalizado: Autocomplete de dispositivos no-Apple + botón crear
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/test-utils'
import userEvent from '@testing-library/user-event'
import PasoDatosBasicos from '../PasoDatosBasicos'
import { mockApiSuccess, setupAuthenticatedState } from '@/__tests__/utils/api-helpers'
import type { DispositivoPersonalizadoSimple } from '@/shared/types/dispositivos'

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
    marca: 'Xiaomi',
    modelo: 'Redmi Note 12',
    capacidad: '128GB',
    tipo: 'movil',
    descripcion_completa: 'Xiaomi Redmi Note 12 128GB'
  },
  {
    id: 3,
    marca: 'Dell',
    modelo: 'XPS 15',
    capacidad: '1TB SSD',
    tipo: 'portatil',
    descripcion_completa: 'Dell XPS 15 1TB SSD'
  }
]

describe('PasoDatosBasicos - Custom Devices Toggle', () => {

  beforeEach(() => {
    setupAuthenticatedState()
    jest.clearAllMocks()
  })

  describe('Toggle Switch Rendering', () => {

    test('should render toggle switch for custom devices', () => {
      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      expect(screen.getByRole('checkbox', { name: /dispositivo personalizado/i })).toBeInTheDocument()
      expect(screen.getByText(/dispositivo personalizado \(no apple\)/i)).toBeInTheDocument()
    })

    test('should have toggle switch unchecked by default', () => {
      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
      expect(toggle).not.toBeChecked()
    })

  })

  describe('Normal Flow (Apple Catalog)', () => {

    test('should show normal Apple catalog fields when toggle is OFF', () => {
      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      // Normal fields should be visible
      expect(screen.getByLabelText(/marca/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/modelo/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/capacidad/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/cantidad/i)).toBeInTheDocument()
    })

    test('should NOT show custom device autocomplete when toggle is OFF', () => {
      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      expect(screen.queryByLabelText(/seleccionar dispositivo personalizado/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/crear nuevo dispositivo personalizado/i)).not.toBeInTheDocument()
    })

  })

  describe('Custom Devices Flow', () => {

    test('should hide normal fields when toggle is ON', () => {
      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      // Normal Apple fields should be hidden
      expect(screen.queryByLabelText(/marca/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/tipo/i)).not.toBeInTheDocument()
      // Modelo autocomplete from normal flow should be hidden
      expect(screen.queryByText(/seleccione marca y tipo primero/i)).not.toBeInTheDocument()
    })

    test('should show custom device autocomplete when toggle is ON', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/disponibles/', mockDispositivosPersonalizados)

      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={null}
          onDispositivoPersonalizadoChange={jest.fn()}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/seleccionar dispositivo personalizado/i)).toBeInTheDocument()
      })
    })

    test('should load custom devices from API when toggle is enabled', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/disponibles/', mockDispositivosPersonalizados)

      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={null}
          onDispositivoPersonalizadoChange={jest.fn()}
        />
      )

      // Wait for API call and autocomplete population
      await waitFor(() => {
        expect(screen.getByLabelText(/seleccionar dispositivo personalizado/i)).toBeInTheDocument()
      })

      // Click autocomplete to see options
      const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i)
      fireEvent.click(autocomplete)

      // Should show all 3 devices
      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy S23 256GB')).toBeInTheDocument()
        expect(screen.getByText('Xiaomi Redmi Note 12 128GB')).toBeInTheDocument()
        expect(screen.getByText('Dell XPS 15 1TB SSD')).toBeInTheDocument()
      })
    })

    test('should call onDispositivoPersonalizadoChange when selecting device', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/disponibles/', mockDispositivosPersonalizados)
      const onChangeMock = jest.fn()

      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={null}
          onDispositivoPersonalizadoChange={onChangeMock}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/seleccionar dispositivo personalizado/i)).toBeInTheDocument()
      })

      const autocomplete = screen.getByLabelText(/seleccionar dispositivo personalizado/i)
      fireEvent.click(autocomplete)

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy S23 256GB')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Samsung Galaxy S23 256GB'))

      expect(onChangeMock).toHaveBeenCalledWith(mockDispositivosPersonalizados[0])
    })

    test('should show "Create new" button when toggle is ON', () => {
      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={null}
          onDispositivoPersonalizadoChange={jest.fn()}
          onCrearPersonalizado={jest.fn()}
        />
      )

      expect(screen.getByRole('button', { name: /crear nuevo dispositivo personalizado/i })).toBeInTheDocument()
    })

    test('should call onCrearPersonalizado when clicking create button', async () => {
      const onCrearMock = jest.fn()

      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={null}
          onDispositivoPersonalizadoChange={jest.fn()}
          onCrearPersonalizado={onCrearMock}
        />
      )

      const createButton = screen.getByRole('button', { name: /crear nuevo dispositivo personalizado/i })
      fireEvent.click(createButton)

      expect(onCrearMock).toHaveBeenCalledTimes(1)
    })

  })

  describe('Toggle Interaction', () => {

    test('should call onToggleDispositivoPersonalizado when clicking toggle', async () => {
      const onToggleMock = jest.fn()

      render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={onToggleMock}
        />
      )

      const toggle = screen.getByRole('checkbox', { name: /dispositivo personalizado/i })
      fireEvent.click(toggle)

      expect(onToggleMock).toHaveBeenCalledTimes(1)
      expect(onToggleMock).toHaveBeenCalledWith(true)
    })

    test('should clear normal fields when enabling custom device toggle', async () => {
      const onMarcaChangeMock = jest.fn()
      const onTipoChangeMock = jest.fn()
      const onModeloChangeMock = jest.fn()
      const onCapacidadChangeMock = jest.fn()

      const { rerender } = render(
        <PasoDatosBasicos
          marca="Apple"
          tipo="iPhone"
          modelo={{ id: 1, descripcion: 'iPhone 14' } as any}
          capacidad={{ id: 1, tamaño: '128GB' } as any}
          cantidad={1}
          isB2C={false}
          onMarcaChange={onMarcaChangeMock}
          onTipoChange={onTipoChangeMock}
          onModeloChange={onModeloChangeMock}
          onCapacidadChange={onCapacidadChangeMock}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      // Simulate toggle to true (parent would handle state change)
      rerender(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={onMarcaChangeMock}
          onTipoChange={onTipoChangeMock}
          onModeloChange={onModeloChangeMock}
          onCapacidadChange={onCapacidadChangeMock}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={null}
          onDispositivoPersonalizadoChange={jest.fn()}
        />
      )

      // Normal fields should be cleared (verified by props)
      expect(screen.queryByLabelText(/marca/i)).not.toBeInTheDocument()
    })

    test('should clear custom device selection when disabling toggle', () => {
      const onDispositivoChangeMock = jest.fn()

      const { rerender } = render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={mockDispositivosPersonalizados[0]}
          onDispositivoPersonalizadoChange={onDispositivoChangeMock}
        />
      )

      // Simulate toggle to false
      rerender(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      // Custom device autocomplete should not be visible
      expect(screen.queryByLabelText(/seleccionar dispositivo personalizado/i)).not.toBeInTheDocument()
    })

  })

  describe('Cantidad Field Behavior', () => {

    test('should show cantidad field for both normal and custom flows', () => {
      const { rerender } = render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      // Normal flow
      expect(screen.getByLabelText(/cantidad/i)).toBeInTheDocument()

      // Custom flow
      rerender(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={false}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={null}
          onDispositivoPersonalizadoChange={jest.fn()}
        />
      )

      expect(screen.getByLabelText(/cantidad/i)).toBeInTheDocument()
    })

    test('should disable cantidad field for B2C users regardless of toggle state', () => {
      const { rerender } = render(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={true}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={false}
          onToggleDispositivoPersonalizado={jest.fn()}
        />
      )

      expect(screen.getByLabelText(/cantidad/i)).toBeDisabled()

      // Also disabled in custom flow
      rerender(
        <PasoDatosBasicos
          marca=""
          tipo=""
          modelo={null}
          capacidad={null}
          cantidad={1}
          isB2C={true}
          onMarcaChange={jest.fn()}
          onTipoChange={jest.fn()}
          onModeloChange={jest.fn()}
          onCapacidadChange={jest.fn()}
          onCantidadChange={jest.fn()}
          esDispositivoPersonalizado={true}
          onToggleDispositivoPersonalizado={jest.fn()}
          dispositivoPersonalizado={null}
          onDispositivoPersonalizadoChange={jest.fn()}
        />
      )

      expect(screen.getByLabelText(/cantidad/i)).toBeDisabled()
    })

  })

})
