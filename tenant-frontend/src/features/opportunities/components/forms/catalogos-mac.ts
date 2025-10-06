import { CatalogoValoracion } from './tipos'

function buildMacCatalog(prefix: string, hasScreen: boolean): CatalogoValoracion {
  const noScreenTitle = 'No aplica (equipo sin pantalla)'
  const noScreenImg = '/demo/desktop/no-screen.webp' // coloca un placeholder

  return {
    funcBasica: [
      { value: 'ok',      label: 'Todo funciona',           desc: 'Sin incidencias detectadas.' },
      { value: 'parcial', label: 'No totalmente funcional', desc: 'Presenta uno o más fallos.' },
    ],
    funcPantalla: hasScreen
      ? [
          { value: 'puntos_brillantes',  label: 'Puntos brillantes', desc: 'Manchas de luz visibles en fondos oscuros.' },
          { value: 'pixeles_muertos', label: 'Píxeles muertos',   desc: 'Puntos fijos apagados/encendidos.' },
          { value: 'lineas_quemaduras',  label: 'Líneas/quemaduras', desc: 'Bandas, retenciones o decoloración.' },
        ]
      : [
          { value: 'puntos_brillantes',  label: noScreenTitle, desc: 'No aplica.' },
          { value: 'pixeles_muertos', label: noScreenTitle, desc: 'No aplica.' },
          { value: 'lineas_quemaduras',  label: noScreenTitle, desc: 'No aplica.' },
        ],
    esteticaPantalla: hasScreen
      ? [
          { value: 'sin_signos',       label: 'Sin signos de uso',  desc: 'Aspecto como nuevo.' },
          { value: 'minimos',          label: 'Mínimos signos',     desc: 'Microarañazos a contraluz.' },
          { value: 'algunos',          label: 'Algunos signos',     desc: 'Arañazos leves.' },
          { value: 'desgaste_visible', label: 'Desgaste visible',   desc: 'Arañazos marcados o marco con uso.' },
        ]
      : [
          { value: 'sin_signos',       label: noScreenTitle, desc: 'Sin pantalla integrada.' },
          { value: 'minimos',          label: noScreenTitle, desc: 'Sin pantalla integrada.' },
          { value: 'algunos',          label: noScreenTitle, desc: 'Sin pantalla integrada.' },
          { value: 'desgaste_visible', label: noScreenTitle, desc: 'Sin pantalla integrada.' },
        ],
    esteticaLados: [
      { value: 'sin_signos',       label: 'Sin signos',         desc: 'Chasis en perfecto estado.' },
      { value: 'minimos',          label: 'Mínimos',            desc: 'Marcas poco visibles.' },
      { value: 'algunos',          label: 'Algunos',            desc: 'Marcas/pequeñas abolladuras.' },
      { value: 'desgaste_visible', label: 'Desgaste visible',   desc: 'Abolladuras/arañazos evidentes.' },
      { value: 'agrietado_roto',   label: 'Agrietado/roto',     desc: 'Golpe serio o curvatura visible.' },
    ],
    esteticaEspalda: [
      { value: 'sin_signos',       label: 'Sin signos',         desc: 'Como nueva.' },
      { value: 'minimos',          label: 'Mínimos',            desc: 'Microarañazos superficiales.' },
      { value: 'algunos',          label: 'Algunos',            desc: 'Marcas evidentes.' },
      { value: 'desgaste_visible', label: 'Desgaste visible',   desc: 'Arañazos claros o abolladuras.' },
      { value: 'agrietado_roto',   label: 'Agrietado/roto',     desc: 'Grietas o aluminio muy golpeado.' },
    ],
    demoFuncPantalla: hasScreen
      ? {
          puntos_brillantes:  { src: `${prefix}/pantalla-puntos-brillantes.webp`,  title: 'Puntos brillantes' },
          pixeles_muertos: { src: `${prefix}/pantalla-pixeles-muertos.webp`,    title: 'Píxeles muertos' },
          lineas_quemaduras:  { src: `${prefix}/pantalla-lineas-quemaduras.webp`,  title: 'Líneas/quemaduras' },
        }
      : {
          puntos_brillantes:  { src: noScreenImg, title: noScreenTitle },
          pixeles_muertos: { src: noScreenImg, title: noScreenTitle },
          lineas_quemaduras:  { src: noScreenImg, title: noScreenTitle },
        },
    demoEsteticaPantalla: hasScreen
      ? {
          sin_signos:       { src: `${prefix}/pantalla-marcas-perfectas.webp`,  title: 'Pantalla sin signos' },
          minimos:          { src: `${prefix}/pantalla-minimos-marcas.webp`,    title: 'Pantalla mínimos signos' },
          algunos:          { src: `${prefix}/pantalla-algunas-marcas.webp`,    title: 'Pantalla algunos signos' },
          desgaste_visible: { src: `${prefix}/pantalla-marcas-profundas.webp`,  title: 'Pantalla desgaste visible' },
          agrietado_roto:   { src: `${prefix}/pantalla-agrietado-roto.webp`,    title: 'Pantalla agrietada/rota' },
          astillado:        { src: `${prefix}/pantalla-marcas-profundas.webp`,  title: 'Pantalla astillada' },
        }
      : {
          sin_signos:       { src: noScreenImg, title: noScreenTitle },
          minimos:          { src: noScreenImg, title: noScreenTitle },
          algunos:          { src: noScreenImg, title: noScreenTitle },
          desgaste_visible: { src: noScreenImg, title: noScreenTitle },
          agrietado_roto:   { src: noScreenImg, title: noScreenTitle },
          astillado:        { src: noScreenImg, title: noScreenTitle },
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

export const buildMacProCatalog     = () => buildMacCatalog('/demo/mac-pro', false)
export const buildMacStudioCatalog  = () => buildMacCatalog('/demo/mac-studio', false)
export const buildMacMiniCatalog    = () => buildMacCatalog('/demo/mac-mini', false)
export const buildMacBookAirCatalog = () => buildMacCatalog('/demo/macbook-air', true)
export const buildMacBookProCatalog = () => buildMacCatalog('/demo/macbook-pro', true)
export const buildIMacCatalog       = () => buildMacCatalog('/demo/imac', true)
