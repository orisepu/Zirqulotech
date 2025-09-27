'use client'
import { Box, Paper, Tabs, Tab, Typography, Button, Link, Grid, List, ListItem, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { useState, useEffect, useMemo, useCallback, ReactNode } from 'react'
import SimpleBar from 'simplebar-react'
import { formatoBonito } from '@/context/precios'
import TablaReactiva from '@/components/TablaReactiva2'
import { columnasDispositivosReales } from '@/components/TablaColumnas2'
import { ESTADOS_META } from '@/context/estados'
import { ColoredPaper } from '@/context/ThemeContext'

function formatEUR(v?: unknown) {
  const n = Number(v ?? 0)
  if (!isFinite(n) || n <= 0) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)
}

type DispositivoRecibido = Record<string, unknown>
type OportunidadResumen = {
  estado?: string
  dispositivos?: DispositivoRecibido[]
  // campos de recogida opcionales usados para decidir apertura
  calle?: string
  numero?: string
  piso?: string
  puerta?: string
  codigo_postal?: string
  poblacion?: string
  provincia?: string
  persona_contacto?: string
  telefono_contacto?: string
  correo_recogida?: string
  instrucciones?: string
  numero_seguimiento?: string
  url_seguimiento?: string
}

export default function TabsOportunidad({
  oportunidad,
  dispositivosReales,
  onEditarItem,
  onEliminarItem,
  onAbrirRecogida,
  usuarioId,
  onTabChange,
  renderAccionesReales,
  permitirEdicionResumen,
}: {
  oportunidad: OportunidadResumen
  dispositivosReales: DispositivoRecibido[]
  onEditarItem: (item: DispositivoRecibido | null) => void
  onEliminarItem: (id: number) => void
  onAbrirRecogida: () => void
  usuarioId?: number
  onTabChange?: (i: number, info?: { realesIdx: number; recogidaIdx: number }) => void
  renderAccionesReales?: () => ReactNode
  permitirEdicionResumen?: boolean
}) {
  const [tab, setTab] = useState(0)
  const [vistaCompacta, setVistaCompacta] = useState(true)
  const [dispositivoAEliminar, setDispositivoAEliminar] = useState<number | null>(null)
  const meta = oportunidad?.estado ? ESTADOS_META[oportunidad.estado] : null
  type ColorKey = 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
  const allowedColors = new Set<ColorKey>(['primary','secondary','error','info','success','warning'])
  const colorKey: ColorKey = allowedColors.has((meta?.color as ColorKey)) ? (meta?.color as ColorKey) : 'primary'
  // 🧠 Normalización de estado
  const estado = String(oportunidad?.estado || '').trim()

  // 👇 Flags de visibilidad
  const mostrarTablaReales = new Set([
    'Recibido','Check in OK','En revisión','Oferta final','Oferta_final','Nueva oferta enviada',
    'Oferta confirmada','Pendiente factura','Factura recibida','Pendiente de pago','Aceptado','Pagado',
  ]).has(estado) || (dispositivosReales?.length ?? 0) > 0

  const mostrarDatosrecogida = new Set(['Aceptado','Recogida solicitada','Contrato firmado']).has(estado)

  const tieneDatosRecogida =
    !!(oportunidad?.calle || oportunidad?.numero || oportunidad?.piso || oportunidad?.puerta ||
       oportunidad?.codigo_postal || oportunidad?.poblacion || oportunidad?.provincia ||
       oportunidad?.persona_contacto || oportunidad?.telefono_contacto || oportunidad?.correo_recogida)

  // 🗂️ Índices de tabs
  const { resumenIdx, recogidaIdx, realesIdx, totalTabs } = useMemo(() => {
    let idx = 0
    const resumenIdx = idx++
    const recogidaIdx = mostrarDatosrecogida ? idx++ : -1
    const realesIdx   = (dispositivosReales?.length ?? 0) > 0 ? idx++ : -1
    return { resumenIdx, recogidaIdx, realesIdx, totalTabs: idx }
  }, [mostrarDatosrecogida, dispositivosReales?.length])

  const puedeEditar = permitirEdicionResumen ?? (estado === 'Pendiente')

  useEffect(() => {
    if (tab > totalTabs - 1) setTab(totalTabs - 1)
    if (tab < 0) setTab(0)
  }, [totalTabs]) // eslint-disable-line react-hooks/exhaustive-deps

  const getField = (o: unknown, key: string): unknown => (o && typeof o === 'object') ? (o as Record<string, unknown>)[key] : undefined

  const inferirModoDispositivo = useCallback((d: Record<string, unknown>): 'completo' | 'rapido' => {
    const razonesCompleto: string[] = []
    const razonesRapido: string[] = []

    const precios = getField(d, 'precios_por_estado') ?? getField(d, 'precio_por_estado')
    if (precios && typeof precios === 'object') razonesRapido.push('precios_por_estado')

    const cantidad = Number(getField(d, 'cantidad'))
    if (Number.isFinite(cantidad) && cantidad > 1) razonesRapido.push('cantidad>1')

    const salud = getField(d, 'salud_bateria_pct')
    if (typeof salud === 'number') razonesCompleto.push('salud_bateria_pct')

    const ciclos = getField(d, 'ciclos_bateria')
    if (typeof ciclos === 'number') razonesCompleto.push('ciclos_bateria')

    const funcBasica = getField(d, 'funcionalidad_basica')
    if (typeof funcBasica === 'string' && funcBasica !== '' && funcBasica !== 'ok') razonesCompleto.push('funcionalidad_basica')

    const pantallaIssues: Array<unknown> = [
      getField(d, 'pantalla_funcional_puntos_bril'),
      getField(d, 'pantalla_funcional_pixeles_muertos'),
      getField(d, 'pantalla_funcional_lineas_quemaduras'),
    ]
    if (pantallaIssues.some((issue) => issue === true)) razonesCompleto.push('pantalla_issues')

    const estetica = [
      getField(d, 'estado_pantalla'),
      getField(d, 'estado_lados'),
      getField(d, 'estado_espalda'),
    ]
    if (estetica.some((val) => typeof val === 'string' && val !== '' && val !== 'sin_signos')) razonesCompleto.push('estetica')

    if (razonesCompleto.length > 0) return 'completo'
    if (razonesRapido.length > 0) return 'rapido'
    return 'rapido'
  }, [])

  const modoCuestionarioDetectado = useMemo(() => {
    const lista = Array.isArray(oportunidad?.dispositivos) ? oportunidad.dispositivos : []
    if (!lista.length) return null

    let fallback: 'rapido' | null = null
    for (const d of lista) {
      const modo = inferirModoDispositivo(d as Record<string, unknown>)
      if (modo === 'completo') return 'completo'
      fallback = 'rapido'
    }
    return fallback
  }, [inferirModoDispositivo, oportunidad?.dispositivos])

  const bloquearVistaCompacta = modoCuestionarioDetectado === 'rapido'

  useEffect(() => {
    if (bloquearVistaCompacta) setVistaCompacta(true)
  }, [bloquearVistaCompacta])

  const handleChange = (_: React.SyntheticEvent, v: number) => {
    setTab(v)
    onTabChange?.(v, { realesIdx, recogidaIdx })
    if (v === recogidaIdx && !tieneDatosRecogida) onAbrirRecogida()
  }
 // sx={{ p: 3, mb: 3, flex: 1, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
  return (
    <>
      <ColoredPaper colorKey={colorKey} elevation={3} sx={{ p: 3, mb: 3, height: '100%', width: '100%' }}>
      <Tabs value={tab} onChange={handleChange} sx={{ mb: 2 }}>
        <Tab label="Resumen" value={resumenIdx} />
        {recogidaIdx !== -1 && <Tab label="Datos de recogida" value={recogidaIdx} />}
        {realesIdx   !== -1 && <Tab label="Dispositivos recibidos" value={realesIdx} />}
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === resumenIdx && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h6">Dispositivos asociados</Typography>
              {Boolean(oportunidad.dispositivos?.length) && !bloquearVistaCompacta && (
                <FormControlLabel
                  control={<Switch size="small" checked={vistaCompacta} onChange={(e) => setVistaCompacta(e.target.checked)} />}
                  label="Vista compacta"
                />
              )}
            </Box>

            {(!oportunidad.dispositivos || oportunidad.dispositivos.length === 0) ? (
              <Typography>No hay dispositivos aún</Typography>
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, mt: 1 }}>
                {vistaCompacta ? (
                  <SimpleBar style={{ maxHeight: 445 }}>
                    <List>
                      {oportunidad.dispositivos?.map((d, idx) => {
                        const _precios = (getField(d, 'precios_por_estado') ?? getField(d, 'precio_por_estado')) as Record<string, unknown> | undefined
                        const modeloDesc = String(getField(getField(d, 'modelo'), 'descripcion') ?? '')
                        const capacidadTam = String(getField(getField(d, 'capacidad'), 'tamaño') ?? '')
                        const cantidadStr = String(getField(d, 'cantidad') ?? '')
                        const _estadoFisico = String(getField(d, 'estado_fisico') ?? '')
                        const _estadoFuncional = String(getField(d, 'estado_funcional') ?? '')
                        const precioOrientativo = getField(d, 'precio_orientativo')
                        const keyVal = (typeof (d as any).id === 'string' || typeof (d as any).id === 'number') ? (d as any).id : idx
                        return (
                          <ListItem key={keyVal} disableGutters>
                            <Paper sx={{ p: 2, width: '100%' }}>
                              <Typography><strong>Modelo:</strong> {modeloDesc} {capacidadTam}</Typography>
                              <Typography><strong>Cantidad:</strong> {cantidadStr}</Typography>
                              <Typography><strong>Precio orientativo:</strong> {formatEUR(precioOrientativo)}</Typography>
                              {puedeEditar && (
                                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                                  <Button size="small" variant="outlined" onClick={() => onEditarItem(d)}>Editar</Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() => {
                                      const idNum = typeof (d as any).id === 'number' ? (d as any).id : Number((d as any).id)
                                      if (Number.isFinite(idNum)) setDispositivoAEliminar(idNum)
                                    }}
                                  >
                                    Eliminar
                                  </Button>
                                </Box>
                              )}
                            </Paper>
                          </ListItem>
                        )
                      })}
                    </List>
                  </SimpleBar>
                ) : (
                  <SimpleBar style={{ height: '40vh' }}>
                    <Grid container spacing={2}>
                      {oportunidad.dispositivos?.map((d, idx) => {
                        // soporta tanto d.precios_por_estado como d.precio_por_estado
                        const precios = (getField(d, 'precios_por_estado') ?? getField(d, 'precio_por_estado')) as Record<string, unknown> | undefined
                        const pantalla = {
                          puntos_bril: Boolean(getField(d, 'pantalla_funcional_puntos_bril')),
                          pixeles_muertos: Boolean(getField(d, 'pantalla_funcional_pixeles_muertos')),
                          lineas_quemaduras: Boolean(getField(d, 'pantalla_funcional_lineas_quemaduras')),
                        }
                        const modeloDesc = String(getField(getField(d, 'modelo'), 'descripcion') ?? '')
                        const capacidadTam = String(getField(getField(d, 'capacidad'), 'tamaño') ?? '')
                        const cantidadStr = String(getField(d, 'cantidad') ?? '')
                        const estadoFisico = String(getField(d, 'estado_fisico') ?? '')
                        const estadoFuncional = String(getField(d, 'estado_funcional') ?? '')
                        const estadoValoracion = String(getField(d, 'estado_valoracion') ?? '')
                        const salud = getField(d, 'salud_bateria_pct')
                        const saludNum = typeof salud === 'number' ? salud : null
                        const precioOrientativo = getField(d, 'precio_orientativo')
                        const precioExcelente = precios ? getField(precios, 'excelente') : undefined
                        const precioMuyBueno = precios ? getField(precios, 'muy_bueno') : undefined
                        const precioBueno = precios ? getField(precios, 'bueno') : undefined
                        const hayRango = precioExcelente != null || precioMuyBueno != null || precioBueno != null
                        const keyVal = (typeof (d as any).id === 'string' || typeof (d as any).id === 'number') ? (d as any).id : idx
                        return (
                          <Grid key={keyVal} size={{ xs: 12, md: 6 }}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                              <Typography><strong>Modelo:</strong> {modeloDesc} {capacidadTam}</Typography>
                              <Typography><strong>Cantidad:</strong> {cantidadStr}</Typography>

                              {/* Estados nuevos del flujo */}
                              <Typography><strong>Estado estético:</strong> {formatoBonito(estadoFisico)}</Typography>
                              <Typography><strong>Estado funcional:</strong> {formatoBonito(estadoFuncional)}</Typography>
                              {!!estadoValoracion && (
                                <Typography><strong>Valoración:</strong> {formatoBonito(estadoValoracion)}</Typography>
                              )}

                              {/* Salud de batería y básicas */}
                              {saludNum !== null && (
                                <Typography><strong>Salud batería:</strong> {saludNum}%</Typography>
                              )}
                              {String(getField(d, 'funcionalidad_basica') ?? '') && (
                                <Typography><strong>Funcionalidad básica:</strong> {formatoBonito(String(getField(d, 'funcionalidad_basica') ?? ''))}</Typography>
                              )}

                              {/* Incidencias de pantalla si vienen del formulario */}
                              {(pantalla.puntos_bril || pantalla.pixeles_muertos || pantalla.lineas_quemaduras) && (
                                <Box sx={{ mt: 1 }}>
                                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Pantalla</Typography>
                                  <Typography>• Puntos de brillo: {pantalla.puntos_bril ? 'Sí' : 'No'}</Typography>
                                  <Typography>• Píxeles muertos: {pantalla.pixeles_muertos ? 'Sí' : 'No'}</Typography>
                                  <Typography>• Líneas/quemaduras: {pantalla.lineas_quemaduras ? 'Sí' : 'No'}</Typography>
                                </Box>
                              )}

                              {/* Precio orientativo + precios por estado si existen */}
                              <Box sx={{ mt: 1 }}>
                                <Typography><strong>Precio orientativo:</strong> {formatEUR(precioOrientativo)}</Typography>
                                {hayRango && (
                                  <Box sx={{ mt: 0.5 }}>
                                    <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Rango por estado</Typography>
                                    <Typography>• Excelente: {formatEUR(precioExcelente)}</Typography>
                                    <Typography>• Muy bueno: {formatEUR(precioMuyBueno)}</Typography>
                                    <Typography>• Bueno: {formatEUR(precioBueno)}</Typography>
                                  </Box>
                                )}
                              </Box>

                              {puedeEditar && (
                                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                  <Button size="small" variant="outlined" onClick={() => onEditarItem(d)}>Editar</Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() => {
                                      const idNum = typeof (d as any).id === 'number' ? (d as any).id : Number((d as any).id)
                                      if (Number.isFinite(idNum)) setDispositivoAEliminar(idNum)
                                    }}
                                  >
                                    Eliminar
                                  </Button>
                                </Box>
                              )}
                            </Paper>
                          </Grid>
                        )
                      })}
                    </Grid>
                  </SimpleBar>
                )}
              </Box>
            )}

            {puedeEditar && (
              <Button sx={{ mt: 2, alignSelf: 'flex-start' }} variant="contained" onClick={() => onEditarItem(null)}>
                Añadir dispositivo
              </Button>
            )}
          </Box>
        )}

        {recogidaIdx !== -1 && tab === recogidaIdx && (
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {tieneDatosRecogida ? (
              <Box>
                <Typography variant="h6" gutterBottom>Dirección de recogida</Typography>
                <Typography>{`${oportunidad.calle || ''} ${oportunidad.numero || ''}${oportunidad.piso ? ', Piso ' + oportunidad.piso : ''}${oportunidad.puerta ? ', Puerta ' + oportunidad.puerta : ''}`}</Typography>
                <Typography>{`${oportunidad.codigo_postal || ''} ${oportunidad.poblacion || ''}${oportunidad.provincia ? ', ' + oportunidad.provincia : ''}`}</Typography>

                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Contacto</Typography>
                <Typography>Persona: {oportunidad.persona_contacto || '-'}</Typography>
                <Typography>Teléfono: {oportunidad.telefono_contacto || '-'}</Typography>
                <Typography>Correo: {oportunidad.correo_recogida || '-'}</Typography>
                <Typography>Instrucciones: {oportunidad.instrucciones || '-'}</Typography>

                {/* Tracking si existe */}
                {(oportunidad.numero_seguimiento || oportunidad.url_seguimiento) && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="h6" gutterBottom>Seguimiento</Typography>
                    {oportunidad.numero_seguimiento && (
                      <Typography>Nº seguimiento: {oportunidad.numero_seguimiento}</Typography>
                    )}
                    {oportunidad.url_seguimiento && (
                      <Typography>
                        Enlace:{' '}
                        <Link href={oportunidad.url_seguimiento} target="_blank" rel="noopener noreferrer">
                          {oportunidad.url_seguimiento}
                        </Link>
                      </Typography>
                    )}
                  </Box>
                )}

                <Button sx={{ mt: 2 }} variant="outlined" onClick={onAbrirRecogida}>
                  Modificar datos de recogida
                </Button>
              </Box>
            ) : (
              <Typography>Sin datos de recogida aún</Typography>
            )}
          </Box>
        )}

        {realesIdx !== -1 && tab === realesIdx && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>Dispositivos reales recibidos</Typography>
            {renderAccionesReales?.()}
            {mostrarTablaReales ? (
              <Box sx={{ mt: 2, flex: 1, minHeight: 0, overflow: 'auto' }}>
                <TablaReactiva
                  oportunidades={dispositivosReales}
                  columnas={columnasDispositivosReales}
                  usuarioId={usuarioId}
                  defaultSorting={[{ id: 'modelo', desc: false }]}
                />
              </Box>
            ) : (
              <Typography variant="body2">Aún no se ha recibido la oportunidad.</Typography>
            )}
          </Box>
        )}
      </Box>
      </ColoredPaper>

      <Dialog open={dispositivoAEliminar !== null} onClose={() => setDispositivoAEliminar(null)}>
        <DialogTitle>Eliminar dispositivo</DialogTitle>
        <DialogContent>
          ¿Seguro que quieres eliminar este dispositivo? Esta acción no se puede deshacer.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDispositivoAEliminar(null)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (dispositivoAEliminar !== null) onEliminarItem(dispositivoAEliminar)
              setDispositivoAEliminar(null)
            }}
            color="error"
            variant="contained"
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
