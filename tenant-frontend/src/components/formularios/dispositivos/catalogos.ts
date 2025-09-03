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
      { value: 'puntos', label: 'Puntos brillantes', desc: 'Manchas luminosas, más en fondos oscuros.' },
      { value: 'pixeles', label: 'Píxeles muertos', desc: 'Puntos siempre apagados/encendidos.' },
      { value: 'lineas', label: 'Líneas/quemaduras', desc: 'Bandas, retenciones o decoloración.' },
    ],
    esteticaPantalla: [
      { value: 'sin_signos', label: 'Sin signos de uso', desc: 'Aspecto como nuevo.' },
      { value: 'minimos', label: 'Mínimos signos', desc: 'Microarañazos, visibles solo a la luz.' },
      { value: 'algunos', label: 'Algunos signos', desc: 'Arañazos ligeros, sobre todo en bordes.' },
      { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'Arañazos claros, se notan al tacto.' },
    ],
    esteticaLados: [
      { value: 'sin_signos', label: 'Sin signos', desc: 'Como nuevos.' },
      { value: 'minimos', label: 'Mínimos', desc: 'Arañazos poco visibles.' },
      { value: 'algunos', label: 'Algunos', desc: 'Arañazos / pequeña abolladura.' },
      { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'Arañazos/abolladuras evidentes.' },
      { value: 'agrietado_roto', label: 'Agrietado/roto', desc: 'Grietas o curvatura visible.' },
    ],
    esteticaEspalda: [
      { value: 'sin_signos', label: 'Sin signos', desc: 'Como nueva.' },
      { value: 'minimos', label: 'Mínimos', desc: 'Pequeños microarañazos.' },
      { value: 'algunos', label: 'Algunos', desc: 'Marcas evidentes o cerca de cámara.' },
      { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'Arañazos claros/abolladuras.' },
      { value: 'agrietado_roto', label: 'Agrietado/roto', desc: 'Cristal trasero roto o metal abollado.' },
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
