/**
 * useAuditoriaForm Hook
 *
 * Manages form state for the device audit modal.
 * Extracts device data and handles capacity ID extraction from various field formats.
 */

import { useMemo } from 'react';
import { extractCapacidadId, type DeviceIdFields } from '../utils/deviceIdUtils';
import type { DispositivoReal } from '../types/auditoria';

export interface AuditoriaFormData {
  dispositivo: DispositivoReal | null;
  modeloId: number | undefined;
  capacidadId: number | undefined;
}

export interface UseAuditoriaFormParams {
  dispositivos: DispositivoReal[];
  actualIndex: number;
  modeloId: number | null | undefined;
}

/**
 * Custom hook for managing audit form data
 *
 * Extracts the current device being audited and resolves modelo/capacidad IDs
 * from various possible field name formats.
 *
 * @param dispositivos - Array of devices to audit
 * @param actualIndex - Index of the currently selected device
 * @param modeloId - Model ID (may come from parent data)
 * @returns Object containing current device and extracted IDs
 *
 * @example
 * const { dispositivo, modeloId, capacidadId } = useAuditoriaForm({
 *   dispositivos: [{ id: 1, capacidad_id: 42 }],
 *   actualIndex: 0,
 *   modeloId: 10
 * });
 * // dispositivo = { id: 1, capacidad_id: 42 }
 * // modeloId = 10
 * // capacidadId = 42
 */
export function useAuditoriaForm({
  dispositivos,
  actualIndex,
  modeloId,
}: UseAuditoriaFormParams): AuditoriaFormData {
  return useMemo(() => {
    // Get current device
    const currentDevice =
      actualIndex >= 0 && actualIndex < dispositivos.length
        ? dispositivos[actualIndex]
        : null;

    // Extract capacity ID from device (handles multiple field name variations)
    const capacidadId = currentDevice
      ? extractCapacidadId(currentDevice as DeviceIdFields)
      : null;

    return {
      dispositivo: currentDevice,
      modeloId: modeloId ?? undefined,
      capacidadId: capacidadId ?? undefined,
    };
  }, [dispositivos, actualIndex, modeloId]);
}
