"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Paper, Snackbar, TextField, Typography } from "@mui/material";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import TablaReactiva from "@/shared/components/TablaReactiva2";
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

const formatearTelefono = (valor?: string | null) => {
  const numerico = (valor || "").replace(/\D/g, "");
  if (!numerico) return "—";
  if (numerico.length === 9) {
    return `${numerico.slice(0, 3)} ${numerico.slice(3, 6)} ${numerico.slice(6)}`;
  }
  return valor || "—";
};

const nombreVisible = (cliente: ContactoCliente) => {
  const nombreCompuesto = `${cliente.nombre || ""} ${cliente.apellidos || ""}`.trim();
  return (
    cliente.display_name ||
    cliente.razon_social ||
    (nombreCompuesto ? nombreCompuesto : "—")
  );
};

export default function ContactosClientesPage() {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: "", type: "error" });
  const columnas = useMemo<ColumnDef<ContactoCliente>[]>(() => [
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (row) => nombreVisible(row),
      meta: { minWidth: 220, ellipsis: true, ellipsisMaxWidth: 220,align: 'center',
            alignHeader: 'center', } as any,
    },
    {
      id: "contacto_principal",
      header: "Contacto principal",
      accessorFn: (row) => (row.tipo_cliente === "empresa" ? (row.contacto || "—") : nombreVisible(row)),
      meta: { minWidth: 200, ellipsis: true, ellipsisMaxWidth: 220,align: 'center',
            alignHeader: 'center', } as any,
    },
    {
      id: "posicion",
      header: "Posición",
      accessorFn: (row) => (row.tipo_cliente === "empresa" ? (row.posicion || "—") : "—"),
      meta: { minWidth: 160, ellipsis: true, ellipsisMaxWidth: 180,align: 'center',
            alignHeader: 'center', } as any,
    },
    {
      id: "telefono",
      header: "Teléfono",
      accessorFn: (row) => row.telefono,
      cell: ({ getValue }) => formatearTelefono(getValue() as string | null | undefined),
      meta: { minWidth: 130, ellipsis: true, ellipsisMaxWidth: 150, headerMaxWidth: 120,align: 'center',
            alignHeader: 'center', } as any,
    },
    {
      id: "correo",
      header: "Correo",
      accessorFn: (row) => row.correo || "—",
      meta: { minWidth: 220, ellipsis: true, ellipsisMaxWidth: 240,align: 'center',
            alignHeader: 'center', } as any,
    },
    {
      id: "contacto_financiero",
      header: "Contacto financiero",
      accessorFn: (row) => row.contacto_financiero || "—",
      meta: { minWidth: 200, ellipsis: true, ellipsisMaxWidth: 220,align: 'center',
            alignHeader: 'center', } as any,
    },
    {
      id: "telefono_financiero",
      header: "Tel. financiero",
      accessorFn: (row) => row.telefono_financiero,
      cell: ({ getValue }) => formatearTelefono(getValue() as string | null | undefined),
      meta: { minWidth: 170, ellipsis: true, ellipsisMaxWidth: 170, headerMaxWidth: 140,align: 'center',
            alignHeader: 'center', } as any,
    },
    {
      id: "correo_financiero",
      header: "Correo financiero",
      accessorFn: (row) => row.correo_financiero || "—",
      meta: { minWidth: 200, ellipsis: true, ellipsisMaxWidth: 220,align: 'center',
            alignHeader: 'center', } as any,
    },

    
  ], []);

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
          columnas={columnas}
          oportunidades={data?.results || []}
          loading={isLoading}
          serverPagination
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
