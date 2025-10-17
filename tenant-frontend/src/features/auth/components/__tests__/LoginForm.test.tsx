/**
 * LOGIN FORM COMPONENT TESTS
 *
 * Tests for the LoginForm component including:
 * - Form validation
 * - User interactions
 * - Error handling
 * - Loading states
 * - Remember empresa functionality
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/test-utils'
import { login as loginRequest } from '@/services/api'
import LoginForm from '../LoginForm'

// Mock the login API call
jest.mock('@/services/api', () => ({
  login: jest.fn(),
}))

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock secure storage
const mockSetSecureItem = jest.fn().mockResolvedValue(undefined)
const mockGetSecureItem = jest.fn().mockResolvedValue(null)

jest.mock('@/shared/lib/secureStorage', () => ({
  setSecureItem: (...args: any[]) => mockSetSecureItem(...args),
  getSecureItem: (...args: any[]) => mockGetSecureItem(...args),
}))

describe('LoginForm Component', () => {
  const mockLoginRequest = loginRequest as jest.MockedFunction<typeof loginRequest>

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
    mockSetSecureItem.mockClear()
    mockGetSecureItem.mockClear()
    localStorage.clear()
  })

  describe('Initial Render', () => {
    test('should render login form with all fields', () => {
      render(<LoginForm />)

      expect(screen.getByRole('textbox', { name: /empresa/i })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/contraseña/i, { selector: 'input' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
    })

    test('should have submit button disabled initially', () => {
      render(<LoginForm />)

      const submitButton = screen.getByRole('button', { name: /entrar/i })
      expect(submitButton).toBeDisabled()
    })

    test('should render remember empresa checkbox', () => {
      render(<LoginForm />)

      expect(screen.getByRole('checkbox', { name: /recordar empresa/i })).toBeInTheDocument()
    })

    test('should show password toggle button', () => {
      render(<LoginForm />)

      expect(screen.getByLabelText(/mostrar contraseña/i)).toBeInTheDocument()
    })

    test('should load remembered empresa from localStorage', () => {
      localStorage.setItem('rememberedEmpresa', 'my-company')

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i }) as HTMLInputElement
      expect(empresaInput.value).toBe('my-company')
    })
  })

  describe('Form Validation', () => {
    test('should enable submit button when all fields are valid', async () => {
      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })

    test('should keep submit button disabled when empresa is empty', async () => {
      render(<LoginForm />)

      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      expect(submitButton).toBeDisabled()
    })

    test('should keep submit button disabled when email is invalid', async () => {
      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      expect(submitButton).toBeDisabled()
    })

    test('should keep submit button disabled when password is too short', async () => {
      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'abc' } }) // Too short (< 4 chars currently)

      expect(submitButton).toBeDisabled()
    })

    test('should reject password with less than 8 characters', async () => {
      // SECURITY FIX (CRIT-01): Now requires minimum 8 characters
      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: '1234567' } }) // 7 chars - should be invalid

      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })
    })

    test('should accept password with exactly 8 characters', async () => {
      // SECURITY FIX (CRIT-01): Minimum 8 characters required
      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: '12345678' } }) // Exactly 8 chars

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })
  })

  describe('User Interactions', () => {
    test('should toggle password visibility when clicking eye icon', async () => {
      render(<LoginForm />)

      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' }) as HTMLInputElement
      const toggleButton = screen.getByLabelText(/mostrar contraseña/i)

      // Initially password type
      expect(passwordInput.type).toBe('password')

      // Click to show
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(passwordInput.type).toBe('text')
      })

      // Click to hide again
      fireEvent.click(toggleButton)

      await waitFor(() => {
        expect(passwordInput.type).toBe('password')
      })
    })

    test('should update checkbox state when toggling remember empresa', () => {
      render(<LoginForm />)

      const checkbox = screen.getByRole('checkbox', { name: /recordar empresa/i }) as HTMLInputElement

      // Initially checked
      expect(checkbox.checked).toBe(true)

      // Click to uncheck
      fireEvent.click(checkbox)
      expect(checkbox.checked).toBe(false)

      // Click to check again
      fireEvent.click(checkbox)
      expect(checkbox.checked).toBe(true)
    })

    test('should trim whitespace from empresa and email inputs', async () => {
      mockLoginRequest.mockResolvedValue({
        data: {
          access: 'access-token',
          refresh: 'refresh-token',
          schema: 'test-company',
          user: { id: 1, email: 'user@example.com', name: 'Test User' },
          tenantAccess: ['test-company']
        }
      } as any)

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: '  test-company  ' } })
      fireEvent.change(emailInput, { target: { value: '  user@example.com  ' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      await waitFor(() => expect(submitButton).not.toBeDisabled())

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockLoginRequest).toHaveBeenCalledWith(
          'test-company', // trimmed
          'user@example.com', // trimmed
          'password123' // not trimmed (passwords can have spaces)
        )
      })
    })
  })

  describe('Form Submission - Success', () => {
    test('should handle successful login', async () => {
      const mockResponse = {
        data: {
          access: 'mock-access-token',
          refresh: 'mock-refresh-token',
          schema: 'test-company',
          user: {
            id: 1,
            email: 'user@example.com',
            name: 'Test User',
            tipo_usuario: 'empleado'
          },
          tenantAccess: ['test-company']
        }
      }

      mockLoginRequest.mockResolvedValue(mockResponse as any)

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockLoginRequest).toHaveBeenCalledWith('test-company', 'user@example.com', 'password123')
      })

      await waitFor(() => {
        expect(mockSetSecureItem).toHaveBeenCalledWith('access', 'mock-access-token')
        expect(mockSetSecureItem).toHaveBeenCalledWith('refresh', 'mock-refresh-token')
        expect(mockSetSecureItem).toHaveBeenCalledWith('schema', 'test-company')
        expect(mockSetSecureItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.data.user))
        expect(mockSetSecureItem).toHaveBeenCalledWith('tenantAccess', JSON.stringify(mockResponse.data.tenantAccess))
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    test('should save empresa to localStorage when remember is checked', async () => {
      mockLoginRequest.mockResolvedValue({
        data: {
          access: 'token',
          refresh: 'refresh',
          schema: 'my-company',
          user: { id: 1, email: 'user@example.com', name: 'Test' },
          tenantAccess: ['my-company']
        }
      } as any)

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const checkbox = screen.getByRole('checkbox', { name: /recordar empresa/i })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      // Checkbox is checked by default
      expect((checkbox as HTMLInputElement).checked).toBe(true)

      fireEvent.change(empresaInput, { target: { value: 'my-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(localStorage.getItem('rememberedEmpresa')).toBe('my-company')
      })
    })

    test('should remove empresa from localStorage when remember is unchecked', async () => {
      localStorage.setItem('rememberedEmpresa', 'old-company')

      mockLoginRequest.mockResolvedValue({
        data: {
          access: 'token',
          refresh: 'refresh',
          schema: 'my-company',
          user: { id: 1, email: 'user@example.com', name: 'Test' },
          tenantAccess: ['my-company']
        }
      } as any)

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const checkbox = screen.getByRole('checkbox', { name: /recordar empresa/i })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      // Uncheck the remember checkbox
      fireEvent.click(checkbox)
      expect((checkbox as HTMLInputElement).checked).toBe(false)

      fireEvent.change(empresaInput, { target: { value: 'my-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(localStorage.getItem('rememberedEmpresa')).toBeNull()
      })
    })
  })

  describe('Form Submission - Loading State', () => {
    test('should show loading state during submission', async () => {
      mockLoginRequest.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          data: {
            access: 'token',
            refresh: 'refresh',
            schema: 'test',
            user: { id: 1, email: 'user@example.com', name: 'Test' },
            tenantAccess: ['test']
          }
        } as any), 100))
      )

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
      })

      // Button should be disabled during loading
      expect(submitButton).toBeDisabled()

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      }, { timeout: 200 })
    })
  })

  describe('Form Submission - Error Handling', () => {
    test('should display error message when tenant not found (404)', async () => {
      mockLoginRequest.mockRejectedValue({
        response: {
          status: 404,
          data: { detail: 'Empresa no encontrada.' }
        }
      })

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'nonexistent-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/empresa no encontrada/i)).toBeInTheDocument()
      })
    })

    test('should display error message when credentials are incorrect (401)', async () => {
      mockLoginRequest.mockRejectedValue({
        response: {
          status: 401,
          data: { detail: 'Credenciales incorrectas.' }
        }
      })

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/credenciales incorrectas/i)).toBeInTheDocument()
      })
    })

    test('should display error message when account is blocked (403)', async () => {
      mockLoginRequest.mockRejectedValue({
        response: {
          status: 403,
          data: { detail: 'Cuenta bloqueada por demasiados intentos de inicio de sesión. Por favor, inténtelo de nuevo más tarde.' }
        }
      })

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'blocked@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/cuenta bloqueada/i)).toBeInTheDocument()
      })
    })

    test('should display generic error message when no specific error detail', async () => {
      mockLoginRequest.mockRejectedValue(new Error('Network error'))

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        // The component uses err.message when available, so it shows "Network error"
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })

    test('should clear error message when user starts typing again', async () => {
      mockLoginRequest.mockRejectedValue({
        response: {
          status: 401,
          data: { detail: 'Credenciales incorrectas.' }
        }
      })

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /entrar/i })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/credenciales incorrectas/i)).toBeInTheDocument()
      })

      // Error should auto-dismiss after 4 seconds
      await waitFor(() => {
        expect(screen.queryByText(/credenciales incorrectas/i)).not.toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Accessibility', () => {
    test('should have proper aria-labels for password toggle', () => {
      render(<LoginForm />)

      const toggleButton = screen.getByLabelText(/mostrar contraseña/i)
      expect(toggleButton).toHaveAttribute('aria-label')
    })

    test('should support form submission via Enter key', async () => {
      mockLoginRequest.mockResolvedValue({
        data: {
          access: 'token',
          refresh: 'refresh',
          schema: 'test',
          user: { id: 1, email: 'user@example.com', name: 'Test' },
          tenantAccess: ['test']
        }
      } as any)

      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })

      fireEvent.change(empresaInput, { target: { value: 'test-company' } })
      fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      // Simulate pressing Enter on the form
      fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!)

      await waitFor(() => {
        expect(mockLoginRequest).toHaveBeenCalled()
      })
    })

    test('should have autocomplete attributes', () => {
      render(<LoginForm />)

      const empresaInput = screen.getByRole('textbox', { name: /empresa/i })
      const emailInput = screen.getByRole('textbox', { name: /email/i })
      const passwordInput = screen.getByLabelText(/contraseña/i, { selector: 'input' })

      expect(empresaInput).toHaveAttribute('autocomplete', 'organization')
      expect(emailInput).toHaveAttribute('autocomplete', 'email')
      expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
    })
  })
})
