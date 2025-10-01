/**
 * Device Name Cleaner Utility
 *
 * Cleans and normalizes device model names from raw provider data
 * (e.g., Likewize) to user-friendly display names.
 *
 * Transformations:
 * - Removes storage capacity (GB/TB)
 * - Removes core counts (CPU/GPU)
 * - Removes model codes (A####)
 * - Simplifies technical model versions
 * - Converts inches notation
 * - Extracts and formats year
 *
 * @example
 * ```ts
 * cleanModelName("iPhone15,2 256GB A2889 10/2023")
 * // Returns: "iPhone 15 (2023)"
 *
 * cleanModelName("MacBook Pro 16 inch M2 512GB")
 * // Returns: "MacBook Pro 16\""
 * ```
 */
export function cleanModelName(rawName: string): string {
  if (!rawName) return ''

  let cleaned = rawName

  // Remover capacidad de almacenamiento
  cleaned = cleaned.replace(/\s*\d+\s*(GB|TB)\s*(SSD|HDD)?/gi, '')

  // Remover información de cores
  cleaned = cleaned.replace(/\s*\d+\s*Core\s+(CPU|GPU)/gi, '')

  // Remover códigos de modelo (A####)
  cleaned = cleaned.replace(/\s*A\d{4}/g, '')

  // Remover versiones técnicas de modelo (ej: iMac15 4 → iMac)
  cleaned = cleaned.replace(/iMac\d+\s*\d+/gi, 'iMac')
  cleaned = cleaned.replace(/MacBook\s*Pro\d+,\d+/gi, 'MacBook Pro')
  cleaned = cleaned.replace(/iPhone\d+,\d+/gi, (match) => {
    // Mantener número de iPhone si es relevante
    const num = match.match(/\d+/)
    return num ? `iPhone ${num[0]}` : 'iPhone'
  })

  // Convertir pulgadas: "24 inch" → "24\""
  cleaned = cleaned.replace(/(\d+)\s*inch/gi, '$1"')

  // Extraer y formatear año: "10/2023" o "2023" → "(2023)"
  const yearMatch = cleaned.match(/\b(\d{1,2}\/)?(\d{4})\b/)
  let year = ''
  if (yearMatch) {
    year = ` (${yearMatch[2]})`
    cleaned = cleaned.replace(/\b\d{1,2}\/\d{4}\b/, '')
  }

  // Limpiar espacios múltiples
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // Añadir año al final si existe
  if (year) {
    cleaned += year
  }

  return cleaned
}
