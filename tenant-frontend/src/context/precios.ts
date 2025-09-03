// Factores según precio base
export function getFactor(precio: number): number {
  if (precio <= 100) return 0.76
  if (precio <= 200) return 0.77
  if (precio <= 300) return 0.79
  if (precio <= 400) return 0.81
  if (precio <= 500) return 0.83
  if (precio <= 750) return 0.85
  if (precio <= 1000) return 0.87
  if (precio <= 1250) return 0.88
  if (precio <= 1500) return 0.88
  return 0.89
}

// Cálculo del precio orientativo final
export function getPrecioFinal(estado: string, base: number): number {
  const factor = getFactor(base)
  const e = estado.toLowerCase()

  if (e === 'excelente') return Math.round(base)
  if (e === 'muy_bueno') return Math.round(base * factor)
  if (e === 'bueno') return Math.round(base * factor * factor)
  return 0
}

// Estado derivado a partir del estado físico y funcional
export function calcularEstadoValoracion(fisico: string, funcional: string): string {
  const criticos = ['no_enciende', 'pantalla_rota', 'error_hardware']
  if (fisico === 'dañado' || criticos.includes(funcional)) return 'a_revision'
  if (fisico === 'perfecto' && funcional === 'funciona') return 'excelente'
  if (fisico === 'bueno' && funcional === 'funciona') return 'muy_bueno'
  return 'bueno'
}

// Opciones disponibles de estado estético
export const estadosFisicos = [
  { value: 'perfecto', label: 'Perfecto' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'regular', label: 'Regular' },
  { value: 'dañado', label: 'Dañado' },
]

// Opciones disponibles de estado funcional
export const estadosFuncionales = [
  { value: 'funciona', label: 'Funciona correctamente' },
  { value: 'pantalla_rota', label: 'Pantalla rota' },
  { value: 'no_enciende', label: 'No enciende' },
  { value: 'error_hardware', label: 'Error de hardware' },
]

// Formato bonito para mostrar el estado (opcional en UI)
export function formatoBonito(estado?: string | null): string {
  if (!estado) return ''; // deja que el caller ponga '—' si quiere
  const texto = estado.replace(/_/g, ' ').trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : '';
}
