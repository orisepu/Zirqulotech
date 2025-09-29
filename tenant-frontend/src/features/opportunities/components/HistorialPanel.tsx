'use client'
import { Paper, Typography,Box } from '@mui/material'
import { Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, TimelineDot } from '@mui/lab'
import { timelineItemClasses } from '@mui/lab/TimelineItem'
import SimpleBar from 'simplebar-react'

type Evento = {
  id: string | number
  tipo_evento?: string
  descripcion?: string
  usuario_nombre?: string
  fecha: string
}

export default function HistorialPanel({ historial = [] }: { historial: Evento[] }) {
return (
  <Paper
    elevation={3}
    
    sx={{
      p: 3,
      mb: 3,
      flex: 1,
      borderRadius: 2,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0, // importante
    }}
  >
    <Typography variant="h6" gutterBottom>Historial de cambios</Typography>

    <Box sx={{ flex: 1, minHeight: 0 }}>
      {historial.length === 0 ? (
        <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <Typography>No hay historial registrado</Typography>
        </Box>
      ) : (
        <SimpleBar style={{ height: '55vh' }}>
          <Timeline sx={{ [`& .${timelineItemClasses.root}:before`]: { flex: 0, padding: 0 } }}>
            {historial.map((e, i) => (
              <TimelineItem key={e.id}>
                <TimelineSeparator>
                  <TimelineDot
                    color={
                      e.tipo_evento === 'comentario'
                        ? 'primary'
                        : e.tipo_evento === 'cambio_estado'
                        ? 'secondary'
                        : 'grey'
                    }
                  />
                  {i < historial.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent>
                  <Typography>{e.descripcion}</Typography>
                  <Typography variant="caption">
                    {e.usuario_nombre} — {new Date(e.fecha).toLocaleString()}
                  </Typography>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </SimpleBar>
      )}
    </Box>
  </Paper>
)

}
