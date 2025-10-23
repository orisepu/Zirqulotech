/**
 * Device ID Utilities Tests
 *
 * Tests for extracting and normalizing device capacity IDs from various API formats.
 */

import { extractCapacidadId, hasCapacidadId } from './deviceIdUtils';

describe('deviceIdUtils', () => {
  describe('extractCapacidadId', () => {
    it('should return null for null device', () => {
      expect(extractCapacidadId(null)).toBeNull();
    });

    it('should return null for device with no capacity fields', () => {
      expect(extractCapacidadId({})).toBeNull();
    });

    it('should extract from capacidad_id (number)', () => {
      expect(extractCapacidadId({ capacidad_id: 42 })).toBe(42);
    });

    it('should extract from capacidad_id (string)', () => {
      expect(extractCapacidadId({ capacidad_id: '42' })).toBe(42);
    });

    it('should extract from cap_id (number)', () => {
      expect(extractCapacidadId({ cap_id: 123 })).toBe(123);
    });

    it('should extract from cap_id (string)', () => {
      expect(extractCapacidadId({ cap_id: '123' })).toBe(123);
    });

    it('should extract from capacidad.id (number)', () => {
      expect(extractCapacidadId({ capacidad: { id: 456 } })).toBe(456);
    });

    it('should extract from capacidad.id (string)', () => {
      expect(extractCapacidadId({ capacidad: { id: '456' } })).toBe(456);
    });

    it('should extract from capacidadId (number)', () => {
      expect(extractCapacidadId({ capacidadId: 789 })).toBe(789);
    });

    it('should extract from capacidadId (string)', () => {
      expect(extractCapacidadId({ capacidadId: '789' })).toBe(789);
    });

    it('should extract from id_capacidad (number)', () => {
      expect(extractCapacidadId({ id_capacidad: 999 })).toBe(999);
    });

    it('should extract from id_capacidad (string)', () => {
      expect(extractCapacidadId({ id_capacidad: '999' })).toBe(999);
    });

    it('should prioritize capacidad_id over other fields', () => {
      expect(
        extractCapacidadId({
          capacidad_id: 1,
          cap_id: 2,
          capacidad: { id: 3 },
          capacidadId: 4,
          id_capacidad: 5,
        })
      ).toBe(1);
    });

    it('should fall back to cap_id if capacidad_id is null', () => {
      expect(
        extractCapacidadId({
          capacidad_id: null,
          cap_id: 2,
          capacidad: { id: 3 },
        })
      ).toBe(2);
    });

    it('should fall back to capacidad.id if earlier fields are null', () => {
      expect(
        extractCapacidadId({
          capacidad_id: null,
          cap_id: null,
          capacidad: { id: 3 },
          capacidadId: 4,
        })
      ).toBe(3);
    });

    it('should reject NaN values', () => {
      expect(extractCapacidadId({ capacidad_id: NaN })).toBeNull();
    });

    it('should reject Infinity', () => {
      expect(extractCapacidadId({ capacidad_id: Infinity })).toBeNull();
    });

    it('should reject empty strings', () => {
      expect(extractCapacidadId({ capacidad_id: '' })).toBeNull();
    });

    it('should reject whitespace-only strings', () => {
      expect(extractCapacidadId({ capacidad_id: '   ' })).toBeNull();
    });

    it('should reject non-numeric strings', () => {
      expect(extractCapacidadId({ capacidad_id: 'abc' })).toBeNull();
    });

    it('should handle string with whitespace', () => {
      expect(extractCapacidadId({ capacidad_id: '  42  ' })).toBe(42);
    });

    it('should handle zero as valid value', () => {
      expect(extractCapacidadId({ capacidad_id: 0 })).toBe(0);
    });

    it('should handle negative numbers as valid', () => {
      expect(extractCapacidadId({ capacidad_id: -1 })).toBe(-1);
    });

    it('should handle floating point numbers', () => {
      expect(extractCapacidadId({ capacidad_id: 42.5 })).toBe(42.5);
    });

    it('should convert numeric strings with decimals', () => {
      expect(extractCapacidadId({ capacidad_id: '42.5' })).toBe(42.5);
    });
  });

  describe('hasCapacidadId', () => {
    it('should return false for null device', () => {
      expect(hasCapacidadId(null)).toBe(false);
    });

    it('should return false for device with no capacity fields', () => {
      expect(hasCapacidadId({})).toBe(false);
    });

    it('should return true for device with valid capacidad_id', () => {
      expect(hasCapacidadId({ capacidad_id: 42 })).toBe(true);
    });

    it('should return true for device with valid cap_id', () => {
      expect(hasCapacidadId({ cap_id: 123 })).toBe(true);
    });

    it('should return true for device with valid capacidad.id', () => {
      expect(hasCapacidadId({ capacidad: { id: 456 } })).toBe(true);
    });

    it('should return false for device with invalid capacity value', () => {
      expect(hasCapacidadId({ capacidad_id: 'invalid' })).toBe(false);
    });
  });
});
