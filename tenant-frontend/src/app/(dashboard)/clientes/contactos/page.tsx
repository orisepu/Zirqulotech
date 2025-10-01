"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Paper, Snackbar, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import TablaReactiva from "@/shared/components/TablaReactiva2";
import { getColumnasContactos } from "@/shared/components/TablaColumnas2";
import api from "@/services/api";

type ClienteTipo = "empresa" | "autonomo" | "particular";
type CanalTipo = "b2b" | "b2c";

type ContactoCliente = {
  id: number;
  display_name?: string;
  razon_social?: string;
  nombre?: string;
  apellidos?: string;
  tipo_cliente: ClienteTipo;
  canal?: CanalTipo;
  contacto?: string | null;
  posicion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  contacto_financiero?: string | null;
  telefono_financiero?: string | null;
  correo_financiero?: string | null;
  tienda_nombre?: string | null;
};

type ContactosResponse = {
  results: ContactoCliente[];
  count: number;
};

type SnackbarKind = "success" | "error" | "warning" | "info";
type SnackbarState = {
  open: boolean;
  message: string;
  type: SnackbarKind;
};

export default function ContactosClientesPage() {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: "", type: "error" });

  const { columnas } = getColumnasContactos<ContactoCliente>();

  const { data, isLoading, isError } = useQuery<ContactosResponse>({
    queryKey: ["clientes-contactos", { busqueda, pagina, porPagina }],
    placeholderData: (prev) => prev ?? { results: [], count: 0 },
    staleTime: 120000,
    queryFn: async () => {
      const res = await api.get("/api/clientes/", {
        params: { search: busqueda, page: pagina, page_size: porPagina },
      });
      const raw = res.data as any;
      const results: ContactoCliente[] = Array.isArray(raw)
        ? (raw as ContactoCliente[])
        : (raw?.results ?? raw?.json ?? []);
      const count: number = raw?.count ?? results.length;
      return { results, count };
    },
  });

  useEffect(() => {
    if (isError) {
      setSnackbar({ open: true, message: "No se pudieron cargar los contactos.", type: "error" });
    }
  }, [isError]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Contactos</Typography>
      </Box>

      <TextField
        label="Buscar contacto o cliente"
        fullWidth
        sx={{ mb: 2 }}
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setPagina(1);
        }}
      />

      <Paper sx={{ overflowX: "auto" }}>
        <TablaReactiva
          columns={columnas}
          data={data?.results || []}
          loading={isLoading}
          paginationMode="server"
          totalCount={data?.count || 0}
          pageIndex={pagina - 1}
          pageSize={porPagina}
          onPageChange={(pi) => setPagina(pi + 1)}
          onPageSizeChange={(ps) => {
            setPagina(1);
            setPorPagina(ps);
          }}
          onRowClick={(cliente) => router.push(`/clientes/${cliente.id}`)}
        />
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.type}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
