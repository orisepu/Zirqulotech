import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/services/api";
import {
  Typography,
  CircularProgress,
} from "@mui/material";
import OportunidadDetalleBase from "@/components/OportunidadDetalleBase";

// Tipos mínimos según uso en OportunidadDetalleBase
interface Dispositivo {
  id: number;
  modelo: { descripcion: string };
  estado_fisico: string;
  estado_funcional: string;
  cantidad: number;
  precio_orientativo: number;
}
interface Comentario {
  id: number; texto: string; autor_nombre: string; fecha: string;
}
interface EventoHistorial {
  id: number; descripcion: string; tipo_evento: string; usuario_nombre: string; fecha: string;
}
interface Oportunidad {
  id: number;
  nombre: string;
  estado: string;
  fecha_creacion: string;
  cliente?: { razon_social: string };
  dispositivos: Dispositivo[];
  comentarios: Comentario[];
  calle?: string; numero?: string; piso?: string; puerta?: string;
  codigo_postal?: string; poblacion?: string; provincia?: string;
  persona_contacto?: string; telefono_contacto?: string; instrucciones?: string;
}
type DatosRecogida = Partial<{
  calle: string; numero: string; piso: string; puerta: string;
  codigo_postal: string; poblacion: string; provincia: string;
  persona_contacto: string; telefono_contacto: string; instrucciones: string;
}>;

export default function OportunidadDetallePageManager() {
  const { id } = useParams();
  const [oportunidad, setOportunidad] = useState<Oportunidad | null>(null);
  const [historial, setHistorial] = useState<EventoHistorial[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/oportunidades/${id}/`);
      setOportunidad(res.data as Oportunidad);
      const hist = await api.get(`/api/oportunidades/${id}/historial/`);
      setHistorial((hist.data as EventoHistorial[]) || []);
    } catch (err) {
      console.error("Error al cargar datos de la oportunidad", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleGuardarRecogida = async (formData: DatosRecogida) => {
    await api.patch(`/api/oportunidades/${id}/`, formData);
    await fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
