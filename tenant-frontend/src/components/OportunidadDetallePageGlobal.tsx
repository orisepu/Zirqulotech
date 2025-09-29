'use client'

import {
  Box, Typography, Paper, List, ListItem, Tabs, Tab,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, CircularProgress
} from '@mui/material'
import {
  Timeline, TimelineItem, TimelineSeparator, TimelineConnector,
  TimelineContent, TimelineDot
} from '@mui/lab'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import api from '@/services/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface Dispositivo {
  id: number
  modelo: { descripcion: string }
  estado_fisico: string
  estado_funcional: string
  cantidad: number
  precio_orientativo?: number
}

interface Comentario {
  id: number
  texto: string
  autor_nombre: string
  fecha: string
}

interface EventoHistorial {
  id: number
  descripcion: string
  tipo_evento: 'comentario' | 'cambio_estado' | string
  usuario_nombre: string
  fecha: string
}

interface Oportunidad {
  id: number
  nombre: string
  estado: string
  fecha_creacion: string
  cliente?: { razon_social: string }
  dispositivos: Dispositivo[]
  comentarios: Comentario[]
  calle?: string
  numero?: string
  piso?: string
  puerta?: string
  codigo_postal?: string
  poblacion?: string
  provincia?: string
  persona_contacto?: string
  telefono_contacto?: string
  instrucciones?: string
}

type RecogidaForm = {
  calle: string
  numero: string
  piso: string
  puerta: string
  codigo_postal: string
  poblacion: string
  provincia: string
  persona_contacto: string
  telefono_contacto: string
  instrucciones: string
}

export default function OportunidadDetallePageGlobal() {
  const { tenant, id } = useParams<{ tenant: string; id: string }>()
  const [tab, setTab] = useState(0)
  const [modalRecogidaAbierto, setModalRecogidaAbierto] = useState(false)
  const [form, setForm] = useState<RecogidaForm>({
    calle: '',
    numero: '',
    piso: '',
    puerta: '',
    codigo_postal: '',
    poblacion: '',
    provincia: '',
    persona_contacto: '',
    telefono_contacto: '',
    instrucciones: '',
  })

  const queryClient = useQueryClient()
  const enabled = Boolean(tenant && id)

  // Oportunidad
  const oppQ = useQuery<Oportunidad>({
    queryKey: ['opp-global', tenant, id],
    enabled,
    queryFn: async () => {
      const { data } = await api.get(`/api/oportunidades-globales/${tenant}/${id}/`)
      return data
    },
    placeholderData: (prev) => prev, // ← mantiene datos previos
    staleTime: 60_000,
  })

  // Historial
  const histQ = useQuery<EventoHistorial[]>({
    queryKey: ['opp-global-historial', tenant, id],
    enabled: oppQ.isSuccess,
    queryFn: async () => {
      const { data } = await api.get(`/api/oportunidades-globales/${tenant}/${id}/historial/`)
      if (Array.isArray(data?.results)) return data.results
      if (Array.isArray(data)) return data
      return []
    },
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  })

  // Sincroniza el formulario cuando llega la oportunidad
  useEffect(() => {
    const opp = oppQ.data
    if (!opp) return
    setForm({
      calle: opp.calle || '',
      numero: opp.numero || '',
      piso: opp.piso || '',
      puerta: opp.puerta || '',
      codigo_postal: opp.codigo_postal || '',
      poblacion: opp.poblacion || '',
      provincia: opp.provincia || '',
      persona_contacto: opp.persona_contacto || '',
      telefono_contacto: opp.telefono_contacto || '',
      instrucciones: opp.instrucciones || '',
    })
  }, [oppQ.data])

  // Guardar datos de recogida (PATCH)
  const updateRecogida = useMutation({
    mutationFn: async (payload: RecogidaForm) => {
      await api.patch(`/api/oportunidades-globales/${tenant}/${id}/`, payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['opp-global', tenant, id] })
      setModalRecogidaAbierto(false)
    },
  })

  // Loading/Error
  if (oppQ.isLoading) {
    return (
      <Box p={3} sx={{ display: 'grid', placeItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (oppQ.isError || !oppQ.data) {
    return <Typography p={3}>Oportunidad no encontrada</Typography>
  }

  const oportunidad = oppQ.data
  const historial = histQ.data ?? []

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Oportunidad: {oportunidad.nombre || `#${oportunidad.id}`}
      </Typography>
      <Typography>Estado: <strong>{oportunidad.estado}</strong></Typography>
      <Typography>
        Fecha de creación: {new Date(oportunidad.fecha_creacion).toLocaleString()}
      </Typography>
      <Typography gutterBottom>
        Cliente: {oportunidad.cliente?.razon_social || '—'}
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 2, mb: 2 }}>
        <Tab label="Resumen" />
        <Tab label="Datos de recogida" />
        <Tab label="Comentarios" />
        <Tab label="Historial" />
      </Tabs>

      {tab === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>Dispositivos</Typography>
          {!oportunidad.dispositivos?.length ? (
            <Typography>No hay dispositivos</Typography>
          ) : (
            <List>
              {oportunidad.dispositivos.map((d) => (
                <ListItem key={d.id}>
                  <Paper sx={{ p: 2, width: '100%' }}>
                    <Typography><strong>Modelo:</strong> {d.modelo?.descripcion || '—'}</Typography>
                    <Typography><strong>Cantidad:</strong> {d.cantidad ?? '—'}</Typography>
                    <Typography><strong>Estado estético:</strong> {d.estado_fisico || '—'}</Typography>
                    <Typography><strong>Estado funcional:</strong> {d.estado_funcional || '—'}</Typography>
                    <Typography><strong>Precio:</strong> {typeof d.precio_orientativo === 'number' ? `${d.precio_orientativo} €` : '—'}</Typography>
                  </Paper>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>Dirección de recogida</Typography>
          {oportunidad.calle ? (
            <>
              <Typography>
                {`${oportunidad.calle ?? ''} ${oportunidad.numero ?? ''}, Piso ${oportunidad.piso ?? ''}, Puerta ${oportunidad.puerta ?? ''}`}
              </Typography>
              <Typography>
                {`${oportunidad.codigo_postal ?? ''} ${oportunidad.poblacion ?? ''}, ${oportunidad.provincia ?? ''}`}
              </Typography>

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Contacto</Typography>
              <Typography>Persona: {oportunidad.persona_contacto || '—'}</Typography>
              <Typography>Teléfono: {oportunidad.telefono_contacto || '—'}</Typography>
              <Typography>Instrucciones: {oportunidad.instrucciones || '—'}</Typography>

              <Button sx={{ mt: 2 }} variant="outlined" onClick={() => setModalRecogidaAbierto(true)}>
                Modificar datos de recogida
              </Button>
            </>
          ) : (
            <Typography>No hay datos de recogida disponibles.</Typography>
          )}
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>Comentarios</Typography>
          {!oportunidad.comentarios?.length ? (
            <Typography>No hay comentarios</Typography>
          ) : (
            <List>
              {oportunidad.comentarios.map((c) => (
                <ListItem key={c.id}>
                  <Paper sx={{ p: 2, width: '100%' }}>
                    <Typography>{c.texto}</Typography>
                    <Typography variant="caption">
                      — {c.autor_nombre}, {new Date(c.fecha).toLocaleString()}
                    </Typography>
                  </Paper>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>Historial</Typography>
          {histQ.isLoading ? (
            <CircularProgress size={20} />
          ) : !historial.length ? (
            <Typography>No hay eventos registrados</Typography>
          ) : (
            <Timeline position="right">
              {historial.map((evento) => (
                <TimelineItem key={evento.id}>
                  <TimelineSeparator>
                    <TimelineDot
                      color={
                        evento.tipo_evento === 'comentario' ? 'primary'
                        : evento.tipo_evento === 'cambio_estado' ? 'secondary'
                        : 'grey'
                      }
                    />
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent>
                    <Typography>{evento.descripcion}</Typography>
                    <Typography variant="caption">
                      {evento.usuario_nombre} — {new Date(evento.fecha).toLocaleString()}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </Box>
      )}

      {/* Modal edición recogida */}
      <Dialog
        open={modalRecogidaAbierto}
        onClose={() => setModalRecogidaAbierto(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Editar datos de recogida</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2, display: 'grid', gap: 2 }}>
            {([
              ['calle', 'Calle'],
              ['numero', 'Número'],
              ['piso', 'Piso'],
              ['puerta', 'Puerta'],
              ['codigo_postal', 'Código Postal'],
              ['poblacion', 'Población'],
              ['provincia', 'Provincia'],
              ['persona_contacto', 'Persona de contacto'],
              ['telefono_contacto', 'Teléfono'],
              ['instrucciones', 'Instrucciones'],
            ] as const).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                fullWidth
                multiline={key === 'instrucciones'}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalRecogidaAbierto(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => updateRecogida.mutate(form)}
            disabled={updateRecogida.isPending}
          >
            {updateRecogida.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
