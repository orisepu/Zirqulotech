"use client";

import React, { useMemo, useState } from "react";
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Typography,
  CircularProgress,
} from "@mui/material";
import { Autocomplete } from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import {
  calcularEstadoValoracion,
  getPrecioFinal,
  estadosFisicos,
  estadosFuncionales,
  formatoBonito,
} from "@/context/precios";

type Modelo = { id: number; descripcion: string };
type Capacidad = { id: number; tamaño: string; precio_estimado?: number | null };

interface Props {
  item: any; // si tienes el tipo, cámbialo
  onClose: () => void;
  onSuccess: () => void;
}

export default function FormularioValoracion({ item, onClose, onSuccess }: Props) {
  // ids: modelo como number | '' (para <Autocomplete/>) y capacidad como string '' (para <Select/>)
  const [modelo, setModelo] = useState<number | "">(item?.modelo?.id ?? "");
  const [capacidad, setCapacidad] = useState<string>(
    item?.capacidad?.id != null ? String(item.capacidad.id) : ""
  );

  const [estadoFisico, setEstadoFisico] = useState<string>(item?.estado_fisico ?? "");
  const [estadoFuncional, setEstadoFuncional] = useState<string>(item?.estado_funcional ?? "");
  const [cantidad, setCantidad] = useState<number>(1);

  // ====== QUERIES ======
  const modelosQ = useQuery({
    queryKey: ["modelos"],
    queryFn: async (): Promise<Modelo[]> => {
      const res = await api.get("/api/modelos/");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const capacidadesQ = useQuery({
    queryKey: ["capacidades-por-modelo", modelo || null],
    enabled: !!modelo,
    queryFn: async (): Promise<Capacidad[]> => {
      const res = await api.get(`/api/capacidades-por-modelo/`, {
        params: { modelo: typeof modelo === "number" ? modelo : undefined },
      });
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const modelos = modelosQ.data ?? [];
  const capacidades = capacidadesQ.data ?? [];

  const selectedCap = useMemo(() => {
    if (capacidad === "") return undefined;
    const id = Number(capacidad);
    return capacidades.find((c) => c.id === id);
  }, [capacidades, capacidad]);

  const precioBase: number | null = useMemo(() => {
    const v = selectedCap?.precio_estimado;
    return typeof v === "number" ? v : null;
  }, [selectedCap]);

  const estadoValoracion = useMemo(
    () => calcularEstadoValoracion(estadoFisico, estadoFuncional),
    [estadoFisico, estadoFuncional]
  );

  const precioOrientativo: number | null = useMemo(() => {
    if (estadoValoracion === "a_revision" || typeof precioBase !== "number") return null;
    return getPrecioFinal(estadoValoracion, precioBase);
  }, [estadoValoracion, precioBase]);

  // ====== MUTATIONS ======
  const updateDispositivo = useMutation({
    mutationFn: async (payload: { id: number; data: any }) => {
      const res = await api.put(`/api/dispositivos/${payload.id}/`, payload.data);
      return res.data;
    },
    onSuccess: () => onSuccess(),
  });

  const createDispositivo = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/api/dispositivos/`, data);
      return res.data;
    },
    onSuccess: () => onSuccess(),
  });

  // ====== SUBMIT ======
  const handleSubmit = async (continuar = false) => {
    const data = {
      modelo: typeof modelo === "number" ? modelo : undefined,
      capacidad: capacidad === "" ? undefined : Number(capacidad),
      estado_fisico: estadoFisico || undefined,
      estado_funcional: estadoFuncional || undefined,
      estado_valoracion: estadoValoracion,
      tipo: "iPhone",
      precio_orientativo: precioOrientativo,
    };

    try {
      if (item?.id) {
        await updateDispositivo.mutateAsync({ id: item.id, data });
        return; // onSuccess se dispara en onSuccess del mutation
      }

      const n = Math.max(1, Math.floor(Number.isFinite(cantidad) ? cantidad : 1));
      const ops = Array.from({ length: n }, () => createDispositivo.mutateAsync(data));
      await Promise.all(ops);

      if (continuar) {
        setModelo("");
        setCapacidad("");
        setEstadoFisico("");
        setEstadoFuncional("");
        setCantidad(1);
      } else {
        onSuccess();
      }
    } catch (err) {
      console.error("Error al guardar:", err);
      alert("Ocurrió un error al guardar el dispositivo.");
    }
  };

  return (
    <>
      <DialogTitle>{item ? "Editar valoración" : "Nueva valoración"}</DialogTitle>

      <DialogContent>
        {/* Modelo */}
        <FormControl fullWidth sx={{ mt: 2 }}>
          <Autocomplete
            options={modelos}
            getOptionLabel={(option: Modelo) => option.descripcion}
            loading={modelosQ.isLoading}
            value={modelos.find((m) => m.id === modelo) || null}
            onChange={(_, newValue: Modelo | null) => setModelo(newValue ? newValue.id : "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Buscar modelo"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {modelosQ.isLoading ? <CircularProgress size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
        </FormControl>

        {/* Capacidad */}
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="capacidad-label">Capacidad</InputLabel>
          <Select<string>
            labelId="capacidad-label"
            label="Capacidad"
            value={capacidad}
            onChange={(e) => setCapacidad(e.target.value)} // string
            displayEmpty
          >
            <MenuItem value="">
              <em>Sin capacidad</em>
            </MenuItem>
            {capacidades.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>
                {c.tamaño}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Cantidad (solo al crear) */}
        {!item && (
          <TextField
            label="Cantidad"
            type="number"
            fullWidth
            sx={{ mt: 2 }}
            value={cantidad}
            inputProps={{ min: 1 }}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCantidad(Number.isFinite(n) ? n : 1);
            }}
          />
        )}

        {/* Estado estético */}
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="estado-fisico-label">Estado estético</InputLabel>
          <Select<string>
            labelId="estado-fisico-label"
            label="Estado estético"
            value={estadoFisico}
            onChange={(e) => setEstadoFisico(e.target.value)}
          >
            {estadosFisicos.map((e) => (
              <MenuItem key={e.value} value={e.value}>
                {e.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Estado funcional */}
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="estado-funcional-label">Estado funcional</InputLabel>
          <Select<string>
            labelId="estado-funcional-label"
            label="Estado funcional"
            value={estadoFuncional}
            onChange={(e) => setEstadoFuncional(e.target.value)}
          >
            {estadosFuncionales.map((e) => (
              <MenuItem key={e.value} value={e.value}>
                {e.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Estado de valoración (solo lectura, formateado) */}
        <TextField
          fullWidth
          sx={{ mt: 2 }}
          label="Estado de valoración"
          value={estadoValoracion === "a_revision" ? "A revisión" : formatoBonito(estadoValoracion) || "—"}
          InputProps={{ readOnly: true }}
        />

        {/* Precio orientativo */}
        <Typography sx={{ mt: 2 }}>
          Precio orientativo:{" "}
          <b>
            {estadoValoracion === "a_revision"
              ? "Se valorará tras revisión técnica"
              : typeof precioBase === "number"
              ? `${precioOrientativo} €`
              : "-"}
          </b>
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        {!item && (
          <Button variant="outlined" onClick={() => handleSubmit(true)} disabled={createDispositivo.isPending}>
            {createDispositivo.isPending ? "Guardando…" : "Guardar y añadir otro"}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => handleSubmit(false)}
          disabled={createDispositivo.isPending || updateDispositivo.isPending}
        >
          {createDispositivo.isPending || updateDispositivo.isPending ? "Guardando…" : "Guardar"}
        </Button>
      </DialogActions>
    </>
  );
}
