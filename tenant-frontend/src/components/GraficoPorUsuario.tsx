'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Paper, Typography, Box, FormGroup, FormControlLabel, Checkbox,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import api from '@/services/api';
import { useEffect, useMemo, useState } from 'react';

// Tipos
type Filtros = Record<string, unknown>;
type Row = Record<string, number | string>; // ej: { mes: '2025-01', Juan: 1200, Ana: 800, ... }

interface Props {
  filtros: Filtros;
}

export default function GraficoPorUsuario({ filtros }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [resumenUsuario, setResumenUsuario] = useState<Row[]>([]);
  const [activos, setActivos] = useState<string[]>([]);
  const [allKeys, setAllKeys] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    if (!filtros) return;

    (async () => {
      try {
        const res = await api.get('/api/dashboard/valor-por-usuario/', { params: filtros });
        const rows: Row[] = Array.isArray(res.data) ? res.data : [];
        if (!mounted) return;

        setResumenUsuario(rows);

        // recolecta claves de usuario (todo excepto 'mes' y columnas auxiliares con '__')
        const keySet = new Set<string>();
        rows.forEach((row) => {
          Object.keys(row).forEach((k) => {
            if (k !== 'mes' && !k.includes('__')) keySet.add(k);
          });
        });
        const claves = Array.from(keySet);
        setAllKeys(claves);
        setActivos(claves);
      } catch {
        if (mounted) {
          setResumenUsuario([]);
          setAllKeys([]);
          setActivos([]);
        }
      }
    })();

    return () => { mounted = false; };
  }, [filtros]);

  const toggleActivo = (clave: string) => {
    setActivos(prev =>
      prev.includes(clave) ? prev.filter(k => k !== clave) : [...prev, clave]
    );
  };

  // Paleta estable
  const PALETA = [
    '#8dd1e1', '#82ca9d', '#8884d8', '#ffc658',
    '#ff7f50', '#a4de6c', '#d0ed57', '#83a6ed',
    '#d4a5ff', '#ffb3ba', '#baffc9', '#bae1ff',
  ];
  const colorDe = (clave: string) => {
    const idx = allKeys.indexOf(clave);
    return PALETA[(idx >= 0 ? idx : 0) % PALETA.length];
  };

  if (!resumenUsuario.length) {
    return <Typography variant="body2">No hay datos por usuario en este período.</Typography>;
  }

  return (
    <Box mt={4}>
      <Typography variant="h6" gutterBottom>
        Valor total por usuario
      </Typography>

      <FormGroup row sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {allKeys.map((clave) => (
          <FormControlLabel
            key={clave}
            control={
              <Checkbox
                checked={activos.includes(clave)}
                onChange={() => toggleActivo(clave)}
              />
            }
            label={clave}
          />
        ))}
      </FormGroup>

      {activos.length === 0 ? (
        <Typography variant="body2">Selecciona al menos un usuario para visualizar el gráfico.</Typography>
      ) : (
        <Paper sx={{ p: 2 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={resumenUsuario}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              {activos.map((clave) => (
                <Line
                  key={clave}
                  type="monotone"
                  dataKey={clave}
                  name={clave}
                  stroke={colorDe(clave)}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}
    </Box>
  );
}
