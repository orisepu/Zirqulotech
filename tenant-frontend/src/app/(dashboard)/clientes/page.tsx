"use client";

import {
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";

import { useState,useMemo,useEffect } from "react";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getColumnasClientes } from "@/shared/components/TablaColumnas2";
import FormularioClientes from "@/features/clients/components/forms/FormularioClientes";
import useUsuarioActual from "@/shared/hooks/useUsuarioActual";
import TablaReactiva from "@/shared/components/TablaReactiva2";
type ListaClientes = { results: Cliente[]; count: number };
type SnackbarKind = 'success' | 'error' | 'warning' | 'info';
type SnackbarState = { open: boolean; message: string; type: SnackbarKind };
interface Cliente {
  id: number;
  tipo_cliente: 'empresa' | 'autonomo' | 'particular';
  canal: 'b2b' | 'b2c'; // lo devuelve el backend
  // Empresa
  razon_social?: string;
  cif?: string;
  contacto?: string;
  posicion?: string;
  // Autónomo/Particular
  nombre?: string;
  apellidos?: string;
  dni_nie?: string;
  nif?: string;
  nombre_comercial?: string;
  // Comunes
  telefono?: string;
  correo?: string;
  tienda_nombre?: string;
  display_name?: string;           // MethodField del serializer
  identificador_fiscal?: string;   // MethodField del serializer
}

export default function ClientesPage() {
  const router = useRouter();
  const usuario = useUsuarioActual();
  const soloEmpresas = usuario?.tenant?.solo_empresas ?? false;
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', type: 'success' });
  const queryClient = useQueryClient();
  const { columnas, zoom } = useMemo(() => getColumnasClientes<Cliente>(), []);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);        // 1-based aquí
  const [porPagina, setPorPagina] = useState(10);
  const pasos = ['Comerciales', 'Financieros', 'Dirección', 'Sector'];
  const handleBack = () => setPasoActivo((prev) => prev - 1);
  const [nuevo, setNuevo] = useState<Partial<Cliente>>({});
  const [pasoActivo, setPasoActivo] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  // Obtener clientes con React Query
  const {data,isLoading,isError,
  } = useQuery<ListaClientes>({
    queryKey: ["clientes", { busqueda, pagina, porPagina }],
    placeholderData: (prev) => prev ?? { results: [], count: 0 }, // v5
    staleTime: 120000,
    queryFn: async () => {
      const res = await api.get("/api/clientes/", {
        params: { search: busqueda, page: pagina, page_size: porPagina },
      });
      const raw = res.data;

      const results: Cliente[] =
        raw?.results ??
        raw?.json ??
        (Array.isArray(raw) ? (raw as Cliente[]) : []);
      const count: number = raw?.count ?? results.length;

      return { results, count };
    },
  });

  const totalPaginas = data?.count
    ? Math.ceil(data.count / porPagina)
    : 1;
  function esCorreoValido(correo: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  }

  function esTelefonoValido(telefono: string): boolean {
    return /^[0-9]{9}$/.test(telefono.replace(/\s+/g, ''));
  }
  const validarPaso = () => {
    if (pasoActivo === 0) {
      const correo = (nuevo.correo || '').trim();
      const telefono = (nuevo.telefono || '').trim();
      if ((correo && !esCorreoValido(correo)) || (telefono && !esTelefonoValido(telefono))) {
        setSnackbar({
          open: true,
          message: 'Corrige los errores en correo o teléfono',
          type: 'error',
        });
        return false;
      }
    }
    return true;
  };
  const handleNext = () => {
    if (!validarPaso()) return;
    setPasoActivo((prev) => prev + 1);
  };
  // Crear cliente con React Query Mutation
  const crearCliente = useMutation({
    mutationFn: async (nuevoCliente: Partial<Cliente>) => {
      await api.post("/api/clientes/", nuevoCliente);
    },
    onSuccess: () => {
      setModalOpen(false);
      setNuevo({});
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const msg = data && typeof data === 'object'
        ? Object.entries(data).map(([k, v]) => `${k}: ${(v as any)[0]}`).join(' · ')
        : 'Error al crear cliente';
      setSnackbar({ open: true, message: msg, type: 'error' });
    },
  });
  useEffect(() => {
    if (isError && !snackbar.open) {
      setSnackbar({ open: true, message: 'No se pudieron cargar los clientes.', type: 'error' });
    }
  }, [isError, snackbar.open]);
  const validarAntesDeCrear = () => {
    const t = nuevo.tipo_cliente;
    const falta = (f: keyof Cliente) => !nuevo[f] || (nuevo[f] as string).trim() === '';
    if (t === 'empresa' && (falta('razon_social') || falta('cif'))) return false;
    if (t === 'autonomo' && (falta('nombre') || falta('apellidos') || falta('nif'))) return false;
    if (t === 'particular' && (falta('nombre') || falta('apellidos') || falta('dni_nie'))) return false;
    return true;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Clientes</Typography>
        <Button
          variant="contained"
          onClick={() => setModalOpen(true)}>
          Nuevo cliente
        </Button>
      </Box>

      <TextField
        label="Buscar cliente"
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
        defaultSorting={[{ id: 'display_name', desc: false }]}
        onRowClick={(o) => router.push(`/clientes/${o.id}`)}
        serverPagination                                   // 🔑 usa paginación del servidor
        totalCount={data?.count || 0}
        pageIndex={(pagina - 1)}                           // 0-based para la tabla
        pageSize={porPagina}
        onPageChange={(pi) => setPagina(pi + 1)}           // tabla → padre (0→1)
        onPageSizeChange={(ps) => { setPagina(1); setPorPagina(ps); }}/>
      </Paper>

      {/* Modal de creación */}
      <FormularioClientes
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={(payload) => crearCliente.mutate(payload)}
        soloEmpresas={soloEmpresas}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.type}
          variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
