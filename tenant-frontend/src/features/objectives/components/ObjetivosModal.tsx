"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Box,
  Tabs,
  Tab,
  Typography,
  CircularProgress,
} from "@mui/material";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";

import {
  guardarObjetivo,
  type ObjetivoResumenItem,
  type PeriodoTipo,
  type ObjetivoScope,
} from "@/services/api";
import { UserAllocationPanel, type UserAllocation } from "./UserAllocationPanel";
import { MonthlyDistributionPanel, type MonthlyDistribution } from "./MonthlyDistributionPanel";

function getQuarterMonths(year: number, quarter: number): MonthlyDistribution[] {
  const startMonth = Math.max(0, (quarter - 1) * 3);
  return Array.from({ length: 3 }, (_, idx) => {
    const date = dayjs().year(year).month(startMonth + idx).startOf('month');
    return {
      month: date.format('YYYY-MM'),
      label: date.format('MMM YYYY'),
      percent: '33.33',
    };
  });
}

function distributeAmount(total: number, percentages: number[], decimals: number): number[] {
  if (!percentages.length || total === 0) {
    return Array(percentages.length).fill(0);
  }
  const factor = Math.pow(10, decimals);
  const raw = percentages.map((p) => (total * p) / 100);
  const scaled = raw.map((v) => Math.floor(v * factor + 1e-6));
  const targetSum = Math.round(total * factor);
  const currentSum = scaled.reduce((acc, val) => acc + val, 0);

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

type ObjetivosModalProps = {
  open: boolean;
  onClose: () => void;
  item: ObjetivoResumenItem | null;
  periodType: PeriodoTipo;
  periodValue: string;
  selectedYear: number;
  selectedQuarter: number;
};

export function ObjetivosModal({
  open,
  onClose,
  item,
  periodType,
  periodValue,
  selectedYear,
  selectedQuarter,
}: ObjetivosModalProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Objetivos principales
  const [valorInput, setValorInput] = useState("");
  const [operacionesInput, setOperacionesInput] = useState("");

  // Distribución por usuarios (solo para tiendas)
  const [userAllocations, setUserAllocations] = useState<UserAllocation[]>([]);

  // Distribución mensual (solo para trimestres)
  const [monthlyDistribution, setMonthlyDistribution] = useState<MonthlyDistribution[]>([]);

  const isQuarter = periodType === "trimestre";
  const isStore = item?.tipo === "tienda";

  useEffect(() => {
    if (item) {
      setValorInput(String(item.objetivo_valor || 0));
      setOperacionesInput(String(item.objetivo_operaciones || 0));

      // Configurar usuarios si es tienda
      if (item.tipo === "tienda" && item.usuarios?.length) {
        setUserAllocations(
          item.usuarios.map((user) => ({
            usuario_id: user.usuario_id,
            nombre: user.nombre,
            valorInput: String(user.objetivo_valor || 0),
            operacionesInput: String(user.objetivo_operaciones || 0),
          }))
        );
      } else {
        setUserAllocations([]);
      }

      // Configurar distribución mensual si es trimestre
      if (isQuarter) {
        setMonthlyDistribution(getQuarterMonths(selectedYear, selectedQuarter));
      } else {
        setMonthlyDistribution([]);
      }

      setActiveTab(0);
    }
  }, [item, isQuarter, selectedYear, selectedQuarter]);

  const handleUserChange = (userId: number, field: "valorInput" | "operacionesInput", value: string) => {
    setUserAllocations((prev) =>
      prev.map((user) =>
        user.usuario_id === userId ? { ...user, [field]: value } : user
      )
    );

    // Actualizar totales automáticamente
    if (field === "valorInput") {
      const total = userAllocations.reduce(
        (acc, user) => acc + Number(user.usuario_id === userId ? value : user.valorInput || 0),
        0
      );
      setValorInput(total.toFixed(2));
    } else {
      const total = userAllocations.reduce(
        (acc, user) => acc + Number(user.usuario_id === userId ? value : user.operacionesInput || 0),
        0
      );
      setOperacionesInput(String(Math.round(total)));
    }
  };

  const handleDistributeUsersEqually = () => {
    const totalValor = Number(valorInput || 0);
    const totalOps = Number(operacionesInput || 0);
    const count = userAllocations.length;

    if (count === 0) return;

    const percentages = Array(count).fill(100 / count);
    const valorDistribuido = distributeAmount(totalValor, percentages, 2);
    const opsDistribuidas = distributeAmount(totalOps, percentages, 0);

    setUserAllocations((prev) =>
      prev.map((user, index) => ({
        ...user,
        valorInput: valorDistribuido[index].toFixed(2),
        operacionesInput: String(Math.round(opsDistribuidas[index])),
      }))
    );
  };

  const handlePercentChange = (month: string, percent: string) => {
    setMonthlyDistribution((prev) =>
      prev.map((entry) =>
        entry.month === month ? { ...entry, percent } : entry
      )
    );
  };

  const handleDistributeMonthsEqually = () => {
    setMonthlyDistribution((prev) =>
      prev.map((entry) => ({ ...entry, percent: "33.33" }))
    );
  };

  const handleSave = async () => {
    if (!item) return;

    const valor = Number(valorInput || 0);
    const operaciones = Number(operacionesInput || 0);

    if (Number.isNaN(valor) || Number.isNaN(operaciones) || valor < 0 || operaciones < 0) {
      toast.error("Introduce valores válidos");
      return;
    }

    // Validar distribución mensual si es trimestre
    let monthlyItems: Array<{ periodo_input: string; objetivo_valor: number; objetivo_operaciones: number }> = [];
    if (isQuarter && monthlyDistribution.length) {
      const percentages = monthlyDistribution.map((d) => {
        const p = Number(d.percent.replace(',', '.'));
        return Number.isFinite(p) && p >= 0 ? p : 0;
      });
      const totalPercent = percentages.reduce((acc, p) => acc + p, 0);

      if (Math.abs(totalPercent - 100) > 0.1) {
        toast.error("La suma de porcentajes debe ser 100%");
        return;
      }

      const normalized = percentages.map((p) => (p / totalPercent) * 100);
      const valorDistribuido = distributeAmount(valor, normalized, 2);
      const operacionesDistribuidas = distributeAmount(operaciones, normalized, 0);

      monthlyItems = monthlyDistribution.map((entry, index) => ({
        periodo_input: entry.month,
        objetivo_valor: valorDistribuido[index],
        objetivo_operaciones: Math.round(operacionesDistribuidas[index]),
      }));
    }

    setIsSaving(true);

    try {
      // Guardar objetivo principal
      const basePayload = {
        tipo: item.tipo,
        periodo_tipo: periodType,
        periodo_input: periodValue,
        objetivo_valor: valor,
        objetivo_operaciones: operaciones,
        ...(item.tipo === "tienda" ? { tienda_id: item.target_id } : { usuario_id: item.target_id }),
      };

      await guardarObjetivo(basePayload);

      // Guardar distribución mensual si es trimestre
      if (monthlyItems.length) {
        await Promise.all(
          monthlyItems.map((monthItem) =>
            guardarObjetivo({
              ...basePayload,
              periodo_tipo: "mes",
              periodo_input: monthItem.periodo_input,
              objetivo_valor: monthItem.objetivo_valor,
              objetivo_operaciones: monthItem.objetivo_operaciones,
            })
          )
        );
      }

      // Guardar objetivos por usuario si es tienda
      if (item.tipo === "tienda" && userAllocations.length) {
        await Promise.all(
          userAllocations.map((user) =>
            guardarObjetivo({
              tipo: "usuario",
              periodo_tipo: periodType,
              periodo_input: periodValue,
              objetivo_valor: Number(user.valorInput || 0),
              objetivo_operaciones: Number(user.operacionesInput || 0),
              usuario_id: user.usuario_id,
            })
          )
        );
      }

      toast.success("Objetivos guardados correctamente");
      queryClient.invalidateQueries({ queryKey: ["objetivos-resumen"], exact: false });
      onClose();
    } catch (error) {
      toast.error("Error al guardar los objetivos");
    } finally {
      setIsSaving(false);
    }
  };

  if (!item) return null;

  const tabs = [];
  tabs.push("Objetivo principal");
  if (isStore && userAllocations.length) tabs.push("Asignación por usuario");
  if (isQuarter) tabs.push("Distribución mensual");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: 400 } }}
    >
      <DialogTitle>
        Editar objetivos - {item.target_name}
      </DialogTitle>

      <DialogContent>
        {tabs.length > 1 && (
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
          >
            {tabs.map((tab, index) => (
              <Tab key={index} label={tab} />
            ))}
          </Tabs>
        )}

        <Box sx={{ mt: 2 }}>
          {activeTab === 0 && (
            <Stack spacing={3}>
              <Typography variant="h6">Objetivo principal</Typography>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Objetivo en euros"
                  type="number"
                  value={valorInput}
                  onChange={(e) => setValorInput(e.target.value)}
                  inputProps={{ min: 0, step: "100" }}
                  fullWidth
                />
                <TextField
                  label="Objetivo en operaciones"
                  type="number"
                  value={operacionesInput}
                  onChange={(e) => setOperacionesInput(e.target.value)}
                  inputProps={{ min: 0, step: "1" }}
                  fullWidth
                />
              </Stack>
            </Stack>
          )}

          {activeTab === 1 && isStore && userAllocations.length > 0 && (
            <UserAllocationPanel
              users={userAllocations}
              totalValor={Number(valorInput || 0)}
              totalOperaciones={Number(operacionesInput || 0)}
              onUserChange={handleUserChange}
              onDistributeEqually={handleDistributeUsersEqually}
            />
          )}

          {activeTab === (isStore && userAllocations.length ? 2 : 1) && isQuarter && (
            <MonthlyDistributionPanel
              distribution={monthlyDistribution}
              totalValor={Number(valorInput || 0)}
              totalOperaciones={Number(operacionesInput || 0)}
              onPercentChange={handlePercentChange}
              onDistributeEqually={handleDistributeMonthsEqually}
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : null}
        >
          Guardar objetivos
        </Button>
      </DialogActions>
    </Dialog>
  );
}