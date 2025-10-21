/**
 * DISPOSITIVOS PERSONALIZADOS ADMIN PAGE - TESTS (CICLO 10 RED)
 *
 * Tests para la página administrativa de dispositivos personalizados.
 * Esta página integra la tabla y el modal para gestión completa CRUD.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/test-utils'
import DispositivosPersonalizadosPage from '../page'
import { mockApiSuccess, setupAuthenticatedState } from '@/__tests__/utils/api-helpers'
import type { DispositivoPersonalizado } from '@/shared/types/dispositivos'

const mockDispositivos: DispositivoPersonalizado[] = [
  {
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
    caracteristicas: {},
    created_by: 1,
    created_by_name: 'Admin User',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    activo: true,
    descripcion_completa: 'Samsung Galaxy S23 256GB'
  },
  {
    id: 2,
    marca: 'Xiaomi',
    modelo: 'Redmi Note 12',
    capacidad: '128GB',
    tipo: 'movil',
    precio_base_b2b: 180.00,
    precio_base_b2c: 220.00,
    ajuste_excelente: 100,
    ajuste_bueno: 75,
    ajuste_malo: 45,
    caracteristicas: {},
    created_by: 1,
    created_by_name: 'Admin User',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    activo: true,
    descripcion_completa: 'Xiaomi Redmi Note 12 128GB'
  },
]

describe('DispositivosPersonalizadosPage - Admin Page', () => {

  beforeEach(() => {
    setupAuthenticatedState()
    mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)
    jest.clearAllMocks()
  })

  describe('Page Rendering', () => {

    test('should render page title', async () => {
      render(<DispositivosPersonalizadosPage />)

      expect(screen.getByText(/dispositivos personalizados/i)).toBeInTheDocument()
    })

    test('should render the dispositivos table', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy S23 256GB')).toBeInTheDocument()
        expect(screen.getByText('Xiaomi Redmi Note 12 128GB')).toBeInTheDocument()
      })
    })

    test('should render create button via table component', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear dispositivo/i })).toBeInTheDocument()
      })
    })

  })

  describe('Create Device Flow', () => {

    test('should open create modal when clicking create button', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /crear dispositivo/i })
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/crear dispositivo personalizado/i)).toBeInTheDocument()
      })
    })

    test('should close create modal when clicking cancel', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /crear dispositivo/i })
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: /cancelar/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    test('should refresh table after successful create', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', { id: 999 }, 'post')
      mockApiSuccess('/api/dispositivos-personalizados/', [
        ...mockDispositivos,
        {
          id: 999,
          marca: 'Dell',
          modelo: 'XPS 15',
          capacidad: '1TB SSD',
          tipo: 'portatil',
          precio_base_b2b: 800.00,
          precio_base_b2c: 900.00,
          ajuste_excelente: 100,
          ajuste_bueno: 80,
          ajuste_malo: 50,
          caracteristicas: {},
          created_by: 1,
          created_by_name: 'Admin User',
          created_at: '2025-01-10T00:00:00Z',
          updated_at: '2025-01-10T00:00:00Z',
          activo: true,
          descripcion_completa: 'Dell XPS 15 1TB SSD'
        }
      ])

      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /crear dispositivo/i })
        fireEvent.click(createButton)
      })

      // Fill form
      fireEvent.change(screen.getByLabelText(/marca/i), { target: { value: 'Dell' } })
      fireEvent.change(screen.getByLabelText(/modelo/i), { target: { value: 'XPS 15' } })
      fireEvent.change(screen.getByLabelText(/capacidad/i), { target: { value: '1TB SSD' } })
      fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'portatil' } })
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '800' } })
      fireEvent.change(screen.getByLabelText(/precio b2c/i), { target: { value: '900' } })

      // Save
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

  })

  describe('Edit Device Flow', () => {

    test('should open edit modal when clicking edit button', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        fireEvent.click(editButtons[0])
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText(/editar dispositivo personalizado/i)).toBeInTheDocument()
      })
    })

    test('should populate form with device data when editing', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        fireEvent.click(editButtons[0])
      })

      await waitFor(() => {
        const marcaInput = screen.getByLabelText(/marca/i) as HTMLInputElement
        expect(marcaInput.value).toBe('Samsung')
      })
    })

    test('should close edit modal when clicking cancel', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        fireEvent.click(editButtons[0])
      })

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: /cancelar/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    test('should refresh table after successful edit', async () => {
      mockApiSuccess(`/api/dispositivos-personalizados/1/`, mockDispositivos[0], 'put')

      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        fireEvent.click(editButtons[0])
      })

      // Modify price
      fireEvent.change(screen.getByLabelText(/precio b2b/i), { target: { value: '475' } })

      // Save
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

  })

  describe('Modal State Management', () => {

    test('should not show modal by default', () => {
      render(<DispositivosPersonalizadosPage />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    test('should only show one modal at a time', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /crear dispositivo/i })
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        const dialogs = screen.queryAllByRole('dialog')
        expect(dialogs.length).toBe(1)
      })
    })

    test('should reset modal state when switching between create and edit', async () => {
      render(<DispositivosPersonalizadosPage />)

      // Open create modal
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /crear dispositivo/i })
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        expect(screen.getByText(/crear dispositivo personalizado/i)).toBeInTheDocument()
      })

      // Close it
      fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Open edit modal
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        fireEvent.click(editButtons[0])
      })

      await waitFor(() => {
        expect(screen.getByText(/editar dispositivo personalizado/i)).toBeInTheDocument()
      })
    })

  })

  describe('Integration - Table and Modal', () => {

    test('should pass onCreate callback to table', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /crear dispositivo/i })
        expect(createButton).toBeInTheDocument()
      })
    })

    test('should pass onEdit callback to table', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        expect(editButtons.length).toBeGreaterThan(0)
      })
    })

    test('should pass correct dispositivo to modal when editing', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        fireEvent.click(editButtons[0])
      })

      await waitFor(() => {
        const marcaInput = screen.getByLabelText(/marca/i) as HTMLInputElement
        const modeloInput = screen.getByLabelText(/modelo/i) as HTMLInputElement

        expect(marcaInput.value).toBe(mockDispositivos[0].marca)
        expect(modeloInput.value).toBe(mockDispositivos[0].modelo)
      })
    })

    test('should pass null to modal when creating', async () => {
      render(<DispositivosPersonalizadosPage />)

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /crear dispositivo/i })
        fireEvent.click(createButton)
      })

      await waitFor(() => {
        const marcaInput = screen.getByLabelText(/marca/i) as HTMLInputElement
        expect(marcaInput.value).toBe('')
      })
    })

  })

})
