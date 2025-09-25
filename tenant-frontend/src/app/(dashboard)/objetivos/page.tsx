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
  InputAdornment,
  FormHelperText,
} from "@mui/material";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import api, {
  guardarObjetivo,
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

type DistributionEntry = {
  month: string;
  label: string;
  percent: string;
};

type UserAllocation = {
  usuario_id: number;
  nombre: string;
  valorInput: string;
  operacionesInput: string;
  originalValor: string;
  originalOperaciones: string;
};

type RowState = ObjetivoResumenItem & {
  valorInput: string;
  operacionesInput: string;
  dirty: boolean;
  editing: boolean;
  originalValor: string;
  originalOperaciones: string;
  distribution?: DistributionEntry[];
  originalDistribution?: DistributionEntry[];
  storeId?: number;
  storeName?: string;
  userAllocations?: UserAllocation[];
  originalUserAllocations?: UserAllocation[];
  userAllocationManual?: boolean;
};

function getQuarterMonths(year: number, quarter: number): DistributionEntry[] {
  const startMonth = Math.max(0, (quarter - 1) * 3);
  return Array.from({ length: 3 }, (_, idx) => {
    const date = dayjs().year(year).month(startMonth + idx).startOf('month');
    return {
      month: date.format('YYYY-MM'),
      label: date.format('MMM YYYY'),
      percent: '0',
    };
  });
}

function createDefaultDistribution(year: number, quarter: number): DistributionEntry[] {
  const months = getQuarterMonths(year, quarter);
  if (!months.length) return [];
  const base = 100 / months.length;
  let remaining = 100;
  return months.map((entry, idx) => {
    const value = idx === months.length - 1 ? Number(remaining.toFixed(2)) : Number(base.toFixed(2));
    remaining -= value;
    return { ...entry, percent: value.toFixed(2) };
  });
}

function cloneDistribution(source?: DistributionEntry[]): DistributionEntry[] | undefined {
  return source ? source.map((item) => ({ ...item })) : undefined;
}

function cloneUserAllocations(source?: UserAllocation[]): UserAllocation[] | undefined {
  return source ? source.map((item) => ({ ...item })) : undefined;
}

function parsePercent(value: string): number {
  if (!value) return 0;
  const numeric = Number(value.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : NaN;
}

function distributeAmount(total: number, percentages: number[], decimals: number): number[] {
  if (!percentages.length || total === 0) {
    return Array(percentages.length).fill(0);
  }
  const factor = Math.pow(10, decimals);
  const raw = percentages.map((p) => (total * p) / 100);
  const scaled = raw.map((v) => Math.floor(v * factor + 1e-6));
  const targetSum = Math.round(total * factor);
  let currentSum = scaled.reduce((acc, val) => acc + val, 0);

  if (currentSum !== targetSum) {
    const remainder = targetSum - currentSum;
    const adjustments = raw
      .map((v, index) => ({ index, frac: v * factor - scaled[index] }))
      .sort((a, b) => b.frac - a.frac);

    const direction = remainder >= 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(remainder); i += 1) {
      const target = adjustments[i % adjustments.length]?.index ?? 0;
      scaled[target] += direction;
    }
  }

  return scaled.map((v) => v / factor);
}

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

  const isQuarter = periodType === "trimestre";

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

  const { data: tiendasExtra } = useQuery<ObjetivoResumenItem[]>({
    queryKey: ["objetivos-resumen", "tienda", periodType, periodValue],
    queryFn: async () => {
      const response = await api.get<ObjetivoResumenItem[]>("/api/objetivos/resumen/", {
        params: {
          scope: "tienda",
          periodo_tipo: periodType,
          periodo: periodValue,
        },
      });
      return response.data;
    },
    enabled: Boolean(periodValue) && scope !== "tienda",
    staleTime: 30_000,
  });

  const tiendasResumen = scope === "tienda" ? data : tiendasExtra;

  const userStoreMap = useMemo(() => {
    if (!tiendasResumen) return new Map<number, { storeId: number; storeName: string }>();
    const map = new Map<number, { storeId: number; storeName: string }>();
    for (const tienda of tiendasResumen) {
      const storeId = tienda.target_id;
      const storeName = tienda.target_name;
      tienda.usuarios?.forEach((usuario) => {
        map.set(usuario.usuario_id, { storeId, storeName });
      });
    }
    return map;
  }, [tiendasResumen]);

  const [rows, setRows] = useState<RowState[]>([]);

  useEffect(() => {
    if (!data) {
      setRows([]);
      return;
    }
    const defaultDistribution = isQuarter
      ? createDefaultDistribution(selectedYear, selectedQuarter)
      : undefined;

    const matchesCurrentQuarter = (entries?: DistributionEntry[]) => {
      if (!entries || !defaultDistribution) return false;
      const validMonths = new Set(defaultDistribution.map((entry) => entry.month));
      return entries.every((entry) => validMonths.has(entry.month));
    };

    setRows((prev) =>
      data.map((item) => {
        const prevRow = prev.find((row) => row.target_id === item.target_id);
        const valorBase =
          item.objetivo_valor !== null && item.objetivo_valor !== undefined
            ? String(item.objetivo_valor)
            : "";
        const operacionesBase =
          item.objetivo_operaciones !== null && item.objetivo_operaciones !== undefined
            ? String(item.objetivo_operaciones)
            : "";

        const previousDistribution = matchesCurrentQuarter(prevRow?.originalDistribution)
          ? prevRow?.originalDistribution
          : matchesCurrentQuarter(prevRow?.distribution)
            ? prevRow?.distribution
            : defaultDistribution;
        const distribution = isQuarter
          ? cloneDistribution(previousDistribution)
          : undefined;

        const storeInfo = userStoreMap.get(item.target_id);

        let userAllocations: UserAllocation[] | undefined;
        let originalUserAllocations: UserAllocation[] | undefined;
        if (item.tipo === "tienda" && Array.isArray(item.usuarios)) {
          const prevAllocMap = new Map(
            (prevRow?.userAllocations || []).map((alloc) => [alloc.usuario_id, alloc])
          );
          userAllocations = item.usuarios.map((usuario) => {
            const prevAlloc = prevAllocMap.get(usuario.usuario_id);
            const valor =
              usuario.objetivo_valor !== null && usuario.objetivo_valor !== undefined
                ? Number(usuario.objetivo_valor)
                : 0;
            const operaciones = usuario.objetivo_operaciones ?? 0;
            return {
              usuario_id: usuario.usuario_id,
              nombre: usuario.nombre,
              valorInput: prevRow?.editing
                ? prevAlloc?.valorInput ?? String(valor)
                : String(valor),
              operacionesInput: prevRow?.editing
                ? prevAlloc?.operacionesInput ?? String(operaciones)
                : String(operaciones),
              originalValor: String(valor),
              originalOperaciones: String(operaciones),
            };
          });
          originalUserAllocations = cloneUserAllocations(userAllocations);
        }

        return {
          ...item,
          valorInput: prevRow?.editing ? prevRow.valorInput : valorBase,
          operacionesInput: prevRow?.editing ? prevRow.operacionesInput : operacionesBase,
          dirty: false,
          editing: false,
          originalValor: valorBase,
          originalOperaciones: operacionesBase,
          distribution,
          originalDistribution: isQuarter
            ? cloneDistribution(previousDistribution)
            : undefined,
          storeId: storeInfo?.storeId,
          storeName: storeInfo?.storeName,
          userAllocations,
          originalUserAllocations,
          userAllocationManual: false,
        } as RowState;
      })
    );
  }, [data, isQuarter, selectedQuarter, selectedYear, userStoreMap]);

  type SaveBase = {
    tipo: ObjetivoScope;
    periodo_tipo: PeriodoTipo;
    periodo_input: string;
    objetivo_valor: number;
    objetivo_operaciones: number;
    tienda_id?: number;
    usuario_id?: number;
  };

  type MonthlyItem = {
    periodo_input: string;
    objetivo_valor: number;
    objetivo_operaciones: number;
  };

  const [savingTargetId, setSavingTargetId] = useState<number | null>(null);

  const saveObjective = async (base: SaveBase, monthly?: MonthlyItem[]) => {
    await guardarObjetivo(base);
    if (monthly?.length) {
      await Promise.all(
        monthly.map((item) =>
          guardarObjetivo({
            ...base,
            periodo_tipo: "mes",
            periodo_input: item.periodo_input,
            objetivo_valor: item.objetivo_valor,
            objetivo_operaciones: item.objetivo_operaciones,
          })
        )
      );
    }
  };

  const handleSave = async (row: RowState) => {
    const valor = Number(row.valorInput || 0);
    const operaciones = Number(row.operacionesInput || 0);

    if (Number.isNaN(valor) || Number.isNaN(operaciones)) {
      toast.error("Revisa los valores introducidos");
      return;
    }

    let monthly: MonthlyItem[] | undefined;
    if (isQuarter && row.distribution?.length) {
      const percentages = row.distribution.map((entry) => parsePercent(entry.percent));
      const invalidEntry = percentages.some((p) => Number.isNaN(p) || p < 0);
      const totalPercent = percentages.reduce((acc, value) => acc + (Number.isNaN(value) ? 0 : value), 0);
      if (invalidEntry || totalPercent <= 0) {
        toast.error("Introduce porcentajes válidos para los meses del trimestre");
        return;
      }
      if (Math.abs(totalPercent - 100) > 0.1) {
        toast.error("La suma de porcentajes debe ser 100%");
        return;
      }

      const normalized = percentages.map((p) => (p / totalPercent) * 100);
      const valorDistribuido = distributeAmount(valor, normalized, 2);
      const operacionesDistribuidas = distributeAmount(operaciones, normalized, 0);

      monthly = row.distribution.map((entry, index) => ({
        periodo_input: entry.month,
        objetivo_valor: Number(valorDistribuido[index].toFixed(2)),
        objetivo_operaciones: Math.round(operacionesDistribuidas[index]),
      }));
    }

    const basePayload: SaveBase = {
      tipo: row.tipo,
      periodo_tipo: periodType,
      periodo_input: periodValue,
      objetivo_valor: valor,
      objetivo_operaciones: operaciones,
      ...(row.tipo === "tienda"
        ? { tienda_id: row.target_id }
        : { usuario_id: row.target_id }),
    };

    setSavingTargetId(row.target_id);

    try {
      let finalValor = valor;
      let finalOperaciones = operaciones;

      if (row.tipo === "tienda" && row.userAllocations?.length) {
        const invalidAlloc = row.userAllocations.some((alloc) => {
          const val = Number(alloc.valorInput || 0);
          const ops = Number(alloc.operacionesInput || 0);
          return Number.isNaN(val) || Number.isNaN(ops) || val < 0 || ops < 0;
        });
        if (invalidAlloc) {
          toast.error("Revisa las asignaciones por usuario");
          setSavingTargetId(null);
          return;
        }
        const sumValor = row.userAllocations.reduce(
          (acc, alloc) => acc + Number(alloc.valorInput || 0),
          0
        );
        const sumOperaciones = row.userAllocations.reduce(
          (acc, alloc) => acc + Number(alloc.operacionesInput || 0),
          0
        );
        finalValor = sumValor;
        finalOperaciones = sumOperaciones;
      }

      await saveObjective(
        {
          ...basePayload,
          objetivo_valor: finalValor,
          objetivo_operaciones: finalOperaciones,
        },
        monthly
      );

      if (row.tipo === "tienda" && row.userAllocations?.length) {
        await Promise.all(
          row.userAllocations.map((alloc) =>
            saveObjective({
              tipo: "usuario",
              periodo_tipo: periodType,
              periodo_input: periodValue,
              objetivo_valor: Number(alloc.valorInput || 0),
              objetivo_operaciones: Number(alloc.operacionesInput || 0),
              usuario_id: alloc.usuario_id,
            })
          )
        );
      } else if (row.tipo === "usuario" && row.storeId) {
        const related = rows.filter((item) => item.storeId === row.storeId);
        if (related.length) {
          const totalValor = related.reduce(
            (acc, item) =>
              acc +
              Number(
                item.target_id === row.target_id ? valor : item.valorInput || 0
              ),
            0
          );
          const totalOperaciones = related.reduce(
            (acc, item) =>
              acc +
              Number(
                item.target_id === row.target_id
                  ? operaciones
                  : item.operacionesInput || 0
              ),
            0
          );
          await saveObjective({
            tipo: "tienda",
            periodo_tipo: periodType,
            periodo_input: periodValue,
            objetivo_valor: totalValor,
            objetivo_operaciones: totalOperaciones,
            tienda_id: row.storeId,
          });
        }
      }

      setRows((prev) =>
        prev.map((item) => {
          if (item.target_id !== row.target_id) return item;
          const updatedDistribution = cloneDistribution(row.distribution || item.distribution);
          let updatedUserAllocations = cloneUserAllocations(
            row.userAllocations || item.userAllocations
          );
          if (updatedUserAllocations) {
            updatedUserAllocations = updatedUserAllocations.map((alloc) => ({
              ...alloc,
              originalValor: alloc.valorInput,
              originalOperaciones: alloc.operacionesInput,
            }));
          }
          return {
            ...item,
            valorInput: String(row.tipo === "tienda" ? finalValor : valor),
            operacionesInput: String(row.tipo === "tienda" ? finalOperaciones : operaciones),
            originalValor: String(row.tipo === "tienda" ? finalValor : valor),
            originalOperaciones: String(row.tipo === "tienda" ? finalOperaciones : operaciones),
            originalDistribution: updatedDistribution,
            distribution: updatedDistribution,
            userAllocations: updatedUserAllocations,
            originalUserAllocations: cloneUserAllocations(updatedUserAllocations),
            userAllocationManual: false,
            dirty: false,
            editing: false,
          } as RowState;
        })
      );

      toast.success("Objetivo guardado");
      queryClient.invalidateQueries({ queryKey: ["objetivos-resumen"], exact: false });
    } catch (error) {
      toast.error("No se pudo guardar el objetivo");
    } finally {
      setSavingTargetId(null);
    }
  };

  const handleInputChange = (
    targetId: number,
    key: "valorInput" | "operacionesInput",
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.target_id === targetId && row.editing
          ? (() => {
              const next: RowState = { ...row, [key]: value, dirty: true };
              if (
                row.tipo === "tienda" &&
                row.userAllocations?.length &&
                !row.userAllocationManual
              ) {
                const count = row.userAllocations.length;
                const percentages = Array(count).fill(100 / count);
                if (key === "valorInput") {
                  const total = Number(value || 0);
                  const distrib = distributeAmount(total, percentages, 2);
                  next.userAllocations = row.userAllocations.map((alloc, index) => ({
                    ...alloc,
                    valorInput: distrib[index].toFixed(2),
                  }));
                } else {
                  const total = Number(value || 0);
                  const distrib = distributeAmount(total, percentages, 0);
                  next.userAllocations = row.userAllocations.map((alloc, index) => ({
                    ...alloc,
                    operacionesInput: String(Math.round(distrib[index])),
                  }));
                }
              }
              return next;
            })()
          : row
      )
    );
  };

  const handleDistributionChange = (targetId: number, month: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.target_id !== targetId || !row.editing || !row.distribution?.length) return row;
        return {
          ...row,
          distribution: row.distribution.map((entry) =>
            entry.month === month ? { ...entry, percent: value } : entry
          ),
          dirty: true,
        };
      })
    );
  };

  const handleAutoDistribute = (targetId: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.target_id !== targetId || !row.editing || !row.distribution?.length) return row;
        const template = createDefaultDistribution(selectedYear, selectedQuarter);
        const map = new Map(template.map((entry) => [entry.month, entry.percent]));
        return {
          ...row,
          distribution: row.distribution.map((entry) => ({
            ...entry,
            percent: map.get(entry.month) ?? entry.percent,
          })),
          dirty: true,
        };
      })
    );
  };

  const handleUserAllocationChange = (
    targetId: number,
    usuarioId: number,
    key: "valorInput" | "operacionesInput",
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.target_id !== targetId || !row.editing || !row.userAllocations?.length) {
          return row;
        }
        const nextAllocations = row.userAllocations.map((alloc) =>
          alloc.usuario_id === usuarioId ? { ...alloc, [key]: value } : alloc
        );
        const sumValor = nextAllocations.reduce(
          (acc, alloc) => acc + Number(alloc.valorInput || 0),
          0
        );
        const sumOperaciones = nextAllocations.reduce(
          (acc, alloc) => acc + Number(alloc.operacionesInput || 0),
          0
        );
        return {
          ...row,
          userAllocations: nextAllocations,
          valorInput: sumValor.toFixed(2),
          operacionesInput: String(Math.round(sumOperaciones)),
          dirty: true,
          userAllocationManual: true,
        };
      })
    );
  };

  const handleEqualUserDistribution = (targetId: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.target_id !== targetId || !row.editing || !row.userAllocations?.length) {
          return row;
        }
        const count = row.userAllocations.length;
        const percentages = Array(count).fill(100 / count);
        const totalValor = Number(row.valorInput || 0);
        const totalOperaciones = Number(row.operacionesInput || 0);
        const valorDistribuido = distributeAmount(totalValor, percentages, 2);
        const operacionesDistribuidas = distributeAmount(totalOperaciones, percentages, 0);
        const nextAllocations = row.userAllocations.map((alloc, index) => ({
          ...alloc,
          valorInput: valorDistribuido[index].toFixed(2),
          operacionesInput: String(Math.round(operacionesDistribuidas[index])),
        }));
        return {
          ...row,
          userAllocations: nextAllocations,
          valorInput: Number(totalValor).toFixed(2),
          operacionesInput: String(Math.round(totalOperaciones)),
          dirty: true,
          userAllocationManual: false,
        };
      })
    );
  };

  const handleEdit = (targetId: number) => {
    setRows((prev) =>
      prev.map((row) =>
        row.target_id === targetId
          ? {
              ...row,
              editing: true,
              userAllocationManual: false,
            }
          : row
      )
    );
  };

  const handleCancel = (targetId: number) => {
    setRows((prev) =>
      prev.map((row) =>
        row.target_id === targetId
          ? {
              ...row,
              valorInput: row.originalValor,
              operacionesInput: row.originalOperaciones,
              distribution: cloneDistribution(row.originalDistribution || row.distribution),
              userAllocations: cloneUserAllocations(row.originalUserAllocations || row.userAllocations),
              dirty: false,
              editing: false,
              userAllocationManual: false,
            }
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
                  const distributionPercentages = row.distribution?.map((entry) => parsePercent(entry.percent)) ?? [];
                  const hasInvalidPercent = distributionPercentages.some((value) => Number.isNaN(value) || value < 0);
                  const distributionSum = distributionPercentages.reduce(
                    (acc, value) => acc + (Number.isNaN(value) ? 0 : value),
                    0
                  );
                  const distributionError =
                    isQuarter && row.editing && row.distribution?.length
                      ? hasInvalidPercent || Math.abs(distributionSum - 100) > 0.1
                      : false;

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
                          {row.tipo === "usuario" && row.storeName && (
                            <Typography variant="caption" color="text.secondary">
                              {row.storeName}
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
                          disabled={!row.editing}
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
                          disabled={!row.editing}
                          onChange={(event) =>
                            handleInputChange(
                              row.target_id,
                              "operacionesInput",
                              event.target.value
                            )
                          }
                        />
                        {isQuarter && row.distribution?.length ? (
                          <Stack spacing={0.5} sx={{ mt: 1 }} alignItems="flex-end">
                            {row.distribution.map((entry) => (
                              <TextField
                                key={entry.month}
                                size="small"
                                type="number"
                                label={entry.label}
                                value={entry.percent}
                                disabled={!row.editing}
                                inputProps={{ min: 0, max: 100, step: "0.1" }}
                                onChange={(event) =>
                                  handleDistributionChange(
                                    row.target_id,
                                    entry.month,
                                    event.target.value
                                  )
                                }
                                InputProps={{
                                  endAdornment: (
                                    <InputAdornment position="end">%</InputAdornment>
                                  ),
                                }}
                              />
                            ))}
                            {row.editing && (
                              <FormHelperText
                                error={distributionError}
                                sx={{ textAlign: 'right', m: 0 }}
                              >
                                {`Suma: ${Number.isFinite(distributionSum) ? distributionSum.toFixed(2) : '—'}%`}
                              </FormHelperText>
                            )}
                            {row.editing && (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => handleAutoDistribute(row.target_id)}
                                sx={{ alignSelf: 'flex-end', mt: 0.5 }}
                              >
                                Reparto equilibrado
                              </Button>
                            )}
                          </Stack>
                        ) : null}
                        {row.tipo === "tienda" && row.userAllocations?.length ? (
                          <Stack spacing={0.5} sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
                              Asignación por usuario
                            </Typography>
                            {row.userAllocations.map((alloc) => (
                              <Stack
                                key={alloc.usuario_id}
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                justifyContent="flex-end"
                              >
                                <Typography variant="body2" sx={{ minWidth: 120, textAlign: 'right' }}>
                                  {alloc.nombre}
                                </Typography>
                                <TextField
                                  size="small"
                                  type="number"
                                  label="€"
                                  value={alloc.valorInput}
                                  disabled={!row.editing}
                                  inputProps={{ min: 0, step: "100" }}
                                  onChange={(event) =>
                                    handleUserAllocationChange(
                                      row.target_id,
                                      alloc.usuario_id,
                                      "valorInput",
                                      event.target.value
                                    )
                                  }
                                />
                                <TextField
                                  size="small"
                                  type="number"
                                  label="Ops"
                                  value={alloc.operacionesInput}
                                  disabled={!row.editing}
                                  inputProps={{ min: 0, step: "1" }}
                                  onChange={(event) =>
                                    handleUserAllocationChange(
                                      row.target_id,
                                      alloc.usuario_id,
                                      "operacionesInput",
                                      event.target.value
                                    )
                                  }
                                />
                              </Stack>
                            ))}
                            {row.editing && (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => handleEqualUserDistribution(row.target_id)}
                                sx={{ alignSelf: 'flex-end', mt: 0.5 }}
                              >
                                Reparto equitativo entre usuarios
                              </Button>
                            )}
                          </Stack>
                        ) : null}
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
                        {row.editing ? (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              onClick={() => handleCancel(row.target_id)}
                              disabled={savingTargetId === row.target_id}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleSave(row)}
                              disabled={
                                savingTargetId === row.target_id ||
                                !row.dirty ||
                                (isQuarter && row.distribution?.length ? distributionError : false)
                              }
                            >
                              Guardar
                            </Button>
                          </Stack>
                        ) : (
                          <Button
                            size="small"
                            onClick={() => handleEdit(row.target_id)}
                            disabled={savingTargetId !== null}
                          >
                            Editar
                          </Button>
                        )}
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
