/**
 * AuditoriaActions Component
 *
 * Action buttons for finalizing audit and resending emails.
 * Handles business logic for determining next opportunity status.
 */

import { Button, CircularProgress, Grid } from '@mui/material';
import type { DispositivoReal, EstadoOportunidad } from '../types/auditoria';

export interface AuditoriaActionsProps {
  estadoOportunidad: EstadoOportunidad | null;
  dispositivosCompletos: DispositivoReal[];
  onFinalizarAuditoria: (nuevoEstado: string) => Promise<void>;
  onReenviarCorreo: () => Promise<void>;
  isFinalizando?: boolean;
  isReenviando?: boolean;
}

/**
 * Action buttons for audit workflow
 *
 * @param estadoOportunidad - Current opportunity status
 * @param dispositivosCompletos - Array of audited devices
 * @param onFinalizarAuditoria - Callback to finalize audit with new status
 * @param onReenviarCorreo - Callback to resend offer email
 * @param isFinalizando - Loading state for finalize action
 * @param isReenviando - Loading state for resend action
 *
 * @example
 * <AuditoriaActions
 *   estadoOportunidad="En revisión"
 *   dispositivosCompletos={devices}
 *   onFinalizarAuditoria={async (estado) => { ... }}
 *   onReenviarCorreo={async () => { ... }}
 * />
 */
export function AuditoriaActions({
  estadoOportunidad,
  dispositivosCompletos,
  onFinalizarAuditoria,
  onReenviarCorreo,
  isFinalizando = false,
  isReenviando = false,
}: AuditoriaActionsProps) {
  const totalDispositivos = dispositivosCompletos.length;
  const dispositivosAuditados = dispositivosCompletos.filter(
    (d) => d.auditado && d.precio_final != null && d.estado_fisico && d.estado_funcional
  ).length;
  const auditoriaCompleta = totalDispositivos > 0 && dispositivosAuditados === totalDispositivos;

  // Determine if all final prices match suggested prices
  const todosIguales = dispositivosCompletos
    .filter((d) => d.auditado && d.precio_final != null)
    .every((d) => d.precio_final === d.precio_orientativo);

  // Determine next status based on price comparison
  const nuevoEstado = todosIguales ? 'Oferta confirmada' : 'Nueva oferta enviada';

  const handleFinalizarAuditoria = async () => {
    await onFinalizarAuditoria(nuevoEstado);
  };

  return (
    <Grid
      container
      spacing={2}
      sx={{ mb: 2, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}
    >
      {/* Finalizar Auditoría Button */}
      {(estadoOportunidad === 'En revisión' || auditoriaCompleta) && (
        <Grid size="auto">
          <Button
            variant="contained"
            color="primary"
            onClick={handleFinalizarAuditoria}
            disabled={!auditoriaCompleta || isFinalizando}
            aria-label={`Finalizar auditoría y cambiar estado a ${nuevoEstado}`}
          >
            {isFinalizando ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Finalizando...
              </>
            ) : (
              'Finalizar auditoría'
            )}
          </Button>
        </Grid>
      )}

      {/* Reenviar Correo Button */}
      {estadoOportunidad !== 'En revisión' && (
        <Grid size="auto">
          <Button
            variant="outlined"
            color="secondary"
            onClick={onReenviarCorreo}
            disabled={isReenviando}
            aria-label="Reenviar correo electrónico de oferta al cliente"
          >
            {isReenviando ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Reenviando...
              </>
            ) : (
              'Reenviar correo'
            )}
          </Button>
        </Grid>
      )}
    </Grid>
  );
}
