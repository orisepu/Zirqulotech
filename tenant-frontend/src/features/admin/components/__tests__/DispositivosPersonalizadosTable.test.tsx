/**
 * DISPOSITIVOS PERSONALIZADOS TABLE - COMPONENT TESTS (CICLO 8 RED)
 *
 * Tests para la tabla administrativa de dispositivos personalizados.
 * Este componente muestra todos los dispositivos con funcionalidad CRUD para admins.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/test-utils'
import DispositivosPersonalizadosTable from '../DispositivosPersonalizadosTable'
import { mockApiSuccess, mockApiError, setupAuthenticatedState } from '@/__tests__/utils/api-helpers'
import type { DispositivoPersonalizado } from '@/shared/types/dispositivos'

const mockDispositivos: DispositivoPersonalizado[] = [
  {
    id: 1,
    marca: 'Samsung',
    modelo: 'Galaxy S23',
    capacidad: '256GB',
    tipo: 'movil',
    precio_b2b_vigente: 450.00,
    precio_b2c_vigente: 500.00,
    precios: [],
    pp_A: 0.08,
    pp_B: 0.12,
    pp_C: 0.15,
    precio_suelo: 180.00,
    caracteristicas: { RAM: '8GB', Procesador: 'Snapdragon 8 Gen 2' },
    notas: 'Dispositivo premium',
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
    precio_b2b_vigente: 180.00,
    precio_b2c_vigente: 220.00,
    precios: [],
    pp_A: 0.08,
    pp_B: 0.12,
    pp_C: 0.15,
    precio_suelo: 80.00,
    caracteristicas: {},
    created_by: 1,
    created_by_name: 'Admin User',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    activo: true,
    descripcion_completa: 'Xiaomi Redmi Note 12 128GB'
  },
  {
    id: 3,
    marca: 'Dell',
    modelo: 'XPS 15',
    capacidad: '1TB SSD',
    tipo: 'portatil',
    precio_b2b_vigente: 800.00,
    precio_b2c_vigente: 900.00,
    precios: [],
    pp_A: 0.08,
    pp_B: 0.12,
    pp_C: 0.15,
    precio_suelo: 350.00,
    caracteristicas: {},
    created_by: 1,
    created_by_name: 'Admin User',
    created_at: '2025-01-03T00:00:00Z',
    updated_at: '2025-01-03T00:00:00Z',
    activo: false,
    descripcion_completa: 'Dell XPS 15 1TB SSD'
  }
]

describe('DispositivosPersonalizadosTable - Admin Component', () => {

  beforeEach(() => {
    setupAuthenticatedState()
    jest.clearAllMocks()
  })

  describe('Table Rendering', () => {

    test('should render table with devices data', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy S23 256GB')).toBeInTheDocument()
        expect(screen.getByText('Xiaomi Redmi Note 12 128GB')).toBeInTheDocument()
        expect(screen.getByText('Dell XPS 15 1TB SSD')).toBeInTheDocument()
      })
    })

    test('should display all required columns', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByText(/marca/i)).toBeInTheDocument()
        expect(screen.getByText(/modelo/i)).toBeInTheDocument()
        expect(screen.getByText(/tipo/i)).toBeInTheDocument()
        expect(screen.getByText(/precio b2b vigente/i)).toBeInTheDocument()
        expect(screen.getByText(/precio b2c vigente/i)).toBeInTheDocument()
        expect(screen.getByText(/penalizaciones/i)).toBeInTheDocument()
        expect(screen.getByText(/precio suelo/i)).toBeInTheDocument()
        expect(screen.getByText(/estado/i)).toBeInTheDocument()
        expect(screen.getByText(/acciones/i)).toBeInTheDocument()
      })
    })

    test('should format prices correctly', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByText('450,00 €')).toBeInTheDocument()
        expect(screen.getByText('500,00 €')).toBeInTheDocument()
      })
    })

    test('should show active/inactive status', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const activeChips = screen.getAllByText('Activo')
        const inactiveChips = screen.getAllByText('Inactivo')
        expect(activeChips.length).toBe(2) // Samsung y Xiaomi
        expect(inactiveChips.length).toBe(1) // Dell
      })
    })

    test('should show adjustment percentages', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByText(/8%.*12%.*15%/)).toBeInTheDocument() // Penalizaciones Samsung (pp_A/pp_B/pp_C)
      })
    })

  })

  describe('Empty States', () => {

    test('should show empty state when no devices', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', [])

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByText(/no hay dispositivos personalizados/i)).toBeInTheDocument()
      })
    })

    test('should show loading state while fetching', () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    test('should show error state on API failure', async () => {
      mockApiError('/api/dispositivos-personalizados/', 500, 'Server Error')

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByText(/error al cargar dispositivos/i)).toBeInTheDocument()
      })
    })

  })

  describe('CRUD Actions', () => {

    test('should render edit button for each device', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        expect(editButtons.length).toBe(3)
      })
    })

    test('should render delete button for each device', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
        expect(deleteButtons.length).toBe(3)
      })
    })

    test('should call onEdit when clicking edit button', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)
      const onEditMock = jest.fn()

      render(<DispositivosPersonalizadosTable onEdit={onEditMock} />)

      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: /editar/i })
        fireEvent.click(editButtons[0])
      })

      expect(onEditMock).toHaveBeenCalledTimes(1)
      expect(onEditMock).toHaveBeenCalledWith(mockDispositivos[0])
    })

    test('should show confirmation dialog before delete', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
        fireEvent.click(deleteButtons[0])
      })

      expect(screen.getByText(/¿estás seguro.*eliminar/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
    })

    test('should cancel delete on cancel button', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
        fireEvent.click(deleteButtons[0])
      })

      const cancelButton = screen.getByRole('button', { name: /cancelar/i })
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByText(/¿estás seguro.*eliminar/i)).not.toBeInTheDocument()
      })
    })

    test('should perform soft delete on confirm', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)
      mockApiSuccess('/api/dispositivos-personalizados/1/', {}, 'delete')

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button', { name: /eliminar/i })
        fireEvent.click(deleteButtons[0])
      })

      const confirmButton = screen.getByRole('button', { name: /confirmar/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText(/dispositivo eliminado correctamente/i)).toBeInTheDocument()
      })
    })

  })

  describe('Search and Filters', () => {

    test('should render search input', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      expect(screen.getByPlaceholderText(/buscar dispositivos/i)).toBeInTheDocument()
    })

    test('should filter devices by search term', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy S23 256GB')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/buscar dispositivos/i)
      fireEvent.change(searchInput, { target: { value: 'Samsung' } })

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy S23 256GB')).toBeInTheDocument()
        expect(screen.queryByText('Xiaomi Redmi Note 12 128GB')).not.toBeInTheDocument()
      })
    })

    test('should filter by device type', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const tipoFilter = screen.getByLabelText(/filtrar por tipo/i)
        fireEvent.change(tipoFilter, { target: { value: 'portatil' } })
      })

      await waitFor(() => {
        expect(screen.getByText('Dell XPS 15 1TB SSD')).toBeInTheDocument()
        expect(screen.queryByText('Samsung Galaxy S23 256GB')).not.toBeInTheDocument()
      })
    })

    test('should filter by active status', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const statusFilter = screen.getByLabelText(/filtrar por estado/i)
        fireEvent.change(statusFilter, { target: { value: 'activo' } })
      })

      await waitFor(() => {
        expect(screen.getAllByText('Activo').length).toBe(2)
        expect(screen.queryByText('Dell XPS 15 1TB SSD')).not.toBeInTheDocument()
      })
    })

  })

  describe('Sorting', () => {

    test('should sort by marca when clicking column header', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const marcaHeader = screen.getByText(/marca/i)
        fireEvent.click(marcaHeader)
      })

      // Verificar orden ascendente: Dell → Samsung → Xiaomi
      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows[1]).toHaveTextContent('Dell')
        expect(rows[2]).toHaveTextContent('Samsung')
        expect(rows[3]).toHaveTextContent('Xiaomi')
      })
    })

    test('should toggle sort direction on second click', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const marcaHeader = screen.getByText(/marca/i)
        fireEvent.click(marcaHeader) // Ascendente
        fireEvent.click(marcaHeader) // Descendente
      })

      await waitFor(() => {
        const rows = screen.getAllByRole('row')
        expect(rows[1]).toHaveTextContent('Xiaomi')
        expect(rows[2]).toHaveTextContent('Samsung')
        expect(rows[3]).toHaveTextContent('Dell')
      })
    })

  })

  describe('Pagination', () => {

    test('should show pagination controls when many devices', async () => {
      const manyDevices = Array.from({ length: 25 }, (_, i) => ({
        ...mockDispositivos[0],
        id: i + 1,
        modelo: `Device ${i + 1}`,
        descripcion_completa: `Samsung Device ${i + 1} 256GB`
      }))
      mockApiSuccess('/api/dispositivos-personalizados/', manyDevices)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByText(/filas por página/i)).toBeInTheDocument()
      })
    })

    test('should change page on pagination click', async () => {
      const manyDevices = Array.from({ length: 25 }, (_, i) => ({
        ...mockDispositivos[0],
        id: i + 1,
        modelo: `Device ${i + 1}`,
        descripcion_completa: `Samsung Device ${i + 1} 256GB`
      }))
      mockApiSuccess('/api/dispositivos-personalizados/', manyDevices)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        const paginationButtons = screen.getAllByRole('button')
        // Find the "next page" button (usually has aria-label="Go to next page")
        const nextButton = paginationButtons.find(btn =>
          btn.getAttribute('aria-label')?.includes('next') ||
          btn.getAttribute('title')?.includes('next')
        )
        if (nextButton) {
          fireEvent.click(nextButton)
        }
      })

      await waitFor(() => {
        expect(screen.getByText('Device 11')).toBeInTheDocument()
      })
    })

  })

  describe('Create Button', () => {

    test('should render create new device button', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)

      render(<DispositivosPersonalizadosTable />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /crear dispositivo/i })).toBeInTheDocument()
      })
    })

    test('should call onCreate when clicking create button', async () => {
      mockApiSuccess('/api/dispositivos-personalizados/', mockDispositivos)
      const onCreateMock = jest.fn()

      render(<DispositivosPersonalizadosTable onCreate={onCreateMock} />)

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /crear dispositivo/i })
        fireEvent.click(createButton)
      })

      expect(onCreateMock).toHaveBeenCalledTimes(1)
    })

  })

})
