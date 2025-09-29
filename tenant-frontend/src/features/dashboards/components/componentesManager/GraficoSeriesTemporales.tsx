
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Serie = {
  fecha: string;
  [grupo: string]: number | string;
};

export function GraficoSeriesTemporales({ data }: { data: Serie[] }) {
  if (!data || data.length === 0) return null;

  // Determinar las claves (usuarios o tiendas) automáticamente
  const grupos = Object.keys(data[0]).filter((key) => key !== "fecha");

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="fecha" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        {grupos.map((grupo, index) => (
          <Line
            key={grupo}
            type="monotone"
            dataKey={grupo}
            stroke={`hsl(${(index * 47) % 360}, 70%, 50%)`}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
