"use client";

import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,Autocomplete,
  Button, TextField, CircularProgress, TablePagination, IconButton,MenuItem,Select
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import api from '@/services/api';
import { Snackbar, Alert } from '@mui/material';
import type { AlertColor } from '@mui/material';
import { EtiquetaTerminalPDFDoc } from '@/components/etiquetas/etiqueta-terminal'
import {  pdf } from '@react-pdf/renderer';

type Modelo = { id: number; descripcion: string };
type Capacidad = { id: number; tamaño: string };

type DispositivoRow = {
  id: string;
  origen: number | null;
  copia_n: number;
  modelo: Modelo | null;
  capacidad: Capacidad | null;
  imei: string;
  numero_serie: string;
  oportunidad: string;           // o number, pero luego convierte a String al pasar al PDF
  real_id: number | null;
  imei_original: string;
  numero_serie_original: string;
  estado_fisico?: string | null;
  estado_funcional?: string | null;
};

type DispositivoReal = {
  id: number;
  origen?: number | null;
  imei?: string | null;
  numero_serie?: string | null;
  asignado?: boolean;
};


export default function RecepcionDispositivosPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantParam = searchParams.get('tenant');
  if (!tenantParam) {
    return <Typography color="error">Falta el parámetro "tenant".</Typography>;
  }
  const tenant = tenantParam as string; // desde aquí tenant: string
  const id = params.id as string;
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [estadoOportunidad, setEstadoOportunidad] = useState<string | null>(null)
  const [snackbarSeverity, setSnackbarSeverity] = useState<AlertColor>('success');
  const [cliente, setCliente] = useState<DispositivoRow[]>([]);
  
  const [loading, setLoading] = useState(true);

  const imeiRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [guardados, setGuardados] = useState<string[]>([]);
  const makeEmptyRow = (opId: string, nextIndex: number): DispositivoRow => ({
    id: `nuevo-${nextIndex + 1}`,
    origen: null,
    copia_n: 1,
    modelo: null,
    capacidad: null,
    imei: '',
    numero_serie: '',
    oportunidad: opId,         // usa el id de la oportunidad (string)
    real_id: null,
    imei_original: '',
    numero_serie_original: '',
    estado_fisico: null,
    estado_funcional: null,
  });
  const fetch = async () => {
    setLoading(true);

    const res1 = await api.get(`/api/oportunidades-globales/${tenant}/${id}/`);
    setEstadoOportunidad(res1.data.estado || null);

    const dispositivosOriginales = (res1.data.dispositivos || []) as any[];

    // Expandir según cantidad
    const dispositivosExpand: DispositivoRow[] = dispositivosOriginales.flatMap((d: any) =>
      Array.from({ length: d.cantidad || 1 }).map((_, i) => ({
        id: `${d.id}-${i + 1}`,
        origen: d.id,
        copia_n: i + 1,
        modelo: d.modelo ?? null,
        capacidad: d.capacidad ?? null,
        imei: '',
        numero_serie: '',
        oportunidad: String(res1.data.id),
        real_id: null,
        imei_original: '',
        numero_serie_original: '',
        estado_fisico: d.estado_fisico ?? null,
        estado_funcional: d.estado_funcional ?? null,
      }))
    );

    const realesRes = await api.get(`/api/dispositivos-reales-globales/${tenant}/${id}/`);
    const reales: DispositivoReal[] = realesRes.data?.dispositivos ?? [];

    // Match explícito por origen
    const dispositivosMerged: DispositivoRow[] = dispositivosExpand.map((d: DispositivoRow) => {
      const real = reales.find((r: DispositivoReal) => r.origen === d.origen && !r.asignado);
      if (real) (real as DispositivoReal).asignado = true;

       return {
        ...d,
        imei: real?.imei ?? '',
        numero_serie: real?.numero_serie ?? '',
        real_id: real?.id ?? null,
        imei_original: real?.imei ?? '',
        numero_serie_original: real?.numero_serie ?? '',
      };
    });

    console.log("🧩 Mapeo resultante:", dispositivosMerged);

    setCliente(dispositivosMerged);
    setLoading(false);
  };
  
  const [modelos, setModelos] = useState([]);
  const [capacidades, setCapacidades] =
    useState<Record<number, { id:number; tamaño:string }[]>>({});

  useEffect(() => {
    const fetchModelos = async () => {
      const res = await api.get('/api/modelos/');
      setModelos(res.data);
    };
    fetchModelos();
  }, []);

  const fetchCapacidades = async (modeloId: number) => {
    if (!capacidades[modeloId]) {
      const res = await api.get(`/api/capacidades-por-modelo/?modelo=${modeloId}`);
      setCapacidades((prev) => ({ ...prev, [modeloId]: res.data }));
    }
  };

  useEffect(() => {
    if (id && tenant) fetch();
  }, [id, tenant]);

  const handleChangeCampo = async (value: string, index: number, field: 'imei' | 'numero_serie') => {
    const current = cliente[index];
    if (!current?.modelo?.id) return;

    const rawValue = typeof value === 'string' ? value.trim() : '';
    const imeiFinal = field === 'imei' ? rawValue : typeof current.imei === 'string' ? current.imei.trim() : '';
    const snFinal = field === 'numero_serie' ? rawValue : typeof current.numero_serie === 'string' ? current.numero_serie.trim() : '';

    if (!imeiFinal && !snFinal) return; // al menos uno requerido

    const yaExiste = cliente.some((d, i) => {
      if (i === index) return false;
      const imei = d.imei?.trim() || '';
      const sn = d.numero_serie?.trim() || '';
      return (imei && imei === imeiFinal) || (sn && sn === snFinal);
    });

    if (yaExiste) {
      setSnackbarMsg("Este IMEI o número de serie ya ha sido registrado.");
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }

    const payload = {
      modelo_id: current.modelo.id,
      capacidad_id: current.capacidad?.id || null,
      imei: imeiFinal || null,
      numero_serie: snFinal || null,
      oportunidad: id,
      origen: current.origen || null,
      estado_fisico: current.estado_fisico || null,
      estado_funcional: current.estado_funcional || null,
    };

    try {
      const updated = [...cliente];
      if (current.real_id) {
        if (current.imei_original === imeiFinal && current.numero_serie_original === snFinal) return;
        await api.put(`/api/dispositivos-reales-globales/${tenant}/editar/${current.real_id}/`, payload);
        updated[index].imei = imeiFinal;
        updated[index].numero_serie = snFinal;
        updated[index].imei_original = imeiFinal;
        updated[index].numero_serie_original = snFinal;
        setGuardados((prev) =>
          [...prev.filter((v) => v !== current.imei_original && v !== current.numero_serie_original), imeiFinal, snFinal].filter(Boolean)
        );
      } else {
        const res = await api.post(`/api/dispositivos-reales-globales/${tenant}/crear/`, payload);
        updated[index].imei = imeiFinal;
        updated[index].numero_serie = snFinal;
        updated[index].real_id = res.data?.id;
        updated[index].imei_original = imeiFinal;
        updated[index].numero_serie_original = snFinal;
        setGuardados((prev) => [...prev, imeiFinal, snFinal].filter(Boolean));
        if (imeiRefs.current[index + 1]) imeiRefs.current[index + 1]?.focus();
      }
      setCliente(updated);
    } catch (err) {
      console.error('Error guardando dispositivo:', err);
    }
  };

  const eliminarFila = async (index: number) => {
    const item = cliente[index];
    const imei = item.imei_original?.trim();
    const numero_serie = item.numero_serie_original?.trim();

    // Solo borrar si fue guardado
    if (imei || numero_serie) {
      try {
        await api.delete(`/api/dispositivos-reales-globales/${tenant}/borrar/`, {
          data: {
            imei: imei || null,
            numero_serie: numero_serie || null,
            oportunidad: id
          },
          headers: { "Content-Type": "application/json" }
        });
        setGuardados((prev) => prev.filter((v) => v !== imei && v !== numero_serie));
      } catch (err) {
        console.error("Error al eliminar el dispositivo real:", err);
        return;
      }
    }

    const updated = [...cliente];
    updated.splice(index, 1);
    setCliente(updated);
  };

    const confirmarRecepcion = async () => {
        try {
            await api.post(`/api/oportunidades-globales/${tenant}/${id}/confirmar-recepcion/`);
            setSnackbarMsg("Recepción confirmada. Oportunidad marcada como 'Check in OK'.");
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            setTimeout(() => {
            router.push(`/oportunidades/global/${tenant}/${id}`);
            }, 1500);
        } catch (err) {
            setSnackbarMsg("Error al confirmar la recepción.");
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        }
    };

  const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  const [modelosDisponibles, setModelosDisponibles] = useState<any[]>([]);

    useEffect(() => {
      api.get("/api/modelos/").then((res) => setModelosDisponibles(res.data));
    }, []);


  const handleVisualizarPDF = async (d: any) => {
    const blob = await pdf(
      <EtiquetaTerminalPDFDoc
        tenant={tenant}
        oportunidad={String(d.oportunidad)}
        imei={d.imei}
        numeroSerie={d.numero_serie}
        modelo={d.modelo?.descripcion || ''}
        capacidad={d.capacidad?.tamaño || ''}
      />
    ).toBlob();

    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  };
  return (
    <Box p={3}>
  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
    <Typography variant="h5" fontWeight="bold">
      Recepción de dispositivos
    </Typography>
    <Button
      variant="outlined"
      onClick={() => {
        setCliente(prev => [...prev, makeEmptyRow(String(id), prev.length)]);
      }}
    >
      Añadir fila
    </Button>
    </Box>

    {loading ? (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    ) : (
      <>
        <Typography variant="h6" gutterBottom>
          Dispositivos informados por el cliente
        </Typography>

        <Table size="small" sx={{ mb: 0 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 70 }}>ID</TableCell>
              <TableCell sx={{ width: 220 }}>Modelo</TableCell>
              <TableCell sx={{ width: 160 }}>Capacidad</TableCell>
              <TableCell sx={{ width: 180 }}>IMEI</TableCell>
              <TableCell sx={{ width: 180 }}>Nº Serie</TableCell>
              <TableCell sx={{ width: 50 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {cliente.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((d: DispositivoRow, index: number) => {
              const globalIndex = page * rowsPerPage + index;
              return (
                <TableRow
                  key={d.id}
                  sx={{ backgroundColor: index % 2 === 0 ? 'action.hover' : 'transparent' }}
                >
                  <TableCell>{d.id}</TableCell>
                  <TableCell>
                    {d.modelo?.id ? (
                      d.modelo.descripcion
                    ) : (
                      <Autocomplete
                        options={modelosDisponibles}
                        getOptionLabel={(option) => option.descripcion}
                        value={null}
                        isOptionEqualToValue={(option, value) => option.id === (value?.id ?? -1)}
                        onChange={(_, newValue) => {
                          if (!newValue) return;
                          const updated = [...cliente];
                          updated[globalIndex].modelo = newValue;
                          setCliente(updated);
                          fetchCapacidades(newValue.id);
                        }}
                        renderInput={(params) => (
                          <TextField {...params} size="small" placeholder="Buscar modelo" />
                        )}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const modeloId = d.modelo?.id;      
                      if (!modeloId) return null;         

                      return d.capacidad?.id ? (
                        d.capacidad.tamaño
                      ) : (
                        <Select
                          size="small"
                          value={d.capacidad?.id ?? ''}     
                          onChange={(e) => {
                            const selectedCapacidadId = Number(e.target.value);
                            if (!modeloId) return;         
                            const opciones = capacidades[modeloId] ?? [];
                            const capSel = opciones.find(c => c.id === selectedCapacidadId) ?? null;

                            setCliente(prev => {
                              const copy = [...prev];
                              copy[globalIndex] = { ...copy[globalIndex], capacidad: capSel };
                              return copy;
                            });
                          }}
                          displayEmpty
                          fullWidth
                        >
                          <MenuItem value="" disabled>Capacidad</MenuItem>
                          {(capacidades[modeloId] ?? []).map(c => (
                            <MenuItem key={c.id} value={c.id}>{c.tamaño}</MenuItem>
                          ))}
                        </Select>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={d.imei || ''}
                      inputRef={(el) => (imeiRefs.current[globalIndex] = el)}
                      onChange={(e) => {
                        const updated = [...cliente];
                        updated[globalIndex].imei = e.target.value;
                        setCliente(updated);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleChangeCampo((e.target as HTMLInputElement).value, globalIndex, 'imei');
                        }
                      }}
                      onBlur={(e) => {
                        handleChangeCampo((e.target as HTMLInputElement).value, globalIndex, 'imei');
                      }}
                      size="small"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      value={d.numero_serie || ''}
                      onChange={(e) => {
                        const updated = [...cliente];
                        updated[globalIndex].numero_serie = e.target.value;
                        setCliente(updated);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleChangeCampo((e.target as HTMLInputElement).value, globalIndex, 'numero_serie');
                        }                       
                      }}
                      onBlur={(e) => {
                        handleChangeCampo((e.target as HTMLInputElement).value, globalIndex, 'numero_serie');
                      }}
                      size="small"
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => eliminarFila(globalIndex)} size="small">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleVisualizarPDF(d)}>
                      🖨️
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={cliente.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />

        <Box display="flex" justifyContent="flex-end" mt={3}>
          <Button onClick={confirmarRecepcion} variant="contained" color="primary" disabled={estadoOportunidad == "Rdecibido"} >
            Confirmar recepción
          </Button>
        </Box>
      </>
    )}

    <Snackbar
      open={snackbarOpen}
      autoHideDuration={5000}
      onClose={() => setSnackbarOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity={snackbarSeverity} variant="filled" onClose={() => setSnackbarOpen(false)}>
        {snackbarMsg}
      </Alert>
    </Snackbar>
  </Box>

  );
}