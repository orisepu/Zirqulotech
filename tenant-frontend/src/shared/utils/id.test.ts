import { getId, getIdlink, HasId } from './id'

describe('id utils', () => {
  describe('getId', () => {
    it('should return hashid when available', () => {
      const entity: HasId = {
        id: 123,
        uuid: 'uuid-456',
        hashid: 'hash-789'
      }
      expect(getId(entity)).toBe('hash-789')
    })

    it('should return uuid when hashid is not available', () => {
      const entity: HasId = {
        id: 123,
        uuid: 'uuid-456'
      }
      expect(getId(entity)).toBe('uuid-456')
    })

    it('should return id when neither hashid nor uuid are available', () => {
      const entity: HasId = {
        id: 123
      }
      expect(getId(entity)).toBe(123)
    })

    it('should return undefined when no identifiers are available', () => {
      const entity: HasId = {}
      expect(getId(entity)).toBeUndefined()
    })

    it('should handle null/undefined hashid and uuid', () => {
      const entity: HasId = {
        id: 123,
        uuid: undefined,
        hashid: null as any
      }
      expect(getId(entity)).toBe(123)
    })

    it('should handle empty string identifiers', () => {
      const entity: HasId = {
        id: 123,
        uuid: '',
        hashid: ''
      }
      // Empty strings are truthy, so they'll be returned over id
      expect(getId(entity)).toBe('')
    })

    it('should prioritize hashid over uuid over id', () => {
      const entity1: HasId = {
        id: 1,
        hashid: 'hash'
      }
      expect(getId(entity1)).toBe('hash')

      const entity2: HasId = {
        id: 1,
        uuid: 'uuid'
      }
      expect(getId(entity2)).toBe('uuid')
    })
  })

  describe('getIdlink', () => {
    it('should return uuid when available (prioritizes uuid over hashid)', () => {
      const entity: HasId = {
        id: 123,
        uuid: 'uuid-456',
        hashid: 'hash-789'
      }
      expect(getIdlink(entity)).toBe('uuid-456')
    })

    it('should return hashid when uuid is not available', () => {
      const entity: HasId = {
        id: 123,
        hashid: 'hash-789'
      }
      expect(getIdlink(entity)).toBe('hash-789')
    })

    it('should return id when neither uuid nor hashid are available', () => {
      const entity: HasId = {
        id: 123
      }
      expect(getIdlink(entity)).toBe(123)
    })

    it('should return undefined when no identifiers are available', () => {
      const entity: HasId = {}
      expect(getIdlink(entity)).toBeUndefined()
    })

    it('should handle null/undefined uuid and hashid', () => {
      const entity: HasId = {
        id: 123,
        uuid: undefined,
        hashid: null as any
      }
      expect(getIdlink(entity)).toBe(123)
    })

    it('should handle empty string identifiers', () => {
      const entity: HasId = {
        id: 123,
        uuid: '',
        hashid: ''
      }
      // Empty strings are truthy, so uuid will be returned over id
      expect(getIdlink(entity)).toBe('')
    })

    it('should prioritize uuid over hashid over id (opposite of getId)', () => {
      const entity1: HasId = {
        id: 1,
        hashid: 'hash'
      }
      expect(getIdlink(entity1)).toBe('hash')

      const entity2: HasId = {
        id: 1,
        uuid: 'uuid'
      }
      expect(getIdlink(entity2)).toBe('uuid')

      const entity3: HasId = {
        id: 1,
        uuid: 'uuid',
        hashid: 'hash'
      }
      // getIdlink prioritizes uuid over hashid
      expect(getIdlink(entity3)).toBe('uuid')
      // getId prioritizes hashid over uuid
      expect(getId(entity3)).toBe('hash')
    })

    it('should handle numeric ids', () => {
      const entity: HasId = {
        id: 42
      }
      expect(getIdlink(entity)).toBe(42)
    })

    it('should handle string ids', () => {
      const entity: HasId = {
        id: 'string-id'
      }
      expect(getIdlink(entity)).toBe('string-id')
    })
  })

  describe('getId vs getIdlink priority differences', () => {
    it('should demonstrate different priorities', () => {
      const entity: HasId = {
        id: 1,
        uuid: 'uuid-value',
        hashid: 'hash-value'
      }

      // getId: hashid > uuid > id
      expect(getId(entity)).toBe('hash-value')

      // getIdlink: uuid > hashid > id
      expect(getIdlink(entity)).toBe('uuid-value')
    })

    it('should fall back correctly when preferred identifier is missing', () => {
      const entityNoHashid: HasId = {
        id: 1,
        uuid: 'uuid-value'
      }

      // Both should return uuid when hashid is missing
      expect(getId(entityNoHashid)).toBe('uuid-value')
      expect(getIdlink(entityNoHashid)).toBe('uuid-value')

      const entityNoUuid: HasId = {
        id: 1,
        hashid: 'hash-value'
      }

      // Both should return hashid when uuid is missing
      expect(getId(entityNoUuid)).toBe('hash-value')
      expect(getIdlink(entityNoUuid)).toBe('hash-value')
    })
  })
})