"use client";

import {
  Box,
  Typography,
  TextField,
  Stack,
  Button,
  Divider,
  Alert,
  InputAdornment,
} from "@mui/material";
import dayjs from "dayjs";

export type MonthlyDistribution = {
  month: string;
  label: string;
  percent: string;
};

type MonthlyDistributionPanelProps = {
  distribution: MonthlyDistribution[];
  totalValor: number;
  totalOperaciones: number;
  onPercentChange: (month: string, percent: string) => void;
  onDistributeEqually: () => void;
};

function formatEuro(value: number) {
  return (
    value.toLocaleString("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function parsePercent(value: string): number {
  if (!value) return 0;
  const numeric = Number(value.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
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

export function MonthlyDistributionPanel({
  distribution,
  totalValor,
  totalOperaciones,
  onPercentChange,
  onDistributeEqually,
}: MonthlyDistributionPanelProps) {
  const percentages = distribution.map((d) => parsePercent(d.percent));
  const totalPercent = percentages.reduce((acc, val) => acc + val, 0);
  const hasInvalidPercent = percentages.some((p) => Number.isNaN(p) || p < 0);
  const isValid = !hasInvalidPercent && Math.abs(totalPercent - 100) <= 0.1;

  const valorDistribuido = isValid
    ? distributeAmount(totalValor, percentages.map(p => (p / totalPercent) * 100), 2)
    : [];
  const operacionesDistribuidas = isValid
    ? distributeAmount(totalOperaciones, percentages.map(p => (p / totalPercent) * 100), 0)
    : [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Distribución mensual</Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={onDistributeEqually}
        >
          Distribuir equitativamente
        </Button>
      </Stack>

      <Stack spacing={2}>
        {distribution.map((entry, index) => (
          <Stack
            key={entry.month}
            direction="row"
            spacing={2}
            alignItems="center"
          >
            <Typography
              variant="body2"
              sx={{ minWidth: 100, fontWeight: 500 }}
            >
              {entry.label}
            </Typography>
            <TextField
              size="small"
              type="number"
              label="Porcentaje"
              value={entry.percent}
              onChange={(e) => onPercentChange(entry.month, e.target.value)}
              inputProps={{ min: 0, max: 100, step: "0.1" }}
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={{ width: 140 }}
            />
            {isValid && (
              <>
                <Typography variant="body2" sx={{ minWidth: 100 }}>
                  {formatEuro(valorDistribuido[index] || 0)}
                </Typography>
                <Typography variant="body2" sx={{ minWidth: 80 }}>
                  {Math.round(operacionesDistribuidas[index] || 0)} ops
                </Typography>
              </>
            )}
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="textSecondary">
            Suma porcentajes:
          </Typography>
          <Typography
            variant="body2"
            color={isValid ? "textPrimary" : "error"}
          >
            {totalPercent.toFixed(2)}%
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="textSecondary">
            Total objetivo:
          </Typography>
          <Typography variant="body2">
            {formatEuro(totalValor)} | {totalOperaciones} ops
          </Typography>
        </Stack>

        {!isValid && (
          <Alert severity="error" sx={{ mt: 1 }}>
            <Typography variant="body2">
              {hasInvalidPercent
                ? "Introduce porcentajes válidos para todos los meses."
                : "La suma de porcentajes debe ser 100%."}
            </Typography>
          </Alert>
        )}
      </Stack>
    </Box>
  );
}