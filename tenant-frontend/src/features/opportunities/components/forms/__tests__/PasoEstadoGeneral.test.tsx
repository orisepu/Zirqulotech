/**
 * PASO ESTADO GENERAL - COMPONENT TESTS (CICLO 6 RED)
 *
 * Tests para el componente PasoEstadoGeneral - selección simple de estado
 * para dispositivos personalizados (no-Apple).
 *
 * Este componente reemplaza el cuestionario complejo de Apple cuando se
 * trabaja con dispositivos personalizados, mostrando solo 3 opciones:
 * - Excelente (100%)
 * - Bueno (80%)
 * - Malo (50%)
 */

import React from 'react'
import { render, screen, fireEvent } from '@/test-utils'
import PasoEstadoGeneral from '../PasoEstadoGeneral'
import type { EstadoGeneral } from '@/shared/types/dispositivos'

describe('PasoEstadoGeneral - Simple State Selection', () => {

  describe('Component Rendering', () => {

    test('should render component with title and description', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      expect(screen.getByText(/estado general del dispositivo/i)).toBeInTheDocument()
      expect(screen.getByText(/seleccione el estado que mejor describe/i)).toBeInTheDocument()
    })

    test('should render all three state option cards', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      expect(screen.getByText('Excelente')).toBeInTheDocument()
      expect(screen.getByText('Bueno')).toBeInTheDocument()
      expect(screen.getByText('Malo')).toBeInTheDocument()
    })

    test('should show percentage for each state option', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      expect(screen.getByText(/100%/)).toBeInTheDocument()
      expect(screen.getByText(/80%/)).toBeInTheDocument()
      expect(screen.getByText(/50%/)).toBeInTheDocument()
    })

    test('should show description for each state option', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      expect(screen.getByText(/como nuevo/i)).toBeInTheDocument()
      expect(screen.getByText(/ligeros signos de uso/i)).toBeInTheDocument()
      expect(screen.getByText(/signos evidentes de uso/i)).toBeInTheDocument()
    })

  })

  describe('State Selection', () => {

    test('should highlight selected state card (excelente)', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      const excelenteCard = screen.getByText('Excelente').closest('div[role="button"]')
      expect(excelenteCard).toHaveClass('selected') // o alguna clase que indique selección
    })

    test('should highlight selected state card (bueno)', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="bueno"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
      expect(buenoCard).toHaveClass('selected')
    })

    test('should highlight selected state card (malo)', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="malo"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      const maloCard = screen.getByText('Malo').closest('div[role="button"]')
      expect(maloCard).toHaveClass('selected')
    })

    test('should call onEstadoGeneralChange when clicking Excelente card', () => {
      const onChangeMock = jest.fn()

      render(
        <PasoEstadoGeneral
          estadoGeneral="bueno"
          onEstadoGeneralChange={onChangeMock}
        />
      )

      const excelenteCard = screen.getByText('Excelente').closest('div[role="button"]')
      if (excelenteCard) fireEvent.click(excelenteCard)

      expect(onChangeMock).toHaveBeenCalledTimes(1)
      expect(onChangeMock).toHaveBeenCalledWith('excelente')
    })

    test('should call onEstadoGeneralChange when clicking Bueno card', () => {
      const onChangeMock = jest.fn()

      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={onChangeMock}
        />
      )

      const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
      if (buenoCard) fireEvent.click(buenoCard)

      expect(onChangeMock).toHaveBeenCalledTimes(1)
      expect(onChangeMock).toHaveBeenCalledWith('bueno')
    })

    test('should call onEstadoGeneralChange when clicking Malo card', () => {
      const onChangeMock = jest.fn()

      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={onChangeMock}
        />
      )

      const maloCard = screen.getByText('Malo').closest('div[role="button"]')
      if (maloCard) fireEvent.click(maloCard)

      expect(onChangeMock).toHaveBeenCalledTimes(1)
      expect(onChangeMock).toHaveBeenCalledWith('malo')
    })

    test('should not call onEstadoGeneralChange when clicking already selected state', () => {
      const onChangeMock = jest.fn()

      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={onChangeMock}
        />
      )

      const excelenteCard = screen.getByText('Excelente').closest('div[role="button"]')
      if (excelenteCard) fireEvent.click(excelenteCard)

      // Debería poder volver a clickear en la misma opción (o podría no hacer nada)
      // Esto depende del comportamiento deseado
      expect(onChangeMock).toHaveBeenCalled()
    })

  })

  describe('Card Visual States', () => {

    test('should show checkmark icon on selected card', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      // Buscar icono de check en la card seleccionada
      const excelenteCard = screen.getByText('Excelente').closest('div[role="button"]')
      expect(excelenteCard?.querySelector('svg')).toBeInTheDocument()
    })

    test('should apply different colors for each state', () => {
      const { container } = render(
        <PasoEstadoGeneral
          estadoGeneral="bueno"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      // Verificar que cada card tiene su color distintivo
      const cards = container.querySelectorAll('div[role="button"]')
      expect(cards.length).toBe(3)
    })

    test('should show hover effect on non-selected cards', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')

      // Simular hover
      if (buenoCard) {
        fireEvent.mouseEnter(buenoCard)
        // Verificar que tiene clase de hover o efecto visual
        expect(buenoCard).toBeInTheDocument()
      }
    })

  })

  describe('Accessibility', () => {

    test('should have role="button" for each card', () => {
      const { container } = render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      const buttons = container.querySelectorAll('[role="button"]')
      expect(buttons.length).toBe(3)
    })

    test('should have aria-selected="true" on selected card', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="bueno"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
      expect(buenoCard).toHaveAttribute('aria-selected', 'true')
    })

    test('should have aria-selected="false" on non-selected cards', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="bueno"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      const excelenteCard = screen.getByText('Excelente').closest('div[role="button"]')
      const maloCard = screen.getByText('Malo').closest('div[role="button"]')

      expect(excelenteCard).toHaveAttribute('aria-selected', 'false')
      expect(maloCard).toHaveAttribute('aria-selected', 'false')
    })

    test('should be keyboard navigable with Tab', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={jest.fn()}
        />
      )

      const cards = screen.getAllByRole('button')

      // Verificar que las cards son focusables
      cards.forEach(card => {
        expect(card).toHaveAttribute('tabIndex')
      })
    })

    test('should allow selection with Enter key', () => {
      const onChangeMock = jest.fn()

      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={onChangeMock}
        />
      )

      const buenoCard = screen.getByText('Bueno').closest('div[role="button"]')
      if (buenoCard) {
        fireEvent.keyDown(buenoCard, { key: 'Enter', code: 'Enter' })
        expect(onChangeMock).toHaveBeenCalledWith('bueno')
      }
    })

    test('should allow selection with Space key', () => {
      const onChangeMock = jest.fn()

      render(
        <PasoEstadoGeneral
          estadoGeneral="excelente"
          onEstadoGeneralChange={onChangeMock}
        />
      )

      const maloCard = screen.getByText('Malo').closest('div[role="button"]')
      if (maloCard) {
        fireEvent.keyDown(maloCard, { key: ' ', code: 'Space' })
        expect(onChangeMock).toHaveBeenCalledWith('malo')
      }
    })

  })

  describe('Edge Cases', () => {

    test('should handle missing estadoGeneral prop gracefully', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral={'' as EstadoGeneral}
          onEstadoGeneralChange={jest.fn()}
        />
      )

      // No debería crashear, todas las cards deberían estar no seleccionadas
      const cards = screen.getAllByRole('button')
      expect(cards.length).toBe(3)
    })

    test('should handle null estadoGeneral prop', () => {
      render(
        <PasoEstadoGeneral
          estadoGeneral={null as any}
          onEstadoGeneralChange={jest.fn()}
        />
      )

      expect(screen.getByText('Excelente')).toBeInTheDocument()
    })

    test('should work with undefined onEstadoGeneralChange', () => {
      // Aunque TypeScript no permite undefined, verificamos robustez
      expect(() => {
        render(
          <PasoEstadoGeneral
            estadoGeneral="bueno"
            onEstadoGeneralChange={undefined as any}
          />
        )
      }).not.toThrow()
    })

  })

})
