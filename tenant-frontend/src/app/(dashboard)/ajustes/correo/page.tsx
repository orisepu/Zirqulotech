'use client'

import {
  Box, Typography, Paper, Table, TableHead, TableRow,Switch,
  TableCell, TableBody, IconButton, CircularProgress, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, TextField, Chip
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { useEffect, useState,useRef } from 'react'
import api from '@/services/api'


export default function PlantillasCorreoPage() {
  type PlantillaCorreo = { id: number; evento: string; [k: string]: any }
  const [plantillas, setPlantillas] = useState<PlantillaCorreo[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionada, setSeleccionada] = useState<any | null>(null)
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false)
  const cuerpoRef = useRef<HTMLInputElement | null>(null)
  const asuntoRef = useRef<HTMLInputElement | null>(null)
  const [destinatario, setDestinatario] = useState('')
  const variables = seleccionada?.variables_disponibles?.variables || []
  const destinatarios = seleccionada?.variables_disponibles?.destinatarios || []

  const fetchPlantillas = async () => {
    try {
      const res = await api.get('api/plantillas-correo/')
      const ordenadas = [...res.data].sort(
      (a: PlantillaCorreo, b: PlantillaCorreo) => a.evento.localeCompare(b.evento))
      setPlantillas(ordenadas)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlantillas()
  }, [])

  const handleEditar = (plantilla: any) => {
    setSeleccionada(plantilla)
    setDestinatario(plantilla.destinatario || '')
    setAsunto(plantilla.asunto)
    setCuerpo(plantilla.cuerpo)
  }

  const handleGuardar = async () => {
    if (!seleccionada) return
    await api.patch(`api/plantillas-correo/${seleccionada.id}/`, {
      asunto,
      cuerpo,
      destinatario,
    })
    setSeleccionada(null)
    fetchPlantillas()
  }
 const insertarVariable = (variable: string, campo: 'asunto' | 'cuerpo' | 'destinatario') => {
  const ref = campo === 'asunto'
    ? asuntoRef.current
    : campo === 'cuerpo'
      ? cuerpoRef.current
      : null

  if (!ref && campo !== 'destinatario') return

  const start = ref?.selectionStart ?? 0
  const end = ref?.selectionEnd ?? 0
  const texto = `{{ ${variable} }}`

  if (campo === 'asunto') {
    const nuevo = asunto.slice(0, start) + texto + asunto.slice(end)
    setAsunto(nuevo)
  } else if (campo === 'cuerpo') {
    const nuevo = cuerpo.slice(0, start) + texto + cuerpo.slice(end)
    setCuerpo(nuevo)
  } else {
    const nuevo = destinatario + (destinatario.trim() ? ', ' : '') + texto
    setDestinatario(nuevo)
  }

  setTimeout(() => {
    ref?.focus()
    if (ref) {
      const pos = start + texto.length
      ref.setSelectionRange(pos, pos)
    }
  }, 0)
}

  if (loading) return <CircularProgress />

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Plantillas de correos automáticos</Typography>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Evento</TableCell>
              <TableCell>Asunto</TableCell>
              <TableCell>Activo</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plantillas.map(p => (
              <TableRow key={p.id}>
                <TableCell>{p.evento}</TableCell>
                <TableCell>{p.asunto}</TableCell>
                <TableCell>
                <Switch
                    checked={p.activo}
                    onChange={async () => {
                    await api.patch(`api/plantillas-correo/${p.id}/`, { activo: !p.activo })
                    fetchPlantillas()
                    }}
                    color="primary"
                />
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEditar(p)}>
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!seleccionada} onClose={() => setSeleccionada(null)} maxWidth="md" fullWidth>
        <DialogTitle>Editar plantilla: {seleccionada?.evento}</DialogTitle>
        <DialogContent>
          <TextField
            label="Asunto"
            fullWidth
            margin="normal"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            inputRef={asuntoRef}
          />
          <TextField
            label="Destinatario(s)"
            fullWidth
            margin="normal"
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            helperText="Puedes usar variables como {{ cliente_email }} o correos fijos separados por coma."
          />
          <TextField
            label="Cuerpo del correo"
            fullWidth
            margin="normal"
            multiline
            minRows={6}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            inputRef={cuerpoRef}
          />
         <Box mt={2}>
            <Typography variant="caption" color="text.secondary">
                Variables disponibles para insertar:
            </Typography>

            <Box mt={1} display="flex" flexWrap="wrap" gap={1}>
                {variables.map((v: string) => (
                <Chip
                    key={`cuerpo-${v}`}
                    label={`Cuerpo: {{ ${v} }}`}
                    onClick={() => insertarVariable(v, 'cuerpo')}
                    size="small"
                    color="success"
                    variant="outlined"
                    clickable
                />
                ))}

                {destinatarios.map((v: string) => (
                <Chip
                    key={`destinatario-${v}`}
                    label={`Destinatario: {{ ${v} }}`}
                    onClick={() => insertarVariable(v, 'destinatario')}
                    size="small"
                    color="info"
                    variant="outlined"
                    clickable
                />
                ))}
            </Box>
        </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeleccionada(null)}>Cancelar</Button>
          <Button onClick={handleGuardar} variant="contained">Guardar</Button>
          <Button color="warning" onClick={() => setConfirmRestoreOpen(true)}>Restaurar por defecto</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmRestoreOpen} onClose={() => setConfirmRestoreOpen(false)}>
        <DialogTitle>¿Restaurar plantilla?</DialogTitle>
        <DialogContent>
            <Typography>Esto sobrescribirá el asunto y el cuerpo actuales con el contenido original por defecto.</Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setConfirmRestoreOpen(false)}>Cancelar</Button>
            <Button
            variant="contained"
            color="warning"
            onClick={async () => {
                if (!seleccionada) return
                await api.post(`api/plantillas-correo/${seleccionada.id}/restaurar/`)
                setConfirmRestoreOpen(false)
                setSeleccionada(null)
                fetchPlantillas()
            }}
            >
            Confirmar
            </Button>
        </DialogActions>
        </Dialog>
    </Box>
  )
}
