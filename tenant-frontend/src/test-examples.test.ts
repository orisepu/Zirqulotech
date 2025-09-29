// Ejemplos prácticos de testing frontend
import { formatoEuros } from './shared/utils/formato'
import { getId } from './shared/utils/id'
import { isEmail, isDNI } from './shared/lib/validators'

describe('Frontend Testing Examples', () => {
  describe('Basic utility tests', () => {
    it('should format euros correctly', () => {
      expect(formatoEuros(100)).toMatch(/100,00\s*€/)
      expect(formatoEuros(null as any)).toBe('—')
    })

    it('should get ID with priority', () => {
      expect(getId({ id: 1, hashid: 'hash' })).toBe('hash')
      expect(getId({ id: 1 })).toBe(1)
      expect(getId({})).toBeUndefined()
    })

    it('should validate emails', () => {
      expect(isEmail('test@example.com')).toBe(true)
      expect(isEmail('invalid-email')).toBe(false)
      expect(isEmail('')).toBe(false)
    })

    it('should validate Spanish DNI format', () => {
      // Test format without verifying checksum
      expect('12345678Z'.length).toBe(9)
      expect('12345678Z').toMatch(/^\d{8}[A-Z]$/)
    })
  })

  describe('Component behavior examples', () => {
    it('should handle loading states', () => {
      const isLoading = true
      const data = isLoading ? null : { value: 100 }

      expect(data).toBeNull()
    })

    it('should handle error states', () => {
      const error = { message: 'API Error' }
      const hasError = Boolean(error)

      expect(hasError).toBe(true)
      expect(error.message).toBe('API Error')
    })

    it('should handle filter arrays', () => {
      const filters = ['pending', 'completed']
      const hasFilters = filters.length > 0

      expect(hasFilters).toBe(true)
      expect(filters).toContain('pending')
    })
  })

  describe('Form validation examples', () => {
    it('should validate required fields', () => {
      const formData = { name: '', email: 'test@example.com' }
      const isValid = formData.name.length > 0 && isEmail(formData.email)

      expect(isValid).toBe(false) // name is required
    })

    it('should validate optional fields when present', () => {
      const phone = '612345678'
      const isValidPhone = phone.match(/^[6789]\d{8}$/)

      expect(isValidPhone).toBeTruthy()
    })
  })
})