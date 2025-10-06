'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, Snackbar, Alert, Button, Grid
} from '@mui/material';
import api from '@/services/api';
import TablaReactiva from '@/shared/components/TablaReactiva2';
import { getColumnasAuditoria } from '@/shared/components/TablaColumnas2';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { FormularioAuditoriaDispositivoV2, type ValoresAuditoria } from '@/features/opportunities/components/forms/auditoria';
import { calcularEstadoDetallado } from '@/features/opportunities/components/forms/valoracion';

type DispositivoEditable = ValoresAuditoria & {
  auditado?: boolean;
};

export default function AuditoriaDispositivosPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const tenant = searchParams.get('tenant');

  const [filaEditando, setFilaEditando] = useState<number | null>(null);
  const [dispositivosEditables, setDispositivosEditables] = useState<DispositivoEditable[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; type: 'success'|'error'|'warning'|'info' }>({ open: false, message: '', type: 'success' });
  const [auditoriaIniciada, setAuditoriaIniciada] = useState(false);

  // Form modal
  const [openForm, setOpenForm] = useState(false);
  const [actualIndex, setActualIndex] = useState<number>(-1);

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['dispositivos-auditoria', tenant, id],
    queryFn: async () => {
      const res = await api.get(`/api/dispositivos-reales-globales/${tenant}/${id}/`);
      return res.data;
    },
    enabled: !!tenant && !!id,
  });

  const estadoOportunidad = data?.estado || null;
  const Modelo_id = data?.dispositivos.id || null;
  useEffect(() => {
    if (data?.dispositivos) {
      const ordenados = [...data.dispositivos].sort((a: any, b: any) => a.id - b.id);
      const mismosIds = JSON.stringify(ordenados.map((d: any) => d.id)) === JSON.stringify(dispositivosEditables.map((d) => d.id));
      if (!mismosIds) setDispositivosEditables(ordenados);
    }
  }, [data?.dispositivos, dispositivosEditables]);

  const mutationEdit = useMutation({
    mutationFn: async (payload: any) => {
      return api.put(`/api/dispositivos-reales-globales/${tenant}/editar/${payload.id}/`, payload);
    },
  });

  const abrirFormulario = useCallback((index: number) => {
    setActualIndex(index);
    setOpenForm(true);
  }, []);

  const cerrarFormulario = () => {
    setOpenForm(false);
  };

  const guardarAuditoria = async (val: ValoresAuditoria) => {
    if (!val.estado_fisico || !val.estado_funcional) {
      setSnackbar({ open: true, message: 'Completa los estados físico y funcional', type: 'warning' });
      return false;
    }

    try {
      if (!auditoriaIniciada && estadoOportunidad === 'Check in OK') {
        await api.patch(`/api/oportunidades-globales/${tenant}/${id}/cambiar-estado/`, {
          estado: 'En revisión',
          schema: tenant,
        });
        setAuditoriaIniciada(true);
      }

      await api.post(`/api/auditorias-globales/${tenant}/`, {
        dispositivo_id: val.id,
        estado_fisico: val.estado_fisico,
        estado_funcional: val.estado_funcional,
        estado_valoracion: val.estado_valoracion ?? null,
        observaciones: val.observaciones ?? '',
        precio_final: val.precio_final ?? null,

        salud_bateria_pct: val.salud_bateria_pct ?? null,
        ciclos_bateria: val.ciclos_bateria ?? null,
        pantalla_funcional_puntos_bril: !!val.pantalla_funcional_puntos_bril,
        pantalla_funcional_pixeles_muertos: !!val.pantalla_funcional_pixeles_muertos,
        pantalla_funcional_lineas_quemaduras: !!val.pantalla_funcional_lineas_quemaduras,
        desgaste_lateral: val.desgaste_lateral ?? 'ninguno',
        desgaste_trasero: val.desgaste_trasero ?? 'ninguno',
      });

      // Actualiza la fila en memoria
      setDispositivosEditables((prev) =>
        prev.map((d, i) => i === actualIndex ? { ...d, ...val, auditado: true } : d)
      );

      setSnackbar({ open: true, message: 'Auditoría guardada', type: 'success' });
      return true;
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Error al guardar', type: 'error' });
      return false;
    }
  };

  const onSubmitForm = async (val: ValoresAuditoria, opts?: { siguiente?: boolean }) => {
    const ok = await guardarAuditoria(val);
    if (!ok) return;

    if (opts?.siguiente) {
      const next = actualIndex + 1;
      if (next < dispositivosEditables.length) {
        setActualIndex(next);
        return; // mantiene el formulario abierto con el siguiente
      }
    }
    cerrarFormulario();
    refetch();
  };

 
  // Columnas de la tabla (mostramos datos + acción Auditar)
  const { columnas, zoom } = useMemo(() =>
    getColumnasAuditoria({
      // Nota: aquí ya no editamos inline; el form es externo.
      // Puedes ajustar getColumnasAuditoria para modo "solo lectura".
      handleChange: () => {}, // noop
      guardarAuditoria: () => {}, // noop
      filaEditando,
      setFilaEditando,
      dispositivosEditables,
      calcularEstadoValoracion: () => 'bueno', // noop (no se usa en modo lectura)
      formTemporal: {},
      setFormTemporal: () => {}
    }),
   
  [filaEditando, dispositivosEditables]);

  const columnasConAccion = useMemo(() => {
    const extra: ColumnDef<DispositivoEditable, any> = {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => {
        const idx = row.index;
        return (
          <Button variant="contained" size="small" onClick={() => abrirFormulario(idx)}>
            Auditar
          </Button>
        );
      },
    };
    return [...(columnas as any[]), extra] as unknown as ColumnDef<DispositivoEditable, any>[];
  }, [columnas, abrirFormulario]);

  const totalDispositivos = dispositivosEditables.length;
  const dispositivosAuditados = dispositivosEditables.filter(
    (d) => d.auditado && d.precio_final != null && d.estado_fisico && d.estado_funcional
  ).length;
  const auditoriaCompleta = totalDispositivos > 0 && dispositivosAuditados === totalDispositivos;
  const todosIguales = dispositivosEditables
    .filter((d) => d.auditado && d.precio_final != null)
    .every((d) => d.precio_final === d.precio_orientativo);

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Auditorías de dispositivos
      </Typography>

      {/* Cabecera */}
      <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="body2" color={auditoriaCompleta ? 'success.main' : 'error'}>
            {auditoriaCompleta ? '✔' : '✖'} {dispositivosAuditados}/{totalDispositivos} auditados
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', gap: 2, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          {(estadoOportunidad === 'En revisión' || auditoriaCompleta) && (
            <Button
              variant="contained"
              color="primary"
              onClick={async () => {
                const nuevoEstado = todosIguales ? 'Oferta confirmada' : 'Nueva oferta enviada';
                try {
                  await api.patch(`/api/oportunidades-globales/${tenant}/${id}/cambiar-estado/`, {
                    estado: nuevoEstado,
                    schema: tenant,
                  });
                  await api.post(`/api/oportunidades/${id}/enviar-correo-oferta/`, {
                    schema: tenant,
                    evento: 'Oferta enviada',
                  });
                  setSnackbar({
                    open: true,
                    message: `Auditoría finalizada. Estado: ${nuevoEstado} y correo enviado.`,
                    type: 'success',
                  });
                  refetch();
                } catch (error) {
                  console.error(error);
                  setSnackbar({ open: true, message: 'Error al finalizar la auditoría.', type: 'error' });
                }
              }}
              disabled={!dispositivosEditables.length}
            >
              Finalizar auditoría
            </Button>
          )}

          {estadoOportunidad !== 'En revisión' && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={async () => {
                try {
                  await api.post(`/api/oportunidades/${id}/enviar-correo-oferta/`, {
                    schema: tenant,
                    evento: 'Oferta enviada',
                  });
                  setSnackbar({ open: true, message: 'Correo reenviado correctamente.', type: 'success' });
                } catch (error) {
                  console.error(error);
                  setSnackbar({ open: true, message: 'Error al reenviar el correo.', type: 'error' });
                }
              }}
            >
              Reenviar correo
            </Button>
          )}
        </Grid>
      </Grid>

      {!auditoriaCompleta && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Todos los dispositivos deben estar auditados para aceptar la auditoría.
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}><CircularProgress /></Box>
      ) : (
        <TablaReactiva<DispositivoEditable>
          oportunidades={dispositivosEditables}
          columnas={columnasConAccion}
          meta={{ data: dispositivosEditables, setData: setDispositivosEditables, zoom }}
          loading={loading}
        />
      )}

      {(() => {
        const current: any = actualIndex >= 0 ? dispositivosEditables[actualIndex] : null
        const num = (v: any) => (typeof v === 'number' && Number.isFinite(v)) ? v : (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null)
        const modeloId = Modelo_id
        const capacidadId = current ? (
          num(current.capacidad_id) ?? num(current.cap_id) ?? num(current?.capacidad?.id) ?? num(current?.capacidadId) ?? num(current?.id_capacidad)
        ) : null
        console.log({ modeloId, capacidadId, current })
        return (
          <FormularioAuditoriaDispositivoV2
            open={openForm}
            dispositivo={current}
            modeloId={modeloId ?? undefined}
            capacidadId={capacidadId ?? undefined}
            tenant={tenant || undefined}
            canal={'B2B'}
            onClose={cerrarFormulario}
            onSubmit={onSubmitForm}
            titulo={`Auditar dispositivo ${actualIndex + 1} / ${dispositivosEditables.length}`}
          />
        )
      })()}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.type} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
