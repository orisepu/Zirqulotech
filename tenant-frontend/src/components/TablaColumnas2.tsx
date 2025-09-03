import { ColumnDef } from '@tanstack/react-table'
import { getId } from '@/utils/id'
import React, { useState ,useEffect} from 'react'
import { ESTADOS_META, ESTADOS_B2B } from '@/context/estados'
import { Chip, Box, Select, MenuItem, TextField, Button,Typography,Tooltip,IconButton,Stack } from '@mui/material'
import { formatoBonito, calcularEstadoValoracion } from '@/context/precios'
import { getPrecioFinal } from '@/context/precios'
import { EllipsisTooltip } from './EllipsisTooltip'

const formatoMoneda = (valor: number) =>
  valor.toLocaleString('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: true,
  }) + ' €'
const calcularTotalPrecioOrientativo = (oportunidad: any): number => {
    return oportunidad.dispositivos?.reduce((acc: number, d: any) => {
    const precio = parseFloat(d.precio_orientativo || 0)
    const cantidad = d.cantidad || 0
    return acc + (precio * cantidad)
    }, 0)
}
export interface ModeloMini {
  id: number
  descripcion: string
  tipo: string
  pantalla?: string | null
  año?: number | null
  procesador?: string | null
}


export interface CapacidadRow {
  id: number
  tamaño: string
  modelo: ModeloMini
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
const fmtEUR = (v: string | number | null | undefined): string =>
  v === null || v === undefined || v === ''
    ? '—'
    : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(v))


export const columnasCapacidadesAdmin: ColumnDef<CapacidadRow>[] = [
  {
    id: 'modelo__descripcion',
    header: 'Modelo',
    meta: { minWidth: 180, align: 'left', alignHeader: 'center', label: 'Modelo' },
    accessorFn: (r) => r.modelo?.descripcion ?? '—',
    cell: ({ row, getValue }) => (
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip size="small" label={row.original.modelo?.tipo ?? '—'} />
        <Typography variant="body2">{getValue<string>()}</Typography>
      </Stack>
    ),
  },
  {
    id: 'tamaño',
    header: 'Capacidad',
    accessorKey: 'tamaño',
    meta: { minWidth: 100, align: 'center', alignHeader: 'center', label: 'Capacidad' },
  },
  {
    id: '_b2b',
    header: 'B2B',
    meta: { minWidth: 110, align: 'right', alignHeader: 'center', label: 'B2B' },
    accessorFn: (r) => (r.precio_b2b != null ? Number(r.precio_b2b) : null),
    cell: ({ getValue }) => fmtEUR(getValue<number | null>()),
  },
  {
    id: '_b2c',
    header: 'B2C',
    meta: { minWidth: 110, align: 'right', alignHeader: 'center', label: 'B2C' },
    accessorFn: (r) => (r.precio_b2c != null ? Number(r.precio_b2c) : null),
    cell: ({ getValue }) => fmtEUR(getValue<number | null>()),
  },
  {
    id: 'fuente',
    header: 'Fuente',
    meta: { minWidth: 140, align: 'left', alignHeader: 'center', label: 'Fuente' },
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
    meta: { minWidth: 180, align: 'left', alignHeader: 'center', label: 'Vigencia' },
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

export const columnasAdmin: ColumnDef<any>[] = [
  { id: 'id', header: 'ID', accessorFn: getId ,meta: { minWidth: 150, align: 'center', alignHeader: 'center'},},
  { id: 'partner', header: 'Partner', accessorKey: 'partner',meta: { minWidth: 150, align: 'center', alignHeader: 'center'}, },
  { id: 'tienda', header: 'Tienda', accessorFn: r => r.tienda?.nombre || '—',meta: { minWidth: 150, align: 'center', alignHeader: 'center'}, },
  { id: 'cliente', header: 'Cliente', accessorFn: r => r.cliente?.razon_social || '—' ,meta: { minWidth: 150, align: 'center', alignHeader: 'center'},},
  { id: 'oportunidad', header: 'Oportunidad', accessorKey: 'nombre' ,meta: { minWidth: 150, align: 'center', alignHeader: 'center'},},
  {
    id: 'fecha_creacion',
    header: 'Fecha',
    accessorKey: 'fecha_creacion',
    meta: { minWidth: 98, align: 'center', alignHeader: 'center'},
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString()
  },
  {
    id: 'valoracion_partner',
    header: 'Valoración partner',
    meta: { minWidth: 125, align: 'center', alignHeader: 'center'},
    cell: ({ row }) => {
      const valor = Number(row.original.valor_total || 0)
      return <Box textAlign="right">{valor > 0 ? formatoMoneda(valor) : ''}</Box>
    },
  },
  {
    id: 'valoracion_final',
    header: 'Valoración final',
    meta: { minWidth: 125, align: 'center', alignHeader: 'center'},
    cell: ({ row }) => {
      const valor = Number(row.original.valor_total_final || 0)
      return <Box textAlign="right">{valor > 0 ? formatoMoneda(valor) : ''}</Box>
    },
  },
  { id: 'seguimiento', header: 'Número de seguimiento', accessorKey: 'numero_seguimiento',meta: { minWidth: 150, align: 'center', alignHeader: 'center'}, },
  {
    id: 'estado',
    header: 'Estado',
    
    cell: ({ row }) => {
      const meta = ESTADOS_META[row.original.estado]
      const Icono = meta?.icon
      return (
        <Chip
          label={row.original.estado}
          icon={Icono ? <Icono /> : undefined}
          color={meta?.color || 'default'}
          size="small"
          sx={{ fontWeight: 500 }}
        />
      )
    },
  },
]

export const columnasTenant: ColumnDef<any>[] = [
  { id: 'id', header: 'ID', accessorFn: getId,meta: { minWidth: 150, align: 'center', alignHeader: 'center'}, },
  { id: 'nombre', header: 'Nombre', accessorKey: 'nombre',meta: { minWidth: 200, align: 'center',alignHeader: 'center',ellipsis: true,ellipsisMaxWidth: 200,}, },
  
  { id: 'cliente', header: 'Cliente', meta: { minWidth: 200, align: 'center',alignHeader: 'center',ellipsis: true,ellipsisMaxWidth: 200,},accessorFn: r => r.cliente?.razon_social ||`${r.cliente?.nombre || ""} ${r.cliente?.apellidos || ""}`.trim()},
  {
  id: 'valoracion',
  header: 'Valoración orientativa',
  accessorFn: (r: any) =>
    (r.dispositivos ?? []).reduce(
      (acc: number, d: any) =>
        acc + (Number(d.precio_orientativo) || 0) * (Number(d.cantidad) || 0),
      0
    ),
  sortingFn: (a, b, id) =>
    Number(a.getValue(id) || 0) - Number(b.getValue(id) || 0),
  meta: {
    label: 'Valoración orientativa',
    minWidth: 120,
    align: 'right',
    alignHeader: 'right',
    headerMaxWidth: 140,
    // CSV crudo (número):
    toCSV: (value: unknown /*, row: any */) => String(Number(value ?? 0)),
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
    header: 'Valoración final',
    accessorFn: (r: any) => Number(r.valor_total_final ?? 0),
    sortingFn: (a, b, id) =>
      Number(a.getValue(id) || 0) - Number(b.getValue(id) || 0),
    meta: {
      label: 'Valoración final',
      minWidth: 120,
      align: 'right',
      alignHeader: 'right',
      headerMaxWidth: 140,
      toCSV: (value: unknown /*, row: any */) => String(Number(value ?? 0)),
    },
    cell: ({ getValue }) => {
      const valor = Number(getValue<number>() ?? 0);
      return valor > 0 ? formatoMoneda(valor) : '—';
    },
  },
  {
    id: 'fecha_creacion',
    header: 'Fecha',
    accessorFn: r => new Date(r.fecha_creacion),
    meta: {
      minWidth: 100,
      align: 'center',
      toCSV: (value: unknown /*, row */) => {
        const d = value instanceof Date ? value : value ? new Date(String(value)) : null
        return d ? d.toISOString() : ''
      },
    },
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
  { id: 'seguimiento', header: 'Número de seguimiento', accessorKey: 'numero_seguimiento' },
  {
    id: 'estado',
    header: 'Estado',
    accessorKey: 'estado',                 // <- clave para que row.getValue('estado') funcione
    meta: {
      label: 'Estado',
      toCSV: (value: unknown /*, row */) =>
        typeof value === 'string' ? value : value == null ? '' : String(value),
      minWidth: 140,
    },
    cell: ({ getValue }) => {
      const estado = (getValue<string>() ?? '').trim();
      const meta = ESTADOS_B2B[estado] || {};
      const Icono = meta.icon;

      return (
        <Chip
          label={estado || '—'}
          icon={Icono ? <Icono fontSize="small" /> : undefined}
          color={meta.color || 'default'}
          size="small"
          sx={{ fontWeight: 500 }}
        />
      );
    },
  },
]

export const columnasDispositivosReales: ColumnDef<any>[] = [
  { id: 'modelo', header: 'Modelo', accessorFn: row => row.modelo || '—' },
  { id: 'capacidad', header: 'Capacidad', accessorFn: row => row.capacidad || '—' },
  { id: 'imei', header: 'IMEI', accessorFn: row => row.imei || '—' },
  { id: 'numero_serie', header: 'Nº Serie', accessorFn: row => row.numero_serie || '—' },
  { id: 'estado_fisico', header: 'Estado físico', accessorFn: row => formatoBonito(row.estado_fisico) || '—' },
  { id: 'estado_funcional', header: 'Estado funcional', accessorFn: row => formatoBonito(row.estado_funcional) || '—' },
  { id: 'estado_valoracion', header: 'Valoración', accessorFn: row => row.estado_valoracion || '—' },
  {
    id: 'precio_final',
    header: 'Precio recompra',
    cell: ({ row }) => {
      const valor = Number(row.original.precio_final || 0);
      return (
        <Box textAlign="right">
          {valor > 0 ? valor.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: true }) + ' €' : ''}
        </Box>
      );
    },
  },
  {
    id: 'fecha_recepcion',
    header: 'Fecha recepción',
    accessorFn: row => row.fecha_recepcion,
    cell: ({ getValue }) => getValue() ? new Date(getValue() as string).toLocaleString('es-ES') : '—'
  },
];

export function getColumnasClientes(): { columnas: ColumnDef<any>[], zoom: number } {
  const formatoTel = (t?: string) => {
    const raw = (t || "").replace(/\D/g, "");
    return raw.length === 9 ? `${raw.slice(0,3)} ${raw.slice(3,6)} ${raw.slice(6)}` : (t || "—");
  };
  const mayus = (s?: string) => (s || "").toUpperCase();
  const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
  const toDisplayName = (r: any) =>
  r.display_name ??
  r.razon_social ??
  [r.nombre, r.apellidos].filter(Boolean).join(" ");
  
  const columnas: ColumnDef<any>[] = [
    // Nombre visible unificado
    { id: "display_name", header: "Nombre", accessorFn: (row) => toDisplayName(row) || "",        // <- solo string
  cell: ({ getValue }) => (
    <EllipsisTooltip text={(getValue() as string) || ""} maxWidth={240} />
  ),
},

    // Identificador fiscal unificado
    { id: "identificador_fiscal", header: "ID fiscal", accessorFn: row => row.identificador_fiscal || row.cif || row.nif || row.dni_nie || "—",
      cell: ({ getValue }) => mayus(getValue() as string) },

    // Tipo y canal (útiles para filtrar)
    { id: "tipo_cliente", header: "Tipo", accessorFn: row => formatoBonito(row.tipo_cliente) },   // empresa | autonomo | particular
  
    // Contacto (solo empresas; en B2C muestra —)
    { id: "contacto", header: "Contacto",
      accessorFn: row => row.tipo_cliente === "empresa" ? (row.contacto || "—") : "—" },
    { id: "posicion", header: "Posición",
      accessorFn: row => row.tipo_cliente === "empresa" ? (row.posicion || "—") : "—" },

    // Comunicación
    { id: "correo", header: "Correo", accessorFn: row => row.correo || "—" },
    { id: "telefono", header: "Teléfono", accessorFn: row => formatoTel(row.telefono) },

    // Tienda
    { id: "tienda_nombre", header: "Tienda", accessorFn: row => row.tienda_nombre ?? "—" },

    // Oportunidades / Valor total
    { id: "n_oportunidades", header: "Oportunidades",
      accessorKey: "oportunidades_count",
      cell: ({ getValue }) => getValue() ?? 0 },
      

    { id: "valor_total", header: "Valor total",
      accessorKey: "valor_total_final", 
      cell: ({ getValue }) => eur(Number(getValue() || 0)) },
  ];

  return { columnas, zoom: 1 };
}

export function getColumnasAuditoria({
  handleChange,
  guardarAuditoria,
  dispositivosEditables,
  filaEditando,
  setFilaEditando,
  calcularEstadoValoracion,
  formTemporal,
  setFormTemporal,
}: {
  handleChange: (index: number, field: string, value: string) => void;
  guardarAuditoria: (dispositivo: any, index: number, silencioso?: boolean) => void;
  dispositivosEditables: any[];
  filaEditando: string | null;
  setFilaEditando: (val: string | null) => void;
  calcularEstadoValoracion: (fisico: string, funcional: string) => string;
  formTemporal: Record<string, any>;
  setFormTemporal: (val: Record<string, any>) => void;
}): { columnas: ColumnDef<any>[], zoom: number } {
  const columnas: ColumnDef<any>[] = [
    {
      id: 'modelo',
      header: 'Modelo',
      accessorFn: (row) => row.modelo ?? '—',
      meta: { minWidth: 300, align: 'center', alignHeader: 'left' },
    },
    {
      id: 'capacidad',
      header: 'Capacidad',
      accessorFn: (row) => row.capacidad ?? '—',
      meta: { minWidth: 100, align: 'center' },
    },
    {
      id: 'imei',
      header: 'IMEI',
      accessorFn: (row) => row.imei || '—',
      meta: { minWidth: 200, align: 'center' },
    },
    {
      id: 'Numero_Serie',
      header: 'Nº Serie',
      accessorFn: (row) => row.numero_serie || '—',
      meta: { minWidth: 200, align: 'center' },
    },
    {
      id: 'estado_fisico',
      header: 'Estético',
      cell: ({ row }) =>
        filaEditando === row.original.id ? (
          <Select
            size="small"
            value={row.original.estado_fisico || ''}
            onChange={(e) => handleChange(row.original.id, 'estado_fisico', e.target.value)}
          >
            {estadosFisicos.map((e) => (
              <MenuItem key={e} value={e}>
                {formatoBonito(e)}
              </MenuItem>
            ))}
          </Select>
        ) : (
          formatoBonito(row.original.estado_fisico || '')
        ),
      meta: { minWidth: 120, align: 'center', persist: true },
    },
    {
      id: 'estado_funcional',
      header: 'Funcional',
      cell: ({ row }) =>
        filaEditando === row.original.id ? (
          <Select
            size="small"
            value={row.original.estado_funcional || ''}
            onChange={(e) => handleChange(row.original.id, 'estado_funcional', e.target.value)}
          >
            {estadosFuncionales.map((e) => (
              <MenuItem key={e} value={e}>
                {formatoBonito(e)}
              </MenuItem>
            ))}
          </Select>
        ) : (
          formatoBonito(row.original.estado_funcional || '')
        ),
      meta: { minWidth: 120, align: 'center', persist: true },
    },
    {
      id: 'estado_valoracion',
      header: 'Valoración',
      accessorFn: (row) => formatoBonito(row.estado_valoracion || ''),
      meta: { minWidth: 130, align: 'center', alignHeader: 'left' },
    },
    {
      id: 'precio_final',
      header: 'Precio',
      cell: ({ row }) => {
        const [valor, setValor] = useState(
          row.original.precio_final ?? row.original.precio_orientativo ?? ''
        );
        // Sincroniza el valor local cuando cambia el precio calculado
        useEffect(() => {
          setValor(
            row.original.precio_final ?? row.original.precio_orientativo ?? ''
          );
        }, [row.original.precio_final, row.original.precio_orientativo]);

        return filaEditando === row.original.id ? (
          <TextField
            key={`precio-${row.original.id}`}
            size="small"
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => {
              if (valor !== row.original.precio_final) {
                handleChange(row.original.id, 'precio_final', valor.toString());
                guardarAuditoria(
                  {
                    ...row.original,
                    precio_final: valor,
                  },
                  row.index,
                  false
                );
              }
            }}
            inputProps={{ min: 0 }}
          />
        ) : (
          <Typography variant="body2" align="center">
            {(row.original.precio_final ?? row.original.precio_orientativo ?? '—') + ' €'}
          </Typography>
        );
      },
      meta: { minWidth: 125, align: 'center', alignHeader: 'left', persist: true },
    },
    {
      id: 'observaciones',
      header: 'Observaciones',
      cell: ({ row }) => {
        const [valor, setValor] = useState(row.original.observaciones || '');

        return filaEditando === row.original.id ? (
          <TextField
            key={`obs-${row.original.id}`}
            size="small"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => {
              if (valor !== row.original.observaciones) {
                handleChange(row.original.id, 'observaciones', valor);
              }
            }}
            placeholder="Opcional"
            sx={{ minWidth: 450 }}
          />
          ) : (
          <Typography variant="body2" align="center">
             {(row.original.observaciones ?? row.original.observaciones ?? '—')}
          </Typography>
        );
      },
      meta: { minWidth: 500, align: 'center', alignHeader: 'left', persist: true },
    },
    
  ];

  return {
    columnas,
    zoom: 0.82, // 👈 escala visual para esta tabla
  };
}


