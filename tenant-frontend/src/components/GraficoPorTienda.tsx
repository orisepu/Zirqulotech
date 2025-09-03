'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
  Paper, Typography, Box, FormGroup, FormControlLabel, Checkbox,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import api from '@/services/api';

type Props = {
  filtros: any;
  modo: 'tienda' | 'usuario';
};

export default function GraficoPorTienda({ filtros, modo }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [data, setData] = useState<any[]>([]);
  const [clavesLine, setClavesLine] = useState<string[]>([]);
  const [clavesBar, setClavesBar] = useState<string[]>([]);
  const [activos, setActivos] = useState<string[]>([]);

  useEffect(() => {
    if (!filtros) return;

    console.log("🏪 Consultando valor-por-tienda con filtros:", filtros);

    api.get("api/dashboard/valor-por-tienda/", { params: filtros })
      .then((res) => {
        console.log("🏪 Resultado valor-por-tienda:", res.data);
        setData(res.data);
      });
  }, [filtros]);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const nuevas = [...new Set(
      data.flatMap((fila) =>
        Object.keys(fila).filter((k) => k !== "mes" && !k.includes("__"))
      )
    )];

    const clavesChanged = nuevas.sort().join(",") !== clavesLine.slice().sort().join(",");

    if (clavesChanged) {
      setClavesLine(nuevas);
      setActivos(nuevas);
    }
  }, [data]);

  useEffect(() => {
    const fila = data[0] || {};
    const nuevas = Object.keys(fila)
      .filter(k => k.endsWith('__n_dispositivos'))
      .map(k => k.replace('__n_dispositivos', ''));
    setClavesBar(nuevas);
  }, [data]);

  const toggleActivo = (clave: string) => {
    setActivos(prev =>
      prev.includes(clave) ? prev.filter(k => k !== clave) : [...prev, clave]
    );
  };

  const coloresMUI = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.info.main,
    theme.palette.warning.main,
    theme.palette.error.main,
  ];

  const colorScale = (clave: string, tipo: 'linea' | 'barra') => {
    const index = [...clavesLine, ...clavesBar].indexOf(clave);
    const baseColor = coloresMUI[index % coloresMUI.length];
    return tipo === 'barra' ? baseColor + 'AA' : baseColor;
  };

  const baseData = data;

  return (
    <Box mt={4}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Gráficos de valor y actividad</Typography>
      </Box>

      <FormGroup row sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {clavesLine.map((clave) => (
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

      <Box display="flex" flexDirection={isMobile ? 'column' : 'row'} gap={2} flexWrap="wrap">
        <Paper sx={{ flex: 1, p: 2, minWidth: 300 }}>
          <Typography variant="subtitle1" gutterBottom>
            Valor total por {modo}
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={baseData}>
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
                  stroke={colorScale(clave, 'linea')}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Paper>

        <Paper sx={{ flex: 1, p: 2, minWidth: 300 }}>
          <Typography variant="subtitle1" gutterBottom>
            Dispositivos y oportunidades por {modo}
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={baseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              {clavesBar.map((clave) => (
                <Bar
                  key={`${clave}__n_dispositivos`}
                  dataKey={`${clave}__n_dispositivos`}
                  name={`${clave} - dispositivos`}
                  fill={colorScale(clave, 'barra')}
                />
              ))}
              {clavesBar.map((clave) => (
                <Bar
                  key={`${clave}__n_oportunidades`}
                  dataKey={`${clave}__n_oportunidades`}
                  name={`${clave} - oportunidades`}
                  fill={colorScale(clave, 'barra')}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Box>
    </Box>
  );
}
