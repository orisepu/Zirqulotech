'use client';

import * as React from 'react';
import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Box,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  Typography,
  Tooltip,
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import { useTheme, alpha } from '@mui/material/styles';

type Producto = { nombre: string; valor: number; cantidad: number };

type Props = {
  productos: Producto[];
  eur: (n: number) => string;
  num: (n: number) => string;
  maxSlices?: number;
  initialMetric?: 'valor' | 'cantidad';
  initialAgruparOtros?: boolean;
  height?: number;
};

function useContainerWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(200);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

// Abrevia modelos largos (Apple-like)
function compactModelName(raw: string): string {
  if (!raw) return '—';
  let s = raw.trim();
  s = s.replace(/\(([^)]+)\)/g, ' $1').replace(/\s+/g, ' ').trim(); // (2023) -> 2023
  const cpu = s.match(/(\d+)\s*[-‐-–—]?\s*core[s]?\s*cpu/i)?.[1];
  const gpu = s.match(/(\d+)\s*[-‐-–—]?\s*core[s]?\s*gpu/i)?.[1];
  if (cpu || gpu) {
    s = s
      .replace(/(\d+)\s*[-‐-–—]?\s*core[s]?\s*cpu/ig, '')
      .replace(/(\d+)\s*[-‐-–—]?\s*core[s]?\s*gpu/ig, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const cg = [cpu ? `${cpu}C` : '', gpu ? `${gpu}G` : ''].filter(Boolean).join('/');
    if (cg) s = `${s} ${cg}`;
  }
  s = s.replace(/\bApple\s+(M\d+\s*(Pro|Max|Ultra)?)\b/i, '$1').replace(/\s{2,}/g, ' ').trim();
  const HARD = 24;
  return s.length > HARD ? s.slice(0, HARD - 1) + '…' : s;
}

export function TopProductosChart({
  productos,
  eur,
  num,
  maxSlices = 9,
  initialMetric = 'valor',
  initialAgruparOtros = true,
  height = 200,
}: Props) {
  const { ref, width } = useContainerWidth();
  const theme = useTheme();
  const [metric, setMetric] = useState<'valor' | 'cantidad'>(initialMetric);
  const [agruparOtros, setAgruparOtros] = useState<boolean>(initialAgruparOtros);

  const valueFmt = (v: number) => (metric === 'valor' ? eur(v) : `${num(v)} uds`);

  // Datos normalizados
  const data = useMemo(() => {
    const base = (productos || [])
      .map((p) => ({ name: p.nombre || '—', value: Number(p[metric] || 0) }))
      .filter((d) => Number.isFinite(d.value) && d.value > 0)
      .sort((a, b) => b.value - a.value);

    if (!base.length) return [] as { id: number; label: string; shortLabel: string; value: number }[];

    const rows =
      !agruparOtros || base.length <= maxSlices
        ? base
        : [
            ...base.slice(0, Math.max(1, maxSlices - 1)),
            { name: 'Otros', value: base.slice(Math.max(1, maxSlices - 1)).reduce((a, d) => a + d.value, 0) },
          ];

    return rows.map((d, i) => ({
      id: i,
      label: d.name,                         // completo → tooltip del pie
      shortLabel: compactModelName(d.name),  // abreviado → arcLabel / leyenda
      value: d.value,
    }));
  }, [productos, metric, agruparOtros, maxSlices]);

  const total = useMemo(() => data.reduce((acc, d) => acc + (d.value || 0), 0), [data]);

  // Layout compacto
  const chartWidth = Math.max(160, Math.min(220, width || 200));
  const compact = chartWidth < 200;
  const outerRadius = Math.min(chartWidth, height) * 0.42;
  const innerRadius = Math.max(12, Math.round(outerRadius * 0.2));
  const shortLabelById = useMemo(() => new Map<number, string>(data.map((d) => [d.id, d.shortLabel])), [data]);
  const basePalette = useMemo(
    () => [
      theme.palette.primary.main,
      theme.palette.info.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.secondary.main,
    ],
    [theme],
  );

  const sliceColors = useMemo(
    () =>
      data.map((_, i) => {
        const color = basePalette[i % basePalette.length] || theme.palette.grey[500];
        const tier = Math.floor(i / basePalette.length);
        const opacity = 0.9 - tier * 0.18;
        return alpha(color, Math.max(0.35, opacity));
      }),
    [data, basePalette, theme],
  );

  return (
    <Box>
      {/* Controles */}
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <ToggleButtonGroup size="small" value={metric} exclusive onChange={(_, v) => v && setMetric(v)}>
          <ToggleButton value="valor">Valor €</ToggleButton>
          <ToggleButton value="cantidad">Unidades</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch checked={agruparOtros} onChange={(_, c) => setAgruparOtros(c)} size="small" />}
          label={<Typography variant="caption">Agrupar “Otros”</Typography>}
        />
      </Stack>

      {/* Chart + leyenda custom con colores compartidos */}
      <Box ref={ref} sx={{ width: '100%', minWidth: 0 }}>
        {!data.length ? (
          <Box sx={{ height, display: 'grid', placeItems: 'center', color: 'text.secondary' }}>Sin datos.</Box>
        ) : (
          <>
            <PieChart
              width={chartWidth}
              height={height}
              hideLegend= {true}
              
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
              sx={compact ? { '& .MuiChartsArcLabel-root': { pointerEvents: 'none' } } : undefined}
              series={[
                {
                  data: data.map((d, idx) => ({ id: d.id, label: d.label, value: d.value, color: sliceColors[idx] })),
                  innerRadius,
                  outerRadius,
                  
                  ...(compact
                    ? {
                        arcLabel: (item) => {
                          const id = typeof item.id === 'number' ? item.id : Number(item.id);
                          return shortLabelById.get(id) ?? String(item.label ?? '');
                        },
                        arcLabelMinAngle: 12,
                      }
                    : {}),
                  paddingAngle: 5,
                  cornerRadius: 5,
                  valueFormatter: (item) => valueFmt(Number(item.value ?? 0)), // Tooltip MUI del pie
                },
              ]}
              slotProps={{ legend: {  } }}
            />

            {/* Leyenda custom (colores compartidos con el pie) */}
            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              justifyContent="center"
              columnGap={1}
              rowGap={0.5}
              sx={{ mt: 1 }}
            >
              {data.map((d, i) => {
                const txt = `${d.label}: ${valueFmt(d.value)}`;
                const color = sliceColors[i] || theme.palette.text.secondary;
                return (
                  <Tooltip
                    key={d.id}
                    title={txt}
                    arrow
                    enterDelay={0}
                    enterNextDelay={0}
                    leaveDelay={0}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.75}
                      sx={{ minWidth: 110, maxWidth: 160, cursor: 'default' }}
                    >
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '2px',
                          bgcolor: color,
                          flex: '0 0 auto',
                        }}
                        aria-hidden
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={d.label}
                      >
                        {d.shortLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ flex: '0 0 auto' }}>
                        {valueFmt(d.value)}
                      </Typography>
                    </Stack>
                  </Tooltip>
                );
              })}
            </Stack>
          </>
        )}
      </Box>

      {!!total && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Total: {valueFmt(total)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
