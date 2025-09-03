"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";

export function GraficoBarrasHorizontales({ data, labelKey, valueKey }: {
  data: any[];
  labelKey: string;
  valueKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart layout="vertical" data={data}>
        <XAxis type="number" />
        <YAxis type="category" dataKey={labelKey} width={150} />
        <Tooltip />
        <Bar dataKey={valueKey} fill="#8884d8">
          <LabelList dataKey={valueKey} position="right" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
