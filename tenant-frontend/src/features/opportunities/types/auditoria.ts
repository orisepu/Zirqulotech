/**
 * TypeScript types for Auditoria (Device Audit) feature
 *
 * This file contains all type definitions for the device audit workflow,
 * including API request/response types and UI state types.
 */

import type { Grade } from '@/shared/types/grading';
import type { EstadoFisico, EstadoFuncional, NivelDesgaste } from '@/shared/utils/gradingCalcs';

export interface DispositivoReal {
  id: number;
  modelo_id: number;

  // Multiple possible field names for capacity ID (API inconsistency)
  capacidad_id?: number;
  cap_id?: number;
  capacidad?: {
    id: number;
    nombre: string;
  };
  capacidadId?: number;
  id_capacidad?: number;

  // Pricing
  precio_orientativo: number;
  precio_final?: number | null;
  precio_por_estado?: Record<string, number>;

  // Audit status (using proper types from grading system)
  estado_fisico?: EstadoFisico;
  estado_funcional?: EstadoFuncional;
  estado_valoracion?: Grade;
  observaciones?: string;
  auditado?: boolean;

  // Device condition details
  salud_bateria_pct?: number | null;
  ciclos_bateria?: number | null;
  pantalla_funcional_puntos_bril?: boolean;
  pantalla_funcional_pixeles_muertos?: boolean;
  pantalla_funcional_lineas_quemaduras?: boolean;
  desgaste_lateral?: NivelDesgaste;
  desgaste_trasero?: NivelDesgaste;

  // Identification fields (for title display)
  modelo_nombre?: string;
  modelo?: { nombre?: string; name?: string; title?: string; display_name?: string } | string;
  imei?: string;
  numero_serie?: string;
  sn?: string;
  serial?: string;
  identificador?: string;
  n_serie?: string;

  // Flags
  editado_por_usuario?: boolean;
}

export interface AuditoriaResponse {
  estado: string;
  dispositivos: DispositivoReal[];
  modelo_id?: number;
}

export interface AuditoriaPayload {
  dispositivo_id: number;
  estado_fisico: EstadoFisico;
  estado_funcional: EstadoFuncional;
  estado_valoracion?: Grade | null;
  observaciones?: string;
  precio_final?: number | null;
  salud_bateria_pct?: number | null;
  ciclos_bateria?: number | null;
  pantalla_funcional_puntos_bril: boolean;
  pantalla_funcional_pixeles_muertos: boolean;
  pantalla_funcional_lineas_quemaduras: boolean;
  desgaste_lateral: NivelDesgaste;
  desgaste_trasero: NivelDesgaste;
}

export interface CambiarEstadoPayload {
  estado: string;
  schema: string;
}

export interface EnviarCorreoPayload {
  schema: string;
  evento: string;
}

export type EstadoOportunidad =
  | 'Check in OK'
  | 'En revisión'
  | 'Oferta confirmada'
  | 'Nueva oferta enviada'
  | string;

export interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}
