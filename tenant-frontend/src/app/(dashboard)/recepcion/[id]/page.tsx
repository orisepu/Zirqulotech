"use client";

import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,Autocomplete,
  Button, TextField, CircularProgress, TablePagination, IconButton,MenuItem,Select, Tooltip
} from '@mui/material';
import { Delete as DeleteIcon, Print as PrintIcon } from '@mui/icons-material';
import api from '@/services/api';
import { Snackbar, Alert } from '@mui/material';
import type { AlertColor } from '@mui/material';
import { EtiquetaTerminalPDFDoc } from '@/shared/components/ui/tags/etiqueta-terminal'
import {  pdf } from '@react-pdf/renderer';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type Modelo = { id: number; descripcion: string };
type Capacidad = { id: number; tamaño: string };
type DispositivoPersonalizado = {
  id: number;
  marca: string;
  modelo: string;
  capacidad?: string;
  tipo: string;
  descripcion_completa: string;
};

type DispositivoRow = {
  id: string;
  origen: number | null;
  copia_n: number;
  modelo: Modelo | null;
  capacidad: Capacidad | null;
  dispositivo_personalizado: DispositivoPersonalizado | null;
  imei: string;
  numero_serie: string;
  oportunidad: string;
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
  const queryClient = useQueryClient();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [estadoOportunidad, setEstadoOportunidad] = useState<string | null>(null)
  const [snackbarSeverity, setSnackbarSeverity] = useState<AlertColor>('success');
  const [cliente, setCliente] = useState<DispositivoRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // loading gestionado por React Query

  const imeiRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [guardados, setGuardados] = useState<string[]>([]);
  const [pageAnnouncement, setPageAnnouncement] = useState('');
  const makeEmptyRow = (opId: string, nextIndex: number): DispositivoRow => ({
    id: `nuevo-${nextIndex + 1}`,
    origen: null,
    copia_n: 1,
    modelo: null,
    capacidad: null,
    dispositivo_personalizado: null,
    imei: '',
    numero_serie: '',
    oportunidad: opId,
    real_id: null,
    imei_original: '',
    numero_serie_original: '',
    estado_fisico: null,
    estado_funcional: null,
  });
  // Carga inicial con React Query
  const recepcionQuery = useQuery<{ estado: any; oppId: string; originales: any[]; reales: DispositivoReal[] }>({
    queryKey: ['recepcion', tenant, id],
    queryFn: async () => {
      const res1 = await api.get(`/api/oportunidades-globales/${tenant}/${id}/`);
      const originales = (res1.data.dispositivos || []) as any[];
      const realesRes = await api.get(`/api/dispositivos-reales-globales/${tenant}/${id}/`);
      const reales: DispositivoReal[] = realesRes.data?.dispositivos ?? [];
      return { estado: res1.data.estado || null, oppId: String(res1.data.id), originales, reales };
    },
    staleTime: 30_000,
  });

  // Derivar estado local cliente a partir de la query
  useEffect(() => {
    const payload = recepcionQuery.data;
    if (!payload) return;
    const { estado, oppId, originales, reales } = payload;
    setEstadoOportunidad(estado);
    const dispositivosExpand: DispositivoRow[] = originales.flatMap((d: any) =>
      Array.from({ length: d.cantidad || 1 }).map((_, i) => ({
        id: `${d.id}-${i + 1}`,
        origen: d.id,
        copia_n: i + 1,
        modelo: d.modelo ?? null,
        capacidad: d.capacidad ?? null,
        dispositivo_personalizado: d.dispositivo_personalizado ?? null,
        imei: '',
        numero_serie: '',
        oportunidad: oppId,
        real_id: null,
        imei_original: '',
        numero_serie_original: '',
        estado_fisico: d.estado_fisico ?? null,
        estado_funcional: d.estado_funcional ?? null,
      }))
    );

    const realesCopy: (DispositivoReal & { asignado?: boolean })[] = [...reales];
    const dispositivosMerged: DispositivoRow[] = dispositivosExpand.map((d: DispositivoRow) => {
      const real = realesCopy.find((r) => r.origen === d.origen && !r.asignado);
      if (real) real.asignado = true;
      return {
        ...d,
        imei: real?.imei ?? '',
        numero_serie: real?.numero_serie ?? '',
        real_id: real?.id ?? null,
        imei_original: real?.imei ?? '',
        numero_serie_original: real?.numero_serie ?? '',
      };
    });
    setCliente(dispositivosMerged);
  }, [recepcionQuery.data]);
  
  const [capacidades, setCapacidades] = useState<Record<number, { id:number; tamaño:string }[]>>({});
  const [modeloSearch, setModeloSearch] = useState('');
  const { data: modelosDisponibles = [], isFetching: buscandoModelos } = useQuery({
    queryKey: ['modelos', modeloSearch],
    queryFn: async (): Promise<any[]> => {
      const params: Record<string, string> = {};
      const s = (modeloSearch || '').trim();
      if (s.length >= 2) params.search = s;
      const res = await api.get('/api/modelos/', { params });
      const d = res.data;
      if (Array.isArray(d)) return d;
      if (d && Array.isArray(d.results)) return d.results;
      return [];
    },
    staleTime: 30_000,
  });
  const ensureCapacidades = async (modeloId: number) => {
    const data = await queryClient.ensureQueryData<{ id:number; tamaño:string }[]>({
      queryKey: ['capacidades-por-modelo', modeloId],
      queryFn: async () => {
        const res = await api.get(`/api/capacidades-por-modelo/?modelo=${modeloId}`)
        const d = res.data
        return Array.isArray(d) ? d : (Array.isArray(d?.results) ? d.results : [])
      },
      staleTime: 5 * 60_000,
    });
    setCapacidades((prev) => (prev[modeloId] ? prev : { ...prev, [modeloId]: data }));
  };

  // Mutations para reales y confirmar recepción
  const mCrearReal = useMutation({
    mutationFn: async (payload: any) => (await api.post(`/api/dispositivos-reales-globales/${tenant}/crear/`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recepcion', tenant, id] }),
  })
  const mEditarReal = useMutation({
    mutationFn: async ({ realId, payload }: { realId: number; payload: any }) =>
      (await api.put(`/api/dispositivos-reales-globales/${tenant}/editar/${realId}/`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recepcion', tenant, id] }),
  })
  const mBorrarReal = useMutation({
    mutationFn: async (body: { imei: string | null; numero_serie: string | null; oportunidad: string }) =>
      api.delete(`/api/dispositivos-reales-globales/${tenant}/borrar/`, { data: body, headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recepcion', tenant, id] }),
  })
  const mConfirmarRecepcion = useMutation({
    mutationFn: async () => api.post(`/api/oportunidades-globales/${tenant}/${id}/confirmar-recepcion/`),
  })

  useEffect(() => {
    if (id && tenant) queryClient.invalidateQueries({ queryKey: ['recepcion', tenant, id] });
  }, [id, tenant]);

  const handleChangeCampo = async (value: string, index: number, field: 'imei' | 'numero_serie') => {
    const current = cliente[index];
    const errorKey = `${field}-${index}`;

    // Clear previous error for this field
    setFieldErrors(prev => {
      const next = { ...prev };
      delete next[errorKey];
      return next;
    });

    // Validar que haya un modelo (Apple) o dispositivo personalizado
    if (!current?.modelo?.id && !current?.dispositivo_personalizado?.id) return;

    const rawValue = typeof value === 'string' ? value.trim() : '';
    const normalizeDigits = (s: string) => s.replace(/\D/g, '');
    const isValidIMEI = (s: string) => {
      const digits = normalizeDigits(s);
      if (digits.length !== 15) return false;
      // Luhn checksum
      let sum = 0;
      for (let i = 0; i < 15; i++) {
        let d = Number(digits.charAt(14 - i));
        if (i % 2 === 1) { // dobla cada segundo dígito desde la derecha
          d *= 2;
          if (d > 9) d -= 9;
        }
        sum += d;
      }
      return sum % 10 === 0;
    };

    const imeiFinalRaw = field === 'imei' ? rawValue : typeof current.imei === 'string' ? current.imei.trim() : '';
    const imeiFinal = normalizeDigits(imeiFinalRaw);
    const snFinal = field === 'numero_serie' ? rawValue : typeof current.numero_serie === 'string' ? current.numero_serie.trim() : '';

    if (!imeiFinal && !snFinal) return; // al menos uno requerido

    // Validación estricta solo en producción: si hay IMEI, debe ser válido
    const isProd = process.env.NODE_ENV === 'production'
    if (isProd && imeiFinal && !isValidIMEI(imeiFinal)) {
      const errorMsg = 'IMEI inválido. Debe tener 15 dígitos y checksum válido.';
      setFieldErrors(prev => ({ ...prev, [errorKey]: errorMsg }));
      setSnackbarMsg(`❌ ${errorMsg}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    const yaExiste = cliente.some((d, i) => {
      if (i === index) return false;
      const imei = (d.imei ? d.imei.trim() : '');
      const imeiDigits = imei.replace(/\D/g, '');
      const sn = d.numero_serie?.trim() || '';
      return (imeiDigits && imeiDigits === imeiFinal) || (sn && sn === snFinal);
    });

    if (yaExiste) {
      const errorMsg = field === 'imei'
        ? 'Este IMEI ya ha sido registrado en otro dispositivo.'
        : 'Este número de serie ya ha sido registrado.';
      setFieldErrors(prev => ({ ...prev, [errorKey]: errorMsg }));
      setSnackbarMsg(errorMsg);
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }

    const payload = {
      modelo_id: current.modelo?.id || null,
      capacidad_id: current.capacidad?.id || null,
      dispositivo_personalizado_id: current.dispositivo_personalizado?.id || null,
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
        await mEditarReal.mutateAsync({ realId: current.real_id, payload });
        updated[index].imei = imeiFinal;
        updated[index].numero_serie = snFinal;
        updated[index].imei_original = imeiFinal;
        updated[index].numero_serie_original = snFinal;
        setGuardados((prev) =>
          [...prev.filter((v) => v !== current.imei_original && v !== current.numero_serie_original), imeiFinal, snFinal].filter(Boolean)
        );
      } else {
        const res = await mCrearReal.mutateAsync(payload);
        updated[index].imei = imeiFinal;
        updated[index].numero_serie = snFinal;
        updated[index].real_id = (res as any)?.id;
        updated[index].imei_original = imeiFinal;
        updated[index].numero_serie_original = snFinal;
        setGuardados((prev) => [...prev, imeiFinal, snFinal].filter(Boolean));
        if (imeiRefs.current[index + 1]) {
          imeiRefs.current[index + 1]?.focus();
        } else {
          // Last row - focus the "Add Row" button
          document.querySelector<HTMLButtonElement>('[data-add-row]')?.focus();
        }
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
        await mBorrarReal.mutateAsync({ imei: imei || null, numero_serie: numero_serie || null, oportunidad: id });
        setGuardados((prev) => prev.filter((v) => v !== imei && v !== numero_serie));
      } catch (err) {
        console.error("Error al eliminar el dispositivo real:", err);
        return;
      }
    }

    const updated = [...cliente];
    updated.splice(index, 1);
    setCliente(updated);

    // Manage focus after deletion
    setTimeout(() => {
      const nextIndex = Math.min(index, updated.length - 1);
      if (nextIndex >= 0 && imeiRefs.current[nextIndex]) {
        imeiRefs.current[nextIndex]?.focus();
      } else {
        // If no rows left, focus the "Add Row" button
        document.querySelector<HTMLButtonElement>('[data-add-row]')?.focus();
      }
    }, 100);
  };

    const confirmarRecepcion = async () => {
        try {
            await mConfirmarRecepcion.mutateAsync();
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

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
    setPageAnnouncement(`Página ${newPage + 1} de ${Math.ceil(cliente.length / rowsPerPage)}`);
  };
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  // modelosDisponibles proviene de React Query (arriba)


  const handleVisualizarPDF = async (d: any) => {
    // Para dispositivos personalizados, usar la descripción completa
    const modelo = d.dispositivo_personalizado
      ? d.dispositivo_personalizado.descripcion_completa
      : (d.modelo?.descripcion || '');
    const capacidad = d.dispositivo_personalizado
      ? '' // La capacidad ya está incluida en descripcion_completa
      : (d.capacidad?.tamaño || '');

    const blob = await pdf(
      <EtiquetaTerminalPDFDoc
        tenant={tenant}
        oportunidad={String(d.oportunidad)}
        imei={d.imei}
        numeroSerie={d.numero_serie}
        modelo={modelo}
        capacidad={capacidad}
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
      data-add-row
      onClick={() => {
        setCliente(prev => [...prev, makeEmptyRow(String(id), prev.length)]);
      }}
    >
      Añadir fila
    </Button>
    </Box>

    {recepcionQuery.isLoading ? (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        my={4}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <CircularProgress aria-label="Cargando dispositivos" />
        <Typography sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}>Cargando información de dispositivos...</Typography>
      </Box>
    ) : (
      <>
        <Typography variant="h6" gutterBottom>
          Dispositivos informados por el cliente
        </Typography>

        <Table id="devices-table" aria-labelledby="devices-table-label" size="small" sx={{ mb: 0 }}>
          <caption id="devices-table-label" style={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: '1px',
            height: '1px',
            overflow: 'hidden'
          }}>
            Dispositivos informados por el cliente
          </caption>
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
                    {d.dispositivo_personalizado ? (
                      d.dispositivo_personalizado.descripcion_completa
                    ) : d.modelo?.id ? (
                      d.modelo.descripcion
                    ) : (
                      <Autocomplete
                        options={Array.isArray(modelosDisponibles) ? modelosDisponibles : []}
                        filterOptions={(x) => x}
                        getOptionLabel={(option: any) => String(option?.descripcion ?? '')}
                        value={null}
                        loading={buscandoModelos}
                        loadingText="Buscando..."
                        noOptionsText={(modeloSearch || '').trim().length < 2 ? 'Escribe modelo para buscar' : 'Sin resultados'}
                        onInputChange={(_, val) => setModeloSearch(val || '')}
                        isOptionEqualToValue={(option, value) => option.id === (value?.id ?? -1)}
                        onChange={(_, newValue) => {
                          if (!newValue) return;
                          const updated = [...cliente];
                          updated[globalIndex].modelo = newValue;
                          setCliente(updated);
                          ensureCapacidades(newValue.id);
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            label="Modelo"
                            placeholder="Buscar modelo"
                            aria-label="Seleccionar modelo del dispositivo"
                          />
                        )}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // Si es dispositivo personalizado, mostrar su capacidad (si existe)
                      if (d.dispositivo_personalizado) {
                        return d.dispositivo_personalizado.capacidad || '-';
                      }

                      // Si no es dispositivo personalizado, debe tener modelo Apple
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
                      label="IMEI"
                      inputRef={(el) => (imeiRefs.current[globalIndex] = el)}
                      error={!!fieldErrors[`imei-${globalIndex}`]}
                      helperText={fieldErrors[`imei-${globalIndex}`] || 'IMEI (15 dígitos) o Nº Serie requerido'}
                      inputProps={{
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        maxLength: 15,
                        'aria-label': 'IMEI del dispositivo',
                        'aria-invalid': !!fieldErrors[`imei-${globalIndex}`],
                        'aria-describedby': fieldErrors[`imei-${globalIndex}`]
                          ? `imei-error-${globalIndex}`
                          : `imei-helper-${globalIndex}`,
                        'aria-required': !d.numero_serie
                      }}
                      FormHelperTextProps={{
                        id: fieldErrors[`imei-${globalIndex}`]
                          ? `imei-error-${globalIndex}`
                          : `imei-helper-${globalIndex}`,
                        role: fieldErrors[`imei-${globalIndex}`] ? 'alert' : undefined
                      }}
                      onChange={(e) => {
                        const onlyDigits = (e.target.value || '').replace(/\D/g, '').slice(0, 15)
                        const updated = [...cliente];
                        updated[globalIndex].imei = onlyDigits;
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
                      label="Nº Serie"
                      error={!!fieldErrors[`numero_serie-${globalIndex}`]}
                      helperText={fieldErrors[`numero_serie-${globalIndex}`] || 'IMEI o Nº Serie requerido'}
                      inputProps={{
                        'aria-label': 'Número de serie del dispositivo',
                        'aria-invalid': !!fieldErrors[`numero_serie-${globalIndex}`],
                        'aria-describedby': fieldErrors[`numero_serie-${globalIndex}`]
                          ? `numero-serie-error-${globalIndex}`
                          : `numero-serie-helper-${globalIndex}`,
                        'aria-required': !d.imei
                      }}
                      FormHelperTextProps={{
                        id: fieldErrors[`numero_serie-${globalIndex}`]
                          ? `numero-serie-error-${globalIndex}`
                          : `numero-serie-helper-${globalIndex}`,
                        role: fieldErrors[`numero_serie-${globalIndex}`] ? 'alert' : undefined
                      }}
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
                    <Tooltip title="Eliminar dispositivo">
                      <IconButton
                        onClick={() => eliminarFila(globalIndex)}
                        size="small"
                        aria-label={`Eliminar dispositivo ${d.id}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Imprimir etiqueta">
                      <IconButton
                        size="small"
                        onClick={() => handleVisualizarPDF(d)}
                        aria-label={`Imprimir etiqueta del dispositivo ${d.id}`}
                      >
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
          aria-label="Paginación de tabla"
        />
        <Typography
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0
          }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {pageAnnouncement}
        </Typography>

        <Box display="flex" justifyContent="flex-end" mt={3}>
          <Tooltip
            title={estadoOportunidad === "Rdecibido" ? "La recepción ya ha sido confirmada para esta oportunidad" : ""}
            arrow
          >
            <span>
              <Button
                onClick={confirmarRecepcion}
                variant="contained"
                color="primary"
                disabled={estadoOportunidad === "Rdecibido"}
                aria-disabled={estadoOportunidad === "Rdecibido"}
              >
                Confirmar recepción
              </Button>
            </span>
          </Tooltip>
        </Box>
      </>
    )}

    <Snackbar
      open={snackbarOpen}
      autoHideDuration={5000}
      onClose={() => setSnackbarOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity={snackbarSeverity}
        variant="filled"
        onClose={() => setSnackbarOpen(false)}
        role={snackbarSeverity === 'error' ? 'alert' : 'status'}
        aria-live={snackbarSeverity === 'error' ? 'assertive' : 'polite'}
      >
        {snackbarMsg}
      </Alert>
    </Snackbar>
  </Box>

  );
}
