"use client";

import { useState, useMemo } from "react";
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
} from "@mui/material";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";

import api, {
  type ObjetivoResumenItem,
  type PeriodoTipo,
  type ObjetivoScope,
} from "@/services/api";

import { PeriodSelector, getDefaultQuarter } from "@/components/objetivos/PeriodSelector";
import { ObjetivosTable } from "@/components/objetivos/ObjetivosTable";
import { ObjetivosModal } from "@/components/objetivos/ObjetivosModal";

export default function ObjetivosPage() {
  // Estado de filtros
  const [scope, setScope] = useState<ObjetivoScope>("tienda");
  const [periodType, setPeriodType] = useState<PeriodoTipo>("mes");
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().format("YYYY-MM"));
  const [selectedYear, setSelectedYear] = useState(() => dayjs().year());
  const [selectedQuarter, setSelectedQuarter] = useState(() => getDefaultQuarter());

  // Estado del modal
  const [selectedItem, setSelectedItem] = useState<ObjetivoResumenItem | null>(null);

  // Valor del período actual
  const periodValue = useMemo(() => {
    if (periodType === "mes") return selectedMonth;
    return `${selectedYear}-Q${selectedQuarter}`;
  }, [periodType, selectedMonth, selectedYear, selectedQuarter]);

  // Query para obtener los datos
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

  const handleEditItem = (item: ObjetivoResumenItem) => {
    setSelectedItem(item);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, display: "grid", gap: 3 }}>
      <Typography variant="h4">Objetivos</Typography>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={3}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
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

        <PeriodSelector
          periodType={periodType}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          selectedQuarter={selectedQuarter}
          onPeriodTypeChange={setPeriodType}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          onQuarterChange={setSelectedQuarter}
        />
      </Stack>

      <ObjetivosTable
        data={data || []}
        scope={scope}
        isLoading={isFetching}
        onEdit={handleEditItem}
      />

      <ObjetivosModal
        open={!!selectedItem}
        onClose={handleCloseModal}
        item={selectedItem}
        periodType={periodType}
        periodValue={periodValue}
        selectedYear={selectedYear}
        selectedQuarter={selectedQuarter}
      />
    </Box>
  );
}