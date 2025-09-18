import { useEffect, useState } from "react";
import { Card, CardContent, Typography, Grid } from "@mui/material";
import api from "@/services/api";
import { formatoEuros } from "@/utils/formato";


type Props = { filtros: Record<string, unknown> }

type UsuarioResumen = {
  nombre: string
  valor: number
  oportunidades: number
  dispositivos: number
}

type ResumenState = {
  resumenPorUsuario: UsuarioResumen[]
  valor_total: number
  comision: number
  valor_medio: number
  total_dispositivos: number
  total_oportunidades: number
}

export default function ResumenPorTienda({ filtros }: Props) {
  const [resumen, setResumen] = useState<ResumenState | null>(null)
  const [tasaConversion, setTasaConversion] = useState<number | null>(null);
  const [tiempoRespuesta, setTiempoRespuesta] = useState<number | null>(null);

  useEffect(() => {
    const fetchResumen = async () => {
      const res = await api.get("api/dashboard/valor-por-usuario/", { params: filtros });
      const raw: Record<string, unknown> | undefined = res.data?.[0]; // asumimos solo un mes

      if (!raw) return;

      const resumenPorUsuario: UsuarioResumen[] = [];

      let totalValor = 0;
      let totalOportunidades = 0;
      let totalDispositivos = 0;

      for (const [key, value] of Object.entries(raw)) {
        if (key === "mes" || key.includes("__")) continue;

        const oportunidades = Number((raw as Record<string, unknown>)[`${key}__n_oportunidades`] ?? 0);
        const dispositivos = Number((raw as Record<string, unknown>)[`${key}__n_dispositivos`] ?? 0);

        resumenPorUsuario.push({
          nombre: key,
          valor: Number(value ?? 0),
          oportunidades,
          dispositivos,
        });

        totalValor += Number(value ?? 0);
        totalOportunidades += oportunidades;
        totalDispositivos += dispositivos;
      }

      setResumen({
        resumenPorUsuario,
        valor_total: totalValor,
        comision: totalValor * 0.10,
        valor_medio: totalOportunidades ? totalValor / totalOportunidades : 0,
        total_dispositivos: totalDispositivos,
        total_oportunidades: totalOportunidades,
      });
    };

    const fetchTasaConversion = async () => {
      const res = await api.get("api/dashboard/tasa-conversion/", { params: filtros });
      setTasaConversion(res.data.tasa_conversion);
    };

    const fetchTiempoRespuesta = async () => {
      const res = await api.get("api/dashboard/tiempo-entre-estados/", {
        params: {
          ...filtros,
          estado_inicio: "pendiente",
          estado_fin: "Nueva oferta enviada",
        },
      });
      setTiempoRespuesta(res.data.tiempo_medio_respuesta_horas || res.data.tiempo_medio_horas);
    };

    fetchResumen();
    fetchTasaConversion();
    fetchTiempoRespuesta();
  }, [filtros]);

  if (!resumen) return null;

  return (
    <Grid container spacing={2}>
      <Grid size={{xs:12,sm:6,md:3}}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="textSecondary">
              Valor total generado
            </Typography>
            <Typography variant="h6" fontWeight="bold">
              {formatoEuros(resumen.valor_total)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{xs:12,sm:6,md:3}}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="textSecondary">
              Comisión acumulada
            </Typography>
            <Typography variant="h6" fontWeight="bold">
              {formatoEuros(resumen.comision)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{xs:12,sm:6,md:3}}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="textSecondary">
              Valor medio por transacción
            </Typography>
            <Typography variant="h6" fontWeight="bold">
              {formatoEuros(resumen.valor_medio)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
        <Typography variant="subtitle1" gutterBottom>
          Desglose por usuario
        </Typography>
        <Grid container spacing={2}>
          {resumen.resumenPorUsuario.map((usuario: UsuarioResumen) => (
            <Grid size={{xs:12,sm:6,md:4}} key={usuario.nombre}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2">{usuario.nombre}</Typography>
                  <Typography variant="body2">
                    Valor: {formatoEuros(usuario.valor)}
                  </Typography>
                  <Typography variant="body2">
                    Oportunidades: {usuario.oportunidades}
                  </Typography>
                  <Typography variant="body2">
                    Dispositivos: {usuario.dispositivos}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      <Grid size={{xs:12,sm:6,md:3}}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="textSecondary">
              Tasa de conversión
            </Typography>
            <Typography variant="h6" fontWeight="bold">
              {tasaConversion !== null ? `${tasaConversion}%` : "—"}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{xs:12,sm:6,md:3}}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="textSecondary">
              Tiempo medio de respuesta
            </Typography>
            <Typography variant="h6" fontWeight="bold">
              {tiempoRespuesta !== null ? `${tiempoRespuesta}h` : "—"}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
