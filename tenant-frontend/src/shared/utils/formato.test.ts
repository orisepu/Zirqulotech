import { formatoEuros } from './formato'

describe('formato utils', () => {
  describe('formatoEuros', () => {
    it('should format positive numbers correctly', () => {
      expect(formatoEuros(100)).toMatch(/100,00\s*€/)
      expect(formatoEuros(1234.56)).toMatch(/1\.?234,56\s*€/)
      expect(formatoEuros(1000000.99)).toMatch(/1\.?000\.?000,99\s*€/)
    })

    it('should format negative numbers correctly', () => {
      expect(formatoEuros(-100)).toMatch(/-100,00\s*€/)
      expect(formatoEuros(-1234.56)).toMatch(/-1\.?234,56\s*€/)
    })

    it('should handle zero correctly', () => {
      expect(formatoEuros(0)).toMatch(/0,00\s*€/)
    })

    it('should handle null values', () => {
      expect(formatoEuros(null as any)).toBe('—')
    })

    it('should handle undefined values', () => {
      expect(formatoEuros(undefined as any)).toBe('—')
    })

    it('should respect custom decimal places', () => {
      expect(formatoEuros(100, 0)).toMatch(/100\s*€/)
      expect(formatoEuros(100, 1)).toMatch(/100,0\s*€/)
      expect(formatoEuros(100.123, 3)).toMatch(/100,123\s*€/)
    })

    it('should round to specified decimal places', () => {
      expect(formatoEuros(100.999, 2)).toMatch(/101,00\s*€/)
      expect(formatoEuros(100.994, 2)).toMatch(/100,99\s*€/)
    })

    it('should handle very small numbers', () => {
      expect(formatoEuros(0.01)).toMatch(/0,01\s*€/)
      expect(formatoEuros(0.001, 3)).toMatch(/0,001\s*€/)
    })

    it('should handle very large numbers', () => {
      expect(formatoEuros(999999999.99)).toMatch(/999[\.\s]*999[\.\s]*999,99\s*€/)
      expect(formatoEuros(1000000000)).toMatch(/1[\.\s]*000[\.\s]*000[\.\s]*000,00\s*€/)
    })

    it('should use Spanish locale formatting', () => {
      // Spanish locale uses comma for decimals and dots/spaces for thousands
      expect(formatoEuros(1234.56)).toContain(',56')
      expect(formatoEuros(1234.56)).toMatch(/1[\.\s]?234,56/)
    })

    it('should handle edge cases with decimals parameter', () => {
      expect(formatoEuros(123.456789, 0)).toMatch(/123\s*€/)
      expect(formatoEuros(123.456789, 4)).toMatch(/123,4568\s*€/)
    })
  })
})