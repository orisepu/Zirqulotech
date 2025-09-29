"use client";

import { useMemo, useState, type MouseEvent } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Popover,
  TextField,
  Button,
  Grid,InputAdornment,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import TablaReactiva from "@/shared/components/TablaReactiva2";
import { columnasOperaciones } from "@/shared/components/TablaColumnas2";
import { ESTADOS_B2B, ESTADOS_OPERACIONEPARTNER } from "@/context/estados";
import api from "@/services/api";
import { getIdlink } from "@/shared/utils/id";

const ESTADOS_OPERACIONES_DEFAULT = ESTADOS_OPERACIONEPARTNER;

export default function OperacionesTenantPage() {
  const router = useRouter();
  const columnas = columnasOperaciones;

  const estadosOperacionesSet = useMemo(
    () => new Set(ESTADOS_OPERACIONES_DEFAULT.map((estado) => estado.toLowerCase())),
    []
  );

  const [cliente, setCliente] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [estado, setEstado] = useState<string[]>(() => [...ESTADOS_OPERACIONES_DEFAULT]);

  const [estadoAnchorEl, setEstadoAnchorEl] = useState<null | HTMLElement>(null);
  const estadoPopoverOpen = Boolean(estadoAnchorEl);
  const handleOpenPopover = (event: MouseEvent<HTMLElement>) => {
    setEstadoAnchorEl(event.currentTarget);
  };
  const handleClosePopover = () => setEstadoAnchorEl(null);

  const queryKey = [
    "operaciones-tenant",
    { cliente, fechaInicio, fechaFin, estado: estado.slice().sort().join(",") },
  ];

  const { data: operaciones = [], isLoading, refetch } = useQuery<any[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (cliente) params.append("cliente", cliente);
      if (fechaInicio) params.append("fecha_inicio", fechaInicio);
      if (fechaFin) params.append("fecha_fin", fechaFin);

      const estadosParaFiltrar = (estado.length > 0 ? estado : ESTADOS_OPERACIONES_DEFAULT)
        .map((e) => e.trim())
        .filter(Boolean);
      const unicos = Array.from(new Set(estadosParaFiltrar));
      unicos.forEach((e) => params.append("estado", e));

      const res = await api.get(`/api/oportunidades/?${params.toString()}`);
      const lista = Array.isArray(res.data) ? res.data : [];
      return lista.filter((o) =>
        estadosOperacionesSet.has(String(o.estado || "").toLowerCase())
      );
    },
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev ?? [],
  });

  const handleBuscar = () => refetch();
  const handleReset = () => {
    setEstado([...ESTADOS_OPERACIONES_DEFAULT]);
    setCliente("");
    setFechaInicio("");
    setFechaFin("");
    refetch();
  };
  const CONTROL_H = (theme: any) => theme.spacing(6.2);
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Operaciones
      </Typography>
      
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            fullWidth
            size="medium"
            sx={{ '& .MuiInputBase-root': { height: CONTROL_H } }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            label="Estados"
            value={estado.length ? `${estado.length} estado(s)` : ''}
            placeholder="Estados"
            onClick={handleOpenPopover}
            fullWidth
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <TuneIcon />
                </InputAdornment>
              ),
            }}
            sx={{
              cursor: 'pointer',
              '& .MuiInputBase-root': { height: CONTROL_H },
              '& .MuiInputBase-input': { cursor: 'pointer' },
            }}
            // accesibilidad: abre con Enter/Espacio
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleOpenPopover(e as any)
            }}
          />
          <Popover
            open={estadoPopoverOpen}
            anchorEl={estadoAnchorEl}
            onClose={handleClosePopover}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            PaperProps={{ sx: { p: 2, maxWidth: 420, width: "100%" } }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Filtrar por estado
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {ESTADOS_OPERACIONES_DEFAULT.map((estadoKey) => {
                const meta = ESTADOS_B2B[estadoKey] || { color: "default" };
                const Icono = meta.icon;
                const selected = estado.includes(estadoKey);
                return (
                  <Chip
                    key={estadoKey}
                    label={estadoKey}
                    size="small"
                    variant={selected ? 'filled' : 'outlined'}
                    color={meta.color}
                    icon={Icono ? <Icono fontSize="small" /> : undefined}
                    onClick={() => {
                      setEstado((prev) =>
                        selected
                          ? prev.filter((e) => e !== estadoKey)
                          : [...prev, estadoKey]
                      );
                    }}
                    sx={{
                      cursor: "pointer",}}
                  />
                );
              })}
            </Box>
            {estado.length !== ESTADOS_OPERACIONES_DEFAULT.length && (
              <Box mt={2} display="flex" justifyContent="flex-end">
                <Button size="small" onClick={() => setEstado([...ESTADOS_OPERACIONES_DEFAULT])}>
                  Mostrar todos
                </Button>
              </Box>
            )}
          </Popover>
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField
            label="Desde"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <TextField
            label="Hasta"
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 2 }}>
          <Button variant="contained" onClick={handleBuscar} sx={{ mr: 1 }}>
            Buscar
          </Button>
          <Button onClick={handleReset}>Reset</Button>
        </Grid>
      </Grid>

      {isLoading ? (
        <CircularProgress />
      ) : (
        <Paper>
          <TablaReactiva
            oportunidades={operaciones}
            columnas={columnas}
            loading={isLoading}
            defaultSorting={[{ id: "fecha_creacion", desc: true }]}
            onRowClick={(o: any) => router.push(`/clientes/oportunidades/${getIdlink(o)}`)}
          />
        </Paper>
      )}
    </Box>
  );
}
