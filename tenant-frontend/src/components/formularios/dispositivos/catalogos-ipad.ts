import { CatalogoValoracion } from './tipos'

export function buildIPadCatalog(): CatalogoValoracion {
  const prefix = '/demo/ipad'

  return {
    funcBasica: [
      { value: 'ok',      label: 'Todo funciona',            desc: 'Sin incidencias detectadas.' },
      { value: 'parcial', label: 'No totalmente funcional',  desc: 'Presenta uno o más fallos.' },
    ],
    funcPantalla: [
      { value: 'puntos',  label: 'Puntos brillantes', desc: 'Manchas de luz (más visibles en fondos oscuros).' },
      { value: 'pixeles', label: 'Píxeles muertos',   desc: 'Puntos fijos apagados/encendidos en la pantalla.' },
      { value: 'lineas',  label: 'Líneas/quemaduras', desc: 'Bandas, retenciones o decoloración persistente.' },
    ],
    esteticaPantalla: [
      { value: 'sin_signos',       label: 'Sin signos de uso',  desc: 'Aspecto como nuevo.' },
      { value: 'minimos',          label: 'Mínimos signos',     desc: 'Microarañazos visibles a contraluz.' },
      { value: 'algunos',          label: 'Algunos signos',     desc: 'Arañazos leves — no afectan uso.' },
      { value: 'desgaste_visible', label: 'Desgaste visible',   desc: 'Arañazos marcados o marcos con uso.' },
    ],
    esteticaLados: [
      { value: 'sin_signos',       label: 'Sin signos',         desc: 'Marcos en perfecto estado.' },
      { value: 'minimos',          label: 'Mínimos',            desc: 'Marcas poco visibles.' },
      { value: 'algunos',          label: 'Algunos',            desc: 'Marcas/pequeñas abolladuras.' },
      { value: 'desgaste_visible', label: 'Desgaste visible',   desc: 'Abolladuras/arañazos evidentes.' },
      { value: 'agrietado_roto',   label: 'Agrietado/roto',     desc: 'Golpe serio o curvatura visible.' },
    ],
    esteticaEspalda: [
      { value: 'sin_signos',       label: 'Sin signos',         desc: 'Como nueva.' },
      { value: 'minimos',          label: 'Mínimos',            desc: 'Microarañazos superficiales.' },
      { value: 'algunos',          label: 'Algunos',            desc: 'Marcas evidentes o cerca de cámara.' },
      { value: 'desgaste_visible', label: 'Desgaste visible',   desc: 'Arañazos claros o abolladuras.' },
      { value: 'agrietado_roto',   label: 'Agrietado/roto',     desc: 'Grietas o aluminio muy golpeado.' },
    ],
    demoFuncPantalla: {
      puntos:  { src: `${prefix}/pantalla-puntos-brillantes.webp`,  title: 'Puntos brillantes (iPad)' },
      pixeles: { src: `${prefix}/pantalla-pixeles-muertos.webp`,    title: 'Píxeles muertos (iPad)' },
      lineas:  { src: `${prefix}/pantalla-lineas-quemaduras.webp`,  title: 'Líneas/quemaduras (iPad)' },
    },
    demoEsteticaPantalla: {
      sin_signos:       { src: `${prefix}/pantalla-marcas-perfectas.webp`,  title: 'Pantalla sin signos (iPad)' },
      minimos:          { src: `${prefix}/pantalla-minimos-marcas.webp`,    title: 'Pantalla mínimos signos (iPad)' },
      algunos:          { src: `${prefix}/pantalla-algunas-marcas.webp`,    title: 'Pantalla algunos signos (iPad)' },
      desgaste_visible: { src: `${prefix}/pantalla-marcas-profundas.webp`,  title: 'Pantalla desgaste visible (iPad)' },
    },
    demoEsteticaLados: {
      sin_signos:       `${prefix}/lados-sin-signos.webp`,
      minimos:          `${prefix}/lados-minimos.webp`,
      algunos:          `${prefix}/lados-algunos.webp`,
      desgaste_visible: `${prefix}/lados-desgaste-visible.webp`,
      agrietado_roto:   `${prefix}/lados-agrietado-roto.webp`,
    },
    demoEsteticaEspalda: {
      sin_signos:       `${prefix}/trasera-sin-signos.webp`,
      minimos:          `${prefix}/trasera-minimos.webp`,
      algunos:          `${prefix}/trasera-algunos.webp`,
      desgaste_visible: `${prefix}/trasera-desgaste-visible.webp`,
      agrietado_roto:   `${prefix}/trasera-agrietado-roto.webp`,
    },
  }
}
