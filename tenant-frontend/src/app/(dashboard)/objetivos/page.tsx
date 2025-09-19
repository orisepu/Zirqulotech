"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  TextField,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  LinearProgress,
  Chip,
} from "@mui/material";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import api, {
  type ObjetivoResumenItem,
  type PeriodoTipo,
  type ObjetivoScope,
} from "@/services/api";

function getDefaultQuarter() {
  const now = dayjs();
  const month = now.month(); // 0-index
  return Math.floor(month / 3) + 1;
}

function formatEuro(value: number) {
  return (
    value.toLocaleString("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

type RowState = ObjetivoResumenItem & {
  valorInput: string;
  operacionesInput: string;
  dirty: boolean;
};

export default function ObjetivosPage() {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<ObjetivoScope>("tienda");
  const [periodType, setPeriodType] = useState<PeriodoTipo>("mes");
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().format("YYYY-MM"));
  const [selectedYear, setSelectedYear] = useState(() => dayjs().year());
  const [selectedQuarter, setSelectedQuarter] = useState(() => getDefaultQuarter());

  const periodValue = useMemo(() => {
    if (periodType === "mes") return selectedMonth;
    return `${selectedYear}-Q${selectedQuarter}`;
  }, [periodType, selectedMonth, selectedYear, selectedQuarter]);

  const { data, isFetching } = useQuery<ObjetivoResumenItem[]>({
    queryKey: ["objetivos-resumen", scope, periodType, periodValue],
    queryFn: async () => {
      const response = await api.get<ObjetivoResumenItem[]>("/api/objetivos/resumen/", {
        params: {
          scope,
          periodo_tipo: periodType,
          periodo: periodValue,
        },
      });
      return response.data;
    },
    enabled: Boolean(periodValue),
  });

  const [rows, setRows] = useState<RowState[]>([]);

  useEffect(() => {
    if (!data) {
      setRows([]);
      return;
    }
    setRows(
      data.map((item) => ({
        ...item,
        valorInput:
          item.objetivo_valor !== null && item.objetivo_valor !== undefined
            ? String(item.objetivo_valor)
            : "",
        operacionesInput:
          item.objetivo_operaciones !== null && item.objetivo_operaciones !== undefined
            ? String(item.objetivo_operaciones)
            : "",
        dirty: false,
      }))
    );
  }, [data]);

  type SavePayload = {
    tipo: ObjetivoScope;
    periodo_tipo: PeriodoTipo;
    periodo_input: string;
    objetivo_valor: number;
    objetivo_operaciones: number;
    tienda_id?: number;
    usuario_id?: number;
  };

  const mutation = useMutation({
    mutationFn: async (payload: SavePayload) => {
      await api.post("/api/objetivos/", payload);
    },
    onSuccess: () => {
      toast.success("Objetivo guardado");
      queryClient.invalidateQueries({
        queryKey: ["objetivos-resumen", scope, periodType, periodValue],
      });
    },
    onError: () => {
      toast.error("No se pudo guardar el objetivo");
    },
  });

  const handleSave = (row: RowState) => {
    const valor = Number(row.valorInput || 0);
    const operaciones = Number(row.operacionesInput || 0);

    if (Number.isNaN(valor) || Number.isNaN(operaciones)) {
      toast.error("Revisa los valores introducidos");
      return;
    }

    mutation.mutate({
      tipo: scope,
      periodo_tipo: periodType,
      periodo_input: periodValue,
      objetivo_valor: valor,
      objetivo_operaciones: operaciones,
      ...(scope === "tienda"
        ? { tienda_id: row.target_id }
        : { usuario_id: row.target_id }),
    });
  };

  const handleInputChange = (
    targetId: number,
    key: "valorInput" | "operacionesInput",
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.target_id === targetId
          ? { ...row, [key]: value, dirty: true }
          : row
      )
    );
  };

  const periodSelector = (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      alignItems="center"
    >
      <TextField
        select
        label="Tipo de periodo"
        size="small"
        value={periodType}
        onChange={(event) => {
          const next = event.target.value as PeriodoTipo;
          setPeriodType(next);
          if (next === "mes" && !selectedMonth) {
            setSelectedMonth(dayjs().format("YYYY-MM"));
          }
        }}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="mes">Mensual</MenuItem>
        <MenuItem value="trimestre">Trimestral</MenuItem>
      </TextField>

      {periodType === "mes" ? (
        <TextField
          label="Mes"
          type="month"
          size="small"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      ) : (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Año"
            type="number"
            size="small"
            value={selectedYear}
            onChange={(event) => {
              const nextYear = Number(event.target.value);
              if (!Number.isNaN(nextYear)) setSelectedYear(nextYear);
            }}
            sx={{ width: 120 }}
          />
          <TextField
            select
            label="Trimestre"
            size="small"
            value={selectedQuarter}
            onChange={(event) => setSelectedQuarter(Number(event.target.value))}
            sx={{ width: 140 }}
          >
            <MenuItem value={1}>Q1</MenuItem>
            <MenuItem value={2}>Q2</MenuItem>
            <MenuItem value={3}>Q3</MenuItem>
            <MenuItem value={4}>Q4</MenuItem>
          </TextField>
        </Stack>
      )}
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, display: "grid", gap: 2 }}>
      <Typography variant="h4">Objetivos</Typography>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={scope}
          onChange={(_, next) => next && setScope(next)}
        >
          <ToggleButton value="tienda">Por tienda</ToggleButton>
          <ToggleButton value="usuario">Por usuario</ToggleButton>
        </ToggleButtonGroup>

        {periodSelector}
      </Stack>

      <Paper sx={{ position: "relative", overflow: "hidden" }}>
        {isFetching && (
          <LinearProgress sx={{ position: "absolute", inset: 0, borderRadius: 1 }} />
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{scope === "tienda" ? "Tienda" : "Usuario"}</TableCell>
                <TableCell align="right">Objetivo €</TableCell>
                <TableCell align="right">Objetivo operaciones</TableCell>
                <TableCell align="right">Progreso €</TableCell>
                <TableCell align="right">Progreso operaciones</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && !isFetching ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No hay registros para el periodo seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const valorObjetivo = Number(row.valorInput || 0);
                  const valorPercent =
                    valorObjetivo > 0
                      ? Math.min(100, (row.progreso_valor / valorObjetivo) * 100)
                      : null;
                  const opsObjetivo = Number(row.operacionesInput || 0);
                  const opsPercent =
                    opsObjetivo > 0
                      ? Math.min(
                          100,
                          (row.progreso_operaciones / opsObjetivo) * 100
                        )
                      : null;

                  return (
                    <TableRow key={row.target_id} hover>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="subtitle2">{row.target_name}</Typography>
                          {row.email && (
                            <Typography variant="body2" color="text.secondary">
                              {row.email}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: "100" }}
                          value={row.valorInput}
                          onChange={(event) =>
                            handleInputChange(
                              row.target_id,
                              "valorInput",
                              event.target.value
                            )
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          inputProps={{ min: 0, step: "1" }}
                          value={row.operacionesInput}
                          onChange={(event) =>
                            handleInputChange(
                              row.target_id,
                              "operacionesInput",
                              event.target.value
                            )
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack spacing={0.5} alignItems="flex-end">
                          <Typography variant="body2">
                            {formatEuro(row.progreso_valor)}
                          </Typography>
                          {valorPercent !== null && (
                            <Chip
                              size="small"
                              color={valorPercent >= 100 ? "success" : "default"}
                              label={`${valorPercent.toFixed(0)}%`}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack spacing={0.5} alignItems="flex-end">
                          <Typography variant="body2">
                            {row.progreso_operaciones}
                          </Typography>
                          {opsPercent !== null && (
                            <Chip
                              size="small"
                              color={opsPercent >= 100 ? "success" : "default"}
                              label={`${opsPercent.toFixed(0)}%`}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleSave(row)}
                          disabled={mutation.isPending || !row.dirty}
                        >
                          Guardar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
