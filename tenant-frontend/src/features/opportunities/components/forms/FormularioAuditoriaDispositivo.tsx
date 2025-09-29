'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query'
// Debug helper (activable también en producción):
// - En consola: localStorage.setItem('AUD_DEBUG','1') o window.__AUD_DEBUG__ = true
const __AUD_DEBUG__ = typeof window !== 'undefined'
  && (((window as any).__AUD_DEBUG__ === true)
    || (typeof window.localStorage !== 'undefined' && window.localStorage.getItem('AUD_DEBUG') === '1')
    || process.env.NODE_ENV !== 'production'
    || process.env.NEXT_PUBLIC_AUD_DEBUG === '1')
const audLog = (...args: any[]) => { if (__AUD_DEBUG__) console.log('[AUD]', ...args) }
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,Stack,Divider,
  Stepper, Step, StepLabel, TextField, Typography, Grid, Chip, ToggleButtonGroup, ToggleButton, FormHelperText, Paper, Tooltip, FormGroup, FormControlLabel, Checkbox, IconButton, Select, MenuItem, InputLabel, FormControl, Snackbar, Alert
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { calcularEstadoDetallado, EstadoFisico, EstadoFuncional, NivelDesgaste } from '@/shared/utils/gradingCalcs';

// 🔁 Ajusta estas rutas a tu estructura real:
import PasoEstadoDispositivo from './PasoEstadoDispositivo';
import PasoEstetica from './PasoEstetica';
import type { CatalogoValoracion, FuncPantallaValue, EsteticaKey } from './tipos';
import { buildCatalogFor } from './catalogos'
import { buildIPadCatalog } from './catalogos-ipad'
import {
  buildMacProCatalog,
  buildMacStudioCatalog,
  buildMacMiniCatalog,
  buildMacBookAirCatalog,
  buildMacBookProCatalog,
  buildIMacCatalog,
} from './catalogos-mac'
import { postValoracionIphoneAuditoria, type ValoracionTecnicaResponse } from '@/services/valoraciones'
import api from '@/services/api'
// util formato moneda (solo local a este componente)
const fmtEUR = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)
export type ValoresAuditoria = {
  id: number;
  // calculado
  estado_valoracion?: 'excelente' | 'muy_bueno' | 'bueno' | 'a_revision';

  // batería
  salud_bateria_pct?: number | null;
  ciclos_bateria?: number | null;

  // pantalla (funcional)
  pantalla_funcional_puntos_bril?: boolean;
  pantalla_funcional_pixeles_muertos?: boolean;
  pantalla_funcional_lineas_quemaduras?: boolean;

  // exterior
  desgaste_lateral?: NivelDesgaste;
  desgaste_trasero?: NivelDesgaste;
  estado_fisico?: EstadoFisico;
  estado_funcional?: EstadoFuncional;
  // precio y notas
  precio_por_estado?: Record<string, number>;
  precio_orientativo?: number | null;
  precio_final?: number | null;
  observaciones?: string;

  // identificadores (para el título)
  modelo_nombre?: string;
  modelo?: { nombre?: string; name?: string; title?: string; display_name?: string } | string;
  imei?: string;
  numero_serie?: string;
  sn?: string;
  serial?: string;
  identificador?: string;
  n_serie?: string;

  // flags
  editado_por_usuario?: boolean;
};

// Tipos mínimos para costes de reparación (reuso del admin de piezas)
type PiezaOption = { value: number; label: string }
type ManoObraOption = { value: number; label: string; tarifa_h?: string | null }
type CostoPiezaRow = {
  id?: number
  modelo_id: number
  pieza_tipo_id: number | undefined
  mano_obra_tipo_id: number | null
  horas: number | null
  coste_neto: string
  mano_obra_fija_neta?: string | null
  proveedor?: string | null
}

interface Props {
  open: boolean;
  dispositivo: Partial<ValoresAuditoria> | null;
  onClose: () => void;
  onSubmit: (val: ValoresAuditoria, opts?: { siguiente?: boolean }) => void;
  titulo?: string;

  // ⬇️ NUEVO: para reutilizar tus componentes visuales
  catalog?: CatalogoValoracion;
  isLaptop?: boolean;
  // IDs explícitos por si el dispositivo no los trae en el shape
  modeloId?: number;
  capacidadId?: number;

  // Tenant/canal para valorar contra el backend correcto
  tenant?: string;
  canal?: 'B2B' | 'B2C';
}

/* -------------------- helpers de título -------------------- */
function inferTipoFromDispositivo(d?: unknown): string {
  const o = (d && typeof d === 'object') ? (d as Record<string, unknown>) : undefined;
  const modelo = o?.modelo;
  const modeloStr = typeof modelo === 'string' ? modelo : (typeof (modelo as Record<string, unknown> | undefined)?.nombre === 'string' ? (modelo as Record<string, unknown>).nombre as string : undefined);
  const parts = [o?.tipo, o?.modelo_nombre, modeloStr].filter((v): v is string => typeof v === 'string');
  const txt = parts.join(' ').toLowerCase();

  if (txt.includes('ipad')) return 'iPad';
  if (txt.includes('macbook pro')) return 'MacBook Pro';
  if (txt.includes('macbook air')) return 'MacBook Air';
  if (txt.includes('imac')) return 'iMac';
  if (txt.includes('mac pro')) return 'Mac Pro';
  if (txt.includes('mac studio')) return 'Mac Studio';
  if (txt.includes('mac mini')) return 'Mac Mini';
  return 'iPhone'; // fallback más común
}

function buildCatalogByTipo(tipo: string): CatalogoValoracion {
  const t = (tipo || 'iPhone').toLowerCase();
  if (t.includes('ipad')) return buildIPadCatalog();
  if (t.includes('mac pro')) return buildMacProCatalog();
  if (t.includes('mac studio')) return buildMacStudioCatalog();
  if (t.includes('mac mini')) return buildMacMiniCatalog();
  if (t.includes('macbook air')) return buildMacBookAirCatalog();
  if (t.includes('macbook pro')) return buildMacBookProCatalog();
  if (t.includes('imac')) return buildIMacCatalog();
  return buildCatalogFor(tipo || 'iPhone');
}

function pickFirstString(obj: unknown, keys: string[]): string | null {
  const o = (obj && typeof obj === 'object') ? (obj as Record<string, unknown>) : undefined;
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') {
      if (k === 'modelo') {
        const vv = v as Record<string, unknown>;
        const cand = (vv.nombre || vv.name || vv.title || vv.display_name) as unknown;
        if (typeof cand === 'string' && cand.trim()) return cand.trim();
      }
      if (k.startsWith('capacidad')) {
        const vv = v as Record<string, unknown>;
        const cand = (vv.nombre || vv.name || vv.title || vv.display_name || vv.capacidad || vv.gb || vv.storage || vv.size) as unknown;
        if (typeof cand === 'string' && cand.trim()) return cand.trim();
        if (typeof cand === 'number' && Number.isFinite(cand)) return String(cand);
      }
    }
  }
  return null;
}
function normalizeCapacityString(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return `${raw} GB`;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    if (/[0-9]\s*(gb|tb)$/i.test(s)) return s;
    const n = parseFloat(s.replace(',', '.'));
    if (Number.isFinite(n)) return `${n} GB`;
    return s;
  }
  return null;
}
function pickCapacity(d: unknown): string | null {
  const c = pickFirstString(d, [
    'capacidad', 'capacidad_nombre', 'capacidad_gb', 'storage', 'storage_gb', 'almacenamiento', 'rom',
    'capacidad', 'capacidad_obj', 'modelo_capacidad',
  ]);
  return normalizeCapacityString(c);
}
function getModeloSerieCapacidad(d: unknown): { modelo: string | null; serie: string | null; capacidad: string | null } {
  const modelo = pickFirstString(d, ['modelo_nombre', 'modelo', 'nombre_modelo', 'modelo_comercial', 'modelo_detalle']);
  const serie  = pickFirstString(d, ['imei', 'numero_serie', 'sn', 'serial', 'n_serie', 'identificador']);
  const capacidad = pickCapacity(d);
  return { modelo, serie, capacidad };
}

// Intenta extraer IDs numéricos de modelo y capacidad desde distintos shapes comunes
function pickIdsFromDispositivo(d: unknown): { modelo_id: number | null; capacidad_id: number | null } {
  const o = (d && typeof d === 'object') ? (d as Record<string, unknown>) : undefined;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v)) ? v : (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null);

  const tryKeys = (obj: any, keys: string[]): number | null => {
    for (const k of keys) {
      const v = obj?.[k];
      const n = num(v);
      if (n !== null) return n;
    }
    return null;
  };

  // Modelo: intenta múltiples variantes comunes
  const modelo_id = (
    tryKeys(o, ['modelo_id', 'model_id', 'modelo', 'model', 'id_modelo']) ??
    num((o?.modelo as any)?.id) ??
    num((o?.modelo as any)?.modelo_id) ??
    num((o as any)?.modeloId) ??
    num((o as any)?.modelId) ??
    // variantes anidadas poco comunes
    num((o as any)?.modelo_obj?.id) ??
    null
  );

  // Capacidad: intenta múltiples variantes comunes
  const capacidad_id = (
    tryKeys(o, ['capacidad_id', 'capacity_id', 'capacidad', 'cap', 'cap_id', 'id_capacidad']) ??
    num((o?.capacidad as any)?.id) ??
    num((o as any)?.capacidadId) ??
    num((o as any)?.capacityId) ??
    // variantes anidadas
    num((o as any)?.capacidad_obj?.id) ??
    null
  );

  return { modelo_id, capacidad_id };
}

/* -------------------- helpers de mapping (UI -> valoracion.ts) -------------------- */
const MAP_ESTETICA_TO_NIVEL: Record<EsteticaKey, NivelDesgaste> = {
  sin_signos: 'ninguno',
  minimos: 'leve',
  algunos: 'medio',
  desgaste_visible: 'alto',
  agrietado_roto: 'alto',
};

function buildDetalladoFromUI(params: {
  // Batería
  saludBateria: number | '';
  ciclosBateria: number | '';

  // Pantalla (funcional - issues)
  pantallaIssues: FuncPantallaValue[];
  // Pantalla (estética rápida)
  estadoPantalla: EsteticaKey | '';

  // Exterior
  estadoLados: EsteticaKey | '';
  estadoEspalda: EsteticaKey | '';
  // Energía
  enciende: boolean | null;
  cargaOk: boolean | null;
  // Funcionalidad básica detallada
  funcChecks: Array<boolean | null>;
}) {
  const salud_bateria_pct =
    typeof params.saludBateria === 'number' && Number.isFinite(params.saludBateria)
      ? params.saludBateria
      : null;
  const ciclos_bateria =
    typeof params.ciclosBateria === 'number' && Number.isFinite(params.ciclosBateria)
      ? params.ciclosBateria
      : null;

  const pantalla_funcional_puntos_bril = params.pantallaIssues.includes('puntos');
  const pantalla_funcional_pixeles_muertos = params.pantallaIssues.includes('pixeles');
  // tratamos "líneas" funcionales como crítico
  const pantalla_funcional_lineas_quemaduras =
    params.pantallaIssues.includes('lineas') || params.estadoPantalla === ('agrietado_roto' as EsteticaKey);

  const desgaste_lateral =
    params.estadoLados ? MAP_ESTETICA_TO_NIVEL[params.estadoLados] : ('ninguno' as NivelDesgaste);
  const desgaste_trasero =
    params.estadoEspalda ? MAP_ESTETICA_TO_NIVEL[params.estadoEspalda] : ('ninguno' as NivelDesgaste);

  // Para compatibilidad con calcularEstadoDetallado:
  // Derivamos "estado_fisico" desde exterior/pantalla estética:
  // - agrietado_roto => 'dañado'
  // - desgaste_visible => 'aceptable'
  // - algunos/minimos => 'bueno'
  // - sin_signos => 'perfecto'
  let estado_fisico: EstadoFisico = 'perfecto';
  const trio = [params.estadoPantalla, params.estadoLados, params.estadoEspalda]
    .filter((v): v is EsteticaKey => !!v) as EsteticaKey[]
  const worst: EsteticaKey = params.estadoPantalla === ('agrietado_roto' as EsteticaKey) || params.estadoLados === ('agrietado_roto' as EsteticaKey) || params.estadoEspalda === ('agrietado_roto' as EsteticaKey)
    ? ('agrietado_roto' as EsteticaKey)
    : trio.includes('desgaste_visible')
      ? 'desgaste_visible'
      : trio.includes('algunos')
        ? 'algunos'
        : trio.includes('minimos')
          ? 'minimos'
          : 'sin_signos';

  if (worst === 'agrietado_roto') estado_fisico = 'dañado';
  else if (worst === 'desgaste_visible') estado_fisico = 'aceptable';
  else if (worst === 'algunos' || worst === 'minimos') estado_fisico = 'bueno';
  else estado_fisico = 'perfecto';

  // Derivar estado funcional según gates
  let estado_funcional: EstadoFuncional = 'funciona';
  const anyFuncKO = params.funcChecks.some(v => v === false);
  if (params.enciende === false) estado_funcional = 'no_enciende';
  else if (params.estadoPantalla === 'agrietado_roto') estado_funcional = 'pantalla_rota';
  else if (anyFuncKO) estado_funcional = 'otros';

  return {
    estado_fisico,
    estado_funcional,
    salud_bateria_pct,
    ciclos_bateria,
    pantalla_funcional_puntos_bril,
    pantalla_funcional_pixeles_muertos,
    pantalla_funcional_lineas_quemaduras,
    desgaste_lateral,
    desgaste_trasero,
  };
}

/* -------------------- componente principal -------------------- */
export default function FormularioAuditoriaDispositivo({
  open, dispositivo, onClose, onSubmit, titulo, catalog, isLaptop, modeloId, capacidadId, tenant, canal,
}: Props) {
    // Costes por defecto para deducciones en auditoría (solo fallback si no hay datos del backend)
    // Estos incluyen ya MO estimada para que coincidan con backend por defecto
    const PR_BATERIA_DEFAULT = 50
    const PR_PANTALLA_DEFAULT = 75
    const PR_CHASIS_DEFAULT = 105
    // Margen de mano de obra por defecto para depuración local (DEV)
    // Nota: Los PR_* ya incluyen MO estimada; mantenemos 0 para evitar doble cómputo.
    const LABOR_MARGIN_DEFAULT = 0
    const tipo = useMemo(() => inferTipoFromDispositivo(dispositivo || {}), [dispositivo]);
    const cat = useMemo(() => catalog ?? buildCatalogByTipo(tipo), [catalog, tipo]);
    const isLaptopFinal = useMemo(
        () => (typeof isLaptop === 'boolean' ? isLaptop : /\b(macbook|laptop|portátil)\b/i.test(tipo)),
        [isLaptop, tipo]
    );
    const hasScreen  = /\b(iphone|ipad|macbook|imac)\b/i.test(tipo);
    const hasBattery = /\b(iphone|ipad|macbook)\b/i.test(tipo);
   

    

    // ---- estado controlado de los pasos (UI) ----
    const [saludBateria, setSaludBateria] = useState<number | ''>('');
    const [ciclosBateria, setCiclosBateria] = useState<number | ''>('');

    const [pantallaIssues, setPantallaIssues] = useState<FuncPantallaValue[]>([]);
    const [estadoPantalla, setEstadoPantalla] = useState<EsteticaKey | ''>('');

    const [estadoLados, setEstadoLados] = useState<EsteticaKey | ''>('');
    const [estadoEspalda, setEstadoEspalda] = useState<EsteticaKey | ''>('');

    // Seguridad / Autenticidad
    const [fmiStatus, setFmiStatus] = useState<''|'OFF'|'ON'>('');
    const [simLock, setSimLock] = useState<''|'LIBRE'|'BLOQUEADO'>('');
    const [mdm, setMdm] = useState<''|'SI'|'NO'>('');
    const [blacklist, setBlacklist] = useState<''|'LIMPIO'|'REPORTADO'>('');
    // Regla de seguridad: si hay bloqueo FMI, SIM, MDM o Blacklist, se rechaza
    const isSecurityKO = useMemo(() => (
      fmiStatus === 'ON' || simLock === 'BLOQUEADO' || mdm === 'SI' || blacklist === 'REPORTADO'
    ), [fmiStatus, simLock, mdm, blacklist])

    const visiblePasos = useMemo(() => {
        // Si falla seguridad, no es necesario continuar: solo Seguridad + Precio y notas
        if (isSecurityKO) return ['Seguridad', 'Precio y notas'] as const as Array<'Seguridad'|'Batería'|'Pantalla'|'Funcionalidad'|'Exterior'|'Precio y notas'>
        const arr: Array<'Seguridad'|'Batería'|'Pantalla'|'Funcionalidad'|'Exterior'|'Precio y notas'> = ['Seguridad'];
        if (hasBattery) arr.push('Batería');
        if (hasScreen)  arr.push('Pantalla');
        arr.push('Funcionalidad', 'Exterior', 'Precio y notas');
        return arr;
    }, [hasBattery, hasScreen, isSecurityKO]);
    const [step, setStep] = useState(0);
    
    // Energía
    const [enciende, setEnciende] = useState<boolean | null>(null);
    const [cargaOk, setCargaOk] = useState<boolean | null>(null);

    // Funcionalidad básica (detallada)
    const [funcTelefoniaOK, setFuncTelefoniaOK] = useState<boolean | null>(null);
    const [funcAudioOK, setFuncAudioOK] = useState<boolean | null>(null);
    const [funcMicOK, setFuncMicOK] = useState<boolean | null>(null);
    const [funcCamarasOK, setFuncCamarasOK] = useState<boolean | null>(null);
    const [funcBiometriaOK, setFuncBiometriaOK] = useState<boolean | null>(null);
    const [funcWiFiOK, setFuncWiFiOK] = useState<boolean | null>(null);
    const [funcBTOK, setFuncBTOK] = useState<boolean | null>(null);
    const [funcPCOK, setFuncPCOK] = useState<boolean | null>(null);
    // QR tests
    const [showTestQR, setShowTestQR] = useState(false);
    const [testSessionId, setTestSessionId] = useState<string>('');
    const testUrl = typeof window !== 'undefined' && testSessionId
        ? `${window.location.origin}/tests/${encodeURIComponent(testSessionId)}`
        : '';
    const genSession = () => {
        const id = Math.random().toString(36).slice(2, 10);
        setTestSessionId(id);
        setShowTestQR(true);
    };
    // Nuevas categorías de funcionalidad
    const [funcGPSOK, setFuncGPSOK] = useState<boolean | null>(null);
    const [funcNFCOK, setFuncNFCOK] = useState<boolean | null>(null);
    const [funcSensoresOK, setFuncSensoresOK] = useState<boolean | null>(null);
    const [funcVibracionOK, setFuncVibracionOK] = useState<boolean | null>(null);
    const [funcTactilOK, setFuncTactilOK] = useState<boolean | null>(null);

    // Mapeos a enums del endpoint técnico (idénticos a comercial)
    const toDisplayImageStatusApi = (issues: FuncPantallaValue[]) =>
      issues.includes('lineas') ? 'LINES' : (issues.includes('pixeles') || issues.includes('puntos')) ? 'PIX' : 'OK'

    const toGlassStatusApi = (k: EsteticaKey | '') => {
      switch (k) {
        case 'sin_signos': return 'NONE'
        case 'minimos': return 'MICRO'
        case 'algunos': return 'VISIBLE'
        case 'desgaste_visible': return 'DEEP'
        case 'agrietado_roto': return 'CRACK'
        default: return 'NONE'
      }
    }
    const estToHousingApi = (k: EsteticaKey | '') => {
      switch (k) {
        case 'sin_signos': return 'SIN_SIGNOS'
        case 'minimos': return 'MINIMOS'
        case 'algunos': return 'ALGUNOS'
        case 'desgaste_visible': return 'DESGASTE_VISIBLE'
        case 'agrietado_roto': return 'DOBLADO'
        default: return 'SIN_SIGNOS'
      }
    }
    const worstHousingApi = (a: string, b: string) => {
      const rank: Record<string, number> = {
        SIN_SIGNOS: 0, MINIMOS: 1, ALGUNOS: 2, DESGASTE_VISIBLE: 3, DOBLADO: 4
      }
      return (rank[a] >= rank[b]) ? a : b
    }

    // Payload y consulta de valoración técnica (solo DEV)
    const payloadAuditoria = useMemo(() => {
      const checks = [
        funcTelefoniaOK, funcAudioOK, funcMicOK, funcCamarasOK,
        funcBiometriaOK, funcWiFiOK, funcBTOK, funcPCOK,
        funcGPSOK, funcNFCOK, funcSensoresOK, funcVibracionOK, funcTactilOK,
      ]
      const anyKO = checks.some(v => v === false)
      const allOK = checks.every(v => v === true)
      const funcional_basico_ok = anyKO ? false : (allOK ? true : null)

      const display_image_status = toDisplayImageStatusApi(pantallaIssues)
      const glass_status = toGlassStatusApi(estadoPantalla)
      const housing_status = worstHousingApi(estToHousingApi(estadoLados || 'sin_signos'), estToHousingApi(estadoEspalda || 'sin_signos'))

      const idsDetected = pickIdsFromDispositivo(dispositivo)
      const { modelo: modelo_nombre, capacidad: capacidad_texto } = getModeloSerieCapacidad(dispositivo || {})
      const ids = {
        modelo_id: (typeof modeloId === 'number' && Number.isFinite(modeloId)) ? modeloId : idsDetected.modelo_id,
        capacidad_id: (typeof capacidadId === 'number' && Number.isFinite(capacidadId)) ? capacidadId : idsDetected.capacidad_id,
      }

      const payload = {
        dispositivo_id: (dispositivo && (dispositivo as any).id) ? Number((dispositivo as any).id) : undefined,
        enciende,
        carga: cargaOk,
        funcional_basico_ok,
        battery_health_pct: typeof saludBateria === 'number' ? saludBateria : null,
        display_image_status,
        glass_status,
        housing_status,
        // contexto tenant/canal para que el backend coja el precio correcto
        tenant: tenant || undefined,
        canal: canal || 'B2B',
        // Para fallback al endpoint comercial
        modelo_id: ids.modelo_id ?? undefined,
        capacidad_id: ids.capacidad_id ?? undefined,
        // Ayudas para resolver IDs en backend si faltan
        modelo_nombre: modelo_nombre || undefined,
        capacidad_texto: capacidad_texto || undefined,
      } as Record<string, unknown>
      audLog('payloadAuditoria', { ids, payload })
      return payload
    }, [
      dispositivo, modeloId, capacidadId, enciende, cargaOk, saludBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda,
      funcTelefoniaOK, funcAudioOK, funcMicOK, funcCamarasOK, funcBiometriaOK, funcWiFiOK, funcBTOK, funcPCOK,
      funcGPSOK, funcNFCOK, funcSensoresOK, funcVibracionOK, funcTactilOK,
    ])

    const idsForAuditoria = useMemo(() => {
      const detected = pickIdsFromDispositivo(dispositivo)
      return {
        modelo_id: (typeof modeloId === 'number' && Number.isFinite(modeloId)) ? modeloId : detected.modelo_id,
        capacidad_id: (typeof capacidadId === 'number' && Number.isFinite(capacidadId)) ? capacidadId : detected.capacidad_id,
      }
    }, [dispositivo, modeloId, capacidadId])
    const auditoriaKey = useMemo(() => {
      const names = getModeloSerieCapacidad(dispositivo || {})
      // Derivar funcional_basico_ok para que cambie la key al cambiar los checks
      const checks = [
        funcTelefoniaOK, funcAudioOK, funcMicOK, funcCamarasOK,
        funcBiometriaOK, funcWiFiOK, funcBTOK, funcPCOK,
        funcGPSOK, funcNFCOK, funcSensoresOK, funcVibracionOK, funcTactilOK,
      ] as const
      const anyKO = checks.some(v => v === false)
      const allOK = checks.every(v => v === true)
      const funcional_basico_ok = anyKO ? false : (allOK ? true : null)

      return [
        'auditoria-valoracion',
        tenant || null,
        canal || 'B2B',
        (dispositivo && (dispositivo as any).id) ? Number((dispositivo as any).id) : null,
        idsForAuditoria.modelo_id ?? null,
        idsForAuditoria.capacidad_id ?? null,
        names.modelo || null,
        names.capacidad || null,
        enciende,
        cargaOk,
        typeof saludBateria === 'number' ? saludBateria : null,
        toDisplayImageStatusApi(pantallaIssues),
        toGlassStatusApi(estadoPantalla),
        worstHousingApi(estToHousingApi(estadoLados || 'sin_signos'), estToHousingApi(estadoEspalda || 'sin_signos')),
        funcional_basico_ok,
      ] as const
    }, [
      tenant, canal, dispositivo, idsForAuditoria.modelo_id, idsForAuditoria.capacidad_id,
      enciende, cargaOk, saludBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda,
      funcTelefoniaOK, funcAudioOK, funcMicOK, funcCamarasOK, funcBiometriaOK, funcWiFiOK, funcBTOK, funcPCOK,
      funcGPSOK, funcNFCOK, funcSensoresOK, funcVibracionOK, funcTactilOK,
    ])
    const namesForQuery = getModeloSerieCapacidad(dispositivo || {})
    const dispositivoIdForQuery = (dispositivo && (dispositivo as any).id) ? Number((dispositivo as any).id) : null
    // Habilita la valoración si tenemos: (modelo+capacidad) o (nombres) o (dispositivo_id) y no hay KO de seguridad
    const canQueryAuditoria = Boolean(
      (idsForAuditoria.modelo_id && idsForAuditoria.capacidad_id) ||
      (namesForQuery.modelo && namesForQuery.capacidad) ||
      dispositivoIdForQuery
    ) && !isSecurityKO
    const { data: valoracionTecnica } = useQuery<ValoracionTecnicaResponse>({
      queryKey: auditoriaKey,
      queryFn: () => postValoracionIphoneAuditoria(payloadAuditoria, tenant || undefined),
      enabled: canQueryAuditoria,
      placeholderData: keepPreviousData,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      staleTime: 0,
    })

    // Poll de resultados de tests móviles
    const [testResults, setTestResults] = useState<Record<string, unknown>>({});
    useEffect(() => {
      if (!testSessionId) return;
      let cancel = false;
      const tick = async () => {
        try {
          const res = await fetch(`/api/test-sessions/${encodeURIComponent(testSessionId)}`);
          const data = await res.json();
          if (!cancel) setTestResults(data?.results || {});
        } catch { /* ignore */ }
      };
      tick();
      const iv = setInterval(tick, 2000);
      return () => { cancel = true; clearInterval(iv); };
    }, [testSessionId]);

    // Aplica automáticamente los resultados polled al formulario
    useEffect(() => {
      const R = (testResults || {}) as Record<string, unknown>;
      const has = (k: string) => Object.prototype.hasOwnProperty.call(R, k);
      // Táctil: requiere las tres
      if (has('touch_ghost_ok') || has('touch_grid_ok') || has('multitouch_ok')) {
        const tg = R.touch_ghost_ok as unknown;
        const td = R.touch_grid_ok as unknown;
        const mt = R.multitouch_ok as unknown;
        if ([tg, td, mt].some((v) => v != null)) setFuncTactilOK(Boolean(tg && td && mt));
      }
      if (has('camOk')) setFuncCamarasOK(Boolean(R.camOk));
      if (has('micOk')) setFuncMicOK(Boolean(R.micOk));
      if (has('geoOk')) setFuncGPSOK(Boolean(R.geoOk));
      if (has('nfcOk')) setFuncNFCOK(Boolean(R.nfcOk));
      if (has('motionOk')) setFuncSensoresOK(Boolean(R.motionOk));
      if (has('vibrateOk')) setFuncVibracionOK(Boolean(R.vibrateOk));
    }, [testResults]);

    // Detalles por categoría cuando hay KO
    const [detallesFunc, setDetallesFunc] = useState<Record<string, string[]>>({});
    const SUBOPCIONES: Record<string, { key: string; label: string }[]> = {
        'Telefonía / datos': [
            { key: 'sim', label: 'SIM' },
            { key: 'datos', label: 'Datos móviles' },
            { key: 'llamadas', label: 'Llamadas' },
        ],
        'Audio (altavoz/auricular)': [
            { key: 'altavoz', label: 'Altavoz' },
            { key: 'auricular', label: 'Auricular' },
        ],
        'Micrófonos': [
            { key: 'inferior', label: 'Inferior (principal)' },
            { key: 'superior', label: 'Superior/Frontal' },
            { key: 'trasero', label: 'Trasero' },
            { key: 'ambiente', label: 'Ambiente / cancelación de ruido' },
        ],
        'Cámaras': [
            { key: 'frontal', label: 'Frontal' },
            { key: 'trasera', label: 'Trasera (principal)' },
            { key: 'ultra', label: 'Ultra gran angular' },
            { key: 'tele', label: 'Teleobjetivo / Zoom' },
            { key: 'macro', label: 'Macro' },
            { key: 'flash', label: 'Flash' },
        ],
        'Biometría (Face/Touch ID)': [
            { key: 'face', label: 'Face ID' },
            { key: 'touch', label: 'Touch ID' },
        ],
        'Wi‑Fi': [
            { key: 'no_conecta', label: 'No conecta' },
            { key: 'intermitente', label: 'Intermitente' },
        ],
        'Bluetooth': [
            { key: 'no_conecta', label: 'No conecta' },
            { key: 'intermitente', label: 'Intermitente' },
        ],
        'Conexión PC/Mac': [
            { key: 'no_reconoce', label: 'No reconoce' },
            { key: 'solo_carga', label: 'Sólo carga' },
        ],
        'GPS': [
            { key: 'no_fija', label: 'No fija posición' },
            { key: 'impreciso', label: 'Impreciso' },
            { key: 'no_detectado', label: 'No detectado' },
        ],
        'NFC': [
            { key: 'no_lee', label: 'No lee' },
            { key: 'no_escribe', label: 'No escribe' },
            { key: 'no_detectado', label: 'No detectado' },
        ],
        'Sensores': [
            { key: 'proximidad', label: 'Proximidad' },
            { key: 'luz', label: 'Luz ambiente' },
            { key: 'acelerometro', label: 'Acelerómetro' },
            { key: 'giroscopio', label: 'Giroscopio' },
            { key: 'brujula', label: 'Brújula' },
            { key: 'barometro', label: 'Barómetro' },
            { key: 'true_tone', label: 'True Tone' },
        ],
        'Vibración/Haptic': [
            { key: 'no_vibra', label: 'No vibra' },
            { key: 'debil', label: 'Vibración débil' },
            { key: 'ruidos', label: 'Ruidos anómalos' },
        ],
    };
    const toggleDetalle = (categoria: string, key: string, checked: boolean) => {
        setDetallesFunc(prev => {
            const current = new Set(prev[categoria] ?? []);
            if (checked) current.add(key); else current.delete(key);
            return { ...prev, [categoria]: Array.from(current) };
        });
    };

    // ---- Reparación: soporte para seleccionar pieza (p.ej. cámara trasera) ----
    // Cargamos opciones de pieza/MO y costes por modelo cuando sea necesario
    const [piezaOpts, setPiezaOpts] = useState<PiezaOption[] | null>(null)
    const [moOpts, setMoOpts] = useState<ManoObraOption[] | null>(null)
    const [costesPieza, setCostesPieza] = useState<CostoPiezaRow[] | null>(null)
    const [loadingCostes, setLoadingCostes] = useState(false)
    const [loadingOpts, setLoadingOpts] = useState(false)
    const [repCamTraseraCostoId, setRepCamTraseraCostoId] = useState<number | ''>('')
    const [descontarRepCamTrasera, setDescontarRepCamTrasera] = useState<boolean>(true)
    const [repCamManualEnabled, setRepCamManualEnabled] = useState<boolean>(false)
    const [repCamManualNombre, setRepCamManualNombre] = useState<string>('')
    const [repCamManualCost, setRepCamManualCost] = useState<string>('')

    // Crear coste de pieza inline si no existe
    const [openAddPieza, setOpenAddPieza] = useState(false)
    const [nuevoCosto, setNuevoCosto] = useState<CostoPiezaRow | null>(null)
    const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' })

    // Intentamos usar modeloId prop > detectado en dispositivo > resuelto por nombre
    const [resolvedModeloId, setResolvedModeloId] = useState<number | null>(null)
    const [resolvingModelo, setResolvingModelo] = useState(false)
    const modeloIdForCostes = useMemo(() => {
      const detected = pickIdsFromDispositivo(dispositivo)
      return (typeof modeloId === 'number' && Number.isFinite(modeloId)) ? modeloId : (detected.modelo_id ?? resolvedModeloId)
    }, [dispositivo, modeloId, resolvedModeloId])

    const camTraseraSeleccionada = useMemo(() => {
      const camsKO = funcCamarasOK === false
      const det = detallesFunc['Cámaras'] || []
      return camsKO && det.includes('trasera')
    }, [funcCamarasOK, detallesFunc])

    const fetchOpcionesReparacion = useCallback(async () => {
      setLoadingOpts(true)
      try {
        const { data } = await api.get('/api/admin/reparacion/opciones/')
        const piezas = (data?.piezas ?? []) as PiezaOption[]
        const mano_obra = (data?.mano_obra ?? []) as ManoObraOption[]
        setPiezaOpts(piezas)
        setMoOpts(mano_obra)
      } catch (e) {
        setSnack({ open: true, msg: 'Error cargando opciones de reparación', sev: 'error' })
      } finally {
        setLoadingOpts(false)
      }
    }, [])

    const fetchCostesModelo = useCallback(async (mid: number) => {
      setLoadingCostes(true)
      try {
        const { data } = await api.get('/api/admin/costos-pieza/', { params: { modelo_id: mid } })
        setCostesPieza(Array.isArray(data) ? data as CostoPiezaRow[] : [])
      } catch (e) {
        setSnack({ open: true, msg: 'Error cargando costes de pieza', sev: 'error' })
      } finally {
        setLoadingCostes(false)
      }
    }, [])

    // Carga perezosa: solo cuando se marca KO cámara trasera y hay modelo
    useEffect(() => {
      if (!open) return
      if (!camTraseraSeleccionada) return
      // Cargamos opciones siempre para poder elegir pieza aún sin modelo
      if (!piezaOpts || !moOpts) fetchOpcionesReparacion()
      if (modeloIdForCostes && !costesPieza) fetchCostesModelo(modeloIdForCostes)
      // Si no hay modelo, activa modo manual por defecto
      if (!modeloIdForCostes) setRepCamManualEnabled(true)
    }, [open, camTraseraSeleccionada, modeloIdForCostes, piezaOpts, moOpts, costesPieza, fetchOpcionesReparacion, fetchCostesModelo])

    // Resolver modelo_id por nombre si no viene: consulta /api/modelos?search=<modelo>
    useEffect(() => {
      const names = getModeloSerieCapacidad(dispositivo || {})
      const name = names.modelo || ''
      if (!open || !camTraseraSeleccionada) return
      if (modeloIdForCostes || resolvingModelo || !name || name.length < 3) return
      let cancelled = false
      ;(async () => {
        try {
          setResolvingModelo(true)
          const { data } = await api.get('/api/modelos/', { params: { search: name, page_size: 1 } })
          const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
          const first = list?.[0]
          const id = first?.id
          if (!cancelled && typeof id === 'number') setResolvedModeloId(id)
        } catch {
          // ignore
        } finally {
          if (!cancelled) setResolvingModelo(false)
        }
      })()
      return () => { cancelled = true }
    }, [open, camTraseraSeleccionada, dispositivo, modeloIdForCostes, resolvingModelo])

    // Determina IDs de pieza tipo que corresponden a "cámara trasera"
    const piezaIdsCamTrasera = useMemo(() => {
      if (!piezaOpts) return [] as number[]
      const match = (s: string) => /cam[aá]ra|camera/i.test(s) && /(trasera|principal|rear|back)/i.test(s)
      return piezaOpts.filter(p => match(p.label || '')).map(p => p.value)
    }, [piezaOpts])

    // Filtra filas de costes de cámara trasera
    const costosCamTrasera = useMemo(() => {
      if (!costesPieza || !piezaIdsCamTrasera.length) return [] as CostoPiezaRow[]
      return costesPieza.filter(r => r.pieza_tipo_id != null && piezaIdsCamTrasera.includes(Number(r.pieza_tipo_id)))
    }, [costesPieza, piezaIdsCamTrasera])

    // Autoselecciona si hay una sola opción
    useEffect(() => {
      if (camTraseraSeleccionada && repCamTraseraCostoId === '' && costosCamTrasera.length === 1) {
        const only = costosCamTrasera[0]
        if (only?.id) setRepCamTraseraCostoId(Number(only.id))
      }
    }, [camTraseraSeleccionada, repCamTraseraCostoId, costosCamTrasera])

    // Calcula coste total de la reparación seleccionada (pieza + MO fija + horas*tarifa)
    const costoRepCamTrasera = useMemo(() => {
      if (!descontarRepCamTrasera) return 0
      if (!camTraseraSeleccionada || !moOpts) return 0
      const row = costosCamTrasera.find(r => r.id === repCamTraseraCostoId)
      if (!row) return 0
      const pieza = Number.parseFloat(row.coste_neto || '0') || 0
      const moFija = Number.parseFloat(row.mano_obra_fija_neta || '0') || 0
      const horas = Number.isFinite(row.horas as any) ? Number(row.horas) : 0
      const tarifa = (() => {
        const mo = moOpts.find(m => m.value === row.mano_obra_tipo_id)
        const t = Number.parseFloat(String(mo?.tarifa_h ?? '0'))
        return Number.isFinite(t) ? t : 0
      })()
      return Math.max(0, pieza + moFija + (horas * tarifa))
    }, [descontarRepCamTrasera, camTraseraSeleccionada, costosCamTrasera, repCamTraseraCostoId, moOpts])

    const costoRepCamManual = useMemo(() => {
      if (!descontarRepCamTrasera) return 0
      if (!camTraseraSeleccionada || !repCamManualEnabled) return 0
      const v = Number.parseFloat(String(repCamManualCost).replace(',', '.'))
      return Number.isFinite(v) && v > 0 ? v : 0
    }, [descontarRepCamTrasera, camTraseraSeleccionada, repCamManualEnabled, repCamManualCost])

    const costoRepCamaraFinal = useMemo(() => {
      // Prioriza un coste seleccionado del catálogo; si no, usa manual
      return costoRepCamTrasera > 0 ? costoRepCamTrasera : costoRepCamManual
    }, [costoRepCamTrasera, costoRepCamManual])

    // Upsert costo de pieza (reutiliza el endpoint admin)
    const upsertCostoPieza = useCallback(async (payload: CostoPiezaRow) => {
      const { data } = await api.post('/api/admin/costos-pieza/set/', payload)
      return data as { id: number }
    }, [])

    // ---- entidad a enviar (con precio/orientación) ----
    const [form, setForm] = useState<ValoresAuditoria>(() => ({
        id: dispositivo?.id as number,
        precio_por_estado: dispositivo?.precio_por_estado ?? {},
        precio_orientativo: dispositivo?.precio_orientativo ?? null,
        precio_final: dispositivo?.precio_final ?? null,
        observaciones: dispositivo?.observaciones ?? '',
        editado_por_usuario: !!dispositivo?.editado_por_usuario,
    }));

    // Título enriquecido (modelo • capacidad • IMEI/SN)
    const details = useMemo(() => {
        const { modelo, serie, capacidad } = getModeloSerieCapacidad(dispositivo || {});
        const parts: string[] = [];
        if (modelo) parts.push(modelo);
        if (capacidad) parts.push(capacidad);
        if (serie) parts.push(`IMEI/SN ${serie}`);
        return parts.length ? parts.join(' • ') : '';
    }, [dispositivo]);

    // Recomputar valoración y sugerido cada vez que cambien los bloques (batería, pantalla, exterior)
    const recomputar = useCallback((draft: ValoresAuditoria, fromUI: ReturnType<typeof buildDetalladoFromUI>, rawUI?: { estadoPantalla: EsteticaKey | ''; estadoLados: EsteticaKey | ''; estadoEspalda: EsteticaKey | ''; pantallaIssues: FuncPantallaValue[] }) => {
        // Si falla seguridad, rechazo inmediato: estado "a_revision" y precio 0
        if (isSecurityKO) {
          draft.estado_valoracion = 'a_revision'
          if (!draft.editado_por_usuario) draft.precio_final = 0
          Object.assign(draft, {
            estado_fisico: fromUI.estado_fisico,
            estado_funcional: fromUI.estado_funcional,
            salud_bateria_pct: fromUI.salud_bateria_pct,
            ciclos_bateria: fromUI.ciclos_bateria,
            pantalla_funcional_puntos_bril: fromUI.pantalla_funcional_puntos_bril,
            pantalla_funcional_pixeles_muertos: fromUI.pantalla_funcional_pixeles_muertos,
            pantalla_funcional_lineas_quemaduras: fromUI.pantalla_funcional_lineas_quemaduras,
            desgaste_lateral: fromUI.desgaste_lateral,
            desgaste_trasero: fromUI.desgaste_trasero,
          })
          return
        }
        // Estado calculado: usa backend si disponemos de valoración técnica, si no, estima local
        const estadoDesdeBackend = (() => {
          const g = valoracionTecnica?.grado_estetico
          const gate = valoracionTecnica?.gate
          if (!g) return null
          if (gate && gate !== 'OK') return 'a_revision'
          return g === 'A+' ? 'excelente' : g === 'A' ? 'muy_bueno' : g === 'B' ? 'bueno' : 'a_revision'
        })()
        const valoracion = estadoDesdeBackend ?? calcularEstadoDetallado({
          estado_fisico: fromUI.estado_fisico,
          estado_funcional: fromUI.estado_funcional,
          salud_bateria_pct: fromUI.salud_bateria_pct,
          ciclos_bateria: fromUI.ciclos_bateria,
          pantalla_funcional_puntos_bril: fromUI.pantalla_funcional_puntos_bril,
          pantalla_funcional_pixeles_muertos: fromUI.pantalla_funcional_pixeles_muertos,
          pantalla_funcional_lineas_quemaduras: fromUI.pantalla_funcional_lineas_quemaduras,
          desgaste_lateral: fromUI.desgaste_lateral,
          desgaste_trasero: fromUI.desgaste_trasero,
          });
        draft.estado_valoracion = valoracion;

        // Deducciones: si tenemos respuesta del backend usamos sus costes exactos
        const bat = fromUI.salud_bateria_pct
        const hasPantIssue = Boolean(rawUI?.pantallaIssues?.length) || rawUI?.estadoPantalla === ('agrietado_roto' as EsteticaKey)
        const worstExt = ((): EsteticaKey => {
          const arr = [rawUI?.estadoLados, rawUI?.estadoEspalda].filter(Boolean) as EsteticaKey[]
          if (arr.includes('agrietado_roto')) return 'agrietado_roto'
          if (arr.includes('desgaste_visible')) return 'desgaste_visible'
          if (arr.includes('algunos')) return 'algunos'
          if (arr.includes('minimos')) return 'minimos'
          return 'sin_signos'
        })()
        const backendDeducciones = valoracionTecnica?.deducciones
        const dedBat = backendDeducciones
          ? backendDeducciones.pr_bat
          : ((bat !== null && bat < 85) ? PR_BATERIA_DEFAULT : 0)
        const dedPant = backendDeducciones
          ? backendDeducciones.pr_pant
          : (hasPantIssue ? PR_PANTALLA_DEFAULT : 0)
        const dedChas = backendDeducciones
          ? backendDeducciones.pr_chas
          : ((worstExt === 'desgaste_visible' || worstExt === ('agrietado_roto' as EsteticaKey)) ? PR_CHASIS_DEFAULT : 0)

        // Base (V_tope aproximado) desde precio_por_estado
        let base: number | undefined = undefined
        if (draft.precio_por_estado) {
          if (valoracion !== 'a_revision') {
            base = draft.precio_por_estado[valoracion]
          } else {
            // Si está en revisión, aproximar V_tope según reglas espejo simplificadas
            // D por pantalla => base por exterior; D por chasis => base por pantalla; otro => mínimo entre ambos
            const gradeFromEst = (k: EsteticaKey | ''): 'excelente' | 'muy_bueno' | 'bueno' => (
              k === 'desgaste_visible' ? 'bueno' : k === 'algunos' ? 'muy_bueno' : 'excelente'
            )
            const estPant = gradeFromEst(rawUI?.estadoPantalla || '')
            const estExt = gradeFromEst(worstExt)
            const dByPantalla = hasPantIssue || rawUI?.estadoPantalla === ('agrietado_roto' as EsteticaKey)
            const dByChasis = worstExt === 'desgaste_visible' || worstExt === ('agrietado_roto' as EsteticaKey)
            let pick: 'excelente' | 'muy_bueno' | 'bueno'
            if (dByPantalla && !dByChasis) pick = estExt
            else if (!dByPantalla && dByChasis) pick = estPant
            else pick = [estPant, estExt].includes('bueno') ? 'bueno' : (estPant === 'muy_bueno' || estExt === 'muy_bueno' ? 'muy_bueno' : 'excelente')
            base = draft.precio_por_estado[pick]
          }
        }

        if (!draft.editado_por_usuario) {
          if (valoracionTecnica) {
            const oferta = Number(valoracionTecnica.oferta)
            draft.precio_final = Math.max(0, oferta - (costoRepCamaraFinal || 0))
          } else if (typeof base !== 'undefined') {
            const finalSugerido = Math.max(0, Number(base) - (dedBat + dedPant + dedChas + (costoRepCamaraFinal || 0)))
            draft.precio_final = finalSugerido
          }
        }

        // Pega también los campos derivados para persistirlos
        Object.assign(draft, {
        estado_fisico: fromUI.estado_fisico,
        estado_funcional: fromUI.estado_funcional,
        salud_bateria_pct: fromUI.salud_bateria_pct,
        ciclos_bateria: fromUI.ciclos_bateria,
        pantalla_funcional_puntos_bril: fromUI.pantalla_funcional_puntos_bril,
        pantalla_funcional_pixeles_muertos: fromUI.pantalla_funcional_pixeles_muertos,
        pantalla_funcional_lineas_quemaduras: fromUI.pantalla_funcional_lineas_quemaduras,
        desgaste_lateral: fromUI.desgaste_lateral,
        desgaste_trasero: fromUI.desgaste_trasero,
        });
    }, [isSecurityKO, valoracionTecnica, costoRepCamaraFinal]);

    // Recalcular sugerencias cuando cambian los inputs relevantes
    useEffect(() => {
      if (!open) return;
      const t = setTimeout(() => {
        setForm((prev) => {
          const next: ValoresAuditoria = { ...prev };
          const ui = buildDetalladoFromUI({
            saludBateria, ciclosBateria,
            pantallaIssues,
            estadoPantalla,
            estadoLados,
            estadoEspalda,
            enciende, cargaOk,
            funcChecks: [
              funcTelefoniaOK, funcAudioOK, funcMicOK, funcCamarasOK,
              funcBiometriaOK, funcWiFiOK, funcBTOK, funcPCOK,
              funcGPSOK, funcNFCOK, funcSensoresOK, funcVibracionOK, funcTactilOK
            ],
          });
          const before = {
            estado_valoracion: prev.estado_valoracion,
            precio_final: prev.precio_final,
            estado_fisico: (prev as any).estado_fisico,
            estado_funcional: (prev as any).estado_funcional,
            salud_bateria_pct: (prev as any).salud_bateria_pct,
            ciclos_bateria: (prev as any).ciclos_bateria,
            pantalla_funcional_puntos_bril: (prev as any).pantalla_funcional_puntos_bril,
            pantalla_funcional_pixeles_muertos: (prev as any).pantalla_funcional_pixeles_muertos,
            pantalla_funcional_lineas_quemaduras: (prev as any).pantalla_funcional_lineas_quemaduras,
            desgaste_lateral: (prev as any).desgaste_lateral,
            desgaste_trasero: (prev as any).desgaste_trasero,
          }
          recomputar(next, ui, { estadoPantalla, estadoLados, estadoEspalda, pantallaIssues });
          const after = {
            estado_valoracion: next.estado_valoracion,
            precio_final: next.precio_final,
            estado_fisico: (next as any).estado_fisico,
            estado_funcional: (next as any).estado_funcional,
            salud_bateria_pct: (next as any).salud_bateria_pct,
            ciclos_bateria: (next as any).ciclos_bateria,
            pantalla_funcional_puntos_bril: (next as any).pantalla_funcional_puntos_bril,
            pantalla_funcional_pixeles_muertos: (next as any).pantalla_funcional_pixeles_muertos,
            pantalla_funcional_lineas_quemaduras: (next as any).pantalla_funcional_lineas_quemaduras,
            desgaste_lateral: (next as any).desgaste_lateral,
            desgaste_trasero: (next as any).desgaste_trasero,
          }
          const changed = Object.keys(after).some(k => (after as any)[k] !== (before as any)[k])
          return changed ? next : prev;
        });
      }, 120); // debounce del recompute
      return () => clearTimeout(t);
    }, [open, saludBateria, ciclosBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda, enciende, cargaOk, funcTelefoniaOK, funcAudioOK, funcMicOK, funcCamarasOK, funcBiometriaOK, funcWiFiOK, funcBTOK, funcPCOK, funcGPSOK, funcNFCOK, funcSensoresOK, funcVibracionOK, funcTactilOK, fmiStatus, simLock, mdm, blacklist, recomputar]);

    // Reset/seed al abrir o al cambiar de dispositivo
    useEffect(() => {
        if (!open || !dispositivo?.id) return;
        setStep(0);
        setSaludBateria(typeof dispositivo.salud_bateria_pct === 'number' ? dispositivo.salud_bateria_pct! : '');
        setCiclosBateria(typeof dispositivo.ciclos_bateria === 'number' ? dispositivo.ciclos_bateria! : '');

        // reconstruye issues de pantalla desde flags (si vienen)
        const issues: FuncPantallaValue[] = [];
        if (dispositivo.pantalla_funcional_puntos_bril) issues.push('puntos');
        if (dispositivo.pantalla_funcional_pixeles_muertos) issues.push('pixeles');
        if (dispositivo.pantalla_funcional_lineas_quemaduras) issues.push('lineas');
        setPantallaIssues(issues);

        // si viene estética previa, mapea al enum UI (no siempre disponible: dejamos vacío si no llega)
        setEstadoPantalla('');
        setEstadoLados('');
        setEstadoEspalda('');

        setForm(() => {
        const base: ValoresAuditoria = {
            id: dispositivo.id as number,
            precio_por_estado: dispositivo.precio_por_estado ?? {},
            precio_orientativo: dispositivo.precio_orientativo ?? null,
            precio_final: dispositivo.precio_final ?? null,
            observaciones: dispositivo.observaciones ?? '',
            editado_por_usuario: !!dispositivo.editado_por_usuario,
        };
        return base;
        });
    }, [open, dispositivo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // (eliminado) recompute effect handled above
    const computeFinalFromUI = useCallback((): ValoresAuditoria => {
        const next: ValoresAuditoria = { ...form }; // snapshot actual
        const ui = buildDetalladoFromUI({
            saludBateria, ciclosBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda,
            enciende, cargaOk,
            funcChecks: [
              funcTelefoniaOK, funcAudioOK, funcMicOK, funcCamarasOK,
              funcBiometriaOK, funcWiFiOK, funcBTOK, funcPCOK,
              funcGPSOK, funcNFCOK, funcSensoresOK, funcVibracionOK, funcTactilOK
            ],
        });
        recomputar(next, ui, { estadoPantalla, estadoLados, estadoEspalda, pantallaIssues });
        return next;
        }, [form, saludBateria, ciclosBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda, enciende, cargaOk, funcTelefoniaOK, funcAudioOK, funcMicOK, funcCamarasOK, funcBiometriaOK, funcWiFiOK, funcBTOK, funcPCOK, funcGPSOK, funcNFCOK, funcSensoresOK, funcVibracionOK, funcTactilOK, recomputar]);
    const pasos = visiblePasos;
    const current = pasos[step];

    // Asegura que el índice de paso sea válido si cambia el número de pasos (p.ej., rechazo por seguridad)
    useEffect(() => {
      setStep((s) => Math.min(s, pasos.length - 1))
    }, [pasos.length])

    // Ya no auto-avanzamos; el usuario decide con "Siguiente".

    // Normalización para backend: mapear alias "defectuoso" -> 'a_revision'
    const normalizeForServer = useCallback((v: ValoresAuditoria): ValoresAuditoria => {
      const out: ValoresAuditoria = { ...v };
      if ((out as unknown as { estado_valoracion?: string }).estado_valoracion === 'defectuoso') {
        (out as unknown as { estado_valoracion?: string }).estado_valoracion = 'a_revision';
      }
      return out;
    }, [isSecurityKO])
    
    useEffect(() => {
        if (step > pasos.length - 1) setStep(pasos.length - 1);
    }, [pasos.length, step]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{titulo ?? 'Auditar dispositivo'}</DialogTitle>
        {details && (
        <Box sx={{ px: 3, pb: 1 }}>
            <Typography variant="body2" color="text.secondary">{details}</Typography>
        </Box>
        )}


      <DialogContent dividers>
        {/* Estado global calculado + sugerido */}
        <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">Estado calculado</Typography>
              <Chip
                label={(form.estado_valoracion === 'excelente'
                  ? 'Excelente'
                  : form.estado_valoracion === 'muy_bueno'
                    ? 'Muy bueno'
                    : form.estado_valoracion === 'bueno'
                      ? 'Bueno'
                      : form.estado_valoracion === 'a_revision'
                        ? 'Defectuoso'
                        : '—')}
                color={
                  form.estado_valoracion === 'excelente' ? 'success'
                    : form.estado_valoracion === 'muy_bueno' ? 'primary'
                    : form.estado_valoracion === 'bueno' ? 'warning'
                    : form.estado_valoracion === 'a_revision' ? 'error'
                    : 'default'
                }
                variant="filled"
                sx={{ mt: 1 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" color="text.secondary">Precio sugerido</Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                {form.estado_valoracion && form.precio_por_estado?.[form.estado_valoracion] != null
                  ? `${form.precio_por_estado?.[form.estado_valoracion]} €`
                  : '—'}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        <Stepper activeStep={step} sx={{ mb: 2 }}>
          {pasos.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {/* Paso 0: Seguridad */}
        {current === 'Seguridad' && (
          <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Seguridad y autenticidad</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="body2" sx={{ mb: .5 }}>FMI / Activation Lock</Typography>
                <ToggleButtonGroup exclusive value={fmiStatus} onChange={(_e, val) => setFmiStatus(val)}>
                  <Tooltip title="iCloud/Activation Lock desactivado" arrow>
                    <ToggleButton
                      value="OFF"
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'success.main',
                          borderColor: 'success.main',
                          color: 'common.white',
                          fontWeight: 700,
                          '&:hover': { bgcolor: 'success.main' },
                        },
                      }}
                    >
                      OFF
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title="Bloqueo activo (debe estar OFF)" arrow>
                    <ToggleButton
                      value="ON"
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'error.main',
                          borderColor: 'error.main',
                          color: 'common.white',
                          fontWeight: 700,
                          '&:hover': { bgcolor: 'error.main' },
                        },
                      }}
                    >
                      ON
                    </ToggleButton>
                  </Tooltip>
                </ToggleButtonGroup>
                <FormHelperText>Debe estar OFF</FormHelperText>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="body2" sx={{ mb: .5 }}>SIM‑lock</Typography>
                <ToggleButtonGroup exclusive value={simLock} onChange={(_e, val) => setSimLock(val)}>
                  <Tooltip title="Sin bloqueo de operador" arrow>
                    <ToggleButton
                      value="LIBRE"
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'success.main',
                          borderColor: 'success.main',
                          color: 'common.white',
                          fontWeight: 700,
                          '&:hover': { bgcolor: 'success.main' },
                        },
                      }}
                    >
                      Libre
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title="Bloqueado por operador" arrow>
                    <ToggleButton
                      value="BLOQUEADO"
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'error.main',
                          borderColor: 'error.main',
                          color: 'common.white',
                          fontWeight: 700,
                          '&:hover': { bgcolor: 'error.main' },
                        },
                      }}
                    >
                      Bloqueado
                    </ToggleButton>
                  </Tooltip>
                </ToggleButtonGroup>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="body2" sx={{ mb: .5 }}>MDM / Supervisión</Typography>
                <ToggleButtonGroup exclusive value={mdm} onChange={(_e, val) => setMdm(val)}>
                  <Tooltip title="No gestionado por MDM" arrow>
                    <ToggleButton
                      value="NO"
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'success.main',
                          borderColor: 'success.main',
                          color: 'common.white',
                          fontWeight: 700,
                          '&:hover': { bgcolor: 'success.main' },
                        },
                      }}
                    >
                      No
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title="Supervisión/MDM corporativo activo" arrow>
                    <ToggleButton
                      value="SI"
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'error.main',
                          borderColor: 'error.main',
                          color: 'common.white',
                          fontWeight: 700,
                          '&:hover': { bgcolor: 'error.main' },
                        },
                      }}
                    >
                      Sí
                    </ToggleButton>
                  </Tooltip>
                </ToggleButtonGroup>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="body2" sx={{ mb: .5 }}>Blacklist / Deuda</Typography>
                <ToggleButtonGroup exclusive value={blacklist} onChange={(_e, val) => setBlacklist(val)}>
                  <Tooltip title="No reportado / sin deuda" arrow>
                    <ToggleButton
                      value="LIMPIO"
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'success.main',
                          borderColor: 'success.main',
                          color: 'common.white',
                          fontWeight: 700,
                          '&:hover': { bgcolor: 'success.main' },
                        },
                      }}
                    >
                      Limpio
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title="Reportado / con deuda" arrow>
                    <ToggleButton
                      value="REPORTADO"
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'error.main',
                          borderColor: 'error.main',
                          color: 'common.white',
                          fontWeight: 700,
                          '&:hover': { bgcolor: 'error.main' },
                        },
                      }}
                    >
                      Reportado
                    </ToggleButton>
                  </Tooltip>
                </ToggleButtonGroup>
              </Grid>
            </Grid>
            <FormHelperText sx={{ mt: 1 }}>Si FMI = ON o Reportado → No aceptado (protocolo).</FormHelperText>
          </Paper>
        )}

        {/* Paso 1: Batería */}
        {current === 'Batería' && (
          <PasoEstadoDispositivo
            catalog={cat}
            isLaptop={isLaptopFinal}
            mode="battery"
            saludBateria={saludBateria}
            setSaludBateria={setSaludBateria}
            ciclosBateria={ciclosBateria}
            setCiclosBateria={setCiclosBateria}
            // No usamos “funcBasica” en la valoración como acordamos
            funcBasica={''} setFuncBasica={() => {}}
            pantallaIssues={[]} setPantallaIssues={() => {}}
            openDemo={() => {}}
            enciende={enciende} setEnciende={setEnciende}
            cargaOk={cargaOk} setCargaOk={setCargaOk}
          />
        )}

        {/* Paso 1: Pantalla (funcional/defectos) */}
        {current === 'Pantalla' && (
          <PasoEstadoDispositivo
            catalog={cat}
            isLaptop={isLaptopFinal}
            mode="screen"
            saludBateria={0} setSaludBateria={() => {}}
            ciclosBateria={''} setCiclosBateria={() => {}}
            funcBasica={''} setFuncBasica={() => {}}
            pantallaIssues={pantallaIssues}
            setPantallaIssues={setPantallaIssues}
            openDemo={() => {}}
          />
        )}

        {/* Paso 3: Funcionalidad básica (detallada) */}
        {current === 'Funcionalidad' && (
          <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Funcionalidad básica</Typography>
            {/* Bloque QR pruebas móviles */}
            <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'background.default' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="body2" fontWeight={600}>Prueba con tu móvil (QR)</Typography>
                  <Typography variant="caption" color="text.secondary">Escanea para abrir una página de tests guiados.</Typography>
                  <Box mt={1} display="flex" gap={1}>
                    <Button variant="contained" size="small" onClick={genSession}>Generar QR</Button>
                    {testUrl && (
                      <>
                        <TextField size="small" value={testUrl} slotProps={{ input: { readOnly: true } }} sx={{ flex: 1 }} />
                        <IconButton size="small" onClick={() => navigator.clipboard?.writeText(testUrl)} aria-label="Copiar enlace">
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Box>
                  {Object.keys(testResults || {}).length > 0 && (
                    <Box mt={1}>
                      <Typography variant="caption" color="text.secondary">Resultados:</Typography>
                      <Box sx={{ display: 'flex', gap: .5, flexWrap: 'wrap', mt: .5 }}>
                        {['touch_ghost_ok','touch_grid_ok','multitouch_ok','camOk','micOk','geoOk','nfcOk','motionOk','vibrateOk'].map(k => (
                          k in (testResults || {}) ? (
                            <Chip key={k} size="small" label={`${k.replace(/_/g,' ')}: ${testResults[k] ? 'OK' : 'KO'}`} color={testResults[k] ? 'success' : 'error'} />
                          ) : null
                        ))}
                      </Box>
                      <Button size="small" sx={{ mt: 1 }} variant="outlined" onClick={() => {
                        // Mapeo de resultados a toggles del formulario
                        const tactil = (testResults.touch_ghost_ok ?? null) && (testResults.touch_grid_ok ?? null) && (testResults.multitouch_ok ?? null);
                        setFuncTactilOK(tactil === null ? null : !!tactil);
                        if ('camOk' in testResults) setFuncCamarasOK(!!testResults.camOk);
                        if ('micOk' in testResults) setFuncMicOK(!!testResults.micOk);
                        if ('geoOk' in testResults) setFuncGPSOK(!!testResults.geoOk);
                        if ('nfcOk' in testResults) setFuncNFCOK(!!testResults.nfcOk);
                        if ('motionOk' in testResults) setFuncSensoresOK(!!testResults.motionOk);
                        if ('vibrateOk' in testResults) setFuncVibracionOK(!!testResults.vibrateOk);
                      }}>Aplicar al formulario</Button>
                    </Box>
                  )}
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  {showTestQR && testUrl ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      {/* QR con servicio público sin dependencias */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="QR tests"
                        style={{ width: 180, height: 180 }}
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(testUrl)}`}
                      />
                    </Box>
                  ) : (
                    <FormHelperText>Genera el QR para mostrarlo aquí.</FormHelperText>
                  )}
                </Grid>
              </Grid>
            </Paper>
            <Grid container spacing={2}>
              {[
                { label: 'Telefonía / datos', val: funcTelefoniaOK, set: setFuncTelefoniaOK },
                { label: 'Audio (altavoz/auricular)', val: funcAudioOK, set: setFuncAudioOK },
                { label: 'Micrófonos', val: funcMicOK, set: setFuncMicOK },
                { label: 'Cámaras', val: funcCamarasOK, set: setFuncCamarasOK },
                { label: 'Biometría (Face/Touch ID)', val: funcBiometriaOK, set: setFuncBiometriaOK },
                { label: 'Wi‑Fi', val: funcWiFiOK, set: setFuncWiFiOK },
                { label: 'Bluetooth', val: funcBTOK, set: setFuncBTOK },
                { label: 'Conexión PC/Mac', val: funcPCOK, set: setFuncPCOK },
                { label: 'Táctil', val: funcTactilOK, set: setFuncTactilOK },
                { label: 'GPS', val: funcGPSOK, set: setFuncGPSOK },
                { label: 'NFC', val: funcNFCOK, set: setFuncNFCOK },
                { label: 'Sensores', val: funcSensoresOK, set: setFuncSensoresOK },
                { label: 'Vibración/Haptic', val: funcVibracionOK, set: setFuncVibracionOK },
              ].map(({ label, val, set }) => (
                <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Typography variant="body2" sx={{ mb: .5 }}>{label}</Typography>
                  <ToggleButtonGroup exclusive value={val} onChange={(_e, v) => set(v)}>
                    <Tooltip title="Funciona en prueba rápida" arrow>
                      <ToggleButton
                        value={true}
                        sx={{
                          '&.Mui-selected': {
                            bgcolor: 'success.main',
                            borderColor: 'success.main',
                            color: 'common.white',
                            fontWeight: 700,
                            '&:hover': { bgcolor: 'success.main' },
                          },
                        }}
                      >
                        OK
                      </ToggleButton>
                    </Tooltip>
                    <Tooltip title="Fallo detectado" arrow>
                      <ToggleButton
                        value={false}
                        sx={{
                          '&.Mui-selected': {
                            bgcolor: 'error.main',
                            borderColor: 'error.main',
                            color: 'common.white',
                            fontWeight: 700,
                            '&:hover': { bgcolor: 'error.main' },
                          },
                        }}
                      >
                        KO
                      </ToggleButton>
                    </Tooltip>
                  </ToggleButtonGroup>
                  {val === false && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">Selecciona qué falla</Typography>
                      <FormGroup sx={{ mt: .5 }}>
                        {(SUBOPCIONES[label] ?? []).map(opt => {
                          const selected = detallesFunc[label]?.includes(opt.key) ?? false;
                          return (
                            <FormControlLabel
                              key={opt.key}
                              control={<Checkbox size="small" checked={selected} onChange={(e) => toggleDetalle(label, opt.key, e.target.checked)} />}
                              label={<Typography variant="body2">{opt.label}</Typography>}
                            />
                          );
                        })}
                        {(SUBOPCIONES[label] ?? []).length === 0 && (
                          <Typography variant="caption" color="text.secondary">Describe detalles en Observaciones.</Typography>
                        )}
                      </FormGroup>
                    </Box>
                  )}
                </Grid>
              ))}
            </Grid>
            <FormHelperText sx={{ mt: 1 }}>Cualquier KO puede forzar Defectuoso (D).</FormHelperText>

            {/* Reparación sugerida cuando falla la cámara trasera */}
            {camTraseraSeleccionada && (
              <Paper variant="outlined" sx={{ p: 1.5, mt: 2, bgcolor: 'background.default', borderLeft: 3, borderColor: 'warning.light' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">Reparación: cámara trasera</Typography>
                  {modeloIdForCostes ? (
                    <Chip size="small" label={loadingCostes || loadingOpts ? 'Cargando…' : (costoRepCamTrasera ? `Coste estimado ${fmtEUR(costoRepCamTrasera)}` : 'Sin coste') } color={costoRepCamTrasera ? 'warning' : 'default'} />
                  ) : null}
                </Stack>

                {!modeloIdForCostes && (
                  <Alert severity="info" sx={{ mb: 1 }}>No se pudo inferir el modelo. Puedes usar un coste manual para descontar la reparación, o completar modelo/capacidad para cargar el catálogo.</Alert>
                )}

                {modeloIdForCostes && (
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel id="pieza-camtras-lbl">Pieza</InputLabel>
                        <Select
                          labelId="pieza-camtras-lbl"
                          label="Pieza"
                          value={repCamTraseraCostoId === '' ? '' : String(repCamTraseraCostoId)}
                          onChange={(e) => setRepCamTraseraCostoId(e.target.value === '' ? '' : Number(e.target.value))}
                          displayEmpty
                        >
                          {costosCamTrasera.map((r) => {
                            const piezaLabel = piezaOpts?.find(p => p.value === r.pieza_tipo_id)?.label || `Pieza #${r.pieza_tipo_id}`
                            return (
                              <MenuItem key={r.id ?? `${r.pieza_tipo_id}-tmp`} value={String(r.id)}>
                                {piezaLabel}
                              </MenuItem>
                            )
                          })}
                          {(!loadingCostes && costosCamTrasera.length === 0) && (
                            <MenuItem value="" disabled>Sin coste configurado para cámara trasera</MenuItem>
                          )}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ height: '100%' }}>
                        <FormControlLabel
                          control={<Checkbox size="small" checked={descontarRepCamTrasera} onChange={(e) => setDescontarRepCamTrasera(e.target.checked)} />}
                          label={<Typography variant="body2">Descontar coste de reparación del precio</Typography>}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setNuevoCosto({
                              modelo_id: Number(modeloIdForCostes),
                              pieza_tipo_id: piezaIdsCamTrasera[0],
                              mano_obra_tipo_id: moOpts?.[0]?.value ?? null,
                              horas: null,
                              coste_neto: '',
                              mano_obra_fija_neta: '',
                              proveedor: '',
                            })
                            setOpenAddPieza(true)
                          }}
                          disabled={!modeloIdForCostes || loadingOpts}
                        >
                          Crear coste de pieza
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                )}

                {/* Modo manual (permite descontar aunque no haya catálogo/coste creado) */}
                <Box sx={{ mt: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <FormControlLabel
                      control={<Checkbox size="small" checked={repCamManualEnabled} onChange={(e) => setRepCamManualEnabled(e.target.checked)} />}
                      label={<Typography variant="body2">Usar coste manual</Typography>}
                    />
                    <TextField
                      size="small"
                      label="Pieza (libre)"
                      placeholder="p.ej. Cámara trasera"
                      value={repCamManualNombre}
                      onChange={(e) => setRepCamManualNombre(e.target.value)}
                      sx={{ minWidth: 200 }}
                    />
                    <TextField
                      size="small"
                      label="Coste manual (€)"
                      type="number"
                      value={repCamManualCost}
                      onChange={(e) => setRepCamManualCost(e.target.value)}
                      inputProps={{ step: '0.01', min: '0' }}
                      sx={{ width: 180 }}
                    />
                    {repCamManualEnabled && (
                      <Chip size="small" color={costoRepCamManual ? 'warning' : 'default'} label={costoRepCamManual ? `Descuento ${fmtEUR(costoRepCamManual)}` : '—'} />
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">El coste manual sólo afecta a esta auditoría y no se guarda en el catálogo.</Typography>
                </Box>

                {/* Diálogo para crear coste si no existe */}
                <Dialog open={openAddPieza} onClose={() => setOpenAddPieza(false)} maxWidth="sm" fullWidth>
                  <DialogTitle>Nuevo coste: cámara trasera</DialogTitle>
                  <DialogContent>
                    <Stack spacing={1.5} sx={{ mt: 1 }}>
                      <FormControl size="small">
                        <InputLabel id="pieza-new-lbl">Pieza</InputLabel>
                        <Select
                          labelId="pieza-new-lbl"
                          label="Pieza"
                          value={nuevoCosto?.pieza_tipo_id != null ? String(nuevoCosto?.pieza_tipo_id) : ''}
                          onChange={(e) => setNuevoCosto((n) => ({ ...(n as CostoPiezaRow), pieza_tipo_id: e.target.value === '' ? undefined : Number(e.target.value) }))}
                        >
                          {piezaOpts?.filter(p => piezaIdsCamTrasera.includes(p.value)).map(p => (
                            <MenuItem key={p.value} value={String(p.value)}>{p.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl size="small">
                        <InputLabel id="mo-new-lbl">Mano de obra</InputLabel>
                        <Select
                          labelId="mo-new-lbl"
                          label="Mano de obra"
                          value={nuevoCosto?.mano_obra_tipo_id != null ? String(nuevoCosto?.mano_obra_tipo_id) : ''}
                          onChange={(e) => setNuevoCosto((n) => ({ ...(n as CostoPiezaRow), mano_obra_tipo_id: e.target.value === '' ? null : Number(e.target.value) }))}
                          displayEmpty
                        >
                          <MenuItem value=""><em>—</em></MenuItem>
                          {moOpts?.map(m => (
                            <MenuItem key={m.value} value={String(m.value)}>{m.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <TextField size="small" label="Horas (si MO por horas)" type="number" value={nuevoCosto?.horas ?? ''} onChange={(e) => setNuevoCosto((n) => ({ ...(n as CostoPiezaRow), horas: e.target.value === '' ? null : Number(e.target.value) }))} inputProps={{ step: '0.1', min: '0' }} />
                      <TextField size="small" label="Coste neto pieza (€)" type="number" value={nuevoCosto?.coste_neto ?? ''} onChange={(e) => setNuevoCosto((n) => ({ ...(n as CostoPiezaRow), coste_neto: e.target.value }))} inputProps={{ step: '0.01', min: '0' }} />
                      <TextField size="small" label="MO fija neta (€)" type="number" value={nuevoCosto?.mano_obra_fija_neta ?? ''} onChange={(e) => setNuevoCosto((n) => ({ ...(n as CostoPiezaRow), mano_obra_fija_neta: e.target.value }))} inputProps={{ step: '0.01', min: '0' }} />
                      <TextField size="small" label="Proveedor (opcional)" value={nuevoCosto?.proveedor ?? ''} onChange={(e) => setNuevoCosto((n) => ({ ...(n as CostoPiezaRow), proveedor: e.target.value }))} />
                    </Stack>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setOpenAddPieza(false)}>Cancelar</Button>
                    <Button
                      variant="contained"
                      onClick={async () => {
                        if (!nuevoCosto || !modeloIdForCostes || !nuevoCosto.pieza_tipo_id) return
                        try {
                          await upsertCostoPieza({ ...nuevoCosto, modelo_id: Number(modeloIdForCostes) })
                          setOpenAddPieza(false)
                          setNuevoCosto(null)
                          await fetchCostesModelo(Number(modeloIdForCostes))
                          setSnack({ open: true, msg: 'Coste creado', sev: 'success' })
                        } catch (e: any) {
                          setSnack({ open: true, msg: e?.message || 'Error creando coste', sev: 'error' })
                        }
                      }}
                      disabled={!nuevoCosto?.pieza_tipo_id}
                    >
                      Guardar
                    </Button>
                  </DialogActions>
                </Dialog>

                <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack({ ...snack, open: false })}>
                  <Alert onClose={() => setSnack({ ...snack, open: false })} severity={snack.sev} variant="filled">{snack.msg}</Alert>
                </Snackbar>
              </Paper>
            )}
          </Paper>
        )}

        {/* Paso 4: Exterior (laterales/trasera) y estética pantalla */}
        {current === 'Exterior' && (
          <PasoEstetica
            catalog={cat}
            mode="all"
            estadoPantalla={estadoPantalla}
            setEstadoPantalla={setEstadoPantalla}
            estadoLados={estadoLados}
            setEstadoLados={setEstadoLados}
            estadoEspalda={estadoEspalda}
            setEstadoEspalda={setEstadoEspalda}
            openDemo={() => {}}
          />
        )}

        {/* Paso 3: Precio y notas */}
        {current === 'Precio y notas' && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Precio final (€)"
                size="small"
                fullWidth
                value={form.precio_final ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  let parsed: number | null;
                  if (raw === '' || raw == null) parsed = null;
                  else {
                    const n = Number(String(raw).replace(/\./g, '').replace(',', '.'));
                    parsed = Number.isFinite(n) ? n : null;
                  }
                  setForm((prev) => ({ ...prev, precio_final: parsed, editado_por_usuario: true }));
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Sugerido por estado:&nbsp;
                {form.estado_valoracion && form.precio_por_estado?.[form.estado_valoracion] != null
                  ? `${form.precio_por_estado?.[form.estado_valoracion]} €`
                  : '—'}
              </Typography>
              
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Observaciones"
                size="small"
                fullWidth
                multiline
                minRows={3}
                value={form.observaciones ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))}
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Box>
          <Button onClick={onClose}>Cancelar</Button>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Atrás
          </Button>
          {step < pasos.length - 1 ? (
          <Button variant="contained" onClick={() => setStep((s) => Math.min(pasos.length - 1, s + 1))}>
              Siguiente
          </Button>
            ) : (
            <>
                <Button
                variant="outlined"
                onClick={() => {
                    const final = computeFinalFromUI();
                    // Añade nota de reparación si aplica descuento de cámara
                    const costoCam = costoRepCamaraFinal
                    if (descontarRepCamTrasera && camTraseraSeleccionada && costoCam > 0) {
                      const piezaLabel = (() => {
                        if (repCamTraseraCostoId) {
                          const row = costosCamTrasera.find(r => r.id === repCamTraseraCostoId)
                          const pl = piezaOpts?.find(p => p.value === row?.pieza_tipo_id)?.label
                          return pl || 'Cámara trasera'
                        }
                        return repCamManualNombre || 'Cámara trasera'
                      })()
                      const obs = final.observaciones || ''
                      const line = `Rep. cámara trasera: ${piezaLabel} – coste ${fmtEUR(costoCam)}`
                      final.observaciones = obs ? `${obs}\n${line}` : line
                    }
                    const normalized = normalizeForServer(final);
                    setForm(normalized);           // opcional, para reflejarlo en UI
                    onSubmit(normalized, { siguiente: true });
                }}
                >
                Guardar y siguiente
                </Button>
                <Button
                variant="contained"
                onClick={() => {
                    const final = computeFinalFromUI();
                    // Añade nota de reparación si aplica descuento de cámara
                    const costoCam = costoRepCamaraFinal
                    if (descontarRepCamTrasera && camTraseraSeleccionada && costoCam > 0) {
                      const piezaLabel = (() => {
                        if (repCamTraseraCostoId) {
                          const row = costosCamTrasera.find(r => r.id === repCamTraseraCostoId)
                          const pl = piezaOpts?.find(p => p.value === row?.pieza_tipo_id)?.label
                          return pl || 'Cámara trasera'
                        }
                        return repCamManualNombre || 'Cámara trasera'
                      })()
                      const obs = final.observaciones || ''
                      const line = `Rep. cámara trasera: ${piezaLabel} – coste ${fmtEUR(costoCam)}`
                      final.observaciones = obs ? `${obs}\n${line}` : line
                    }
                    // Si seguridad KO, fuerza precio 0 y estado a revisión
                    if (isSecurityKO) {
                      final.precio_final = 0
                      final.estado_valoracion = 'a_revision'
                    }
                    const normalized = normalizeForServer(final);
                    setForm(normalized);           // opcional
                    onSubmit(normalized);
                }}
                >
                Guardar
                </Button>
            </>
            )}
        </Box>
        {process.env.NODE_ENV !== 'production' && (() => {
                // Métricas solo basadas en la respuesta de la API
                if (isSecurityKO) {
                  return (
                    <Stack direction="row" spacing={0.75} justifyContent="center" alignItems="center" sx={{ flexWrap: 'wrap', width: '100%', mt: 1 }}>
                      <Chip size="small" color="error" label="Rechazado por seguridad" />
                      <Chip size="small" color="default" label={`Oferta ${fmtEUR(0)}`} />
                    </Stack>
                  )
                }
                if (!valoracionTecnica) return null

                return (
                  <Stack direction="row" spacing={0.75} justifyContent="center" alignItems="center" sx={{ flexWrap: 'wrap', width: '100%', mt: 1 }}>
                    <Chip size="small" label={`Gate ${valoracionTecnica.gate}`} />
                    <Chip size="small" label={`Grado ${valoracionTecnica.grado_estetico}`} />
                    <Chip size="small" label={`V_tope ${fmtEUR(valoracionTecnica.V_tope)}`} />
                    <Chip size="small" color="primary" label={`Oferta ${fmtEUR(valoracionTecnica.oferta)}`} />
                    <Tooltip
                      arrow
                      placement="top"
                      title={
                        <Box sx={{ fontSize: 12, lineHeight: 1.35, maxWidth: 520 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: .5 }}>
                            Resumen backend (técnica)
                          </Typography>
                          <Box>Topes — A+: <b>{fmtEUR(valoracionTecnica.V_Aplus)}</b> · A: <b>{fmtEUR(valoracionTecnica.V_A)}</b> · B: <b>{fmtEUR(valoracionTecnica.V_B)}</b> · C: <b>{fmtEUR(valoracionTecnica.V_C)}</b></Box>
                          <Box>V_suelo: <b>{fmtEUR(valoracionTecnica.params.V_suelo)}</b> · <span style={{ opacity: .8 }}>{valoracionTecnica.params.v_suelo_regla?.label}</span></Box>
                          <Box>Deducciones: bat <b>{fmtEUR(valoracionTecnica.deducciones.pr_bat)}</b> · pant <b>{fmtEUR(valoracionTecnica.deducciones.pr_pant)}</b> · chas <b>{fmtEUR(valoracionTecnica.deducciones.pr_chas)}</b></Box>
                          <Box>Oferta backend: <b>{fmtEUR(valoracionTecnica.oferta)}</b></Box>
                          <Box sx={{ my: 1, borderTop: 1, borderColor: 'divider' }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: .25 }}>
                            Payload enviado
                          </Typography>
                          <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(payloadAuditoria, null, 2)}
                          </Box>
                        </Box>
                      }
                    >
                      <IconButton size="small" sx={{ ml: 0.25 }}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                )
              })()}
      </DialogActions>
    </Dialog>
  );
}
