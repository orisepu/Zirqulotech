'use client'

import {
  Box,
  Grid,
  Paper,
  Typography,
  useTheme,
} from '@mui/material'

import { useState } from 'react'

export default function DashboardInterno() {
  const theme = useTheme()
  const tareasPendientes = [
    {
      tipo: 'auditoria',
      cliente: 'MediaMarkt Barcelona',
      fecha: '2025-07-24',
      dispositivos: 8,
    },
    {
      tipo: 'oportunidad',
      nombre: 'Lote iPhones verano',
      estado: 'pendiente',
      fecha: '2025-07-23',
    },
    {
      tipo: 'chat',
      cliente: 'PCComponentes',
      ultimaRespuesta: 'hace 3 min',
      sinLeer: 2,
    },
  ]
  const tecnicos = [
    {
      nombre: 'Juan López',
      auditados: 128,
      tiempoMedio: '4m 30s',
      valorMedio: 82.5,
      chats: 5,
    },
    {
      nombre: 'Clara Pérez',
      auditados: 96,
      tiempoMedio: '3m 45s',
      valorMedio: 78.2,
      chats: 2,
    },
    {
      nombre: 'Mario Ruiz',
      auditados: 185,
      tiempoMedio: '4m 10s',
      valorMedio: 89.0,
      chats: 0,
    },
  ]
  // Datos ficticios para resumen
  const [datos, _setDatos] = useState({
    valorGenerado: 125430,
    dispositivosAuditados: 482,
    oportunidadesPendientes: 37,
    chatsActivos: 5,
  })

  const formatoEuros = (valor: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(valor)

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Dashboard interno
      </Typography>

      <Grid container spacing={3}>

        <Grid size={{xs:12,sm:6, md:3}} >
          <Paper elevation={4} sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <Typography variant="subtitle2" color="text.secondary">Valor generado</Typography>
            <Typography variant="h5" fontWeight="bold" color="success.main">
              {formatoEuros(datos.valorGenerado)}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{xs:12,sm:6, md:3}}>
          <Paper elevation={4} sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <Typography variant="subtitle2" color="text.secondary">Dispositivos auditados</Typography>
            <Typography variant="h5" fontWeight="bold">
              {datos.dispositivosAuditados}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{xs:12,sm:6, md:3}}>
          <Paper elevation={4} sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <Typography variant="subtitle2" color="text.secondary">Oportunidades pendientes</Typography>
            <Typography variant="h5" fontWeight="bold">
              {datos.oportunidadesPendientes}
            </Typography>
          </Paper>
        </Grid>

        <Grid size={{xs:12,sm:6, md:3}}>
          <Paper elevation={4} sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <Typography variant="subtitle2" color="text.secondary">Chats activos</Typography>
            <Typography variant="h5" fontWeight="bold" color="info.main">
              {datos.chatsActivos}
            </Typography>
          </Paper>
        </Grid>
<Box sx={{ mt: 5 }}>
  <Typography variant="h6" fontWeight="bold" gutterBottom>
    Tareas pendientes
  </Typography>

  <Grid container spacing={2}>
    {tareasPendientes.map((tarea, idx) => (
      <Grid size={{xs:12,md:6,lg:4}} key={idx}>
        <Paper sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff' }}>
          {tarea.tipo === 'auditoria' && (
            <>
              <Typography variant="subtitle2" color="text.secondary">🔍 Auditoría pendiente</Typography>
              <Typography variant="body1">{tarea.cliente}</Typography>
              <Typography variant="body2" color="text.secondary">
                {tarea.dispositivos} dispositivos · {tarea.fecha}
              </Typography>
            </>
          )}
          {tarea.tipo === 'oportunidad' && (
            <>
              <Typography variant="subtitle2" color="text.secondary">📦 Oportunidad sin revisar</Typography>
              <Typography variant="body1">{tarea.nombre}</Typography>
              <Typography variant="body2" color="text.secondary">
                Estado: {tarea.estado} · {tarea.fecha}
              </Typography>
            </>
          )}
          {tarea.tipo === 'chat' && (
            <>
              <Typography variant="subtitle2" color="text.secondary">💬 Chat sin respuesta</Typography>
              <Typography variant="body1">{tarea.cliente}</Typography>
              <Typography variant="body2" color="text.secondary">
                Última actividad: {tarea.ultimaRespuesta} · {tarea.sinLeer} mensajes sin leer
              </Typography>
            </>
          )}
        </Paper>
      </Grid>
    ))}
  </Grid>
</Box>
<Box sx={{ mt: 5 }}>
  <Typography variant="h6" fontWeight="bold" gutterBottom>
    Rendimiento por técnico
  </Typography>

  <Paper sx={{ overflowX: 'auto', backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fff' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: 12, color: '#888' }}>👤 Técnico</th>
          <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>🔧 Auditados</th>
          <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>⏱️ Tiempo medio</th>
          <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>💰 Valor medio</th>
          <th style={{ textAlign: 'center', padding: 12, color: '#888' }}>💬 Chats</th>
        </tr>
      </thead>
      <tbody>
        {tecnicos.map((t, idx) => (
          <tr key={idx} style={{ borderTop: '1px solid #333' }}>
            <td style={{ padding: 12 }}>{t.nombre}</td>
            <td style={{ textAlign: 'center' }}>{t.auditados}</td>
            <td style={{ textAlign: 'center' }}>{t.tiempoMedio}</td>
            <td style={{ textAlign: 'center' }}>{t.valorMedio.toFixed(2)} €</td>
            <td style={{ textAlign: 'center' }}>{t.chats}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Paper>
</Box>
      </Grid>
    </Box>
  )
}
