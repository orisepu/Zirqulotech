'use client'
import { Box, Paper, Typography, List, ListItem, TextField, Button } from '@mui/material'
import SimpleBar from 'simplebar-react'
import 'simplebar-react/dist/simplebar.min.css'
import { useRef, useEffect, useState } from 'react'

export default function ComentariosPanel({
  comentarios = [],
  onEnviar,
  enviando = false,
}: {
  comentarios: any[]
  onEnviar: (texto: string) => void
  enviando?: boolean
}) {
  const finRef = useRef<HTMLDivElement | null>(null)
  const [texto, setTexto] = useState('')

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comentarios])

return (
  <Paper
    elevation={3}
    sx={{
      p: 3,
      mb: 3,
      flex: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0, // clave para que el hijo con overflow funcione
    }}
  >
    <Typography variant="h6" gutterBottom>Comentarios</Typography>

    {/* Área scrollable */}
    <Box sx={{ flex: 1, minHeight: 0, mt: 1 }}>
      {comentarios.length === 0 ? (
        <Box sx={{ height: '50%', display: 'grid', placeItems: 'center' }}>
          <Typography>No hay comentarios aún</Typography>
        </Box>
      ) : (
        <SimpleBar style={{ height: '40vh' }}>
          <List sx={{ px: 0 }}>
            {comentarios.map((c) => (
              <ListItem key={c.id}>
                <Paper sx={{ p: 2, width: '100%' }}>
                  <Typography>{c.texto}</Typography>
                  <Typography variant="caption">
                    {c.autor_nombre}, {new Date(c.fecha).toLocaleString()}
                  </Typography>
                </Paper>
              </ListItem>
            ))}
            <div ref={finRef} />
          </List>
        </SimpleBar>
      )}
    </Box>

    {/* Footer (fuera del scroll) */}
    <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
      <TextField
        label="Nuevo comentario"
        fullWidth
        multiline
        minRows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <Button
        sx={{ mt: 1 }}
        variant="contained"
        disabled={enviando || !texto.trim()}
        onClick={() => { onEnviar(texto); setTexto('') }}
      >
        Añadir comentario
      </Button>
    </Box>
  </Paper>
)

}
