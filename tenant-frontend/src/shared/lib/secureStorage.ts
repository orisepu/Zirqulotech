/**
 * Secure Token Storage
 *
 * Estrategia de seguridad en capas:
 * 1. Almacenamiento en memoria (principal) - inaccesible para otros scripts
 * 2. sessionStorage encriptado (backup) - se borra al cerrar navegador
 * 3. Nunca usar localStorage - vulnerable a XSS persistente
 *
 * Protege contra:
 * - XSS básico (tokens no en DOM/localStorage)
 * - Persistencia de tokens robados (sessionStorage temporal)
 * - Lectura directa de storage (encriptación)
 */

// Almacenamiento en memoria (más seguro)
const memoryStorage: Record<string, string> = {}

/**
 * Genera una clave de encriptación derivada del navegador
 * No es criptográficamente perfecta pero añade una capa de ofuscación
 */
async function getDerivedKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()

  // Combinar propiedades del navegador para crear un seed único por sesión
  const browserFingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    new Date().toDateString(), // Cambia diariamente
  ].join('|')

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(browserFingerprint),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  )

  // Derivar una clave AES
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('zirqulo-secure-token-v1'), // Salt estático (no ideal pero funcional)
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encripta un valor usando AES-GCM
 */
async function encrypt(value: string): Promise<string> {
  try {
    const key = await getDerivedKey()
    const encoder = new TextEncoder()
    const iv = crypto.getRandomValues(new Uint8Array(12)) // IV aleatorio

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(value)
    )

    // Combinar IV + datos encriptados y convertir a base64
    const combined = new Uint8Array(iv.length + encrypted.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(encrypted), iv.length)

    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('❌ Error encriptando:', error)
    throw new Error('Encryption failed')
  }
}

/**
 * Desencripta un valor usando AES-GCM
 */
async function decrypt(encryptedValue: string): Promise<string> {
  try {
    const key = await getDerivedKey()
    const decoder = new TextDecoder()

    // Decodificar de base64
    const combined = new Uint8Array(
      atob(encryptedValue).split('').map(char => char.charCodeAt(0))
    )

    // Separar IV + datos
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )

    return decoder.decode(decrypted)
  } catch (error) {
    console.error('❌ Error desencriptando:', error)
    throw new Error('Decryption failed')
  }
}

/**
 * Verifica si estamos en el navegador
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined'
}

/**
 * Obtiene un valor del storage seguro
 * 1. Intenta leer de memoria
 * 2. Si no está, intenta leer de sessionStorage encriptado
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (!isBrowser()) return null

  // 1. Intentar leer de memoria primero (más rápido y seguro)
  if (memoryStorage[key]) {
    return memoryStorage[key]
  }

  // 2. Intentar leer de sessionStorage encriptado
  try {
    const encrypted = sessionStorage.getItem(`_sec_${key}`)
    if (!encrypted) return null

    const decrypted = await decrypt(encrypted)
    // Restaurar a memoria
    memoryStorage[key] = decrypted
    return decrypted
  } catch (error) {
    console.error(`⚠️ Error leyendo ${key} del storage seguro:`, error)
    // Limpiar dato corrupto
    sessionStorage.removeItem(`_sec_${key}`)
    return null
  }
}

/**
 * Guarda un valor en el storage seguro
 * 1. Guarda en memoria
 * 2. Guarda en sessionStorage encriptado como backup
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (!isBrowser()) return

  // 1. Guardar en memoria
  memoryStorage[key] = value

  // 2. Guardar en sessionStorage encriptado
  try {
    const encrypted = await encrypt(value)
    sessionStorage.setItem(`_sec_${key}`, encrypted)
  } catch (error) {
    console.error(`⚠️ Error guardando ${key} en storage seguro:`, error)
    // No fallar si la encriptación falla, al menos tenemos memoria
  }
}

/**
 * Elimina un valor del storage seguro
 */
export function removeSecureItem(key: string): void {
  if (!isBrowser()) return

  // Limpiar de ambos lugares
  delete memoryStorage[key]
  sessionStorage.removeItem(`_sec_${key}`)
}

/**
 * Limpia todo el storage seguro
 */
export function clearSecureStorage(): void {
  if (!isBrowser()) return

  // Limpiar memoria
  for (const key in memoryStorage) {
    delete memoryStorage[key]
  }

  // Limpiar sessionStorage (solo las claves seguras)
  const keys = Object.keys(sessionStorage)
  keys.forEach(key => {
    if (key.startsWith('_sec_')) {
      sessionStorage.removeItem(key)
    }
  })
}

/**
 * Helper para migrar datos de localStorage a secure storage
 * Útil para la transición
 */
export async function migrateFromLocalStorage(keys: string[]): Promise<void> {
  if (!isBrowser()) return

  for (const key of keys) {
    const value = localStorage.getItem(key)
    if (value) {
      await setSecureItem(key, value)
      localStorage.removeItem(key) // Limpiar localStorage
      console.log(`✅ Migrado ${key} a secure storage`)
    }
  }
}

/**
 * API de conveniencia para tokens específicos
 */
export const secureTokens = {
  async getAccessToken() {
    return getSecureItem('access')
  },
  async setAccessToken(token: string) {
    return setSecureItem('access', token)
  },
  async getRefreshToken() {
    return getSecureItem('refresh')
  },
  async setRefreshToken(token: string) {
    return setSecureItem('refresh', token)
  },
  async getSchema() {
    return getSecureItem('schema')
  },
  async setSchema(schema: string) {
    return setSecureItem('schema', schema)
  },
  removeAllTokens() {
    removeSecureItem('access')
    removeSecureItem('refresh')
    removeSecureItem('schema')
    removeSecureItem('user')
    removeSecureItem('tenantAccess')
  }
}
