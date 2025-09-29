'use client';

import { useParams } from 'next/navigation';
import { useState, useMemo,useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Paper,
  TableContainer,
  Snackbar,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import TablaReactiva from '@/shared/components/TablaReactiva2';
import { columnasDispositivosReales } from '@/shared/components/TablaColumnas2';
import { formatoBonito } from '@/context/precios';

type Modelo = { id: number; descripcion: string ; modelo: string };
type Capacidad = { id: number; tamaño: string; capacidad: string };

type DispositivoReal = {
  id: number | string;
  origen?: number | string | null;
  modelo?: Modelo | null;
  capacidad?: Capacidad | null;
  imei?: string | null;
  numero_serie?: string | null;
  modelo_descripcion?: string | null;
  capacidad_tamaño?: string | null;
  // campos que pintas más abajo:
  estado_fisico?: string | null;
  estado_funcional?: string | null;
  estado_valoracion?: string | null;
  precio_final?: number | null;
  observaciones?: string | null;
};

export default function RecepcionDispositivosPartnerPage() {
  const params = useParams();
  const id = params.id as string;
  const safeBonito = (v: string | null | undefined) => (v ? formatoBonito(v) : '—');
  // Paginación local (solo visualización)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', type: 'info' });

  const {
    data: dispositivos = [],
    isLoading,
    isError,
    error,
  } = useQuery<DispositivoReal[]>({
    queryKey: ['oportunidad', id, 'dispositivos-reales'],
    enabled: !!id,
    placeholderData: (prev) => prev ?? [], // v5: reemplaza keepPreviousData
    // staleTime: 5_000, // opcional: evita refetch instantáneo
    queryFn: async () => {
      const res = await api.get(`/api/oportunidades/${id}/dispositivos-reales/`);
      const lista = Array.isArray(res.data) ? res.data : res.data?.dispositivos ?? [];
      return lista ?? [];
    },
  });

  // Mensaje de error (opcional, puedes quitar el Snackbar si no lo usas)
  useEffect(() => {
    if (isError && !snackbar.open) {
      setSnackbar({
        open: true,
        message: 'No se pudieron cargar los dispositivos validados.',
        type: 'error',
      });
    }
  }, [isError, snackbar.open]);

  const paginados = useMemo(() => {
    const start = page * rowsPerPage;
    return dispositivos.slice(start, start + rowsPerPage);
  }, [dispositivos, page, rowsPerPage]);

  const renderModelo = (d: DispositivoReal) =>
    typeof d?.modelo === 'object'
      ? d?.modelo?.descripcion ?? '—'
      : d?.modelo ?? '—';

  
  const renderCapacidad = (d: DispositivoReal) =>
    typeof d?.capacidad === 'object'
      ? d?.capacidad?.tamaño ?? '—'
      : typeof d?.capacidad === 'string'
      ? d.capacidad
      : '—';

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight="bold">
          Auditoria 
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Mostrando dispositivos auditados
        </Typography>
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  
                  <TableCell sx={{ width: 260 }}>Modelo</TableCell>
                  <TableCell sx={{ width: 160 }}>Capacidad</TableCell>
                  <TableCell sx={{ width: 220 }}>IMEI</TableCell>
                  <TableCell sx={{ width: 220 }}>Nº Serie</TableCell>
                  <TableCell sx={{ width: 220 }}>Estado físico</TableCell>
                  <TableCell sx={{ width: 220 }}>Estado funcional</TableCell>
                  <TableCell sx={{ width: 220 }}>Valoracion</TableCell>
                  <TableCell sx={{ width: 220 }}>Precio recompra</TableCell>
                  <TableCell sx={{ width: 220 }}>Observaciones</TableCell>

                </TableRow>
              </TableHead>
              <TableBody>
                {dispositivos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No hay dispositivos validados todavía.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginados.map((d) => (
                    <TableRow key={String(d.id)}>
                      <TableCell>{renderModelo(d)}</TableCell>
                      <TableCell>{renderCapacidad(d)}</TableCell>
                      <TableCell>{d.imei || '—'}</TableCell>
                      <TableCell>{d.numero_serie || '—'}</TableCell>
                      <TableCell>{safeBonito(d.estado_fisico) || '—'}</TableCell>
                      <TableCell>{safeBonito(d.estado_funcional) || '—'}</TableCell>
                      <TableCell>{safeBonito(d.estado_valoracion) || '—'}</TableCell>
                      <TableCell>{d.precio_final || '—'}</TableCell>
                      <TableCell>{d.observaciones || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={dispositivos.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.type}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ whiteSpace: 'pre-line' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
