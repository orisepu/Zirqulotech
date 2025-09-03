// src/components/GraficoValoresPorUsuario.tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

export function GraficoValoresPorUsuario({ data }: { data: any[] }) {
  const datosFiltrados = data.filter((item) => item.usuario); // opcional

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart layout="vertical" data={datosFiltrados}>
        <XAxis type="number" />
        <YAxis type="category" dataKey="usuario" width={180} />
        <Tooltip />
        <Bar dataKey="total" fill="#9C27B0">
          <LabelList dataKey="total" position="right" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
