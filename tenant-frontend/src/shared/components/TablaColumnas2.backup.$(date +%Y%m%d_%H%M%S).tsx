import { ColumnDef } from '@tanstack/react-table'
import { getId } from '@/shared/utils/id'
import React from 'react'
import { ESTADOS_META, ESTADOS_B2B, ESTADO_LABEL_OVERRIDES } from '@/context/estados'
import { Chip, Box, Select, MenuItem, TextField, Typography, Stack } from '@mui/material'
import { formatoBonito } from '@/context/precios'
import { EllipsisTooltip } from '@/shared/components/ui/EllipsisTooltip'
import { getResponsiveColumnMeta } from '@/shared/utils/tableResponsive'

const formatoMoneda = (valor: number) =>
  valor.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: true,
  }) + ' €'
// (eliminado) calcularTotalPrecioOrientativo: no se usaba
export interface ModeloMini {
  id: number
  descripcion: string
  tipo: string
  marca: string
  pantalla?: string | null
  año?: number | null
  procesador?: string | null
  likewize_modelo_id?: string | null
}


export interface CapacidadRow {
  id: number
  tamaño: string
  modelo: ModeloMini
  activo: boolean
  precio_b2b: string | null
  precio_b2c: string | null
  b2b_valid_from: string | null
  b2b_valid_to: string | null
  b2b_fuente: string | null
  b2c_valid_from: string | null
  b2c_valid_to: string | null
  b2c_fuente: string | null
}
const estadosFisicos = ['perfecto', 'bueno', 'regular', 'dañado']
const estadosFuncionales = ['funciona', 'pantalla_rota', 'no_enciende', 'otros'] 
const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}); 
export const fmtEUR = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—';

  const raw = typeof v === 'string' ? v.trim() : v;
  const normalized =
    typeof raw === 'string'
      ? Number(raw.replace(/\./g, '').replace(',', '.'))
      : Number(raw);

  if (!Number.isFinite(normalized)) return '—';

  const formatted = EUR.format(normalized).replace(/[\u00A0\u202F]/g, ' ').trim();
  return formatted.includes('€') ? formatted : `${formatted} €`;
};

const makeTwoLineHeader = (line1: string, line2: string) => {
  const HeaderComponent = () => (
    <Box
      component="span"
      sx={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1, textAlign: 'center' }}
    >
      <span>{line1}</span>
      <span>{line2}</span>
    </Box>
  )
  HeaderComponent.displayName = `${line1}-${line2}-header`
  return HeaderComponent
}

export const columnasCapacidadesAdmin: ColumnDef<CapacidadRow>[] = [
  {
    id: 'modelo__descripcion',
    header: 'Modelo',
    meta: { minWidth: { xs: '11rem', sm: '12rem', md: '13rem' }, align: 'left', alignHeader: 'center', label: 'Modelo' },
    accessorFn: (r) => r.modelo?.descripcion ?? '—',
    cell: ({ row, getValue }) => (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
        <Chip size="small" label={row.original.modelo?.marca ?? '—'} color="default" variant="outlined" />
        <Chip size="small" label={row.original.modelo?.tipo ?? '—'} />
        <Typography variant="body2">{getValue<string>()}</Typography>
      </Stack>
    ),
  },
  {
    id: 'activo',
    header: 'Estado',
    accessorFn: (r) => r.activo,
    meta: { minWidth: { xs: '6rem', sm: '7rem' }, align: 'center', alignHeader: 'center', label: 'Estado' },
    cell: ({ row }) => (
      <Chip
        size="small"
        color={row.original.activo ? 'success' : 'default'}
        label={row.original.activo ? 'Activo' : 'Baja'}
        variant={row.original.activo ? 'filled' : 'outlined'}
      />
    ),
  },
  {
    id: 'tamaño',
    header: 'Capacidad',
    accessorKey: 'tamaño',
    meta: { minWidth: { xs: '6rem', sm: '7rem' }, align: 'center', alignHeader: 'center', label: 'Capacidad' },
  },
  {
    id: '_b2b',
    header: 'B2B',
    meta: { minWidth: { xs: '7rem', sm: '8rem' }, align: 'right', alignHeader: 'center', label: 'B2B' },
    accessorFn: (r) => (r.precio_b2b != null ? Number(r.precio_b2b) : null),
    cell: ({ getValue }) => fmtEUR(getValue<number | null>()),
  },
  {
    id: '_b2c',
    header: 'B2C',
    meta: { minWidth: { xs: '7rem', sm: '8rem' }, align: 'right', alignHeader: 'center', label: 'B2C' },
    accessorFn: (r) => (r.precio_b2c != null ? Number(r.precio_b2c) : null),
    cell: ({ getValue }) => fmtEUR(getValue<number | null>()),
  },
  {
    id: 'fuente',
    header: 'Fuente',
    meta: { minWidth: { xs: '9rem', sm: '10rem' }, align: 'left', alignHeader: 'center', label: 'Fuente' },
    accessorFn: (r) => ({ b2b: r.b2b_fuente, b2c: r.b2c_fuente }),
    cell: ({ row }) => (
      <Stack spacing={0}>
      <Typography variant="caption">B2B: {row.original.b2b_fuente || '—'}</Typography>
      <Typography variant="caption">B2C: {row.original.b2c_fuente || '—'}</Typography>
      </Stack>
    ),
  },
  {
    id: 'vigencia',
    header: 'Vigencia',
    meta: { minWidth: { xs: '11rem', sm: '12rem', md: '13rem' }, align: 'left', alignHeader: 'center', label: 'Vigencia' },
    accessorFn: (r) => r, // usamos el row completo en la celda
    cell: ({ row }) => (
      <Stack spacing={0}>
      <Typography variant="caption">
      B2B: {row.original.b2b_valid_from ? new Date(row.original.b2b_valid_from).toLocaleDateString('es-ES') : '—'} → {row.original.b2b_valid_to ? new Date(row.original.b2b_valid_to).toLocaleDateString('es-ES') : '∞'}
      </Typography>
      <Typography variant="caption">
      B2C: {row.original.b2c_valid_from ? new Date(row.original.b2c_valid_from).toLocaleDateString('es-ES') : '—'} → {row.original.b2c_valid_to ? new Date(row.original.b2c_valid_to).toLocaleDateString('es-ES') : '∞'}
      </Typography>
      </Stack>
    ),
  },
]

type GenericRow = Record<string, unknown>

// Minimal shape used by getColumnasClientes columns
export interface ClienteLike {
  display_name?: string;
  razon_social?: string;
  nombre?: string;
  apellidos?: string;
  identificador_fiscal?: string;
  cif?: string;
  nif?: string;
  dni_nie?: string;
  tipo_cliente?: string;
  contacto?: string;
  posicion?: string;
  correo?: string;
  telefono?: string;
  tienda_nombre?: string;
  oportunidades_count?: number;
  valor_total_final?: number;
}

export const columnasAdmin: ColumnDef<GenericRow>[] = [
  { id: 'id', header: 'ID', accessorFn: getId ,meta: getResponsiveColumnMeta({ minWidth: 90, type: 'id' })},
  { id: 'partner', header: 'Partner', accessorKey: 'partner',meta: getResponsiveColumnMeta({ minWidth: 110, type: 'text', ellipsis: true, maxWidth: 220 }) },
  { id: 'tienda', header: 'Tienda', accessorFn: (r: { tienda?: { nombre?: string } }) => r.tienda?.nombre || '—',meta: getResponsiveColumnMeta({ minWidth: 100, type: 'text', ellipsis: true, maxWidth: 220 })},
  { id: 'cliente', header: 'Cliente', accessorFn: (r: { cliente?: { razon_social?: string; nombre?: string; apellidos?: string } }) => r.cliente?.razon_social || '—' ,meta: getResponsiveColumnMeta({ minWidth: 130, type: 'text', ellipsis: true, maxWidth: 280 })

},
  { id: 'oportunidad', header: 'Oportunidad', accessorKey: 'nombre' ,meta: getResponsiveColumnMeta({ minWidth: 140, type: 'text', ellipsis: true, maxWidth: 220 })},
  {
    id: 'fecha_creacion',
    header: 'Fecha',
    accessorKey: 'fecha_creacion',
    meta: { ...getResponsiveColumnMeta({ minWidth: 110, type: 'date' }), nowrapHeader: true },
    cell: ({ getValue }) => new Date(String(getValue())).toLocaleDateString()
  },
  {
    id: 'valoracion_partner',
    header: makeTwoLineHeader('Valoración', 'partner'),
    meta: getResponsiveColumnMeta({ minWidth: 140, type: 'currency', maxWidth: 200 }),
    cell: ({ row }) => {
      const valor = Number((row.original as { valor_total?: unknown }).valor_total ?? 0)
      return <Box textAlign="right">{valor > 0 ? formatoMoneda(valor) : ''}</Box>
    },
  },
  {
    id: 'valoracion_final',
    header: makeTwoLineHeader('Valoración', 'final'),
    meta: getResponsiveColumnMeta({ minWidth: 150, type: 'currency', maxWidth: 200 }),
    cell: ({ row }) => {
      const valor = Number((row.original as { valor_total_final?: unknown }).valor_total_final ?? 0)
      return <Box textAlign="right">{valor > 0 ? formatoMoneda(valor) : ''}</Box>
    },
  },
  { id: 'seguimiento', 
    header: makeTwoLineHeader('Número de', 'seguimiento'),
    accessorKey: 'numero_seguimiento',meta: getResponsiveColumnMeta({ minWidth: 200, type: 'text', ellipsis: true, maxWidth: 280 })},
  {
    id: 'estado',
    header: 'Estado',
    meta: getResponsiveColumnMeta({ minWidth: 140, type: 'status', maxWidth: 180 }),
    cell: ({ row }) => {
      const estado = String((row.original as { estado?: unknown }).estado ?? '')
      const metaInfo = ESTADOS_META[estado]
      const Icono = metaInfo?.icon
      return (
        <Chip
          label={estado}
          icon={Icono ? <Icono /> : undefined}
          color={metaInfo?.color || 'default'}
          size="small"
          sx={{ fontWeight: 500 }}
        />
      )
    },
  },
]

export const columnasTenant: ColumnDef<GenericRow>[] = [
  { id: 'id', header: 'ID', accessorFn: getId,meta: getResponsiveColumnMeta({ minWidth: 90, type: 'id' })},
  { id: 'nombre', header: 'Nombre', accessorKey: 'nombre',meta: getResponsiveColumnMeta({ minWidth: 150, type: 'text', ellipsis: true, maxWidth: 250 })},

  {
    id: 'cliente',
    header: 'Cliente',
    meta: getResponsiveColumnMeta({ minWidth: 180, type: 'text', ellipsis: true, maxWidth: 300 }),
    accessorFn: (r: { cliente?: { razon_social?: string; nombre?: string; apellidos?: string } }) => r.cliente?.razon_social ||`${r.cliente?.nombre || ""} ${r.cliente?.apellidos || ""}`.trim()
  },
  {
  id: 'valoracion',
  header: 'Val. orientativa',
  accessorFn: (r: { dispositivos?: Array<{ precio_orientativo?: unknown; cantidad?: unknown }> }) =>
    (r.dispositivos ?? []).reduce(
      (acc: number, d) => acc + (Number(d.precio_orientativo) || 0) * (Number(d.cantidad) || 0),
      0
    ),
  sortingFn: (a, b, id) =>
    Number(a.getValue(id) || 0) - Number(b.getValue(id) || 0),
  meta: {
    ...getResponsiveColumnMeta({ minWidth: 120, type: 'currency', maxWidth: 160 }),
    label: 'Valoración orientativa',
    headerMaxWidth: 140,
    toCSV: (value: unknown /*, row */) => String(Number(value ?? 0)),
  },
  cell: ({ getValue }) => {
    const total = Number(getValue<number>() ?? 0);
    return total > 0 ? formatoMoneda(total) : '—';
  },
  },
  {
    id: 'valoracion_final',
    header: 'Valoración final',
    accessorFn: (r: { valor_total_final?: unknown }) => Number(r.valor_total_final ?? 0),
    sortingFn: (a, b, id) =>
      Number(a.getValue(id) || 0) - Number(b.getValue(id) || 0),
    meta: {
      ...getResponsiveColumnMeta({ minWidth: 120, type: 'currency', maxWidth: 160 }),
      label: 'Valoración final',
      headerMaxWidth: 140,
      toCSV: (value: unknown /*, row */) => String(Number(value ?? 0)),
    },
    cell: ({ getValue }) => {
      const valor = Number(getValue<number>() ?? 0);
      return valor > 0 ? formatoMoneda(valor) : '—';
    },
  },
  {
    id: 'fecha_creacion',
    header: 'Fecha',
    accessorFn: (r: { fecha_creacion?: string | Date }) => new Date(r.fecha_creacion as unknown as string | number | Date),
    meta: {
      ...getResponsiveColumnMeta({ minWidth: 100, type: 'date' }),
      toCSV: (value: unknown /*, row */) => {
        const d = value instanceof Date ? value : value ? new Date(String(value)) : null
        return d ? d.toISOString() : ''
      },
    },
    cell: ({ getValue }) => {
      const v = getValue<Date | string | number | null>()
      const d = v instanceof Date ? v : v ? new Date(v) : null
      return d ? d.toLocaleDateString('es-ES') : '—'
    },
  },
  {
    id: 'seguimiento',
    header: 'N de seguimiento',
    accessorKey: 'numero_seguimiento',
    meta: getResponsiveColumnMeta({ minWidth: 150, type: 'text', ellipsis: true, maxWidth: 240 }),
  },
  {
    id: 'estado',
    header: 'Estado',
    accessorKey: 'estado',
    meta: {
      ...getResponsiveColumnMeta({ minWidth: 140, type: 'status', maxWidth: 180 }),
      label: 'Estado',
      toCSV: (value: unknown /*, row */) =>
        typeof value === 'string' ? value : value == null ? '' : String(value),
    },
    cell: ({ getValue }) => {
      const estado = (getValue<string>() ?? '').trim();
      const meta = ESTADOS_B2B[estado] || {};
      const Icono = meta.icon;

      const label = ESTADO_LABEL_OVERRIDES[estado] || estado || '—'
      return (
        <Chip
          label={label}
          icon={Icono ? <Icono fontSize="small" /> : undefined}
          color={meta.color || 'default'}
          size="small"
          sx={{ fontWeight: 500 }}
        />
      );
    },
  },
]

export const columnasDispositivosReales: ColumnDef<GenericRow>[] = [
  { id: 'modelo', header: 'Modelo', accessorFn: (row: { modelo?: string }) => row.modelo || '—',
    meta: { minWidth: { xs: '12rem', sm: '14rem', md: '16rem' }, maxWidth: { xs: '20rem', sm: '25rem', md: '28rem' }, align: 'center', alignHeader: 'center', ellipsis: true, ellipsisMaxWidth: { xs: '19rem', sm: '24rem', md: '27rem' } },  },
  { id: 'capacidad', header: 'Capacidad', accessorFn: (row: { capacidad?: string }) => row.capacidad || '—',
   meta: { minWidth: { xs: '9rem', sm: '10rem' }, maxWidth: { xs: '9rem', sm: '10rem' }, align: 'center', alignHeader: 'center', ellipsis: true, ellipsisMaxWidth: { xs: '8rem', sm: '9rem' } },  },
  { id: 'imei', header: 'IMEI', accessorFn: (row: { imei?: string }) => row.imei || '—',
   meta: { minWidth: { xs: '9rem', sm: '10rem' }, maxWidth: { xs: '14rem', sm: '16rem' }, align: 'center', alignHeader: 'center', ellipsis: true, ellipsisMaxWidth: { xs: '13rem', sm: '15rem' } },  },
  { id: 'numero_serie', header: 'Nº Serie', accessorFn: (row: { numero_serie?: string }) => row.numero_serie || '—',
   meta: { minWidth: { xs: '9rem', sm: '10rem' }, maxWidth: { xs: '14rem', sm: '16rem' }, align: 'center', alignHeader: 'center', ellipsis: true, ellipsisMaxWidth: { xs: '13rem', sm: '15rem' } },  },
  { id: 'estado_fisico', header: 'Estado físico', accessorFn: (row: { estado_fisico?: string }) => formatoBonito(row.estado_fisico) || '—',
   meta: { minWidth: { xs: '9rem', sm: '10rem' }, maxWidth: { xs: '9rem', sm: '10rem' }, align: 'center', alignHeader: 'center', ellipsis: true, ellipsisMaxWidth: { xs: '8rem', sm: '9rem' } },  },
  { id: 'estado_funcional', header: 'Estado funcional', accessorFn: (row: { estado_funcional?: string }) => formatoBonito(row.estado_funcional) || '—',
   meta: { minWidth: { xs: '9rem', sm: '10rem' }, maxWidth: { xs: '12rem', sm: '13rem' }, align: 'center', alignHeader: 'center', ellipsis: true, ellipsisMaxWidth: { xs: '11rem', sm: '12rem' } },  },
  { id: 'estado_valoracion', header: 'Valoración', accessorFn: (row: { estado_valoracion?: string }) => row.estado_valoracion || '—',
   meta: { minWidth: { xs: '9rem', sm: '10rem' }, maxWidth: { xs: '9rem', sm: '10rem' }, align: 'center', alignHeader: 'center', ellipsis: true, ellipsisMaxWidth: { xs: '8rem', sm: '9rem' } },  },
 {
  id: 'precio_final',
  header: 'Precio recompra',
  accessorFn: (row: any) => {
    const n = Number(row?.precio_final);
    if (!Number.isFinite(n)) return '—';
    return EUR.format(n).replace('\u00A0€', ' €');
  },
  meta: { minWidth: { xs: '10rem', sm: '11rem' }, maxWidth: { xs: '13rem', sm: '14rem' }, align: 'center', alignHeader: 'center' },
},

  {
    id: 'fecha_recepcion',
    header: 'Fecha recepción',
    accessorFn: (row: { fecha_recepcion?: string }) => row.fecha_recepcion,
    cell: ({ getValue }) => getValue() ? new Date(String(getValue())).toLocaleString('es-ES') : '—'
  },
];

export function getColumnasClientes<T extends ClienteLike = ClienteLike>(): { columnas: ColumnDef<T>[], zoom: number } {
  const formatoTel = (t?: string) => {
    const raw = (t || "").replace(/\D/g, "");
    return raw.length === 9 ? `${raw.slice(0,3)} ${raw.slice(3,6)} ${raw.slice(6)}` : (t || "—");
  };
  const mayus = (s?: string) => (s || "").toUpperCase();
  const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
  const toDisplayName = (r: ClienteLike) =>
  r.display_name ??
  r.razon_social ??
  [r.nombre, r.apellidos].filter(Boolean).join(" ");
  
  const columnas: ColumnDef<T>[] = [
    // Nombre visible unificado
    { id: "display_name", header: "Nombre", accessorFn: (row: T) => toDisplayName(row as unknown as ClienteLike) || "",
      // Activamos ellipsis por meta para que la tabla gestione el recorte y tooltip
      meta: { minWidth: { xs: '12rem', sm: '13rem', md: '14rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '14rem', sm: '15rem', md: '16rem' }, align: 'center',
      alignHeader: 'center', } as any,
    },

    // Identificador fiscal unificado
    { id: "identificador_fiscal", header: "ID fiscal", accessorFn: (row: T) => {
      const r = row as unknown as ClienteLike
      return r.identificador_fiscal || r.cif || r.nif || r.dni_nie || "—"
    },
      cell: ({ getValue }) => mayus(getValue() as string),
      meta: { minWidth: { xs: '7rem', sm: '8rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '8rem', sm: '9rem' }, align: 'center',
      alignHeader: 'center', } as any },

    // Tipo y canal (útiles para filtrar)
    { id: "tipo_cliente", header: "Tipo", accessorFn: (row: T) => formatoBonito((row as unknown as ClienteLike).tipo_cliente), meta: { minWidth: { xs: '7rem', sm: '8rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '8rem', sm: '9rem' }, align: 'center',
      alignHeader: 'center', } as any },   // empresa | autonomo | particular

    // Contacto (solo empresas; en B2C muestra —)
    { id: "contacto", header: "Contacto",
      accessorFn: (row: T) => {
        const r = row as unknown as ClienteLike
        return r.tipo_cliente === "empresa" ? (r.contacto || "—") : "—"
      },
      meta: { minWidth: { xs: '10rem', sm: '11rem', md: '12rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '11rem', sm: '12rem', md: '13rem' }, align: 'center',
      alignHeader: 'center', } as any },
    { id: "posicion", header: "Posición",
      accessorFn: (row: T) => {
        const r = row as unknown as ClienteLike
        return r.tipo_cliente === "empresa" ? (r.posicion || "—") : "—"
      },
      meta: { minWidth: { xs: '9rem', sm: '10rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '10rem', sm: '11rem' }, align: 'center',
      alignHeader: 'center', } as any },

    // Comunicación
    { id: "correo", header: "Correo", accessorFn: (row: T) => (row as unknown as ClienteLike).correo || "—", meta: { minWidth: { xs: '12rem', sm: '13rem', md: '14rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '14rem', sm: '15rem', md: '16rem' }, align: 'center',
      alignHeader: 'center', } as any },
    { id: "telefono", header: "Teléfono", accessorFn: (row: T) => formatoTel((row as unknown as ClienteLike).telefono), meta: { headerMaxWidth: { xs: '7rem', sm: '8rem' }, nowrapHeader: true, minWidth: { xs: '8rem', sm: '9rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '9rem', sm: '10rem' }, align: 'center',
      alignHeader: 'center', } as any },

    // Tienda
    { id: "tienda_nombre", header: "Tienda", accessorFn: (row: T) => (row as unknown as ClienteLike).tienda_nombre ?? "—", meta: { minWidth: { xs: '9rem', sm: '10rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '10rem', sm: '11rem' }, align: 'center',
      alignHeader: 'center', } as any },

    // Oportunidades / Valor total
    { id: "n_oportunidades", header: "OP",
      accessorKey: "oportunidades_count",
      cell: ({ getValue }) => getValue() ?? 0,
      meta: {
        headerMaxWidth: { xs: '7rem', sm: '8rem' },
        align: 'center',
        alignHeader: 'center',
        nowrapHeader: true,
        minWidth: { xs: '6rem', sm: '7rem' },
        ellipsis: true,
        ellipsisMaxWidth: { xs: '8rem', sm: '9rem' },

      } as any },


    { id: "valor_total", header: "Valor total",
      accessorKey: "valor_total_final",
      cell: ({ getValue }) => eur(Number(getValue() || 0)),
      meta: { headerMaxWidth: { xs: '7rem', sm: '8rem' }, align: "center", nowrapHeader: true, minWidth: { xs: '9rem', sm: '10rem' }, ellipsis: true, ellipsisMaxWidth: { xs: '10rem', sm: '11rem' },
        alignHeader: 'center', } as any },
  ];

  return { columnas, zoom: 1 };
}

export function getColumnasAuditoria({
  handleChange,
  guardarAuditoria,
  dispositivosEditables: _dispositivosEditables,
  filaEditando,
  setFilaEditando: _setFilaEditando,
  calcularEstadoValoracion: _calcularEstadoValoracion,
  formTemporal,
  setFormTemporal,
}: {
  handleChange: (index: number, field: string, value: string) => void;
  guardarAuditoria: (dispositivo: Record<string, unknown>, index: number, silencioso?: boolean) => void;
  dispositivosEditables: Array<Record<string, unknown>>;
  filaEditando: string | null;
  setFilaEditando: (val: string | null) => void;
  calcularEstadoValoracion: (fisico: string, funcional: string) => string;
  formTemporal: Record<string, unknown>;
  setFormTemporal: (val: Record<string, unknown>) => void;
}): { columnas: ColumnDef<GenericRow>[], zoom: number } {
  const columnas: ColumnDef<GenericRow>[] = [
    {
      id: 'modelo',
      header: 'Modelo',
      accessorFn: (row: { modelo?: string }) => row.modelo ?? '—',
      meta: { minWidth: { xs: '18rem', sm: '20rem', md: '22rem' }, align: 'center', alignHeader: 'left' },
    },
    {
      id: 'capacidad',
      header: 'Capacidad',
      accessorFn: (row: { capacidad?: string }) => row.capacidad ?? '—',
      meta: { minWidth: { xs: '6rem', sm: '7rem' }, align: 'center' },
    },
    {
      id: 'imei',
      header: 'IMEI',
      accessorFn: (row: { imei?: string }) => row.imei || '—',
      meta: { minWidth: { xs: '12rem', sm: '13rem', md: '14rem' }, align: 'center' },
    },
    {
      id: 'Numero_Serie',
      header: 'Nº Serie',
      accessorFn: (row: { numero_serie?: string }) => row.numero_serie || '—',
      meta: { minWidth: { xs: '12rem', sm: '13rem', md: '14rem' }, align: 'center' },
    },
    {
      id: 'estado_fisico',
      header: 'Estético',
      cell: ({ row }) =>
        filaEditando === row.original.id ? (
          <Select
            size="small"
            value={String((row.original as { estado_fisico?: unknown }).estado_fisico ?? '')}
            onChange={(e) => handleChange(Number((row.original as { id?: unknown }).id), 'estado_fisico', String(e.target.value))}
          >
            {estadosFisicos.map((e) => (
              <MenuItem key={e} value={e}>
                {formatoBonito(e)}
              </MenuItem>
            ))}
          </Select>
        ) : (
          formatoBonito(String((row.original as { estado_fisico?: unknown }).estado_fisico ?? ''))
        ),
      meta: { minWidth: { xs: '7rem', sm: '8rem' }, align: 'center', persist: true },
    },
    {
      id: 'estado_funcional',
      header: 'Funcional',
      cell: ({ row }) =>
        filaEditando === row.original.id ? (
          <Select
            size="small"
            value={String((row.original as { estado_funcional?: unknown }).estado_funcional ?? '')}
            onChange={(e) => handleChange(Number((row.original as { id?: unknown }).id), 'estado_funcional', String(e.target.value))}
          >
            {estadosFuncionales.map((e) => (
              <MenuItem key={e} value={e}>
                {formatoBonito(e)}
              </MenuItem>
            ))}
          </Select>
        ) : (
          formatoBonito(String((row.original as { estado_funcional?: unknown }).estado_funcional ?? ''))
        ),
      meta: { minWidth: { xs: '7rem', sm: '8rem' }, align: 'center', persist: true },
    },
    {
      id: 'estado_valoracion',
      header: 'Valoración',
      accessorFn: (row: { estado_valoracion?: unknown }) => formatoBonito(String(row.estado_valoracion ?? '')),
      meta: { minWidth: { xs: '8rem', sm: '9rem' }, align: 'center', alignHeader: 'left' },
    },
    {
      id: 'precio_final',
      header: 'Precio',
      cell: ({ row }) => {
        const id = String(row.original.id)
        const temp = (formTemporal[id] as { precio_final?: unknown } | undefined)?.precio_final
        const valorActual = temp ?? row.original.precio_final ?? row.original.precio_orientativo ?? ''

        return filaEditando === row.original.id ? (
          <TextField
            key={`precio-${row.original.id}`}
            size="small"
            type="number"
            value={valorActual as string | number}
            onChange={(e) => {
              const next = { ...(formTemporal[id] as Record<string, unknown> | undefined), precio_final: e.target.value }
              setFormTemporal({ ...formTemporal, [id]: next })
            }}
            onBlur={() => {
              const toSave = String((formTemporal[id] as { precio_final?: unknown } | undefined)?.precio_final ?? valorActual ?? '')
              if (toSave !== String(row.original.precio_final ?? '')) {
                handleChange(Number((row.original as { id?: unknown }).id), 'precio_final', toSave);
                guardarAuditoria(
                  {
                    ...row.original,
                    precio_final: toSave,
                  } as unknown as Record<string, unknown>,
                  row.index,
                  false
                );
              }
            }}
            inputProps={{ min: 0 }}
          />
        ) : (
          <Typography variant="body2" align="center">
            {String((row.original as { precio_final?: unknown; precio_orientativo?: unknown }).precio_final ?? (row.original as { precio_orientativo?: unknown }).precio_orientativo ?? '—') + ' €'}
          </Typography>
        );
      },
      meta: { minWidth: { xs: '8rem', sm: '9rem' }, align: 'center', alignHeader: 'left', persist: true },
    },
    {
      id: 'observaciones',
      header: 'Observaciones',
      cell: ({ row }) => {
        const id = String(row.original.id)
        const temp = (formTemporal[id] as { observaciones?: unknown } | undefined)?.observaciones
        const valorActual = String(temp ?? row.original.observaciones ?? '')

        return filaEditando === row.original.id ? (
          <TextField
            key={`obs-${row.original.id}`}
            size="small"
            value={valorActual}
            onChange={(e) => {
              const next = { ...(formTemporal[id] as Record<string, unknown> | undefined), observaciones: e.target.value }
              setFormTemporal({ ...formTemporal, [id]: next })
            }}
            onBlur={() => {
              if (valorActual !== String(row.original.observaciones ?? '')) {
                handleChange(Number((row.original as { id?: unknown }).id), 'observaciones', valorActual);
              }
            }}
            placeholder="Opcional"
            sx={{ minWidth: { xs: '28rem', sm: '30rem', md: '32rem' } }}
          />
          ) : (
          <Typography variant="body2" align="center">
             {String((row.original as { observaciones?: unknown }).observaciones ?? '—')}
          </Typography>
        );
      },
      meta: { minWidth: { xs: '30rem', sm: '32rem', md: '35rem' }, align: 'center', alignHeader: 'left', persist: true },
    },

  ];

  return {
    columnas,
    zoom: 0.82, // 👈 escala visual para esta tabla
  };
}

export const columnasOperaciones: ColumnDef<GenericRow>[] = [
  { id: 'id', header: 'ID', accessorFn: getId, meta: { minWidth: { xs: '5rem', sm: '5rem' }, maxWidth: { xs: '8rem', sm: '8rem' }, align: 'center', alignHeader: 'center' } },
  {
    id: 'comercial',
    header: 'Comercial',
    accessorFn: (r: { usuario_info?: { name?: string; } }) => r.usuario_info?.name || '—',
    meta: {
      align: 'center',
      minWidth: { xs: 0, sm: '5rem',md: '5rem' },
      maxWidth: { xs: '14rem', sm: '18rem', md: '20rem' },
      alignHeader: 'center',
      ellipsis: true,
      ellipsisMaxWidth: { xs: '13rem', sm: '17rem', md: '19rem' },
    },
  },
  { id: 'nombre', header: 'Nombre', accessorKey: 'nombre', meta: { minWidth: { xs: 0, sm: '6rem' }, maxWidth: { xs: '10rem', sm: '12rem', md: '14rem' }, align: 'center', alignHeader: 'center', ellipsis: true, ellipsisMaxWidth: { xs: '9rem', sm: '11rem', md: '13rem' } } },
  
  {
    id: 'cliente',
    header: 'Cliente',
    meta: {
            minWidth: { xs: 0, sm: '6rem' },
            maxWidth: { xs: '12rem', sm: '13rem', md: '14rem' },
            align: 'center',
            alignHeader: 'center',
            ellipsis: true,
            ellipsisMaxWidth: { xs: '11rem', sm: '12rem', md: '13rem' },
          },
    accessorFn: (r: { cliente?: { razon_social?: string; nombre?: string; apellidos?: string } }) => r.cliente?.razon_social ||`${r.cliente?.nombre || ""} ${r.cliente?.apellidos || ""}`.trim()
  },
  {
  id: 'valoracion',
  header: makeTwoLineHeader('Valoración', 'orientativa'),
  accessorFn: (r: { dispositivos?: Array<{ precio_orientativo?: unknown; cantidad?: unknown }> }) =>
    (r.dispositivos ?? []).reduce(
      (acc: number, d) => acc + (Number(d.precio_orientativo) || 0) * (Number(d.cantidad) || 0),
      0
    ),
  sortingFn: (a, b, id) =>
    Number(a.getValue(id) || 0) - Number(b.getValue(id) || 0),
  meta: {
    label: 'Valoración orientativa',
    minWidth: { xs: 0, sm: '7rem', md: '8rem' },
    align: 'center',
    alignHeader: 'center',
    headerMaxWidth: { xs: '9rem', sm: '10rem', md: '11rem' },
    // CSV crudo (número):
    toCSV: (value: unknown /*, row */) => String(Number(value ?? 0)),
    // Si prefieres exportar formateado:
    // toCSV: (v: number) => formatoMoneda(v ?? 0),
  },
  cell: ({ getValue }) => {
    const total = Number(getValue<number>() ?? 0);
    return total > 0 ? formatoMoneda(total) : '—';
  },
  },
  {
    id: 'valoracion_final',
    header: makeTwoLineHeader('Valoración', 'final'),
    accessorFn: (r: { valor_total_final?: unknown }) => Number(r.valor_total_final ?? 0),
    sortingFn: (a, b, id) =>
      Number(a.getValue(id) || 0) - Number(b.getValue(id) || 0),
    meta: {
      label: 'Valoración final',
      minWidth: { xs: 0, sm: '7rem', md: '8rem' },
      align: 'center',
      alignHeader: 'center',
      headerMaxWidth: { xs: '9rem', sm: '10rem', md: '11rem' },
      toCSV: (value: unknown /*, row */) => String(Number(value ?? 0)),
    },
    cell: ({ getValue }) => {
      const valor = Number(getValue<number>() ?? 0);
      return valor > 0 ? formatoMoneda(valor) : '—';
    },
  },
  {
    id: 'fecha_creacion',
    header: 'Fecha',
    accessorFn: (r: { fecha_creacion?: string | Date }) => new Date(r.fecha_creacion as unknown as string | number | Date),
    meta: {
      minWidth: { xs: 0, sm: '6rem', md: '7rem' },
      align: 'center',
      alignHeader: 'center',
      toCSV: (value: unknown /*, row */) => {
        const d = value instanceof Date ? value : value ? new Date(String(value)) : null
        return d ? d.toISOString() : ''
      },
    },
    cell: ({ getValue }) => {
      const v = getValue<Date | string | number | null>()
      const d = v instanceof Date ? v : v ? new Date(v) : null
      return d ? d.toLocaleDateString('es-ES') : '—'
    },
  },
  {
    id: 'seguimiento',
    header: 'N de seguimiento',
    accessorKey: 'numero_seguimiento',
    meta: {
      align: 'center',
      minWidth: { xs: 0, sm: '6rem', md: '7rem' },
      maxWidth: { xs: '12rem', sm: '14rem', md: '16rem' },
      alignHeader: 'center',
      ellipsis: true,
      ellipsisMaxWidth: { xs: '11rem', sm: '13rem', md: '15rem' },
    },
  },
  {
    id: 'estado',
    header: 'Estado',
    accessorKey: 'estado',                 // <- clave para que row.getValue('estado') funcione
    meta: {
      label: 'Estado',
      align: 'center',
      alignHeader: 'center',
      toCSV: (value: unknown /*, row */) =>
        typeof value === 'string' ? value : value == null ? '' : String(value),
      minWidth: { xs: 0, sm: '6rem', md: '7rem' },
      maxWidth: { xs: '8rem', sm: '9rem', md: '10rem' },
    },
    cell: ({ getValue }) => {
      const estado = (getValue<string>() ?? '').trim();
      const meta = ESTADOS_B2B[estado] || {};
      const Icono = meta.icon;

      const label = ESTADO_LABEL_OVERRIDES[estado] || estado || '—'
      return (
        <Chip
          label={label}
          icon={Icono ? <Icono fontSize="small" /> : undefined}
          color={meta.color || 'default'}
          size="small"
          sx={{ fontWeight: 500 }}
        />
      );
    },
  },
]
