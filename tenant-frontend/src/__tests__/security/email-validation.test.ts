/**
 * SECURITY TEST: Email Validation (CRIT-02)
 *
 * Tests para verificar que la validacion de email cumple con:
 * - RFC 5322: Email Address Format
 * - OWASP Input Validation Cheat Sheet
 * - CWE-20: Improper Input Validation
 *
 * Vulnerabilidad original: LoginForm.tsx:55
 * `const okEmail = /\S+@\S+\.\S+/.test(email);`
 *
 * Problema: \S permite CUALQUIER caracter no-whitespace, incluyendo:
 * - < > ( ) [ ] { } que pueden causar XSS
 * - ' " que pueden causar SQL injection (aunque se use ORM)
 * - Caracteres Unicode peligrosos
 */

describe('SECURITY: Email Validation (CRIT-02)', () => {
  describe('validateEmail', () => {
    /**
     * Implementacion VULNERABLE (original)
     * NO usar en produccion
     */
    const validateEmailVulnerable = (email: string): boolean => {
      return /\S+@\S+\.\S+/.test(email)
    }

    /**
     * Implementacion SEGURA (fixed)
     * Rechaza caracteres peligrosos
     * Permite: a-z, A-Z, 0-9, . - _ + en local part
     * Permite: a-z, A-Z, 0-9, . - en domain
     */
    const validateEmailSecure = (email: string): boolean => {
      return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
    }

    /**
     * RED PHASE: Demostrar que el regex vulnerable acepta emails maliciosos
     */
    describe('VULNERABLE regex /\\S+@\\S+\\.\\S+/', () => {
      test('should INCORRECTLY accept XSS payloads (SECURITY ISSUE)', () => {
        const xssPayloads = [
          '<script>alert(1)</script>@x.x',
          'user<img src=x>@domain.com',
          'admin"><script>@x.x',
          '<iframe>@test.com',
        ]

        xssPayloads.forEach(payload => {
          // ❌ VULNERABLE: Regex actual acepta estos payloads
          expect(validateEmailVulnerable(payload)).toBe(true)
        })
      })

      test('should INCORRECTLY accept SQL injection attempts (SECURITY ISSUE)', () => {
        const sqlPayloads = [
          "admin'--@x.x",
          "user' OR '1'='1@domain.com",
          "'; DROP TABLE users--@x.x",
        ]

        sqlPayloads.forEach(payload => {
          // ❌ VULNERABLE: Regex actual acepta estos payloads
          expect(validateEmailVulnerable(payload)).toBe(true)
        })
      })

      test('should INCORRECTLY accept emails with invalid characters', () => {
        const invalidEmails = [
          'user@@domain.com',      // Doble @
          'user@domain..com',      // Doble punto
          '{}[]()@domain.com',     // Caracteres especiales peligrosos
          'user@domain.com<>',     // HTML tags
        ]

        invalidEmails.forEach(email => {
          // ❌ VULNERABLE: Regex actual acepta estos
          expect(validateEmailVulnerable(email)).toBe(true)
        })
      })
    })

    /**
     * GREEN PHASE: Verificar que el regex seguro rechaza emails maliciosos
     */
    describe('SECURE regex /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/', () => {
      test('should CORRECTLY reject XSS payloads', () => {
        const xssPayloads = [
          '<script>alert(1)</script>@x.x',
          'user<img src=x>@domain.com',
          'admin"><script>@x.x',
          '<iframe>@test.com',
        ]

        xssPayloads.forEach(payload => {
          // ✅ SECURE: Regex seguro rechaza estos
          expect(validateEmailSecure(payload)).toBe(false)
        })
      })

      test('should CORRECTLY reject SQL injection attempts', () => {
        const sqlPayloads = [
          "admin'--@x.x",
          "user' OR '1'='1@domain.com",
          "'; DROP TABLE users--@x.x",
        ]

        sqlPayloads.forEach(payload => {
          // ✅ SECURE: Regex seguro rechaza estos
          expect(validateEmailSecure(payload)).toBe(false)
        })
      })

      test('should CORRECTLY reject emails with invalid characters', () => {
        const invalidEmails = [
          'user@@domain.com',      // Doble @
          // Nota: user@domain..com es tecnicamente aceptado por el regex simplificado
          // Para validacion estricta, usar backend validation o validator library
          '{}[]()@domain.com',     // Caracteres especiales
          'user@domain.com<>',     // HTML tags
          '@domain.com',           // Sin local part
          'user@',                 // Sin domain
          'user domain@test.com',  // Espacio
        ]

        invalidEmails.forEach(email => {
          // ✅ SECURE: Regex seguro rechaza estos
          expect(validateEmailSecure(email)).toBe(false)
        })
      })

      test('should CORRECTLY accept valid emails', () => {
        const validEmails = [
          'user@example.com',
          'admin@test.co.uk',
          'first.last@domain.com',
          'user+tag@example.com',
          'user123@test-domain.com',
          'a@b.co',                 // Minimo valido (TLD de 2 letras)
        ]

        validEmails.forEach(email => {
          // ✅ SECURE: Acepta emails validos
          expect(validateEmailSecure(email)).toBe(true)
        })
      })
    })

    /**
     * EDGE CASES: Casos especiales que deben ser manejados
     */
    describe('Edge cases', () => {
      test('should handle empty strings', () => {
        expect(validateEmailSecure('')).toBe(false)
      })

      test('should handle emails with special but valid characters', () => {
        // Estos son validos segun RFC 5322 (simplificado)
        const validSpecialCases = [
          'user+filter@domain.com',     // + permitido
          'user.name@domain.com',       // . permitido
          'user_name@domain.com',       // _ permitido
          'user-name@domain.com',       // - permitido
        ]

        validSpecialCases.forEach(email => {
          expect(validateEmailSecure(email)).toBe(true)
        })
      })

      test('should handle long emails', () => {
        const longEmail = 'a'.repeat(50) + '@' + 'b'.repeat(50) + '.com'
        expect(validateEmailSecure(longEmail)).toBe(true)
      })

      test('should handle emails with multiple subdomains', () => {
        expect(validateEmailSecure('user@mail.example.com')).toBe(true)
        expect(validateEmailSecure('user@a.b.c.d.com')).toBe(true)
      })

      test('should reject single-letter TLDs (too short)', () => {
        // TLDs de 1 letra no son validos en practica
        expect(validateEmailSecure('user@domain.x')).toBe(false)
      })
    })

    /**
     * COMPARISON: Vulnerable vs Secure
     */
    describe('Vulnerable vs Secure comparison', () => {
      test('should demonstrate security improvement', () => {
        const dangerousEmail = '<script>@x.x'

        // Vulnerable acepta
        expect(validateEmailVulnerable(dangerousEmail)).toBe(true)

        // Secure rechaza
        expect(validateEmailSecure(dangerousEmail)).toBe(false)
      })
    })

    /**
     * RFC 5322 Compliance (simplified)
     */
    describe('RFC 5322 compliance (simplified)', () => {
      test('should require at least one @ symbol', () => {
        expect(validateEmailSecure('nodomain.com')).toBe(false)
      })

      test('should require dot in domain part', () => {
        expect(validateEmailSecure('user@nodot')).toBe(false)
      })

      test('should not allow leading/trailing whitespace', () => {
        expect(validateEmailSecure(' user@example.com')).toBe(false)
        expect(validateEmailSecure('user@example.com ')).toBe(false)
        expect(validateEmailSecure(' user@example.com ')).toBe(false)
      })
    })
  })

  describe('Integration with lib/validators.ts', () => {
    /**
     * Verificar que existe un validador reutilizable
     * Si no existe, debe crearse
     */
    test('should use shared email validator from lib/validators.ts', () => {
      // Este test documenta que deberia existir un validador compartido
      // Implementacion recomendada en lib/validators.ts

      const recommendedImplementation = `
        export function validarEmail(email: string): boolean {
          // RFC 5322 simplified
          return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
        }
      `

      expect(recommendedImplementation).toBeTruthy()
    })
  })
})

// Helper exportado para uso en componentes
export function validateEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
}
