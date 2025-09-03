'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Stepper, Step, StepLabel, TextField, Typography, Grid, Chip
} from '@mui/material';

import { calcularEstadoDetallado, EstadoFisico, EstadoFuncional, NivelDesgaste } from './valoracion';

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

interface Props {
  open: boolean;
  dispositivo: Partial<ValoresAuditoria> | null;
  onClose: () => void;
  onSubmit: (val: ValoresAuditoria, opts?: { siguiente?: boolean }) => void;
  titulo?: string;

  // ⬇️ NUEVO: para reutilizar tus componentes visuales
  catalog?: CatalogoValoracion;
  isLaptop?: boolean;
}

/* -------------------- helpers de título -------------------- */
function inferTipoFromDispositivo(d?: any): string {
  const txt = [
    d?.tipo,
    d?.modelo_nombre,
    typeof d?.modelo === 'string' ? d?.modelo : d?.modelo?.nombre,
  ].filter(Boolean).join(' ').toLowerCase();

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

function pickFirstString(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') {
      if (k === 'modelo') {
        const cand = v.nombre || v.name || v.title || v.display_name;
        if (typeof cand === 'string' && cand.trim()) return cand.trim();
      }
      if (k.startsWith('capacidad')) {
        const cand = v.nombre || v.name || v.title || v.display_name || v.capacidad || v.gb || v.storage || v.size;
        if (typeof cand === 'string' && cand.trim()) return cand.trim();
        if (typeof cand === 'number' && Number.isFinite(cand)) return String(cand);
      }
    }
  }
  return null;
}
function normalizeCapacityString(raw: any): string | null {
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
function pickCapacity(d: any): string | null {
  const c = pickFirstString(d, [
    'capacidad', 'capacidad_nombre', 'capacidad_gb', 'storage', 'storage_gb', 'almacenamiento', 'rom',
    'capacidad', 'capacidad_obj', 'modelo_capacidad',
  ]);
  return normalizeCapacityString(c);
}
function getModeloSerieCapacidad(d: any): { modelo: string | null; serie: string | null; capacidad: string | null } {
  const modelo = pickFirstString(d, ['modelo_nombre', 'modelo', 'nombre_modelo', 'modelo_comercial', 'modelo_detalle']);
  const serie  = pickFirstString(d, ['imei', 'numero_serie', 'sn', 'serial', 'n_serie', 'identificador']);
  const capacidad = pickCapacity(d);
  return { modelo, serie, capacidad };
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
}) {
  const salud_bateria_pct =
    typeof params.saludBateria === 'number' && Number.isFinite(params.saludBateria)
      ? params.saludBateria
      : null;
  const ciclos_bateria =
    typeof params.ciclosBateria === 'number' && Number.isFinite(params.ciclosBateria)
      ? params.ciclosBateria
      : null;

  const pantalla_funcional_puntos_bril = params.pantallaIssues.includes('puntos' as any);
  const pantalla_funcional_pixeles_muertos = params.pantallaIssues.includes('pixeles' as any);
  // tratamos "líneas" funcionales como crítico
  const pantalla_funcional_lineas_quemaduras =
    params.pantallaIssues.includes('lineas' as any) || params.estadoPantalla === 'agrietado_roto';

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
  const worst = params.estadoPantalla === 'agrietado_roto' || params.estadoLados === 'agrietado_roto' || params.estadoEspalda === 'agrietado_roto'
    ? 'agrietado_roto'
    : [params.estadoPantalla, params.estadoLados, params.estadoEspalda].includes('desgaste_visible' as any)
      ? 'desgaste_visible'
      : [params.estadoPantalla, params.estadoLados, params.estadoEspalda].includes('algunos' as any)
        ? 'algunos'
        : [params.estadoPantalla, params.estadoLados, params.estadoEspalda].includes('minimos' as any)
          ? 'minimos'
          : 'sin_signos';

  if (worst === 'agrietado_roto') estado_fisico = 'dañado';
  else if (worst === 'desgaste_visible') estado_fisico = 'aceptable';
  else if (worst === 'algunos' || worst === 'minimos') estado_fisico = 'bueno';
  else estado_fisico = 'perfecto';

  // “estado_funcional” no viene de este flujo; lo fijamos neutro:
  const estado_funcional: EstadoFuncional = 'funciona';

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
  open, dispositivo, onClose, onSubmit, titulo, catalog, isLaptop,
}: Props) {
    const tipo = useMemo(() => inferTipoFromDispositivo(dispositivo || {}), [dispositivo]);
    const cat = useMemo(() => catalog ?? buildCatalogByTipo(tipo), [catalog, tipo]);
    const isLaptopFinal = useMemo(
        () => (typeof isLaptop === 'boolean' ? isLaptop : /\b(macbook|laptop|portátil)\b/i.test(tipo)),
        [isLaptop, tipo]
    );
    const hasScreen  = /\b(iphone|ipad|macbook|imac)\b/i.test(tipo);
    const hasBattery = /\b(iphone|ipad|macbook)\b/i.test(tipo);
    const visiblePasos = useMemo(() => {
        const arr: Array<'Batería'|'Pantalla'|'Exterior'|'Precio y notas'> = [];
        if (hasBattery) arr.push('Batería');
        if (hasScreen)  arr.push('Pantalla');
        arr.push('Exterior', 'Precio y notas');
        return arr;
    }, [hasBattery, hasScreen]);
    const [step, setStep] = useState(0);

    // ---- estado controlado de los pasos (UI) ----
    const [saludBateria, setSaludBateria] = useState<number | ''>('');
    const [ciclosBateria, setCiclosBateria] = useState<number | ''>('');

    const [pantallaIssues, setPantallaIssues] = useState<FuncPantallaValue[]>([]);
    const [estadoPantalla, setEstadoPantalla] = useState<EsteticaKey | ''>('');

    const [estadoLados, setEstadoLados] = useState<EsteticaKey | ''>('');
    const [estadoEspalda, setEstadoEspalda] = useState<EsteticaKey | ''>('');

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
    const recomputar = useCallback((draft: ValoresAuditoria, fromUI: ReturnType<typeof buildDetalladoFromUI>) => {
        const valoracion = calcularEstadoDetallado({
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

        // Sugiere precio si el usuario no lo editó y no es 'a_revision'
        if (!draft.editado_por_usuario && draft.precio_por_estado && valoracion !== 'a_revision') {
        const sugerido = draft.precio_por_estado[valoracion];
        if (typeof sugerido !== 'undefined') draft.precio_final = sugerido;
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
    }, []);

    const updateFromUI = useCallback(() => {
        setForm((prev) => {
        const next: ValoresAuditoria = { ...prev };
        const ui = buildDetalladoFromUI({
            saludBateria, ciclosBateria,
            pantallaIssues,
            estadoPantalla,
            estadoLados,
            estadoEspalda,
        });
        recomputar(next, ui);
        return next;
        });
    }, [saludBateria, ciclosBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda, recomputar]);

    // Reset/seed al abrir o al cambiar de dispositivo
    useEffect(() => {
        if (!open || !dispositivo?.id) return;
        setStep(0);
        setSaludBateria(typeof dispositivo.salud_bateria_pct === 'number' ? dispositivo.salud_bateria_pct! : '');
        setCiclosBateria(typeof dispositivo.ciclos_bateria === 'number' ? dispositivo.ciclos_bateria! : '');

        // reconstruye issues de pantalla desde flags (si vienen)
        const issues: FuncPantallaValue[] = [];
        if (dispositivo.pantalla_funcional_puntos_bril) issues.push('puntos' as any);
        if (dispositivo.pantalla_funcional_pixeles_muertos) issues.push('pixeles' as any);
        if (dispositivo.pantalla_funcional_lineas_quemaduras) issues.push('lineas' as any);
        setPantallaIssues(issues);

        // si viene estética previa, mapea al enum UI (no siempre disponible: dejamos vacío si no llega)
        setEstadoPantalla('');
        setEstadoLados('');
        setEstadoEspalda('');

        setForm((prev) => {
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

    // dispara recomputo cuando cambie cualquier sub-bloque
    useEffect(() => { if (open) updateFromUI(); }, [open, updateFromUI]);
    const computeFinalFromUI = useCallback((): ValoresAuditoria => {
        const next: ValoresAuditoria = { ...form }; // snapshot actual
        const ui = buildDetalladoFromUI({
            saludBateria, ciclosBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda
        });
        recomputar(next, ui);
        return next;
        }, [form, saludBateria, ciclosBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda, recomputar]);
    const pasos = visiblePasos;
    const current = pasos[step];
    
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
                label={form.estado_valoracion ?? '—'}
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

        {/* Paso 0: Batería */}
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
            funcBasica={'' as any} setFuncBasica={() => {}}
            pantallaIssues={[]} setPantallaIssues={() => {}}
            openDemo={() => {}}
          />
        )}

        {/* Paso 1: Pantalla (funcional/defectos) */}
        {current === 'Pantalla' && (
          <PasoEstadoDispositivo
            catalog={cat}
            isLaptop={isLaptopFinal}
            mode="screen"
            saludBateria={0 as any} setSaludBateria={() => {}}
            ciclosBateria={''} setCiclosBateria={() => {}}
            funcBasica={'' as any} setFuncBasica={() => {}}
            pantallaIssues={pantallaIssues}
            setPantallaIssues={setPantallaIssues}
            openDemo={() => {}}
          />
        )}

        {/* Paso 2: Exterior (laterales/trasera) y (opcional) estética pantalla */}
        {current === 'Exterior' && (
          <PasoEstetica
            catalog={cat}
            // Si quieres incluir estética de pantalla aquí también: mode="all"
            mode="body"
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
                    setForm(final);           // opcional, para reflejarlo en UI
                    onSubmit(final, { siguiente: true });
                }}
                >
                Guardar y siguiente
                </Button>
                <Button
                variant="contained"
                onClick={() => {
                    const final = computeFinalFromUI();
                    setForm(final);           // opcional
                    onSubmit(final);
                }}
                >
                Guardar
                </Button>
            </>
            )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
