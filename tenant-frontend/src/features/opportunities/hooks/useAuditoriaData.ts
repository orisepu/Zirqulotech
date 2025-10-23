/**
 * useAuditoriaData Hook
 *
 * Centralized data management for device audits using TanStack Query.
 * Handles all API operations including fetching audit data, saving audits,
 * changing opportunity status, and sending email notifications.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { toastApiError } from '@/shared/hooks/useOportunidadData';
import type {
  AuditoriaResponse,
  AuditoriaPayload,
  CambiarEstadoPayload,
  EnviarCorreoPayload,
} from '../types/auditoria';

/**
 * Query keys for audit data
 * Centralized for consistent cache management
 */
export const auditoriaKeys = {
  dispositivos: (tenant: string, id: string) =>
    ['dispositivos-auditoria', tenant, id] as const,
};

export interface UseAuditoriaDataParams {
  tenant: string;
  id: string;
}

/**
 * Custom hook for managing audit data and mutations
 *
 * @param tenant - Tenant schema identifier
 * @param id - Opportunity ID
 * @returns Object containing query and mutation states
 *
 * @example
 * const { dispositivos, guardarAuditoria, cambiarEstado } = useAuditoriaData({
 *   tenant: 'acme',
 *   id: '123'
 * });
 *
 * // Save audit
 * await guardarAuditoria.mutateAsync({
 *   dispositivo_id: 1,
 *   estado_fisico: 'bueno',
 *   estado_funcional: 'funciona'
 * });
 *
 * // Change status
 * await cambiarEstado.mutateAsync('En revisión');
 */
export function useAuditoriaData({ tenant, id }: UseAuditoriaDataParams) {
  const queryClient = useQueryClient();

  // Query: Fetch audit devices
  const dispositivos = useQuery<AuditoriaResponse>({
    queryKey: auditoriaKeys.dispositivos(tenant, id),
    queryFn: async () => {
      const res = await api.get<AuditoriaResponse>(
        `/api/dispositivos-reales-globales/${tenant}/${id}/`
      );
      return res.data;
    },
  });

  // Mutation: Save device audit
  const guardarAuditoria = useMutation({
    mutationFn: async (payload: AuditoriaPayload) => {
      return api.post(`/api/auditorias-globales/${tenant}/`, payload);
    },
    onSuccess: () => {
      // Automatic cache invalidation - no manual refetch needed
      queryClient.invalidateQueries({
        queryKey: auditoriaKeys.dispositivos(tenant, id),
      });
    },
    onError: (error) => {
      toastApiError(error, 'Error al guardar auditoría');
    },
  });

  // Mutation: Change opportunity status
  const cambiarEstado = useMutation({
    mutationFn: async (estado: string) => {
      const payload: CambiarEstadoPayload = {
        estado,
        schema: tenant,
      };
      return api.patch(
        `/api/oportunidades-globales/${tenant}/${id}/cambiar-estado/`,
        payload
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: auditoriaKeys.dispositivos(tenant, id),
      });
    },
    onError: (error) => {
      toastApiError(error, 'Error al cambiar estado');
    },
  });

  // Mutation: Send email notification
  const enviarCorreo = useMutation({
    mutationFn: async (evento: string) => {
      const payload: EnviarCorreoPayload = {
        schema: tenant,
        evento,
      };
      return api.post(`/api/oportunidades/${id}/enviar-correo-oferta/`, payload);
    },
    onError: (error) => {
      toastApiError(error, 'Error al enviar correo');
    },
  });

  // Mutation: Combined finalize audit (change status + send email)
  const finalizarAuditoria = useMutation({
    mutationFn: async (nuevoEstado: string) => {
      // First change status
      await cambiarEstado.mutateAsync(nuevoEstado);

      // Then send email
      await enviarCorreo.mutateAsync('Oferta enviada');
    },
    onError: (error) => {
      toastApiError(error, 'Error al finalizar la auditoría');
    },
  });

  return {
    // Query state
    dispositivos,

    // Mutations
    guardarAuditoria,
    cambiarEstado,
    enviarCorreo,
    finalizarAuditoria,
  };
}
