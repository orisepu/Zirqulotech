"use client";

import React, { useState } from "react";
import {
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import api from "@/services/api"; // Ajusta según tu alias o ruta real

interface CrearLoteProps {
  dispositivosSeleccionados: number[];
  onClose: () => void;
  onSuccess: () => void;
}

const CrearLote: React.FC<CrearLoteProps> = ({ dispositivosSeleccionados, onClose, onSuccess }) => {
  const [nombreLote, setNombreLote] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [borradoCertificado, setBorradoCertificado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("api/lotes/crearlote/", {
        dispositivos: dispositivosSeleccionados,
        nombre: nombreLote || "Lote sin nombre",
        observaciones,
        borrado_certificado: borradoCertificado,
      });

      onSuccess();
    } catch (error) {
      console.error("Error al crear el lote:", error);
      alert("Ocurrió un error al crear el lote.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogTitle>Crear Lote</DialogTitle>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Nombre del Lote"
            value={nombreLote}
            onChange={(e) => setNombreLote(e.target.value)}
            fullWidth
            required
            margin="normal"
          />

          <TextField
            label="Observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            fullWidth
            multiline
            rows={2}
            required
            margin="normal"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={borradoCertificado}
                onChange={(e) => setBorradoCertificado(e.target.checked)}
                color="primary"
              />
            }
            label="Confirmar borrado certificado de datos durante la auditoría"
          />
        </form>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <CircularProgress size={22} /> : "Crear Lote"}
        </Button>
      </DialogActions>
    </>
  );
};

export default CrearLote;
