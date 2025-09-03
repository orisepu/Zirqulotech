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
import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Box,
} from "@mui/material";

const COLORES = ["#f87171", "#facc15", "#60a5fa", "#a78bfa"];

type Filtros = Record<string, unknown>;

type ApiRow = {
  estado?: string;
  total?: number | string;
};

type Datum = { nombre: string; value: number };

interface Props {
  filtros: Filtros;
}

export default function GraficoRechazosDonut({ filtros }: Props) {
  const { data: datos = [], isLoading, isError } = useQuery<
    ApiRow[],  // TQueryFnData (crudo de la API)
    Error,     // TError
    Datum[]    // TData (transformado con select)
  >({
    queryKey: ["rechazos-producto", filtros],
    queryFn: async () => {
      const res = await api.get("/api/dashboard/rechazos-producto/", {
        params: filtros,
      });
      if (Array.isArray(res.data?.results)) return res.data.results;
      if (Array.isArray(res.data)) return res.data;
      return [];
    },
    select: (raw) =>
      raw
        .map<Datum>((item) => ({
          nombre: item.estado ?? "—",
          value: Number(item.total ?? 0),
        }))
        .filter((d) => Number.isFinite(d.value) && d.value > 0),
    // Mantiene los datos anteriores mientras cambian filtros (equiv. keepPreviousData)
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Rechazos por estado final
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
            Rechazos por estado final
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
          Rechazos por estado final
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
              {datos.map((_, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={COLORES[idx % COLORES.length]}
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
