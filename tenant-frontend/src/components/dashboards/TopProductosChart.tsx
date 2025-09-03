'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import { Box, Stack, ToggleButton, ToggleButtonGroup, FormControlLabel, Switch, Typography } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';

type Producto = {
  nombre: string;
  valor: number;
  cantidad: number;
};

type Props = {
  productos: Producto[];
  eur: (n: number) => string;
  num: (n: number) => string;
  maxSlices?: number;          // máximo de porciones visibles (si se agrupa, una es "Otros")
  initialMetric?: 'valor' | 'cantidad';
  initialAgruparOtros?: boolean;
  height?: number;
};

export function TopProductosChart({
  productos,
  eur,
  num,
  maxSlices = 8,
  initialMetric = 'valor',
  initialAgruparOtros = true,
  height = 280,
}: Props) {
  const [metric, setMetric] = useState<'valor' | 'cantidad'>(initialMetric);
  const [agruparOtros, setAgruparOtros] = useState<boolean>(initialAgruparOtros);

  const data = useMemo(() => {
    // Normaliza y ordena
    const base = (productos || [])
      .map((p) => ({
        name: p.nombre || '—',
        value: Number(p[metric] || 0),
      }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0)
      .sort((a, b) => b.value - a.value);

    if (!base.length) return [];

    if (!agruparOtros || base.length <= maxSlices) {
      // Asigna ids numéricos
      return base.map((d, i) => ({ id: i, label: d.name, value: d.value }));
    }

    // Agrupar “Otros” si supera el máximo
    const head = base.slice(0, Math.max(1, maxSlices - 1));
    const tail = base.slice(Math.max(1, maxSlices - 1));
    const tailSum = tail.reduce((acc, d) => acc + d.value, 0);

    const grouped = [
      ...head.map((d, i) => ({ id: i, label: d.name, value: d.value })),
      { id: head.length, label: 'Otros', value: tailSum },
    ];
    return grouped;
  }, [productos, metric, agruparOtros, maxSlices]);

  const total = useMemo(
    () => data.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    [data]
  );

  const valueFormatter = (v: number) =>
    metric === 'valor' ? eur(v) : `${num(v)} uds`;

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1 }}
      >
        <ToggleButtonGroup
          size="small"
          value={metric}
          exclusive
          onChange={(_, v) => v && setMetric(v)}
        >
          <ToggleButton value="valor">Valor €</ToggleButton>
          <ToggleButton value="cantidad">Unidades</ToggleButton>
        </ToggleButtonGroup>

        <FormControlLabel
          control={
            <Switch
              checked={agruparOtros}
              onChange={(_, checked) => setAgruparOtros(checked)}
              size="small"
            />
          }
          label={<Typography variant="caption">Agrupar “Otros”</Typography>}
        />
      </Stack>

      {!data.length ? (
        <Box sx={{ height, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>
          Sin datos.
        </Box>
      ) : (
        <PieChart
          height={height}
          series={[
            {
              data,
              innerRadius: 20,
              paddingAngle: 2,
              cornerRadius: 2,
              valueFormatter: (item) => valueFormatter(item.value as number),
            },
          ]}
          slotProps={{
            legend: {
              position: { vertical: 'middle', horizontal: 'end' }, // 'end' en vez de 'right'
            },
          }}
        />
      )}

      {!!total && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Total: {metric === 'valor' ? eur(total) : `${num(total)} uds`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
