"use client";

import React, { useEffect, useState } from "react";
import {
  Box, Table, TableHead, TableRow, TableCell, TableBody, Checkbox,
  IconButton, Button, Dialog, Typography, Tooltip, CircularProgress
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ReplayIcon from "@mui/icons-material/Replay";
import AddIcon from "@mui/icons-material/Add";
import api from "@/services/api";
import FormularioValoracion from "../../../components/FormularioValoracion";
import CrearLote from "../../../components/CrearLote";

function diasRestantes(fechaCaducidad?: string | Date | null): number | null {
  if (!fechaCaducidad) return null;
  const caduca = typeof fechaCaducidad === 'string' ? new Date(fechaCaducidad) : fechaCaducidad;
  if (isNaN(caduca.getTime())) return null;

  // Comparación a día completo para evitar desfases por horas
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(caduca);
  fin.setHours(0, 0, 0, 0);

  return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ValoracionesList() {
  const [valoraciones, setValoraciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [openLoteForm, setOpenLoteForm] = useState(false);
  const [valoracionActual, setValoracionActual] = useState<any>(null);

  useEffect(() => {
    cargarValoraciones();
  }, []);

  const cargarValoraciones = () => {
    setLoading(true);
    api.get("/api/dispositivos/?lote_id__isnull=true")
      .then((res) => {
        setValoraciones(res.data);
      })
      .catch((err) => {
        console.error("Error al cargar valoraciones", err);
      })
      .finally(() => setLoading(false));
  };

  const handleSeleccionar = (id: number) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((sel) => sel !== id) : [...prev, id]
    );
  };

  const handleSeleccionarTodo = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSeleccionados(
        valoraciones.filter((v) => !v.caducado).map((v) => v.id)
      );
    } else {
      setSeleccionados([]);
    }
  };

  const handleCrearLote = () => {
    if (seleccionados.length === 0) return;
    setOpenLoteForm(true);
  };

  const handleEliminar = (id: number) => {
    if (window.confirm("¿Seguro que quieres eliminar esta valoración?")) {
      api.delete(`/api/dispositivos/${id}/`).then(() => {
        cargarValoraciones();
      });
    }
  };

  const handleEditar = (valoracion: any) => {
    setValoracionActual(valoracion);
    setModalAbierto(true);
  };

  const handleNuevaValoracion = () => {
    setValoracionActual(null);
    setModalAbierto(true);
  };

  const handleRecalcular = (id: number) => {
    api.post(`/api/dispositivos/${id}/recalcular_precio/`).then(() => {
      cargarValoraciones();
    });
  };

  if (loading) return <CircularProgress />;

  return (
    <Box p={3}>
      <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Mis valoraciones (en borrador)</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={handleNuevaValoracion}>
          Añadir valoración
        </Button>
      </Box>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={
                  seleccionados.length > 0 &&
                  seleccionados.length < valoraciones.filter((v) => !v.caducado).length
                }
                checked={
                  valoraciones.length > 0 &&
                  seleccionados.length === valoraciones.filter((v) => !v.caducado).length
                }
                onChange={handleSeleccionarTodo}
              />
            </TableCell>
            <TableCell>Modelo</TableCell>
            <TableCell>Capacidad</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell>Precio (€)</TableCell>
            <TableCell>Caduca en</TableCell>
            <TableCell>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {valoraciones.map((item) => (
            <TableRow key={item.id} selected={seleccionados.includes(item.id)}>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={seleccionados.includes(item.id)}
                  disabled={item.caducado}
                  onChange={() => handleSeleccionar(item.id)}
                />
              </TableCell>
              <TableCell>{item.modelo?.descripcion || "-"}</TableCell>
              <TableCell>{item.capacidad?.tamaño || "-"}</TableCell>
              <TableCell>{item.estado_valoracion || "-"}</TableCell>
              <TableCell>{item.capacidad?.precio ?? "-"}</TableCell>
              <TableCell>
                {(() => {
                  const dr = diasRestantes(item.fecha_caducidad);
                  if (dr === null) return '—';
                  return dr <= 0
                    ? <span style={{ color: 'red' }}>Caducada</span>
                    : `${dr} días`;
                })()}
              </TableCell>
              <TableCell>
                {item.caducado && (
                  <Tooltip title="Recalcular precio">
                    <IconButton onClick={() => handleRecalcular(item.id)}>
                      <ReplayIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Editar">
                  <IconButton onClick={() => handleEditar(item)}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton onClick={() => handleEliminar(item.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box mt={2} display="flex" justifyContent="space-between">
        <Typography variant="body2" color="textSecondary">
          Solo puedes seleccionar valoraciones válidas (no caducadas) para crear lote.
        </Typography>
        <Button
          variant="contained"
          onClick={handleCrearLote}
          disabled={seleccionados.length === 0}
        >
          Crear Lote
        </Button>
      </Box>

      {/* Modales */}
      <Dialog open={openLoteForm} onClose={() => setOpenLoteForm(false)}>
        <CrearLote
          dispositivosSeleccionados={seleccionados}
          onClose={() => setOpenLoteForm(false)}
          onSuccess={() => {
            setOpenLoteForm(false);
            cargarValoraciones();
          }}
        />
      </Dialog>

      <Dialog open={modalAbierto} onClose={() => setModalAbierto(false)} maxWidth="sm" fullWidth>
        <FormularioValoracion
          item={valoracionActual}
          onClose={() => setModalAbierto(false)}
          onSuccess={() => {
            setModalAbierto(false);
            cargarValoraciones();
          }}
        />
      </Dialog>
    </Box>
  );
}
