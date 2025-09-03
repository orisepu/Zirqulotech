import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/services/api";
import {
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import OportunidadDetalleBase from "@/components/OportunidadDetalleBase";

export default function OportunidadDetallePageManager() {
  const { id } = useParams();
  const [oportunidad, setOportunidad] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/oportunidades/${id}/`);
      setOportunidad(res.data);
      const hist = await api.get(`/api/oportunidades/${id}/historial/`);
      setHistorial(hist.data);
    } catch (err) {
      console.error("Error al cargar datos de la oportunidad", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarRecogida = async (formData: any) => {
    await api.patch(`/api/oportunidades/${id}/`, formData);
    await fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (loading) return <CircularProgress sx={{ mt: 5, mx: "auto", display: "block" }} />;
  if (!oportunidad) return <Typography color="error">Oportunidad no encontrada</Typography>;

  return (
    <OportunidadDetalleBase
      oportunidad={oportunidad}
      historial={historial}
      onGuardarRecogida={handleGuardarRecogida}
      onRefrescar={fetchData}
      puedeEditarRecogida={true}
      puedeVerFacturas={false}
      puedeVerDispositivosAuditados={false}
      esSuperadmin={false}
    />
  );
}