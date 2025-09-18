  import {getId} from '@/utils/id'
  import { ESTADOS_META,ESTADOS_B2B } from '@/context/estados'
  import { Chip,Box } from '@mui/material'
  import type { ChipProps } from '@mui/material/Chip'
  import { ColumnDef } from '@tanstack/react-table'
  import { Select, MenuItem, TextField, Button } from '@mui/material'
  import React from 'react'
  /** Tipo de columna para tu tabla personalizada (no TanStack) */
  type Col<T> = {
    id: string
    label: string
    render: (row: T) => React.ReactNode
    ordenable?: boolean
    accessor?: (row: T) => unknown
  }

  /** Tipos de filas */
  type OportunidadRow = {
    id?: string | number
    partner?: string
    tienda?: { nombre?: string } | null
    cliente?: { razon_social?: string } | null
    nombre?: string
    fecha_creacion?: string | Date
    valor_total?: number | string | null
    valor_total_final?: number | string | null
    numero_seguimiento?: string | null
    estado: string
    dispositivos?: Array<{ precio_orientativo?: number | string; cantidad?: number }>
  }

  type DispositivoRealRow = {
    modelo?: string | { descripcion?: string }
    capacidad?: string | { tamaño?: string }
    imei?: string
    numero_serie?: string
    estado_fisico?: string
    estado_funcional?: string
    estado_valoracion?: string
    precio_final?: number | string | null
    precio_orientativo?: number | string | null
    observaciones?: string
    auditado?: boolean
    fecha_recepcion?: string | Date
  }

  type ClienteRow = {
    razon_social: string
    cif?: string
    contacto?: string
    correo?: string
    telefono?: string
    tienda_nombre?: string
    oportunidades?: Array<Record<string, unknown>>
  }

  /** util */
  function formatoBonito(estado?: string): string {
    return (estado || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }
  const calcularTotalPrecioOrientativo = (oportunidad: OportunidadRow): number => {
    return (oportunidad.dispositivos ?? []).reduce((acc, d) => {
      const precio = Number(d?.precio_orientativo ?? 0)
      const cantidad = Number(d?.cantidad ?? 0)
      return acc + precio * cantidad
    }, 0)
  }
const estadosFisicos = ['perfecto', 'bueno', 'regular', 'dañado']
const estadosFuncionales = ['funciona', 'pantalla_rota', 'no_enciende', 'otros']  

  export const columna_admin: Col<OportunidadRow>[] = [
    {
      id: 'id',
      label: 'ID',
      render: (o) => getId(o) || '—',
      
    },
    {
      id: 'partner',
      label: 'Partner',
      render: (o) => o.partner || '—',
      
    },
    {
      id: 'tienda',
      label: 'Tienda',
      render: (o) => o.tienda?.nombre || '—',
      
    },
    {
      id: 'cliente',
      label: 'Cliente',
      render: (o) => o.cliente?.razon_social || '—',
      ordenable: true,
      
    },
    {
      id: 'oportunidad',
      label: 'Oportunidad',
      render: (o) => o.nombre || '—',
      ordenable: true,
      
    },
    {
      id: 'fecha_creacion',
      label: 'Fecha',
      render: (o: OportunidadRow) =>
        o.fecha_creacion ? new Date(o.fecha_creacion).toLocaleDateString('es-ES') : '—',
      accessor: (o) => o.fecha_creacion,
      ordenable: true,
    },
    {
      id: 'valoracion_partner',
      label: 'Valoración partner',
      render: (o) => {
        const valor = Number(o.valor_total ?? 0)
        return (
          <Box textAlign="right">
            {valor > 0
              ? valor.toLocaleString('es-ES', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                  useGrouping: true,
                }) + ' €'
              : ''}
          </Box>
        );
      },
    },
    {
      id: 'valoracion_final',
      label: 'Valoración final',
      render: (o) => {
        const valor = Number(o.valor_total_final ?? 0)
        return (
          <Box textAlign="right">
            {valor > 0
              ? valor.toLocaleString('es-ES', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                  useGrouping: true,
                }) + ' €'
              : ''}
          </Box>
        );
      },
    },
    {
      id: 'seguimiento',
      label: 'Número de seguimiento',
      render: (o) => o.numero_seguimiento,
      
    },
    {
      id: 'estado',
      label: 'Estado',
      render: (o) => {
        const meta = ESTADOS_META[o.estado] as { icon?: React.ElementType; color?: ChipProps['color'] } | undefined
        const Icono = meta?.icon as React.ElementType | undefined
        return (
          <Chip
            label={o.estado}
            icon={Icono ? <Icono /> : undefined}
            color={meta?.color || 'default'}
            size="small"
            sx={{ fontWeight: 500 }}
          />
        )
      },
      
    },
  ]

  export const columna_tenant: Col<OportunidadRow>[] = [
        {
          id: 'id',
          label: 'ID',
          render: (o) => getId(o),
          ordenable: true,
        },
        {
          id: 'nombre',
          label: 'Nombre',
          render: (o) => o.nombre,
          ordenable: true,
        },
        {
          id: 'cliente',
          label: 'Cliente',
          render: (o) => o.cliente?.razon_social || '—',
          ordenable: true,
        },
        {
          id: 'valoracion',
          label: 'Valoración orientativa',
          ordenable: true,
          render: (o) => {
            const total = calcularTotalPrecioOrientativo(o);
            return (
              <Box textAlign="right" >
                {total > 0
                  ? total.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                      useGrouping: true,
                    }) + ' €'
                  : '—'}
              </Box>
            );
          },
        },
        {
          id: 'valoracion_final',
          label: 'Valoración final',
          render: (o) => {
            const valor = Number(o.valor_total_final || 0);
            return (
              <Box textAlign="right">
                {valor > 0
                  ? valor.toLocaleString('es-ES', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                      useGrouping: true,
                    }) + ' €'
                  : '—'}
              </Box>
            );
          },
        },
        {
          id: 'fecha_creacion',
          label: 'Fecha',
          render: (o: OportunidadRow) =>
            o.fecha_creacion ? new Date(o.fecha_creacion).toLocaleDateString('es-ES') : '—',
          ordenable: true,
        },
        {
          id: 'seguimiento',
          label: 'Número de seguimiento',
          render: (o) => o.numero_seguimiento|| '—',
          ordenable: true,
        },
        {
          id: 'estado',
          label: 'Estado',
          render: (o) => {
            const meta = ESTADOS_B2B[o.estado]
            const Icono = meta?.icon
            return (
              <Chip
                label={o.estado}
                icon={Icono ? <Icono /> : undefined}
                color={meta?.color || 'default'}
                size="small"
                sx={{ fontWeight: 500 }}
              />
            )
          },
          ordenable: true,
        },
  ]

  export const columnasDispositivosReales: Col<DispositivoRealRow>[] = [
  {
    id: 'modelo',
    label: 'Modelo',
    render: (row) =>
      typeof row.modelo === 'object' && row.modelo
        ? row.modelo.descripcion ?? '—'
        : (row.modelo as string) ?? '—',
  },
  {
    id: 'capacidad',
    label: 'Capacidad',
    render: (row) =>
      typeof row.capacidad === 'object' && row.capacidad
        ? (row.capacidad as { ['tamaño']?: string })['tamaño'] ?? '—'
        : (row.capacidad as string) ?? '—',
  },
  {
    id: 'imei',
    label: 'IMEI',
    render: (row) => row.imei || '—',
  },
  {
    id: 'numero_serie',
    label: 'Nº Serie',
    render: (row) => row.numero_serie || '—',
  },
  {
    id: 'estado_fisico',
    label: 'Estado físico',
    render: (row) => formatoBonito(row.estado_fisico) || '—',
  },
  {
    id: 'estado_funcional',
    label: 'Estado funcional',
    render: (row) => formatoBonito(row.estado_funcional) || '—',
  },
  {
    id: 'estado_valoracion',
    label: 'Valoración',
    render: (row) => row.estado_valoracion || '—',
  },
  {
    id: 'precio_final',
    label: 'Precio recompra',
    render: (row) =>{
        const valor = Number(row.precio_final || 0);
        return (
          <Box textAlign="right">
            {valor > 0
              ? valor.toLocaleString('es-ES', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                  useGrouping: true,
                }) + ' €'
              : ''}
          </Box>
        );
      },
  },
  {
    id: 'fecha_recepcion',
    label: 'Fecha recepción',
    render: (row) =>
      row.fecha_recepcion
        ? new Date(row.fecha_recepcion).toLocaleString('es-ES')
        : '—',
  },
]

  export function getColumnasAuditoria(
    handleChange: (index: number, field: keyof DispositivoRealRow | string, value: string) => void,
    guardarAuditoria: (dispositivo: DispositivoRealRow, index: number) => void
  ): ColumnDef<DispositivoRealRow>[] {
    return [
      {
        id: 'modelo',
        header: 'Modelo',
        accessorFn: (row) =>
          typeof row.modelo === 'object' && row.modelo
            ? row.modelo.descripcion ?? '—'
            : (row.modelo as string) ?? '—',
            },
      {
        id: 'capacidad',
        header: 'Capacidad',
         accessorFn: (row) =>
          typeof row.capacidad === 'object' && row.capacidad
            ? (row.capacidad as { ['tamaño']?: string })['tamaño'] ?? '—'
            : (row.capacidad as string) ?? '—',
            },
      {
        id: 'imei',
        header: 'IMEI / Nº Serie',
        accessorFn: (row) => row.imei || row.numero_serie || '—',
      },
      {
        id: 'estado_fisico',
        header: 'Estético',
        accessorKey: 'estado_fisico',
        cell: ({ row }) => (
          <Select
            size="small"
            value={row.original.estado_fisico || ''}
            onChange={(e) => handleChange(row.index, 'estado_fisico', e.target.value)}
          >
            {estadosFisicos.map((e) => (
              <MenuItem key={e} value={e}>
                {e}
              </MenuItem>
            ))}
          </Select>
        ),
      },
      {
        id: 'estado_funcional',
        header: 'Funcional',
        accessorKey: 'estado_funcional',
        cell: ({ row }) => (
          <Select
            size="small"
            value={row.original.estado_funcional || ''}
            onChange={(e) => handleChange(row.index, 'estado_funcional', e.target.value)}
          >
            {estadosFuncionales.map((e) => (
              <MenuItem key={e} value={e}>
                {e}
              </MenuItem>
            ))}
          </Select>
        ),
      },
      {
        id: 'estado_valoracion',
        header: 'Valoración',
        accessorFn: (row) => formatoBonito(row.estado_valoracion || ''),
      },
      {
        id: 'precio_final',
        header: 'Precio',
        accessorKey: 'precio_final',
        cell: ({ row }) => (
          <TextField
            size="small"
            type="number"
            value={row.original.precio_final ?? row.original.precio_orientativo ?? ''}
            onChange={(e) => handleChange(row.index, 'precio_final', e.target.value)}
            inputProps={{ min: 0 }}
          />
        ),
      },
      {
        id: 'observaciones',
        header: 'Observaciones',
        accessorKey: 'observaciones',
        cell: ({ row }) => (
          <TextField
            size="small"
            value={row.original.observaciones || ''}
            onChange={(e) => handleChange(row.index, 'observaciones', e.target.value)}
            placeholder="Opcional"
          />
        ),
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => (
          <Button
            onClick={() => guardarAuditoria(row.original, row.index)}
            variant="contained"
            size="small"
            disabled={!!row.original.auditado}
          >
            {row.original.auditado ? 'Auditado' : 'Guardar'}
          </Button>
        ),
      },
    ]
  }



  export const columna_clientes: Col<ClienteRow>[] = [
    {
      id: "razon_social",
      label: "Razón Social",
      render: (row) => row.razon_social,
    },
    {
      id: "cif",
      label: "CIF",
      render: (row) => row.cif,
    },
    {
      id: "contacto",
      label: "Contacto",
      render: (row) => row.contacto,
    },
    {
      id: "correo",
      label: "Correo",
      render: (row) => row.correo,
    },
    {
      id: "telefono",
      label: "Teléfono",
      render: (row) => {
        const raw = (row.telefono || "").replace(/\D/g, ""); // elimina todo lo que no sea número
        const formatted = raw.length === 9
          ? `${raw.slice(0, 3)} ${raw.slice(3, 6)} ${raw.slice(6)}`
          : raw;
        return formatted || "-";
      },
    },
    {
      id: "tienda_nombre",
      label: "Tienda",
      render: (row) => row.tienda_nombre ?? "-",
    },
    {
      id: "n_oportunidades",
      label: "Oportunidades",
      render: (row) => row.oportunidades?.length ?? 0,
      accessor: (row) => row.oportunidades?.length ?? 0, // para sorting
    },
    
  ]


