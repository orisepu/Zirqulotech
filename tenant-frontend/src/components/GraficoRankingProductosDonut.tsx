"use client";

import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { Card, CardContent, Typography, CircularProgress, Box } from "@mui/material";

const COLORES = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f50", "#a4de6c"];

type Filtros = Record<string, unknown>;

type ApiRow = {
  modelo__descripcion?: string;
  total?: number | string;
};

type Datum = { nombre: string; value: number };

interface Props {
  filtros: Filtros;
  topN?: number; // por defecto 5
}

export default function GraficoRankingProductosDonut({
  filtros,
  topN = 5,
}: Props) {
  const { data: datos = [], isLoading, isError } = useQuery<
    ApiRow[],            // TQueryFnData (lo que devuelve la API)
    Error,               // TError
    Datum[]              // TData (lo que usa el componente tras 'select')
  >({
    queryKey: ["ranking-productos", filtros, topN],
    queryFn: async () => {
      const res = await api.get("/api/dashboard/ranking-productos/", {
        params: filtros,
      });
      // Acepta array plano o paginado { results: [...] }
      if (Array.isArray(res.data?.results)) return res.data.results;
      if (Array.isArray(res.data)) return res.data;
      return [];
    },
    select: (raw) =>
      raw
        .map<Datum>((item) => ({
          nombre: item.modelo__descripcion ?? "—",
          value: Number(item.total ?? 0),
        }))
        .filter((d) => Number.isFinite(d.value) && d.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, topN),
    // Mantiene los datos anteriores mientras cambian los filtros (equivalente a keepPreviousData)
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Productos más recomprados (Top {topN})
          </Typography>
          <Box sx={{ display: "grid", placeItems: "center", height: 300 }}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (isError || !datos.length) {
    return (
      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Productos más recomprados (Top {topN})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No hay datos para los filtros seleccionados.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Productos más recomprados (Top {topN})
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={datos}
              dataKey="value"
              nameKey="nombre"
              outerRadius={90}
              innerRadius={40}
              paddingAngle={3}
              label
            >
              {datos.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORES[index % COLORES.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
