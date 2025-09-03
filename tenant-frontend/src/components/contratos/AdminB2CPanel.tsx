"use client";

import React from "react";
import {
  Box, Button, Card, CardActions, CardContent, CardHeader, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl,
  FormControlLabel, FormGroup, InputAdornment, InputLabel, MenuItem, OutlinedInput,
  Select, Snackbar, Stack, TextField, Typography, Alert,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ErrorOutline from "@mui/icons-material/ErrorOutline";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import Gavel from "@mui/icons-material/Gavel";
import PictureAsPdf from "@mui/icons-material/PictureAsPdf";
import AssignmentTurnedIn from "@mui/icons-material/AssignmentTurnedIn";
import Refresh from "@mui/icons-material/Refresh";
import Search from "@mui/icons-material/Search";
import api from "@/services/api";

// --- Types ---
interface ContratoDetalle {
  id: number | string;
  tipo: string;
  estado: string;
  kyc_estado: string;
  email: string | null;
  dni: string | null;
  pdf_url?: string | null;
  pdf_sha256?: string | null;
  firmado_en?: string | null;
  dni_anverso?: string | null;
  dni_reverso?: string | null;
  contrato_datos?: any;
  tenant_slug?: string;
  oportunidad_id?: string;
  nombre?: string;
}

function unwrapContrato(res: any) {
  return res?.json?.data ?? res?.data?.data ?? res?.data ?? res;
}

// --- Hooks ---
function useDetalle({ token, tenant_slug, contrato_id }: { token?: string; tenant_slug?: string; contrato_id?: string | number }) {
  return useQuery<ContratoDetalle>({
    queryKey: ["admin-detalle", { token, tenant_slug, contrato_id }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (token) params.set("token", token);
      if (tenant_slug) params.set("tenant_slug", String(tenant_slug));
      if (contrato_id) params.set("contrato_id", String(contrato_id));
      const res = await api.get(`/api/contratos-b2c/detalle?${params.toString()}`);
      return unwrapContrato(res);
    },
    enabled: Boolean(token || (tenant_slug && contrato_id)),
  });
}

function useDetallePorOpp({ tenant_slug, opp }: { tenant_slug?: string; opp?: string }) {
  return useQuery<ContratoDetalle>({
    queryKey: ["admin-detalle-opp", { tenant_slug, opp }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenant_slug) params.set("tenant_slug", tenant_slug);
      if (opp) params.set("opp", opp);
      const res = await api.get(`/api/contratos-b2c/detalle-por-opp?${params.toString()}`);
      return unwrapContrato(res);
    },
    enabled: Boolean(tenant_slug && opp),
  });
}

// 🔹 NUEVO: lista completa por opp (all=1)
function useContratosPorOpp({ tenant_slug, opp }: { tenant_slug?: string; opp?: string }) {
  return useQuery<ContratoDetalle[]>({
    queryKey: ["admin-contratos-opp", { tenant_slug, opp }],
    enabled: Boolean(tenant_slug && opp),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenant_slug) params.set("tenant_slug", tenant_slug);
      if (opp) params.set("opp", opp);
      params.set("all", "1");
      const res = await api.get(`/api/contratos-b2c/detalle-por-opp?${params.toString()}`);
      const data = unwrapContrato(res);
      // el endpoint puede devolver { count, results } o directamente array
      const list = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : (data ? [data] : []));
      // Orden opcional: marco primero
      list.sort((a: any, b: any) => (a?.tipo === "marco" ? -1 : 1) - (b?.tipo === "marco" ? -1 : 1));
      return list;
    },
  });
}

function useKYCActions() {
  const qc = useQueryClient();
  const call = (path: string, payload: any) => api.post(`/api/contratos-b2c/${path}`, payload);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-detalle"] });
    qc.invalidateQueries({ queryKey: ["admin-detalle-opp"] });
    qc.invalidateQueries({ queryKey: ["admin-detalle-opp-list"] });
    qc.invalidateQueries({ queryKey: ["admin-contratos-opp"] })// ← refrescar lista
  };
  return {
    verificar: useMutation({
      mutationFn: (payload: any) => call("kyc/verificar/", payload),
      onSuccess: invalidate,
      meta: { successMessage: "KYC verificado" },
    }),
    mismatch: useMutation({
      mutationFn: (payload: any) => call("kyc/mismatch/", payload),
      onSuccess: invalidate,
      meta: { successMessage: "Marcado como mismatch" },
    }),
    rechazar: useMutation({
      mutationFn: (payload: any) => call("kyc/rechazar/", payload),
      onSuccess: invalidate,
      meta: { successMessage: "KYC rechazado" },
    }),
    generarActa: useMutation({
      mutationFn: (payload: any) => call("acta/generar-por-opp/", payload),
      onSuccess: invalidate,
      meta: { successMessage: "Acta generada" },
    }),
  };
}

// --- UI helpers ---
function EstadoChip({ estado }: { estado: string }) {
  const map: Record<string, { label: string; color: any }> = {
    pendiente: { label: "Pendiente", color: "default" },
    otp_enviado: { label: "OTP enviado", color: "warning" },
    firmado: { label: "Firmado", color: "success" },
  };
  const v = map[estado] || { label: estado, color: "default" };
  return <Chip size="small" label={v.label} color={v.color as any} />;
}
function KycChip({ kyc }: { kyc: string }) {
  const map: Record<string, { label: string; color: any }> = {
    pendiente: { label: "KYC pendiente", color: "default" },
    docs_recibidos: { label: "Docs recibidos", color: "info" },
    verificado: { label: "KYC verificado", color: "success" },
    mismatch: { label: "Mismatch", color: "warning" },
    rechazado: { label: "Rechazado", color: "error" },
  };
  const v = map[kyc] || { label: kyc, color: "default" };
  return <Chip size="small" label={v.label} color={v.color as any} />;
}

// --- Acta dialog ---
function ActaDialog({
  open, onClose, token, tenant_slug, contrato_id, opp,
}: { open: boolean; onClose: () => void; token?: string; tenant_slug?: string; contrato_id?: string | number; opp?: string; }) {
  const { generarActa } = useKYCActions();
  const [obs, setObs] = React.useState("");
  const [filtroEstado, setFiltroEstado] = React.useState<string[]>(["revisado", "aprobado"]);
  const [firmarAhora, setFirmarAhora] = React.useState(true);

  const submit = () => {
    const payload: any = { observaciones: obs, firmar_ahora: firmarAhora, filtros: { estado_inventario: filtroEstado } };
    if (token) payload.token = token;
    else if (opp) { payload.tenant_slug = tenant_slug; payload.opp = opp; }
    else { payload.tenant_slug = tenant_slug; payload.contrato_id = contrato_id; }
    generarActa.mutate(payload, { onSuccess: () => onClose() });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Generar acta desde inventario</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Observaciones" value={obs} onChange={(e) => setObs(e.target.value)} multiline minRows={2} />
          <FormControl fullWidth>
            <InputLabel>Estados del inventario</InputLabel>
            <Select multiple value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as string[])} input={<OutlinedInput label="Estados del inventario" />}
              renderValue={(sel) => (sel as string[]).join(", ")}
            >
              {["revisado","aprobado","recepcionado","listo"].map(s => (
                <MenuItem key={s} value={s}>
                  <FormControlLabel control={<Chip size="small" label={s} />} label="" />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormGroup>
            <FormControlLabel control={<input type="checkbox" checked={firmarAhora} onChange={(e) => setFirmarAhora(e.currentTarget.checked)} /> as any} label="Dejar acta lista para firma por OTP" />
          </FormGroup>
          {generarActa.isError && <Alert severity="error">{String(generarActa.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" startIcon={<AssignmentTurnedIn />} onClick={submit} disabled={generarActa.isPending}>
          {generarActa.isPending ? "Generando…" : "Generar acta"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// --- Main ---
export default function AdminB2CPanel({
  tenant, oportunidadId,
}: { tenant?: string; oportunidadId?: string }) {
  const [initialQS] = React.useState(() => {
    const qs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return {
      qsTenant: qs.get("tenant_slug") || "",
      qsOpp: qs.get("opp") || "",
      qsHash: typeof window !== "undefined" ? window.location.hash : "",
    };
  });
  const [tenantSlug, setTenantSlug] = React.useState(tenant || initialQS.qsTenant);
  const [opp, setOpp] = React.useState(oportunidadId || initialQS.qsOpp);

  const bloqueadoPorRuta = Boolean(tenant || oportunidadId);

  const [token, setToken] = React.useState("");
  const [contratoId, setContratoId] = React.useState("");
  const [showActa, setShowActa] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const usandoOpp = Boolean(tenantSlug && opp);

  // Single (por token / tenant+id)
  const qDetalle = useDetalle({
    token: !usandoOpp ? (token || undefined) : undefined,
    tenant_slug: !usandoOpp ? (tenantSlug || undefined) : undefined,
    contrato_id: !usandoOpp ? (contratoId || undefined) : undefined,
  });

  // Single (por opp) - legacy
  const qDetalleOpp = useDetallePorOpp({
    tenant_slug: usandoOpp ? tenantSlug : undefined,
    opp: usandoOpp ? opp : undefined,
  });

  // 🔹 NUEVO: lista completa por opp
  const qListaOpp = useContratosPorOpp({
    tenant_slug: usandoOpp ? tenantSlug : undefined,
    opp: usandoOpp ? opp : undefined,
  });

  // Derivados para render:
  const lista = usandoOpp ? (qListaOpp.data || []) : [];
  const data = usandoOpp ? qDetalleOpp.data : qDetalle.data;

  const isLoading = usandoOpp ? (qListaOpp.isLoading || qDetalleOpp.isLoading) : qDetalle.isLoading;
  const isError = usandoOpp ? (qListaOpp.isError || qDetalleOpp.isError) : qDetalle.isError;
  const error: any = usandoOpp ? (qListaOpp.error || qDetalleOpp.error) : qDetalle.error;
  const refetch = usandoOpp ? async () => { await qListaOpp.refetch(); await qDetalleOpp.refetch(); } : qDetalle.refetch;

  const { verificar, mismatch, rechazar } = useKYCActions();

  const payloadBase = React.useMemo(
    () =>
      usandoOpp
        ? { tenant_slug: tenantSlug, opp: opp }
        : token
        ? { token }
        : { tenant_slug: tenantSlug, contrato_id: contratoId },
    [usandoOpp, tenantSlug, contratoId, token, opp]
  );

  async function abrirPdfBlob(id: string | number | undefined, tenantSlug: string, tipo: string) {
    if (!id) return;
    const res = await api.get(
      `/api/contratos-b2c/${id}/pdf-blob/?tenant_slug=${encodeURIComponent(tenantSlug)}`,
      { responseType: "blob" }
    );
    const url = URL.createObjectURL(res.data);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  React.useEffect(() => {
    if (initialQS.qsHash === "#acta" && (lista.length || data)) {
      setShowActa(true);
    }
  }, [initialQS.qsHash, lista.length, data]);

  // --- Render helpers ---
  const CardContrato = (ctr: ContratoDetalle) => (
    <Card key={ctr.id} variant="outlined" sx={{ mb: 2 }}>
      <CardHeader
        title={`Contrato #${ctr.id}`}
        subheader={
          <Stack direction="row" spacing={1} alignItems="center">
            <EstadoChip estado={ctr.estado} />
            {ctr.tipo === "marco" && <KycChip kyc={ctr.kyc_estado} />}
            <Chip size="small" label={ctr?.tipo ? String(ctr.tipo).toUpperCase() : "—"} />
            {ctr.oportunidad_id && <Chip size="small" label={`OPP: ${String(ctr.oportunidad_id).slice(0, 8)}…`} />}
          </Stack>
        }
      />
      <Divider />
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Cliente</Typography>
            <Typography variant="body2">Nombre: <b>{ctr.contrato_datos?.cliente.nombre || "-"}</b></Typography>
            <Typography variant="body2">DNI: <b>{ctr.dni || "-"}</b></Typography>
            <Typography variant="body2">Email: <b>{ctr.email || "-"}</b></Typography>
            {ctr.firmado_en && (
              <Typography variant="body2">Firmado en: <b>{new Date(ctr.firmado_en).toLocaleString()}</b></Typography>
            )}
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PictureAsPdf />}
                onClick={() => abrirPdfBlob(ctr.id, tenantSlug, ctr.tipo)}
              >
                Abrir PDF
              </Button>
              {ctr.pdf_sha256 && (
                <Typography variant="caption" sx={{ display: "block", mt: 1, wordBreak: "break-all" }}>
                  SHA-256: {ctr.pdf_sha256}
                </Typography>
              )}
            </Box>
            {ctr.tipo === "marco" && 
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2">DNI</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {ctr.dni_anverso ? (
                  <img src={ctr.dni_anverso} alt="DNI anverso" style={{ width: 220, height: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }} />
                ) : <Chip label="Sin anverso" size="small" />}
                {ctr.dni_reverso ? (
                  <img src={ctr.dni_reverso} alt="DNI reverso" style={{ width: 220, height: 140, objectFit: "cover", borderRadius: 8, border: "1px solid #eee" }} />
                ) : <Chip label="Sin reverso" size="small" />}
              </Stack>
            </Box>}
          </Box>

          <Box sx={{ flex: 1 }}>
            
              {ctr.kyc_estado === "docs_recibidos" && (
            <Box>
            <Typography variant="subtitle2" gutterBottom>Acciones KYC</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button size="small" variant="contained" color="success" startIcon={<VerifiedUser />} onClick={() => verificar.mutate(payloadBase)} disabled={verificar.isPending}>
                {verificar.isPending ? "Marcando…" : "Marcar verificado"}
              </Button>
              <Button size="small" variant="outlined" color="warning" startIcon={<ErrorOutline />} onClick={() => {
                const motivo = prompt("Motivo de mismatch?") || "Discrepancia en DNI";
                mismatch.mutate({ ...payloadBase, motivo });
              }} disabled={mismatch.isPending}>Mismatch</Button>
              <Button size="small" variant="outlined" color="error" startIcon={<Gavel />} onClick={() => {
                const motivo = prompt("Motivo de rechazo?") || "KYC rechazado";
                rechazar.mutate({ ...payloadBase, motivo });
              }} disabled={rechazar.isPending}>Rechazar</Button>
            </Stack>
            
            <Divider sx={{ my: 2 }} /></Box>)}

            {(ctr?.contrato_datos?.dispositivos?.length || ctr?.contrato_datos?.dispositivos_estimados?.length) && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Resumen (plantilla acta)</Typography>
                <ul style={{ marginTop: 6 }}>
                  {(ctr.contrato_datos.dispositivos ?? ctr.contrato_datos.dispositivos_estimados)
                    .slice(0, 6)
                    .map((d: any, i: number) => {
                      const desc = d.descripcion ?? d.modelo ?? "Dispositivo";
                      const precio = (d.precio ?? d.precio_provisional ?? 0);
                      const accesorios = d.accesorios?.map((a: any) => a?.nombre).filter(Boolean);
                      return (
                        <li key={i}>
                          <Typography variant="body2">
                            {desc} — <b>{Number(precio).toFixed(2)}€</b>
                          </Typography>
                          {accesorios?.length ? (
                            <Typography variant="caption" color="text.secondary">
                              Accesorios: {accesorios.join(", ")}
                            </Typography>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
      <CardActions sx={{ justifyContent: "flex-end" }}>
        <Button variant="text" onClick={() => refetch()} startIcon={<Refresh />}>Refrescar</Button>
        {ctr.tipo === "marco" && ctr.estado === "firmado" && (
    <Button
      variant="contained"
      startIcon={<AssignmentTurnedIn />}
      onClick={() => setShowActa(true)}
    >
      Generar acta
    </Button>
  )}
      </CardActions>
    </Card>
  );

  return (
    <Box sx={{ p: 2, maxWidth: 1100, mx: "auto" }}>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardHeader title="Buscar contrato" subheader="Usa opp + tenant o token/ID" />
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
            <TextField
              size="small"
              label="Token (UUID)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
              sx={{ minWidth: 280 }}
              disabled={usandoOpp}
            />
            <TextField size="small" label="Tenant slug" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} disabled={bloqueadoPorRuta} />
            <TextField size="small" label="Oportunidad (UUID)" value={opp} onChange={(e) => setOpp(e.target.value)} disabled={bloqueadoPorRuta} />
            <TextField size="small" label="Contrato ID" value={contratoId} onChange={(e) => setContratoId(e.target.value)} disabled={usandoOpp} />
            <Button variant="outlined" startIcon={<Refresh />} onClick={() => refetch()} disabled={!(usandoOpp || token || (tenantSlug && contratoId))}>
              Cargar
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {isLoading && (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          No se pudo cargar el contrato: {String(error)}
        </Alert>
      )}

      {/* 🔹 Render lista si hay resultados (por opp) */}
      {lista.length > 0 && lista.map(ctr => <React.Fragment key={String(ctr.id)}>{CardContrato(ctr)}</React.Fragment>)}

      {/* Fallback: vista single (token / tenant+id, o si la API de opp no devolvió lista) */}
      {!lista.length && data && CardContrato(data)}

      <ActaDialog
        open={showActa}
        onClose={() => setShowActa(false)}
        token={!usandoOpp ? (token || undefined) : undefined}
        tenant_slug={usandoOpp ? tenantSlug : undefined}
        contrato_id={!usandoOpp ? contratoId : undefined}
        opp={usandoOpp ? opp : undefined}
      />

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        <Alert severity="success" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
