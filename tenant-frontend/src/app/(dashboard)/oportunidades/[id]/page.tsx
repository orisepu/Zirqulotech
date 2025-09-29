"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/services/api";
import {
  Typography,
  Box,
  CircularProgress,
  Paper,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";
import { getId } from "@/shared/utils/id";

type Lote = {
  id: number | string;
  nombre?: string | null;
  estado?: string | null;
  global_id?: number | string | null;
  usuario?: { email?: string | null } | null;
  observaciones?: string | null;
};

type Dispositivo = {
  id: number | string;
  modelo?: { descripcion?: string | null } | null;
  imei?: string | null;
  // estados del cliente
  estado_fisico?: string | null;
  estado_funcional?: string | null;
  // auditoría real
  auditado?: boolean;
  estado_fisico_real?: string | null;
  estado_funcional_real?: string | null;
  comentarios_auditor?: string | null;
  precio_estimado?: number | null;
  imei_confirmado_valor?: string | null;
  // metadatos auditoría
  tecnico_nombre?: string | null;
  fecha?: string | null;
};

export default function LoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lote, setLote] = useState<Lote | null>(null);
  const [error, setError] = useState<string>('');
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [selected, setSelected] = useState<Dispositivo | null>(null);
  const [open, setOpen] = useState(false);
  const fmtFechaHora = (v?: string | null) => (v ? new Date(v).toLocaleString('es-ES') : '—');

  useEffect(() => {
    if (!id) return;

    const tenant = localStorage.getItem("currentTenant");
    const loteGlobalId = localStorage.getItem("loteGlobalId");
    const token = localStorage.getItem("access");

    const faltantes: string[] = [];
    if (!tenant) faltantes.push("tenant");
    if (!token) faltantes.push("token");
    if (faltantes.length > 0) {
      setError(`Faltan datos de contexto: ${faltantes.join(", ")}`);
      return;
    }

    // Cargar lote real desde el tenant
    api
      .get(`/api/lotes/${id}/`)
      .then((res) => {
        setLote(res.data);
      })
      .catch(() => {
        setError("No se pudo cargar el lote.");
      });

    if (!loteGlobalId) {
      setDispositivos([]);
      return;
    }

    // Cargar dispositivos desde el schema público
    api
      .get(`/api/lotes-globales/${loteGlobalId}/dispositivos/`, {
        headers: { "X-Tenant": "public" },
      })
      .then(async (res) => {
        const dispositivosBase = res.data;

        const auditorias = await Promise.all(
          dispositivosBase.map((d: Dispositivo) =>
            api
              .get(`/api/dispositivos-auditados/?dispositivo_id=${d.id}&lote=${id}`)
              .then((r) => ({
                dispositivo_id: d.id,
                auditoria: r.data?.[0] || null,
              }))
              .catch(() => ({ dispositivo_id: d.id, auditoria: null }))
          )
        );

        const dispositivosCompletos = dispositivosBase.map((d: Dispositivo) => {
          const auditoria = auditorias.find((a) => a.dispositivo_id === d.id)?.auditoria;
          return auditoria
            ? {
                ...d,
                ...auditoria,
                auditado: true,
                tecnico_nombre: auditoria.tecnico_nombre || "Desconocido",
                fecha: auditoria.fecha,
              }
            : { ...d, auditado: false };
        });

        setDispositivos(dispositivosCompletos);
      })
      .catch(() => {
        setDispositivos([]);
      });
  }, [id]);

  const handleOpenModal = (dispositivo: Dispositivo) => {
    setSelected(dispositivo);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelected(null);
  };

  const handleChange = <K extends keyof Dispositivo>(campo: K, valor: Dispositivo[K]) => {
    setSelected(prev => (prev ? { ...prev, [campo]: valor } : prev));
  };

  const guardarAuditoria = () => {
    const tenant = localStorage.getItem("currentTenant");
    
    if (!selected) return;
    api
      .post("/api/dispositivos-auditados/", {
        lote: lote?.global_id || lote?.id,
        dispositivo_id: selected.id,
        estado_fisico_cliente: selected.estado_fisico,
        estado_funcional_cliente: selected.estado_funcional,
        estado_fisico_real: selected.estado_fisico_real,
        estado_funcional_real: selected.estado_funcional_real,
        comentarios_auditor: selected.comentarios_auditor,
        precio_estimado: selected.precio_estimado ?? null,   // ya es number|null
        imei_confirmado: true,
        tenant_slug: tenant,
      })
      .then(() => { alert("Auditoría guardada"); handleClose();})
      .catch(() => {alert("Error al guardar auditoría"); });
  };

  if (error) return <Typography color="error">{error}</Typography>;
  if (!lote) return <CircularProgress sx={{ mt: 5, mx: "auto", display: "block" }} />;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Lote #{lote.id}: {lote.nombre || "Sin nombre"}
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Typography>Estado: {lote.estado}</Typography>
        <Typography>ID: {getId(lote)}</Typography>
        <Typography>Creado por: {lote.usuario?.email || "Desconocido"}</Typography>
        <Typography>Observaciones: {lote.observaciones || "Ninguna"}</Typography>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6">Dispositivos</Typography>

        {dispositivos.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Sin dispositivos registrados</Typography>
        ) : (
          dispositivos.map((d: Dispositivo) => (
            <Box key={String(d.id)} sx={{ mb: 2, p: 2, border: "1px solid #ccc", borderRadius: 2 }}>
              <Typography>Modelo: {d.modelo?.descripcion || "—"}</Typography>
              <Typography>IMEI reportado: {d.imei}</Typography>
              <Typography>Estado cliente: {d.estado_fisico} / {d.estado_funcional}</Typography>

              {d.auditado ? (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" color="success.main">✅ Auditado</Typography>
                  <Typography>
                    Estado real: {d.estado_fisico_real || "-"} / {d.estado_funcional_real || "-"}
                  </Typography>
                  <Typography>Comentario: {d.comentarios_auditor || "Sin comentarios"}</Typography>
                  <Typography>Precio estimado: {d.precio_estimado || "—"} €</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Técnico: {d.tecnico_nombre} | Fecha: {fmtFechaHora(d.fecha)}
                  </Typography>
                </>
              ) : (
                <Typography color="warning.main">🔍 Pendiente de auditar</Typography>
              )}

              <Button
                variant="outlined"
                sx={{ mt: 1 }}
                onClick={() => handleOpenModal(d)}
              >
                {d.auditado ? "Ver auditoría" : "Auditar"}
              </Button>
            </Box>
          ))
        )}
      </Paper>

      {/* Modal de auditoría */}
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
        <DialogTitle>Auditoría del dispositivo</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <>
              <TextField
                label="IMEI confirmado"
                fullWidth
                sx={{ mt: 2 }}
                value={selected.imei_confirmado_valor || selected.imei || ""}
                onChange={(e) => handleChange("imei", e.target.value)}
                disabled={selected?.auditado}
              />

              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Estado estético real</InputLabel>
                <Select
                  value={selected?.estado_fisico_real || ""}
                  label="Estado estético real"
                  onChange={(e) => handleChange("estado_fisico_real", e.target.value as string)}
                  disabled={selected?.auditado}
                >
                  <MenuItem value="perfecto">Perfecto</MenuItem>
                  <MenuItem value="bueno">Bueno</MenuItem>
                  <MenuItem value="regular">Regular</MenuItem>
                  <MenuItem value="dañado">Dañado</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Estado funcional real</InputLabel>
                <Select
                  value={selected?.estado_funcional_real || ""}
                  label="Estado funcional real"
                  onChange={(e) => handleChange("estado_funcional_real", e.target.value as string)}
                  disabled={selected?.auditado}
                >
                  <MenuItem value="funciona">Funciona correctamente</MenuItem>
                  <MenuItem value="pantalla_rota">Pantalla rota</MenuItem>
                  <MenuItem value="no_enciende">No enciende</MenuItem>
                  <MenuItem value="error_hardware">Error de hardware</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Comentario del auditor"
                fullWidth
                multiline
                rows={2}
                sx={{ mt: 2 }}
                value={selected.comentarios_auditor || ""}
                onChange={(e) => handleChange("comentarios_auditor", e.target.value)}
                disabled={selected.auditado}
              />

              <TextField
                label="Precio estimado (€)"
                type="number"
                fullWidth
                sx={{ mt: 2 }}
                value={selected?.precio_estimado || ""}
                onChange={(e) => handleChange("precio_estimado", e.target.value === '' ? null : Number(e.target.value))}
                disabled={selected?.auditado}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cerrar</Button>
          <Button
            onClick={guardarAuditoria}
            variant="contained"
            disabled={selected?.auditado}
          >
            Guardar auditoría
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
