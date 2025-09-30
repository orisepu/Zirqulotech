import {
  Box, Typography, Paper, List, ListItem, Tabs, Tab, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Container, Grid
} from '@mui/material';
import { useState } from 'react';
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab';

interface Dispositivo {
  id: number;
  modelo: { descripcion: string };
  estado_fisico: string;
  estado_funcional: string;
  cantidad: number;
  precio_orientativo: number;
}

interface Comentario {
  id: number;
  texto: string;
  autor_nombre: string;
  fecha: string;
}

interface EventoHistorial {
  id: number;
  descripcion: string;
  tipo_evento: string;
  usuario_nombre: string;
  fecha: string;
}

interface Oportunidad {
  id: number;
  nombre: string;
  estado: string;
  fecha_creacion: string;
  cliente?: { razon_social: string };
  dispositivos: Dispositivo[];
  comentarios: Comentario[];
  calle?: string;
  numero?: string;
  piso?: string;
  puerta?: string;
  codigo_postal?: string;
  poblacion?: string;
  provincia?: string;
  persona_contacto?: string;
  telefono_contacto?: string;
  instrucciones?: string;
}

interface Props {
  oportunidad: Oportunidad;
  historial: EventoHistorial[];
  onGuardarRecogida: (data: any) => Promise<void>;

  puedeEditarRecogida: boolean;
  puedeVerFacturas?: boolean;
  puedeVerDispositivosAuditados?: boolean;
  esSuperadmin?: boolean;
  onRefrescar?: () => void;

}

export default function OportunidadDetalleBase({
  oportunidad,
  historial,
  onGuardarRecogida,
  puedeEditarRecogida,
  puedeVerDispositivosAuditados,
  esSuperadmin,
  onRefrescar,

}: Props) {
  const [tab, setTab] = useState(0);
  const [modalRecogidaAbierto, setModalRecogidaAbierto] = useState(false);
  const [form, setForm] = useState({
    calle: oportunidad.calle || '',
    numero: oportunidad.numero || '',
    piso: oportunidad.piso || '',
    puerta: oportunidad.puerta || '',
    codigo_postal: oportunidad.codigo_postal || '',
    poblacion: oportunidad.poblacion || '',
    provincia: oportunidad.provincia || '',
    persona_contacto: oportunidad.persona_contacto || '',
    telefono_contacto: oportunidad.telefono_contacto || '',
    instrucciones: oportunidad.instrucciones || '',
  });

  const handleGuardarDatosRecogida = async () => {
    await onGuardarRecogida(form);
    setModalRecogidaAbierto(false);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box>
      <Typography variant="h5" gutterBottom>
        Oportunidad: {oportunidad.nombre || `#${oportunidad.id}`}
      </Typography>
      <Typography>Estado: <strong>{oportunidad.estado}</strong></Typography>
      <Typography>Fecha de creación: {new Date(oportunidad.fecha_creacion).toLocaleString()}</Typography>
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
          {oportunidad.dispositivos.length === 0 ? (
            <Typography>No hay dispositivos</Typography>
          ) : (
            <Grid container spacing={2}>
              {oportunidad.dispositivos.map((d) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={d.id}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography><strong>Modelo:</strong> {d.modelo.descripcion}</Typography>
                    <Typography><strong>Cantidad:</strong> {d.cantidad}</Typography>
                    <Typography><strong>Estado estético:</strong> {d.estado_fisico}</Typography>
                    <Typography><strong>Estado funcional:</strong> {d.estado_funcional}</Typography>
                    <Typography><strong>Precio:</strong> {d.precio_orientativo} €</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>Dirección de recogida</Typography>
          {form.calle ? (
            <>
              <Typography>{`${form.calle} ${form.numero}, Piso ${form.piso}, Puerta ${form.puerta}`}</Typography>
              <Typography>{`${form.codigo_postal} ${form.poblacion}, ${form.provincia}`}</Typography>

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Contacto</Typography>
              <Typography>Persona: {form.persona_contacto || '—'}</Typography>
              <Typography>Teléfono: {form.telefono_contacto || '—'}</Typography>
              <Typography>Instrucciones: {form.instrucciones || '—'}</Typography>

              {puedeEditarRecogida && (
                <Button sx={{ mt: 2 }} variant="outlined" onClick={() => setModalRecogidaAbierto(true)}>
                  Modificar datos de recogida
                </Button>
              )}
            </>
          ) : (
            <Typography>No hay datos de recogida disponibles.</Typography>
          )}
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>Comentarios</Typography>
          {oportunidad.comentarios.length === 0 ? (
            <Typography>No hay comentarios</Typography>
          ) : (
            <Grid container spacing={2}>
              {oportunidad.comentarios.map((c) => (
                <Grid size={{ xs: 12, md: 6 }} key={c.id}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography>{c.texto}</Typography>
                    <Typography variant="caption">
                      — {c.autor_nombre}, {new Date(c.fecha).toLocaleString()}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>Historial</Typography>
          {historial.length === 0 ? (
            <Typography>No hay eventos registrados</Typography>
          ) : (
            <Timeline position="right">
              {historial.map((evento) => (
                <TimelineItem key={evento.id}>
                  <TimelineSeparator>
                    <TimelineDot color={
                      evento.tipo_evento === 'comentario' ? 'primary' :
                      evento.tipo_evento === 'cambio_estado' ? 'secondary' :
                      'grey'
                    } />
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

      <Dialog
        open={modalRecogidaAbierto}
        onClose={() => setModalRecogidaAbierto(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Editar datos de recogida</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2, display: 'grid', gap: 2 }}>
            {Object.entries({
              calle: 'Calle',
              numero: 'Número',
              piso: 'Piso',
              puerta: 'Puerta',
              codigo_postal: 'Código Postal',
              poblacion: 'Población',
              provincia: 'Provincia',
              persona_contacto: 'Persona de contacto',
              telefono_contacto: 'Teléfono',
              instrucciones: 'Instrucciones',
            }).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                fullWidth
                multiline={key === 'instrucciones'}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalRecogidaAbierto(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarDatosRecogida}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Container>
  );
}
