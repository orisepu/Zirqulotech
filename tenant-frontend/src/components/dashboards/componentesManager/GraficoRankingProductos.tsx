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

export function GraficoRankingProductos({ data }: { data: any[] }) {
  const sortedData = [...data].sort((a, b) => b.cantidad - a.cantidad);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart layout="vertical" data={sortedData}>
        <XAxis type="number" allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="modelo"
          width={200}
          tick={{ fontSize: 12 }}
        />
        <Tooltip />
        <Bar dataKey="cantidad" fill="#4CAF50">
          <LabelList dataKey="cantidad" position="right" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
