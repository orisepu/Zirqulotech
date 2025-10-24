/**
 * AuditoriaHeader Component
 *
 * Displays audit progress status with accessible indicators.
 * Shows count of completed vs total devices with visual and semantic feedback.
 */

import { Typography, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

export interface AuditoriaHeaderProps {
  total: number;
  auditados: number;
}

/**
 * Header component showing audit completion status
 *
 * @param total - Total number of devices to audit
 * @param auditados - Number of devices already audited
 *
 * @example
 * <AuditoriaHeader total={10} auditados={7} />
 * // Displays: "7/10 auditados" with warning if incomplete
 */
export function AuditoriaHeader({ total, auditados }: AuditoriaHeaderProps) {
  const auditoriaCompleta = total > 0 && auditados === total;
  const dispositivosPendientes = total - auditados;

  return (
    <>
      {/* Progress Status */}
      <Typography
        variant="body2"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {auditoriaCompleta ? (
          <CheckCircleIcon
            color="success"
            aria-label="Auditoría completa"
            role="img"
          />
        ) : (
          <CancelIcon color="error" aria-label="Auditoría incompleta" role="img" />
        )}
        <span>
          {auditados}/{total} dispositivos auditados
          {auditoriaCompleta && ' - Auditoría completa'}
        </span>
      </Typography>

      {/* Warning Alert for Incomplete Audit */}
      {!auditoriaCompleta && total > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} role="alert">
          Todos los dispositivos deben estar auditados para finalizar la auditoría.
          {dispositivosPendientes > 0 && (
            <>
              {' '}
              Quedan <strong>{dispositivosPendientes}</strong>{' '}
              {dispositivosPendientes === 1 ? 'dispositivo' : 'dispositivos'} pendiente
              {dispositivosPendientes === 1 ? '' : 's'}.
            </>
          )}
        </Alert>
      )}
    </>
  );
}
