// src/lib/validators.ts
export type ValidatorKind = 'email' | 'dni' | 'nie' | 'dni_or_nie' | 'cif' | 'imei' | 'telefono' | 'cp_es'

export function isEmail(value: string): boolean {
  const v = String(value || '').trim()
  if (!v) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'

export function isDNI(value: string): boolean {
  const v = String(value || '').toUpperCase().replace(/\s|-/g, '')
  const m = v.match(/^([0-9]{8})([A-Z])$/)
  if (!m) return false
  const num = parseInt(m[1], 10)
  const letter = m[2]
  return DNI_LETTERS[num % 23] === letter
}

export function isNIE(value: string): boolean {
  const v = String(value || '').toUpperCase().replace(/\s|-/g, '')
  const m = v.match(/^([XYZ])(\d{7})([A-Z])$/)
  if (!m) return false
  const map: Record<string, string> = { X: '0', Y: '1', Z: '2' }
  const numStr = (map[m[1]] || '') + m[2]
  const num = parseInt(numStr, 10)
  const letter = m[3]
  return DNI_LETTERS[num % 23] === letter
}

// Luhn check for IMEI, must be 15 digits
export function isIMEI(value: string): boolean {
  const v = String(value || '').replace(/\D/g, '')
  if (!/^\d{15}$/.test(v)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(v.charAt(i), 10)
    // Double every second digit starting from index 0? IMEI uses Luhn from right; easier to compute from right.
    const idxFromRight = 14 - i
    if ((idxFromRight % 2) === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

export function isTelefonoES(value: string): boolean {
  const v = String(value || '').replace(/\D/g, '')
  // España: 9 dígitos empezando por 6,7,8,9 (móvil/fijo/números gratuitos)
  return /^[6789]\d{8}$/.test(v)
}

// Código Postal España: 5 dígitos; los dos primeros 01-52
export function isCPEsp(value: string): boolean {
  const v = String(value || '').trim()
  return /^(0[1-9]|[1-4][0-9]|5[0-2])\d{3}$/.test(v)
}

export function validate(kind: ValidatorKind, value: string): { valid: boolean; message?: string } {
  switch (kind) {
    case 'email':
      return { valid: isEmail(value), message: 'Correo inválido' }
    case 'dni':
      return { valid: isDNI(value), message: 'DNI inválido' }
    case 'nie':
      return { valid: isNIE(value), message: 'NIE inválido' }
    case 'dni_or_nie':
      return { valid: isDNI(value) || isNIE(value), message: 'DNI/NIE inválido' }
    case 'imei':
      return { valid: isIMEI(value), message: 'IMEI inválido. Debe tener 15 dígitos y checksum válido.' }
    case 'telefono':
      return { valid: isTelefonoES(value), message: 'Teléfono inválido. Debe tener 9 dígitos.' }
    case 'cif':
      return { valid: isCIF(value), message: 'CIF inválido' }
    case 'cp_es':
      return { valid: isCPEsp(value), message: 'Código postal inválido (España)' }
    default:
      return { valid: true }
  }
}

// CIF español (identificador fiscal de entidades)
// Formato: Letra inicial de tipo + 7 dígitos + dígito/letra de control
// Cálculo: suma pares + suma impares*2 (sumando dígitos), control = (10 - (suma % 10)) % 10
// Control esperado: según tipo, letra (JABCDEFGHI[control]) o dígito
export function isCIF(value: string): boolean {
  const v = String(value || '').toUpperCase().replace(/\s|-/g, '')
  const m = v.match(/^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-Z])$/)
  if (!m) return false
  const type = m[1]
  const digits = m[2]
  const control = m[3]

  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const n = parseInt(digits.charAt(i), 10)
    if (i % 2 === 0) { // posiciones impares (1,3,5,7) en 1-based
      const doubled = n * 2
      sum += Math.floor(doubled / 10) + (doubled % 10)
    } else {
      sum += n
    }
  }
  const controlNum = (10 - (sum % 10)) % 10
  const controlLetter = 'JABCDEFGHI'.charAt(controlNum)

  const mustBeLetter = /[PQRSNW]/.test(type)
  const mustBeDigit = /[ABEH]/.test(type)

  if (mustBeLetter) return control === controlLetter
  if (mustBeDigit) return control === String(controlNum)
  // Puede ser cualquiera de ambos
  return control === String(controlNum) || control === controlLetter
}
