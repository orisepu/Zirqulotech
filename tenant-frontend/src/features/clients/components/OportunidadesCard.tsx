"use client";
import {
  Card, CardHeader, CardContent, CardActions,
  Typography, Paper, Button, Dialog, IconButton,
  DialogTitle, DialogContent
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Link from "next/link";
import { useMemo, useState } from "react";
import OportunidadForm from "@/features/opportunities/components/OportunidadForm";
import type { SxProps, Theme } from '@mui/material/styles';
type Oportunidad = {
  id: number;
  uuid?: string | null;
  nombre: string | null;
  estado: string;
  fecha_creacion: string;
  
};

export default function OportunidadesCard({
  oportunidades,
  clienteId,  
  sx,                         // ✅ pásalo desde el padre
}: {
  oportunidades: Oportunidad[];
  clienteId?: number;
  sx?: SxProps <Theme>;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const [abrirModal, setAbrirModal] = useState(false);

  const ordenadas = useMemo(
    () =>
      [...(oportunidades || [])].sort(
        (a, b) =>
          new Date(b.fecha_creacion).getTime() -
          new Date(a.fecha_creacion).getTime()
      ),
    [oportunidades]
  );

  const mostradas = verTodas ? ordenadas : ordenadas.slice(0, 3);

  const hrefOportunidad = (o: Oportunidad) =>
    `/clientes/oportunidades/${o.uuid || o.id}`;

  return (
    <Card variant="outlined" sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,   // 👈 importantísimo con flex hijos
        ...sx,          // 👈 permite que el padre le pase flex:1
      }}>
      <CardHeader
        sx={{ p: 1, flexShrink: 0 }}
        title="Últimas oportunidades"
        action={
          ordenadas.length > 3 && (
            <Button variant="text" size="small" onClick={() => setVerTodas((v) => !v)}>
              {verTodas ? "Ver menos" : "Ver todas"}
            </Button>
          )
        }
      />
      <CardContent sx={{
          p: 1,
          flex: 1,        // 👈 ocupa todo el espacio disponible
          minHeight: 0,   // 👈 permite que overflow funcione
          overflow: 'auto', // 👈 el scroll ocurre aquí, no en la página
        }}>
        {mostradas.length === 0 ? (
          <Typography>No hay oportunidades aún</Typography>
        ) : (
          mostradas.map((o) => (
            <Link key={o.uuid || o.id} href={hrefOportunidad(o)}>
              <Paper
                sx={{
                  p: 1,
                  my: 1,
                  cursor: "pointer",
                  transition: "0.2s",
                  "&:hover": { boxShadow: 3 },
                }}
                elevation={1}
              >
                <Typography fontWeight="bold">{o.nombre || "Sin nombre"}</Typography>
                <Typography variant="body2">Estado: {o.estado}</Typography>
                <Typography variant="body2">
                  Fecha creación: {new Date(o.fecha_creacion).toLocaleString()}
                </Typography>
              </Paper>
            </Link>
          ))
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', flexShrink: 0 }}>
        <Button
          variant="contained"
          onClick={() => setAbrirModal(true)}
          disabled={!clienteId}                  // ✅ evita crash si no hay cliente
          title={!clienteId ? "Selecciona un cliente primero" : ""}
        >
          Crear Oportunidad
        </Button>
      </CardActions>

      {/* Modal: Crear oportunidad */}
      <Dialog
        open={abrirModal}
        onClose={() => setAbrirModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Crear nueva oportunidad
          <IconButton
            aria-label="cerrar"
            onClick={() => setAbrirModal(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {/* ✅ pasa clienteId real; si no hay, no montes el form */}
          {clienteId ? (
            <OportunidadForm
              clienteId={clienteId}
              onClose={() => setAbrirModal(false)}
            />
          ) : (
            <Typography variant="body2">
              Selecciona un cliente para crear una oportunidad.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
