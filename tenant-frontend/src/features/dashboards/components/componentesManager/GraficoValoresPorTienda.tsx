// src/components/GraficoValoresPorTienda.tsx
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

type TiendaValor = {
  tienda: string;
  total: number;
};

export function GraficoValoresPorTienda({ data }: { data: readonly TiendaValor[] }) {
  const datosFiltrados = data.filter((item) => !!item.tienda); // descarta null

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart layout="vertical" data={datosFiltrados}>
        <XAxis type="number" />
        <YAxis type="category" dataKey="tienda" width={180} />
        <Tooltip />
        <Bar dataKey="total" fill="#03A9F4">
          <LabelList dataKey="total" position="right" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
