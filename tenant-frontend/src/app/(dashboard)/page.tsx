"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      router.push("/login");
      return;
    }

    fetch("https://progeek.es/api/mi-dashboard/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error al cargar dashboard", err);
        setLoading(false);
      });
  }, [router]);

  if (loading) return <CircularProgress sx={{ m: 4 }} />;
  if (!data) return <Typography sx={{ m: 4 }}>Error al cargar el dashboard.</Typography>;

  const clienteView = (
    <Grid container spacing={2}>
      <Grid size={{xs:12, sm:6,md:3}}>
        <Card><CardContent>
          <Typography variant="h6">Dispositivos Totales</Typography>
          <Typography variant="h4">{data.dispositivos_totales}</Typography>
        </CardContent></Card>
      </Grid>
      <Grid size={{xs:12, sm:6,md:3}}>
        <Card><CardContent>
          <Typography variant="h6">Valoraciones Pendientes</Typography>
          <Typography variant="h4">{data.valoraciones_pendientes}</Typography>
        </CardContent></Card>
      </Grid>
      <Grid size={{xs:12, sm:6,md:3}}>
        <Card><CardContent>
          <Typography variant="h6">Reparaciones Activas</Typography>
          <Typography variant="h4">{data.reparaciones_en_curso}</Typography>
        </CardContent></Card>
      </Grid>
      <Grid size={{xs:12, sm:6,md:3}}>
        <Card><CardContent>
          <Typography variant="h6">Consultas Abiertas</Typography>
          <Typography variant="h4">{data.consultas_abiertas}</Typography>
        </CardContent></Card>
      </Grid>
    </Grid>
  );

  const adminView = (
    <Grid container spacing={2}>
      <Grid size={{xs:12, sm:4}}>
        <Card><CardContent>
          <Typography variant="h6">Dispositivos Totales</Typography>
          <Typography variant="h4">{data.total_dispositivos}</Typography>
        </CardContent></Card>
      </Grid>
      <Grid size={{xs:12, sm:4}}>
        <Card><CardContent>
          <Typography variant="h6">Valoraciones Pendientes</Typography>
          <Typography variant="h4">{data.valoraciones_pendientes}</Typography>
        </CardContent></Card>
      </Grid>
      <Grid size={{xs:12, sm:4}}>
        <Card><CardContent>
          <Typography variant="h6">Consultas Pendientes</Typography>
          <Typography variant="h4">{data.consultas_pendientes}</Typography>
        </CardContent></Card>
      </Grid>
    </Grid>
  );

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>

      {data.tipo_usuario === "cliente" ? clienteView : adminView}

      <Box display="flex" justifyContent="space-between" alignItems="center" mt={4} mb={2}>
        <Typography variant="h5">Tus lotes</Typography>
        <Button variant="contained" color="primary" component={Link} href="/crear-lote">
          Crear nuevo lote
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        {data.lotes?.length > 0 ? (
          <List>
            {data.lotes.map((lote: any) => (
              <ListItem
                key={lote.id}
                divider
                component={Link}
                href={`/lotes/editar/${lote.id}`}
              >
                <ListItemText
                  primary={`Lote #${lote.id}`}
                  secondary={lote.observaciones}
                />
                <EditIcon />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography>No tienes lotes creados aún.</Typography>
        )}
      </Paper>
    </Box>
  );
}