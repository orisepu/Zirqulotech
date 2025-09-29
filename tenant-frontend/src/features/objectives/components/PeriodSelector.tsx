"use client";

import { Stack, TextField, MenuItem } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { type PeriodoTipo } from "@/services/api";

function getDefaultQuarter() {
  const now = dayjs();
  const month = now.month(); // 0-index
  return Math.floor(month / 3) + 1;
}

type PeriodSelectorProps = {
  periodType: PeriodoTipo;
  selectedMonth: string;
  selectedYear: number;
  selectedQuarter: number;
  onPeriodTypeChange: (type: PeriodoTipo) => void;
  onMonthChange: (month: string) => void;
  onYearChange: (year: number) => void;
  onQuarterChange: (quarter: number) => void;
};

export function PeriodSelector({
  periodType,
  selectedMonth,
  selectedYear,
  selectedQuarter,
  onPeriodTypeChange,
  onMonthChange,
  onYearChange,
  onQuarterChange,
}: PeriodSelectorProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      alignItems="center"
    >
      <TextField
        select
        label="Tipo de período"
        size="small"
        value={periodType}
        onChange={(event) => {
          const next = event.target.value as PeriodoTipo;
          onPeriodTypeChange(next);
          if (next === "mes" && !selectedMonth) {
            onMonthChange(dayjs().format("YYYY-MM"));
          }
        }}
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="mes">Mensual</MenuItem>
        <MenuItem value="trimestre">Trimestral</MenuItem>
      </TextField>

      {periodType === "mes" ? (
        <DatePicker
          label="Mes"
          value={dayjs(selectedMonth)}
          onChange={(newValue) => {
            if (newValue) {
              onMonthChange(newValue.format("YYYY-MM"));
            }
          }}
          views={["year", "month"]}
          slotProps={{
            textField: {
              size: "small",
            },
          }}
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
              if (!Number.isNaN(nextYear)) onYearChange(nextYear);
            }}
            sx={{ width: 120 }}
          />
          <TextField
            select
            label="Trimestre"
            size="small"
            value={selectedQuarter}
            onChange={(event) => onQuarterChange(Number(event.target.value))}
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
}

export { getDefaultQuarter };