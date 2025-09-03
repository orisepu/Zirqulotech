// Tipos comunes del flujo de valoración

export const STEPS = [
  'Datos básicos',
  'Batería',
  'Funcionalidad',
  'Pantalla (funcional)',
  'Estética pantalla',
  'Estética laterales/trasera',
  'Valoración',
] as const
export type FormStep = (typeof STEPS)[number]

// Opción/entrada de catálogo
export interface OpcionCatalogo<T extends string = string> {
  value: T
  label: string
  desc: string
}

// Claves de estética del cuerpo
export type EsteticaKey = 'sin_signos' | 'minimos' | 'algunos' | 'desgaste_visible' | 'agrietado_roto'

// Claves de estética de pantalla (sin grietas aquí)
export type EsteticaPantallaKey = 'sin_signos' | 'minimos' | 'algunos' | 'desgaste_visible'

// Catálogo completo parametrizable por producto
export interface CatalogoValoracion {
  funcBasica: OpcionCatalogo<'ok' | 'parcial'>[]
  funcPantalla: OpcionCatalogo<'puntos' | 'pixeles' | 'lineas'>[]
  esteticaPantalla: OpcionCatalogo<EsteticaPantallaKey>[]
  esteticaLados: OpcionCatalogo<EsteticaKey>[]
  esteticaEspalda: OpcionCatalogo<EsteticaKey>[]

  demoFuncPantalla: {
    puntos: { src: string; title: string }
    pixeles: { src: string; title: string }
    lineas: { src: string; title: string }
  }

  demoEsteticaPantalla: Record<EsteticaPantallaKey, { src: string; title: string }>
  demoEsteticaLados: Record<EsteticaKey, string>
  demoEsteticaEspalda: Record<EsteticaKey, string>
}

// Salida de derivación
export interface ValoracionDerivada {
  estado_valoracion: 'excelente' | 'muy_bueno' | 'bueno' | 'a_revision'
  estado_fisico: 'sin_signos' | 'minimos' | 'algunos' | 'desgaste_visible' | 'agrietado'
  estado_funcional: 'ok' | 'con_incidencias'
}

export type FuncPantallaValue = 'puntos' | 'pixeles' | 'lineas'


