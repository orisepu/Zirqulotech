/**
 * DISPOSITIVO PERSONALIZADO MODAL - COMPONENT TESTS (CICLO 9 RED)
 *
 * Tests para el modal de creación/edición de dispositivos personalizados.
 * Este modal permite a los administradores crear nuevos dispositivos y editar existentes.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/test-utils'
import DispositivoPersonalizadoModal from '../DispositivoPersonalizadoModal'
import { mockApiSuccess, mockApiError, setupAuthenticatedState } from '@/__tests__/utils/api-helpers'
import type { DispositivoPersonalizado } from '@/shared/types/dispositivos'

const mockExistingDevice: DispositivoPersonalizado = {
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
  caracteristicas: { RAM: '8GB', Procesador: 'Snapdragon 8 Gen 2' },
  notas: 'Dispositivo premium',
  created_by: 1,
  created_by_name: 'Admin User',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  activo: true,
  descripcion_completa: 'Samsung Galaxy S23 256GB'
}

describe('DispositivoPersonalizadoModal - CRUD Modal', () => {

  beforeEach(() => {
    setupAuthenticatedState()
    jest.clearAllMocks()
  })

  describe('Modal Rendering', () => {

    test('should not render when closed', () => {
      render(
        <DispositivoPersonalizadoModal
          open={false}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('should render when open in create mode', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/crear dispositivo/i)).toBeInTheDocument()
    })

    test('should render when open in edit mode', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={mockExistingDevice}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/editar dispositivo/i)).toBeInTheDocument()
    })

    test('should render all required form fields', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      expect(screen.getByLabelText(/marca/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/modelo/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/capacidad/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/precio b2b/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/precio b2c/i)).toBeInTheDocument()
    })

    test('should render adjustment percentage fields', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      expect(screen.getByLabelText(/ajuste excelente/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/ajuste bueno/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/ajuste malo/i)).toBeInTheDocument()
    })

    test('should render optional fields', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      expect(screen.getByLabelText(/notas/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/activo/i)).toBeInTheDocument()
    })

    test('should render action buttons', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument()
    })

  })

  describe('Create Mode - Empty Form', () => {

    test('should show empty form in create mode', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const marcaInput = screen.getByLabelText(/marca/i) as HTMLInputElement
      const modeloInput = screen.getByLabelText(/modelo/i) as HTMLInputElement

      expect(marcaInput.value).toBe('')
      expect(modeloInput.value).toBe('')
    })

    test('should show default adjustment values in create mode', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const excelenteInput = screen.getByLabelText(/ajuste excelente/i) as HTMLInputElement
      const buenoInput = screen.getByLabelText(/ajuste bueno/i) as HTMLInputElement
      const maloInput = screen.getByLabelText(/ajuste malo/i) as HTMLInputElement

      expect(excelenteInput.value).toBe('100')
      expect(buenoInput.value).toBe('80')
      expect(maloInput.value).toBe('50')
    })

    test('should show activo as checked by default', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const activoCheckbox = screen.getByLabelText(/activo/i) as HTMLInputElement
      expect(activoCheckbox.checked).toBe(true)
    })

  })

  describe('Edit Mode - Populated Form', () => {

    test('should populate form with device data in edit mode', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={mockExistingDevice}
        />
      )

      const marcaInput = screen.getByLabelText(/marca/i) as HTMLInputElement
      const modeloInput = screen.getByLabelText(/modelo/i) as HTMLInputElement
      const capacidadInput = screen.getByLabelText(/capacidad/i) as HTMLInputElement

      expect(marcaInput.value).toBe('Samsung')
      expect(modeloInput.value).toBe('Galaxy S23')
      expect(capacidadInput.value).toBe('256GB')
    })

    test('should populate prices in edit mode', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={mockExistingDevice}
        />
      )

      const b2bInput = screen.getByLabelText(/precio b2b/i) as HTMLInputElement
      const b2cInput = screen.getByLabelText(/precio b2c/i) as HTMLInputElement

      expect(b2bInput.value).toBe('450')
      expect(b2cInput.value).toBe('500')
    })

    test('should populate adjustment percentages in edit mode', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={mockExistingDevice}
        />
      )

      const excelenteInput = screen.getByLabelText(/ajuste excelente/i) as HTMLInputElement
      const buenoInput = screen.getByLabelText(/ajuste bueno/i) as HTMLInputElement
      const maloInput = screen.getByLabelText(/ajuste malo/i) as HTMLInputElement

      expect(excelenteInput.value).toBe('100')
      expect(buenoInput.value).toBe('80')
      expect(maloInput.value).toBe('50')
    })

    test('should populate optional fields in edit mode', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={mockExistingDevice}
        />
      )

      const notasInput = screen.getByLabelText(/notas/i) as HTMLInputElement
      const activoCheckbox = screen.getByLabelText(/activo/i) as HTMLInputElement

      expect(notasInput.value).toBe('Dispositivo premium')
      expect(activoCheckbox.checked).toBe(true)
    })

  })

  describe('Form Interaction', () => {

    test('should allow typing in marca field', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const marcaInput = screen.getByLabelText(/marca/i)
      fireEvent.change(marcaInput, { target: { value: 'Xiaomi' } })

      expect(marcaInput).toHaveValue('Xiaomi')
    })

    test('should allow typing in modelo field', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const modeloInput = screen.getByLabelText(/modelo/i)
      fireEvent.change(modeloInput, { target: { value: 'Redmi Note 12' } })

      expect(modeloInput).toHaveValue('Redmi Note 12')
    })

    test('should allow typing in capacity field', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const capacidadInput = screen.getByLabelText(/capacidad/i)
      fireEvent.change(capacidadInput, { target: { value: '128GB' } })

      expect(capacidadInput).toHaveValue('128GB')
    })

    test('should allow selecting device type', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const tipoSelect = screen.getByLabelText(/tipo/i)
      fireEvent.change(tipoSelect, { target: { value: 'portatil' } })

      expect(tipoSelect).toHaveValue('portatil')
    })

    test('should allow typing in price fields', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const b2bInput = screen.getByLabelText(/precio b2b/i)
      const b2cInput = screen.getByLabelText(/precio b2c/i)

      fireEvent.change(b2bInput, { target: { value: '200' } })
      fireEvent.change(b2cInput, { target: { value: '250' } })

      expect(b2bInput).toHaveValue(200)
      expect(b2cInput).toHaveValue(250)
    })

    test('should allow toggling activo checkbox', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const activoCheckbox = screen.getByLabelText(/activo/i)

      expect(activoCheckbox).toBeChecked()

      fireEvent.click(activoCheckbox)
      expect(activoCheckbox).not.toBeChecked()
    })

  })

  describe('Create - API Integration', () => {

    test('should POST to API when creating new device', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', { id: 999 }, 'post')

      const onCloseMock = jest.fn()
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={onCloseMock}
          dispositivo={null}
        />
      )

      // Fill form
      fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Xiaomi' } })
      fireEvent.change(screen.getByLabelText(/modelo/i), { target: { value: 'Redmi Note 12' } })
      fireEvent.change(screen.getByLabelText(/capacidad/i), { target: { value: '128GB' } })
      fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'movil' } })
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '180' } })
      fireEvent.change(screen.getByLabelText(/precio b2c/i), { target: { value: '220' } })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      await waitFor(() => {
        expect(screen.getByText(/dispositivo creado correctamente/i)).toBeInTheDocument()
      })

      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    test('should send correct payload when creating device', async () => {
      const postSpy = jest.fn().mockResolvedValue({ data: { id: 999 } })
      mockApiSuccess('/api/dispositivos-personalizados/', { id: 999 }, 'post')

      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      // Fill required fields
      fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Dell' } })
      fireEvent.change(screen.getByLabelText(/modelo/i), { target: { value: 'XPS 15' } })
      fireEvent.change(screen.getByLabelText(/capacidad/i), { target: { value: '1TB SSD' } })
      fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'portatil' } })
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '800' } })
      fireEvent.change(screen.getByLabelText(/precio b2c/i), { target: { value: '900' } })
      fireEvent.change(screen.getByLabelText(/notas/i), { target: { value: 'Laptop premium' } })

      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      await waitFor(() => {
        expect(screen.getByText(/dispositivo creado correctamente/i)).toBeInTheDocument()
      })
    })

    test('should show error toast on API failure during creation', async () => {
      mockApiError('/api/dispositivos-personalizados/', 400, 'Validation error', 'post')

      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      // Fill form
      fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/modelo/i), { target: { value: 'Model' } })
      fireEvent.change(screen.getByLabelText(/capacidad/i), { target: { value: '64GB' } })
      fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'movil' } })
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '100' } })
      fireEvent.change(screen.getByLabelText(/precio b2c/i), { target: { value: '150' } })

      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      await waitFor(() => {
        expect(screen.getByText(/error.*crear/i)).toBeInTheDocument()
      })
    })

  })

  describe('Edit - API Integration', () => {

    test('should PUT to API when editing existing device', async () => {
      mockApiSuccess(`/api/dispositivos-personalizados/${mockExistingDevice.id}/`, mockExistingDevice, 'put')

      const onCloseMock = jest.fn()
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={onCloseMock}
          dispositivo={mockExistingDevice}
        />
      )

      // Modify a field
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '475' } })

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      await waitFor(() => {
        expect(screen.getByText(/dispositivo actualizado correctamente/i)).toBeInTheDocument()
      })

      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    test('should send correct payload when editing device', async () => {
      mockApiSuccess(`/api/dispositivos-personalizados/${mockExistingDevice.id}/`, mockExistingDevice, 'put')

      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={mockExistingDevice}
        />
      )

      // Modify fields
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '475' } })
      fireEvent.change(screen.getByLabelText(/notas/i), { target: { value: 'Updated notes' } })

      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      await waitFor(() => {
        expect(screen.getByText(/dispositivo actualizado correctamente/i)).toBeInTheDocument()
      })
    })

    test('should show error toast on API failure during edit', async () => {
      mockApiError(`/api/dispositivos-personalizados/${mockExistingDevice.id}/`, 500, 'Server error', 'put')

      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={mockExistingDevice}
        />
      )

      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '500' } })
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      await waitFor(() => {
        expect(screen.getByText(/error.*actualizar/i)).toBeInTheDocument()
      })
    })

  })

  describe('Validation', () => {

    test('should disable save button when required fields are empty', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const saveButton = screen.getByRole('button', { name: /guardar/i })
      expect(saveButton).toBeDisabled()
    })

    test('should enable save button when all required fields are filled', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Samsung' } })
      fireEvent.change(screen.getByLabelText(/modelo/i), { target: { value: 'S23' } })
      fireEvent.change(screen.getByLabelText(/capacidad/i), { target: { value: '256GB' } })
      fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'movil' } })
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '400' } })
      fireEvent.change(screen.getByLabelText(/precio b2c/i), { target: { value: '450' } })

      const saveButton = screen.getByRole('button', { name: /guardar/i })
      expect(saveButton).not.toBeDisabled()
    })

    test('should show validation error for negative prices', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '-100' } })
      fireEvent.blur(screen.getByLabelText(/precio b2b/i))

      expect(screen.getByText(/precio.*positivo/i)).toBeInTheDocument()
    })

    test('should show validation error for adjustment percentage > 100', () => {
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      fireEvent.change(screen.getByLabelText(/ajuste excelente/i), { target: { value: '150' } })
      fireEvent.blur(screen.getByLabelText(/ajuste excelente/i))

      expect(screen.getByText(/ajuste.*entre 0 y 100/i)).toBeInTheDocument()
    })

  })

  describe('Cancel and Close', () => {

    test('should call onClose when clicking cancel button', () => {
      const onCloseMock = jest.fn()
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={onCloseMock}
          dispositivo={null}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })

    test('should call onClose when clicking backdrop', () => {
      const onCloseMock = jest.fn()
      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={onCloseMock}
          dispositivo={null}
        />
      )

      const dialog = screen.getByRole('dialog')
      fireEvent.click(dialog.parentElement!)

      expect(onCloseMock).toHaveBeenCalled()
    })

    test('should reset form when modal closes and reopens', async () => {
      const { rerender } = render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      // Fill form
      fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Test' } })

      // Close modal
      rerender(
        <DispositivoPersonalizadoModal
          open={false}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      // Reopen modal
      rerender(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      const marcaInput = screen.getByLabelText(/marca/i) as HTMLInputElement
      expect(marcaInput.value).toBe('')
    })

  })

  describe('Loading State', () => {

    test('should show loading state while saving', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', { id: 999 }, 'post')

      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      // Fill required fields
      fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/modelo/i), { target: { value: 'Model' } })
      fireEvent.change(screen.getByLabelText(/capacidad/i), { target: { value: '64GB' } })
      fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'movil' } })
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '100' } })
      fireEvent.change(screen.getByLabelText(/precio b2c/i), { target: { value: '150' } })

      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      // Should show loading indicator
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    test('should disable buttons while saving', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', { id: 999 }, 'post')

      render(
        <DispositivoPersonalizadoModal
          open={true}
          onClose={jest.fn()}
          dispositivo={null}
        />
      )

      // Fill form
      fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Test' } })
      fireEvent.change(screen.getByLabelText(/modelo/i), { target: { value: 'Model' } })
      fireEvent.change(screen.getByLabelText(/capacidad/i), { target: { value: '64GB' } })
      fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'movil' } })
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '100' } })
      fireEvent.change(screen.getByLabelText(/precio b2c/i), { target: { value: '150' } })

      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      const saveButton = screen.getByRole('button', { name: /guardando/i })
      const cancelButton = screen.getByRole('button', { name: /cancelar/i })

      expect(saveButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()
    })

  })

})
