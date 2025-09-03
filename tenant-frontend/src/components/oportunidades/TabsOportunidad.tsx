'use client'
import { Box, Paper, Tabs, Tab, Typography, Button, Link, Grid } from '@mui/material'
import { useState, useEffect, useMemo } from 'react'
import SimpleBar from 'simplebar-react'
import { formatoBonito } from '@/context/precios'
import TablaReactiva from '@/components/TablaReactiva2'
import { columnasDispositivosReales } from '@/components/TablaColumnas2'

function formatEUR(v?: number | string) {
  const n = Number(v ?? 0)
  if (!isFinite(n) || n <= 0) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)
}

export default function TabsOportunidad({
  oportunidad, dispositivosReales, onEditarItem, onEliminarItem, onAbrirRecogida, usuarioId, onTabChange,
}: {
  oportunidad: any
  dispositivosReales: any[]
  onEditarItem: (item: any | null) => void
  onEliminarItem: (id: number) => void
  onAbrirRecogida: () => void
  usuarioId?: number
  onTabChange?: (i:number)=>void
}) {
  const [tab, setTab] = useState(0)

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

  useEffect(() => {
    if (tab > totalTabs - 1) setTab(totalTabs - 1)
    if (tab < 0) setTab(0)
  }, [totalTabs]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (_: any, v: number) => {
    setTab(v)
    onTabChange?.(v)
    if (v === recogidaIdx && !tieneDatosRecogida) onAbrirRecogida()
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3, flex: 1, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Tabs value={tab} onChange={handleChange} sx={{ mb: 2 }}>
        <Tab label="Resumen" value={resumenIdx} />
        {recogidaIdx !== -1 && <Tab label="Datos de recogida" value={recogidaIdx} />}
        {realesIdx   !== -1 && <Tab label="Dispositivos recibidos" value={realesIdx} />}
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === resumenIdx && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6">Dispositivos asociados</Typography>

            {(!oportunidad.dispositivos || oportunidad.dispositivos.length === 0) ? (
              <Typography>No hay dispositivos aún</Typography>
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, mt: 1 }}>
                <SimpleBar style={{ height: '40vh' }}>
                  <Grid container spacing={2}>
                    {oportunidad.dispositivos.map((d: any) => {
                      // soporta tanto d.precios_por_estado como d.precio_por_estado
                      const precios = d?.precios_por_estado ?? d?.precio_por_estado
                      const pantalla = {
                        puntos_bril: d?.pantalla_funcional_puntos_bril,
                        pixeles_muertos: d?.pantalla_funcional_pixeles_muertos,
                        lineas_quemaduras: d?.pantalla_funcional_lineas_quemaduras,
                      }
                      return (
                        <Grid key={d.id} size={{ xs: 12, md: 6 }}>
                          <Paper sx={{ p: 2, height: '100%' }}>
                            <Typography><strong>Modelo:</strong> {d?.modelo?.descripcion} {d?.capacidad?.tamaño}</Typography>
                            <Typography><strong>Cantidad:</strong> {d?.cantidad}</Typography>

                            {/* Estados nuevos del flujo */}
                            <Typography><strong>Estado estético:</strong> {formatoBonito(d?.estado_fisico)}</Typography>
                            <Typography><strong>Estado funcional:</strong> {formatoBonito(d?.estado_funcional)}</Typography>
                            {d?.estado_valoracion && (
                              <Typography><strong>Valoración:</strong> {formatoBonito(d.estado_valoracion)}</Typography>
                            )}

                            {/* Salud de batería y básicas */}
                            {typeof d?.salud_bateria_pct === 'number' && (
                              <Typography><strong>Salud batería:</strong> {d.salud_bateria_pct}%</Typography>
                            )}
                            {d?.funcionalidad_basica && (
                              <Typography><strong>Funcionalidad básica:</strong> {formatoBonito(d.funcionalidad_basica)}</Typography>
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
                              <Typography><strong>Precio orientativo:</strong> {formatEUR(d?.precio_orientativo)}</Typography>
                              {precios && (precios.excelente || precios.muy_bueno || precios.bueno) && (
                                <Box sx={{ mt: 0.5 }}>
                                  <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Rango por estado</Typography>
                                  <Typography>• Excelente: {formatEUR(precios.excelente)}</Typography>
                                  <Typography>• Muy bueno: {formatEUR(precios.muy_bueno)}</Typography>
                                  <Typography>• Bueno: {formatEUR(precios.bueno)}</Typography>
                                </Box>
                              )}
                            </Box>

                            {estado === 'Pendiente' && (
                              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                <Button size="small" variant="outlined" onClick={() => onEditarItem(d)}>Editar</Button>
                                <Button size="small" variant="outlined" color="error" onClick={() => onEliminarItem(d.id)}>Eliminar</Button>
                              </Box>
                            )}
                          </Paper>
                        </Grid>
                      )
                    })}
                  </Grid>
                </SimpleBar>
              </Box>
            )}

            {estado === 'Pendiente' && (
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
    </Paper>
  )
}