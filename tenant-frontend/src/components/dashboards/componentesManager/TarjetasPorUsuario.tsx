"use client";
import { Grid, Card, CardContent, Typography, useTheme } from "@mui/material";

type UsuarioStats = {
  usuario: string;
  total: number;
  oportunidades: number;
  dispositivos: number;
};

export function TarjetasPorUsuario({ data }: { data: readonly UsuarioStats[] }) {
  const theme = useTheme();

  return (
    <Grid container spacing={3}>
      {data.map((usuario) => (
        <Grid size={{xs:12, sm:6, md:4}} key={usuario.usuario}>
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
                👤 {usuario.usuario}
              </Typography>
              <Typography variant="h6">💶 €{usuario.total}</Typography>
              <Typography variant="body2">📦 Oportunidades: {usuario.oportunidades}</Typography>
              <Typography variant="body2">🔧 Dispositivos: {usuario.dispositivos}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
