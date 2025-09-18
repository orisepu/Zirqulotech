import { CatalogoValoracion } from './tipos'

export function buildCatalogFor(tipo: string): CatalogoValoracion {
  // Por defecto: iPhone. Cambia rutas si es iPad/iMac/MacBook
  const prefix = tipo.toLowerCase().includes('ipad') ? '/demo/ipad' :
                 tipo.toLowerCase().includes('macbook') ? '/demo/macbook' :
                 tipo.toLowerCase().includes('imac') ? '/demo/imac' :
                 '/demo'

  return {
    funcBasica: [
      { value: 'ok', label: 'Todo funciona', desc: 'Sin incidencias detectadas.' },
      { value: 'parcial', label: 'No totalmente funcional', desc: 'Tiene uno o más problemas.' },
    ],
    funcPantalla: [
      { value: 'puntos', label: 'Puntos brillantes', desc: 'Subpíxeles encendidos permanentemente.' },
      { value: 'pixeles', label: 'Píxeles muertos', desc: 'Puntos que permanecen apagados en todos los fondos.' },
      { value: 'lineas', label: 'Líneas/quemaduras', desc: 'Líneas/sombras permanentes (retenciones o burn‑in).' },
    ],
    esteticaPantalla: [
      { value: 'sin_signos', label: 'Sin signos de uso', desc: 'La pantalla parece nueva. Sin signos de desgaste. No existen arañazos visibles que puedan apreciarse bajo una fuente de luz.' },
      { value: 'minimos', label: 'Mínimos signos', desc: 'La pantalla tiene microarañazos y está prácticamente intacta. Los arañazos no son visibles a primera vista, pero sí cuando se exponen a la luz.' },
      { value: 'algunos', label: 'Algunos signos', desc: 'La pantalla tiene ligeros arañazos. Los arañazos aparecen principalmente en los bordes de la pantalla.' },
      { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'La pantalla tiene arañazos visibles. Los arañazos se notan al pasar el dedo por la pantalla. Los arañazos son visibles sin una fuente de luz.' },
      { value: 'agrietado_roto', label: 'Agrietado/roto', desc: 'Rotura o grieta visible.' },
      { value: 'astillado', label: 'Astillado', desc: 'Pequeñas muescas/bordes saltados, sin grieta corrida ni filo cortante.' },
    ],
    esteticaLados: [
      { value: 'sin_signos', label: 'Sin signos', desc: 'Aspecto prácticamente nuevo.' },
      { value: 'minimos', label: 'Mínimos', desc: 'Micro‑marcas superficiales.' },
      { value: 'algunos', label: 'Algunos', desc: 'Varias marcas leves o algún pequeño picotazo.' },
      { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'Arañazos/abolladuras evidentes.' },
      { value: 'agrietado_roto', label: 'Agrietado/roto', desc: 'Trasera de vidrio rota o chasis roto/doblado' },
    ],
    esteticaEspalda: [
      { value: 'sin_signos', label: 'Sin signos', desc: 'Aspecto prácticamente nuevo.' },
      { value: 'minimos', label: 'Mínimos', desc: 'Micro‑marcas superficiales.' },
      { value: 'algunos', label: 'Algunos', desc: 'Varias marcas leves o algún pequeño picotazo.' },
      { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'Arañazos/golpes claros o múltiples marcas notorias.' },
      { value: 'agrietado_roto', label: 'Agrietado/roto', desc: 'Trasera de vidrio rota o chasis roto/doblado' },
    ],
    demoFuncPantalla: {
      puntos:  { src: `${prefix}/pantalla-puntos-brillantes.webp`,  title: 'Puntos brillantes' },
      pixeles: { src: `${prefix}/pantalla-pixeles-muertos.webp`,    title: 'Píxeles muertos' },
      lineas:  { src: `${prefix}/pantalla-lineas-quemaduras.webp`,  title: 'Líneas / quemaduras' },
    },
    demoEsteticaPantalla: {
      sin_signos:       { src: `${prefix}/pantalla-marcas-perfectas.webp`,  title: 'Sin signos de uso' },
      minimos:          { src: `${prefix}/pantalla-minimos-marcas.webp`,    title: 'Mínimos signos' },
      algunos:          { src: `${prefix}/pantalla-algunas-marcas.webp`,    title: 'Algunos signos' },
      desgaste_visible: { src: `${prefix}/pantalla-marcas-profundas.webp`,  title: 'Desgaste visible' },
      agrietado_roto:   { src: `${prefix}/pantalla-marcas-profundas.webp`,  title: 'Cristal agrietado o roto' },
      astillado:        { src: `${prefix}/pantalla-marcas-profundas.webp`,  title: 'Astillado' }
    },
    demoEsteticaLados: {
      sin_signos:       `${prefix}/lados-sin-signos.webp`,
      minimos:          `${prefix}/lados-minimos.webp`,
      algunos:          `${prefix}/lados-algunos.webp`,
      desgaste_visible: `${prefix}/desgaste-trasero-grande.webp`,
      agrietado_roto:   `${prefix}/cristal-trasero-roto.webp`,
    },
    demoEsteticaEspalda: {
      sin_signos:       `${prefix}/lados-sin-signos.webp`,
      minimos:          `${prefix}/lados-minimos.webp`,
      algunos:          `${prefix}/lados-algunos.webp`,
      desgaste_visible: `${prefix}/desgaste-trasero-grande.webp`,
      agrietado_roto:   `${prefix}/cristal-trasero-roto.webp`,
    },
  }
}
