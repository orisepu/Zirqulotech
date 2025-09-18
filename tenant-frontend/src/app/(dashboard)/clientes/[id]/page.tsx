"use client";

import {Box,Typography,Grid} from "@mui/material";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import FichaCliente from "@/components/clientes/FichaCliente";
import OportunidadesCard from "@/components/clientes/OportunidadesCard";
import ComentariosCard from "@/components/clientes/ComentariosCard";
import EditarClienteDialog from "@/components/clientes/EditarClienteDialog";

interface Cliente {
  id: number;
  razon_social: string;
  cif: string;
  contacto: string;
  telefono: string;
  posicion: string;
  correo: string;
  comentarios: ComentarioCliente[];
  oportunidades: Oportunidad[];
  contacto_financiero: string;
  telefono_financiero: string;
  correo_financiero: string;
  numero_empleados: number | null;
  direccion_calle: string;
  direccion_piso: string;
  direccion_puerta: string;
  direccion_cp: string;
  direccion_poblacion: string;
  direccion_provincia: string;
  direccion_pais: string;
  vertical: string;
  vertical_secundaria: string;
}

interface ComentarioCliente {
  id: number;
  texto: string;
  autor_nombre: string;
  fecha: string;
}

interface Oportunidad {
  id: number;
  nombre: string | null;
  estado: string;
  fecha_creacion: string;
}

export default function ClienteDetallePage() {
  const { id } = useParams();
  const [comentario, setComentario] = useState("");
 
  const [abrirEditarCliente, setAbrirEditarCliente] = useState(false);
  const [clienteEditado, setClienteEditado] = useState<Partial<Cliente>>({});
  const pasos = ["Comercial", "Financiero", "Dirección", "Sector"];
  const [pasoActivo, setPasoActivo] = useState(0);
  const queryClient = useQueryClient();
  const [verTodas, setVerTodas] = useState(false);

  

  const handleNext = () => setPasoActivo((prev) => prev + 1);
  const handleBack = () => setPasoActivo((prev) => prev - 1);

  const { data: cliente, isLoading } = useQuery<Cliente>({
    queryKey: ["cliente", id],
    queryFn: async () => (await api.get(`/api/clientes/${id}/`)).data,
  });

  useEffect(() => {
    if (cliente) setClienteEditado(cliente);
  }, [cliente]);

  const enviarComentarioMutation = useMutation({
    mutationFn: (texto: string) => api.post(`/api/comentarios-cliente/`, { cliente: id, texto }),
    onSuccess: () => {
      setComentario("");
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: () => alert("❌ Error al añadir comentario"),
  });

  const guardarCambiosClienteMutation = useMutation({
    mutationFn: (clienteActualizado: Partial<Cliente>) => api.patch(`/api/clientes/${id}/`, clienteActualizado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: () => alert("❌ Error al guardar cambios"),
  });
 
  if (isLoading || !cliente) return <Typography>Cargando...</Typography>;
  const oportunidadesOrdenadas = [...cliente.oportunidades].sort(
    (a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime()
  );

  const oportunidadesMostradas = verTodas
    ? oportunidadesOrdenadas
    : oportunidadesOrdenadas.slice(0, 3);
  return (
    <Box >
      <Grid container spacing={1} alignItems="stretch" sx={{ minHeight: 'calc(100vh - 160px)' }}>

        {/* Columna izquierda: ficha + oportunidades */}
          <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex', flexDirection: 'column',minHeight: 'calc(100vh - 160px)',overflow: 'hidden', }}>
            {/* Ficha del cliente */}
            <Box sx={{ flexShrink: 0 }}>
              <FichaCliente cliente={cliente as any} onEditar={() => { setClienteEditado(cliente); setPasoActivo(0); setAbrirEditarCliente(true); }} />
            </Box>
            {/* Oportunidades */}
          <OportunidadesCard 
          oportunidades={cliente.oportunidades}
          clienteId={cliente.id}
          sx={{ flex: 1, minHeight: 0 }} />
              
            </Grid>

        {/* Columna derecha: comentarios con scroll */}
          <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flexDirection: 'column',minHeight: 'calc(100vh - 160px)',overflow: 'hidden', }}>
            <ComentariosCard comentarios={cliente.comentarios} onAdd={(texto) => enviarComentarioMutation.mutate(texto)} />
          </Grid>
      </Grid>
    
      {/* Modal: Editar cliente */}
      <EditarClienteDialog
        open={abrirEditarCliente}
        initial={clienteEditado}
        onClose={() => setAbrirEditarCliente(false)}
        onSave={async (payload) => {
          // Espera a que termine y no devuelvas valor (Promise<void>)
          await guardarCambiosClienteMutation.mutateAsync(payload);
        }}
      />
    </Box>
  );
}
