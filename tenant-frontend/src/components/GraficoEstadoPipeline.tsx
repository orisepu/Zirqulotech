"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useEffect, useState } from "react";
import api from "@/services/api";
import { Card, CardContent, Typography, CircularProgress, Box } from "@mui/material";

type EstadoPipelineRow = {
  estado: string;
  total: number;
};

type Filtros = Record<string, unknown>;

type Props = {
  filtros?: Filtros;
  height?: number;
};

export default function GraficoEstadoPipeline({ filtros = {}, height = 300 }: Props) {
  const [datos, setDatos] = useState<EstadoPipelineRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchDatos = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get("/api/dashboard/estado-pipeline/", { params: filtros });
        const arr = Array.isArray(res.data) ? (res.data as EstadoPipelineRow[]) : [];
        if (mounted) setDatos(arr);
      } catch (e) {
        if (mounted) setError("No se pudo cargar el pipeline.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchDatos();
    return () => {
      mounted = false;
    };
  }, [filtros]);

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Estado actual del pipeline
        </Typography>

        {loading ? (
          <Box sx={{ height, display: "grid", placeItems: "center" }}>
            <CircularProgress size={22} />
          </Box>
        ) : error ? (
          <Box sx={{ height, display: "grid", placeItems: "center", color: "text.secondary" }}>
            {error}
          </Box>
        ) : !datos.length ? (
          <Box sx={{ height, display: "grid", placeItems: "center", color: "text.secondary" }}>
            Sin datos para este filtro
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={datos} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="estado" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Total" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
