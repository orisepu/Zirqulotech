'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useMemo, useCallback } from 'react';
import { Box, Typography, CircularProgress, Snackbar, Alert, Button } from '@mui/material';
import TablaReactiva from '@/shared/components/TablaReactiva2';
import { getColumnasAuditoria } from '@/shared/components/TablaColumnas2';
import type { ColumnDef } from '@tanstack/react-table';
import {
  FormularioAuditoriaDispositivoV2,
  type ValoresAuditoria,
} from '@/features/opportunities/components/forms/auditoria';
import { AuditoriaHeader } from '@/features/opportunities/components/AuditoriaHeader';
import { AuditoriaActions } from '@/features/opportunities/components/AuditoriaActions';
import { useAuditoriaData } from '@/features/opportunities/hooks/useAuditoriaData';
import { useAuditoriaForm } from '@/features/opportunities/hooks/useAuditoriaForm';
import { useNotification } from '@/shared/hooks/useNotification';
import type { DispositivoReal, AuditoriaPayload } from '@/features/opportunities/types/auditoria';

export default function AuditoriaDispositivosPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const tenant = searchParams.get('tenant');

  // Early return with null safety validation
  if (!tenant || !id) {
    return (
      <Box p={3}>
        <Alert severity="error" role="alert">
          Parámetros de URL inválidos. Se requiere tenant e ID de oportunidad.
        </Alert>
      </Box>
    );
  }

  // State
  const [openForm, setOpenForm] = useState(false);
  const [actualIndex, setActualIndex] = useState<number>(-1);
  const [auditoriaIniciada, setAuditoriaIniciada] = useState(false);

  // Hooks
  const { dispositivos, guardarAuditoria, finalizarAuditoria, enviarCorreo } = useAuditoriaData({
    tenant,
    id: id as string,
  });

  const {
    notification,
    showSuccess,
    showError,
    showWarning,
    hideNotification,
  } = useNotification();

  // Derived state - replaces useEffect anti-pattern
  const dispositivosOrdenados = useMemo(() => {
    if (!dispositivos.data?.dispositivos) return [];
    return [...dispositivos.data.dispositivos].sort(
      (a: DispositivoReal, b: DispositivoReal) => a.id - b.id
    );
  }, [dispositivos.data?.dispositivos]);

  const estadoOportunidad = dispositivos.data?.estado || null;
  const modeloId = dispositivos.data?.modelo_id;

  // Form data - replaces complex IIFE
  const { dispositivo, modeloId: formModeloId, capacidadId } = useAuditoriaForm({
    dispositivos: dispositivosOrdenados,
    actualIndex,
    modeloId,
  });

  // Callbacks
  const abrirFormulario = useCallback((index: number) => {
    setActualIndex(index);
    setOpenForm(true);
  }, []);

  const cerrarFormulario = useCallback(() => {
    setOpenForm(false);
  }, []);

  const handleGuardarAuditoria = useCallback(
    async (val: ValoresAuditoria) => {
      if (!val.estado_fisico || !val.estado_funcional) {
        showWarning('Los campos Estado Físico y Estado Funcional son obligatorios');
        return false;
      }

      try {
        // Change status to "En revisión" on first audit
        if (!auditoriaIniciada && estadoOportunidad === 'Check in OK') {
          await dispositivos.refetch();
          setAuditoriaIniciada(true);
        }

        // Save audit
        const payload: AuditoriaPayload = {
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
        };

        await guardarAuditoria.mutateAsync(payload);
        showSuccess('Auditoría guardada correctamente');
        return true;
      } catch (err) {
        console.error(err);
        showError('Error al guardar la auditoría');
        return false;
      }
    },
    [
      auditoriaIniciada,
      estadoOportunidad,
      dispositivos,
      guardarAuditoria,
      showSuccess,
      showError,
      showWarning,
    ]
  );

  const onSubmitForm = useCallback(
    async (val: ValoresAuditoria, opts?: { siguiente?: boolean }) => {
      const ok = await handleGuardarAuditoria(val);
      if (!ok) return;

      if (opts?.siguiente) {
        const next = actualIndex + 1;
        if (next < dispositivosOrdenados.length) {
          setActualIndex(next);
          return;
        }
      }
      cerrarFormulario();
    },
    [handleGuardarAuditoria, actualIndex, dispositivosOrdenados.length, cerrarFormulario]
  );

  const handleFinalizarAuditoria = useCallback(
    async (nuevoEstado: string) => {
      try {
        await finalizarAuditoria.mutateAsync(nuevoEstado);
        showSuccess(`Auditoría finalizada. Estado: ${nuevoEstado} y correo enviado.`);
      } catch (error) {
        console.error(error);
        showError('Error al finalizar la auditoría.');
      }
    },
    [finalizarAuditoria, showSuccess, showError]
  );

  const handleReenviarCorreo = useCallback(async () => {
    try {
      await enviarCorreo.mutateAsync('Oferta enviada');
      showSuccess('Correo reenviado correctamente.');
    } catch (error) {
      console.error(error);
      showError('Error al reenviar el correo.');
    }
  }, [enviarCorreo, showSuccess, showError]);

  // Table columns - now static, only needs to calculate once
  const { columnas, zoom } = useMemo(() => getColumnasAuditoria(), []);

  const columnasConAccion = useMemo(() => {
    const extra: ColumnDef<DispositivoReal, unknown> = {
      id: 'acciones',
      header: 'Acciones',
      cell: ({ row }) => {
        const idx = row.index;
        return (
          <Button
            variant="contained"
            size="small"
            onClick={() => abrirFormulario(idx)}
            aria-label={`Auditar dispositivo ${idx + 1}`}
          >
            Auditar
          </Button>
        );
      },
    };
    return [...(columnas as ColumnDef<DispositivoReal, unknown>[]), extra];
  }, [columnas, abrirFormulario]);

  const tableMeta = useMemo(
    () => ({
      data: dispositivosOrdenados,
      setData: () => {},
      zoom,
    }),
    [dispositivosOrdenados, zoom]
  );

  // Loading state
  if (dispositivos.isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        my={4}
        role="status"
        aria-live="polite"
        aria-label="Cargando dispositivos para auditoría"
      >
        <CircularProgress aria-label="Cargando" />
        <Typography sx={{ position: 'absolute', left: '-10000px' }}>
          Cargando datos de auditoría...
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Skip Navigation Link */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: '-9999px',
          '&:focus': {
            position: 'fixed',
            top: 8,
            left: 8,
            zIndex: 9999,
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            padding: 2,
            textDecoration: 'none',
            borderRadius: 1,
          },
        }}
      >
        Saltar al contenido principal
      </Box>

      {/* Page Title - Semantic Heading */}
      <Typography variant="h5" component="h1" fontWeight="bold" gutterBottom id="main-content" tabIndex={-1}>
        Auditorías de dispositivos
      </Typography>

      {/* Header with Progress */}
      <AuditoriaHeader
        total={dispositivosOrdenados.length}
        auditados={
          dispositivosOrdenados.filter(
            (d) => d.auditado && d.precio_final != null && d.estado_fisico && d.estado_funcional
          ).length
        }
      />

      {/* Action Buttons */}
      <AuditoriaActions
        estadoOportunidad={estadoOportunidad}
        dispositivosCompletos={dispositivosOrdenados}
        onFinalizarAuditoria={handleFinalizarAuditoria}
        onReenviarCorreo={handleReenviarCorreo}
        isFinalizando={finalizarAuditoria.isPending}
        isReenviando={enviarCorreo.isPending}
      />

      {/* Devices Table */}
      <Box sx={{ overflowX: 'auto', width: '100%' }}>
        <TablaReactiva<DispositivoReal>
          oportunidades={dispositivosOrdenados}
          columnas={columnasConAccion}
          meta={tableMeta}
          loading={dispositivos.isLoading}
        />
      </Box>

      {/* Audit Form Modal */}
      <FormularioAuditoriaDispositivoV2
        open={openForm}
        dispositivo={dispositivo}
        modeloId={formModeloId}
        capacidadId={capacidadId}
        tenant={tenant}
        canal="B2B"
        onClose={cerrarFormulario}
        onSubmit={onSubmitForm}
        titulo={`Auditar dispositivo ${actualIndex + 1} / ${dispositivosOrdenados.length}`}
      />

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={hideNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        aria-live="assertive"
        role="alert"
      >
        <Alert
          onClose={hideNotification}
          severity={notification.severity}
          variant="filled"
          role={notification.severity === 'error' || notification.severity === 'warning' ? 'alert' : 'status'}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
