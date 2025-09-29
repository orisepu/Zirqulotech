"use client";
import { Grid, Card, CardContent, Typography, useTheme } from "@mui/material";

type TiendaStats = {
  tienda: string;
  total: number;
  oportunidades: number;
  dispositivos: number;
  canceladas?: number;
};

export function TarjetasPorTienda({ data }: { data: readonly TiendaStats[] }) {
  const theme = useTheme();

  return (
    <Grid container spacing={3}>
      {data.map((tienda) => (
        <Grid size={{xs:12, sm:6, md:4}} key={tienda.tienda}>
          <Card
            sx={{
              height: "100%",
              backgroundColor: theme.palette.mode === "dark"
                ? theme.palette.grey[900]
                : theme.palette.grey[100],
            }}
          >
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">
                🏪 {tienda.tienda}
              </Typography>
              <Typography variant="h6">💶 €{tienda.total}</Typography>
              <Typography variant="body2">📦 Oportunidades: {tienda.oportunidades}</Typography>
              <Typography variant="body2">🔧 Dispositivos: {tienda.dispositivos}</Typography>
              <Typography variant="body2">🔧 Canceladas: {tienda.dispositivos}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
