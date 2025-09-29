"use client";
import { Card, CardHeader, CardContent, List, ListItem, Paper, Typography, TextField, Button,Box,CardActions } from "@mui/material";
import { useState } from "react";

type Comentario = { id: number; texto: string; autor_nombre: string; fecha: string; };

export default function ComentariosCard({
  comentarios,
  onAdd,
}: {
  comentarios: Comentario[];
  onAdd: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");

  return (
    <Card variant="outlined" sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <CardHeader title="Comentarios" sx={{ flexShrink: 0 }} />
      <CardContent sx={{
        flex: 1,
        minHeight: 0,                          // 👈 imprescindible para que el hijo con overflow funcione
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}>
         {/* Lista con scroll interno */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
        <List sx={{ py: 0 }}>
          {comentarios.map((c) => (
            <ListItem key={c.id} disablePadding sx={{ mb: 1 }}>
              <Paper sx={{ p: 2, width: "100%" }}>
                <Typography>{c.texto}</Typography>
                <Typography variant="caption">
                  — {c.autor_nombre}, {new Date(c.fecha).toLocaleString()}
                </Typography>
              </Paper>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Editor fijo al final del CardContent (no hace scroll) */}
      <TextField
        label="Nuevo comentario"
        multiline
        fullWidth
        minRows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
    </CardContent>

    {/* Botón fijo abajo */}
    <CardActions sx={{ flexShrink: 0 }}>
      <Button
        variant="contained"
        disabled={!texto.trim()}
        onClick={() => { onAdd(texto.trim()); setTexto(""); }}
      >
        Añadir comentario
      </Button>
    </CardActions>
  </Card>
);
}
