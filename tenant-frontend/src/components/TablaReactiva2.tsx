import React, { useMemo, useState, useEffect } from 'react'
import {
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  CircularProgress,
  TableSortLabel,
  Box,
  Menu,
  MenuItem,
  IconButton,
  TableContainer,
  Checkbox,
  Button,
  Select
} from '@mui/material'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  VisibilityState,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel
} from '@tanstack/react-table'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import DownloadIcon from '@mui/icons-material/Download'
import VisibilityIcon from '@mui/icons-material/Visibility'
import Papa from 'papaparse'
import { EllipsisTooltip } from "@/components/EllipsisTooltip";

export interface TablaReactivaProps<TData> {
  oportunidades: TData[];
  columnas: ColumnDef<TData>[];
  loading?: boolean;
  onRowClick?: (row: TData) => void;
  usuarioId?: string | number;
  defaultSorting?: SortingState;
  meta?: {
    data: TData[];
    setData: (val: TData[]) => void;
    zoom?: number;
  };
  serverPagination?: boolean;
  totalCount?: number;
  pageIndex?: number;        // 0-based
  pageSize?: number;
  onPageChange?: (pageIndex: number) => void;      // 0-based
  onPageSizeChange?: (pageSize: number) => void;
}

export default function TablaReactiva<TData>({
  oportunidades,
  columnas,
  loading = false,
  onRowClick,
  usuarioId,
  defaultSorting = [],
  meta,
  serverPagination = false,
  totalCount,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TablaReactivaProps<TData>) {

  const [globalFilter, setGlobalFilter] = useState('')
  const STORAGE_KEY_VISIBILITY = `columnasVisibles_oportunidades_${usuarioId}`
  const datos = Array.isArray(oportunidades) ? oportunidades : []

  // Estado interno solo si NO usamos server-side
  const [internalPagination, setInternalPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const pagination = serverPagination
    ? { pageIndex: pageIndex ?? 0, pageSize: pageSize ?? 10 }
    : internalPagination

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_VISIBILITY)
      if (saved) return JSON.parse(saved)
    }
    // por defecto, todas visibles
    return Object.fromEntries(columnas.map((c) => [c.id, true]))
  })

  // onPaginationChange compatible con controlado/no controlado
  const handlePaginationChange = (
    updater:
      | { pageIndex: number; pageSize: number }
      | ((old: { pageIndex: number; pageSize: number }) => { pageIndex: number; pageSize: number })
  ) => {
    const current = pagination as { pageIndex: number; pageSize: number }
    const next = typeof updater === 'function' ? (updater as (old: { pageIndex: number; pageSize: number }) => { pageIndex: number; pageSize: number })(current) : updater
    if (serverPagination) {
      if (next.pageIndex !== current.pageIndex) onPageChange?.(next.pageIndex)
      if (next.pageSize !== current.pageSize) onPageSizeChange?.(next.pageSize)
    } else {
      setInternalPagination(next)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(columnVisibility))
    }
  }, [columnVisibility, STORAGE_KEY_VISIBILITY])

  const [sorting, setSorting] = useState<SortingState>(defaultSorting ?? [])
  const columnDefs = useMemo<ColumnDef<TData, unknown>[]>(() => columnas as ColumnDef<TData, unknown>[], [columnas])
  const tableMeta = useMemo(() => {
    if (!meta) return undefined
    const setDataWrapped = (val: TData[] | ((old: TData[]) => TData[])) => {
      if (typeof val === 'function') {
        const next = (val as (old: TData[]) => TData[])(meta.data)
        meta.setData(next)
      } else {
        meta.setData(val)
      }
    }
    return { data: meta.data, setData: setDataWrapped, zoom: meta.zoom }
    // Dependencias finas para evitar cierres obsoletos
  }, [meta])
  const table = useReactTable<TData>({
    data: datos,
    columns: columnDefs,
    getRowId: (row: TData, index: number) => {
      const r = row as Record<string, unknown> & { tenant?: string | number; id?: string | number }
      if (r && r.tenant !== undefined && r.id !== undefined) return `${r.tenant}-${r.id}`
      if (r.id !== undefined) return String(r.id)
      return String(index)
    },
    state: { sorting, pagination, globalFilter, columnVisibility },
    meta:tableMeta,
    onPaginationChange: handlePaginationChange,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: serverPagination ? undefined : getPaginationRowModel(),
    manualPagination: serverPagination, // 🔑
    pageCount: serverPagination
      ? Math.max(1, Math.ceil((totalCount ?? datos.length) / (pagination.pageSize || 10)))
      : undefined,
    autoResetPageIndex: false,
    initialState: {
      sorting: [
        { id: 'fecha_creacion', desc: false },
      ]
    }
  })

  const toggleColumna = (id: string) => {
    const col = table.getColumn(id)
    if (!col) return
    col.toggleVisibility()
  }

  const exportToCSV = () => {
    const visibleColumns = table.getVisibleLeafColumns();

    type ColMeta = {
      label?: string;
      toCSV?: (value: unknown, row: TData) => unknown;
      minWidth?: number;
      headerMaxWidth?: number;
      alignHeader?: 'left' | 'center' | 'right';
      align?: 'left' | 'center' | 'right';
      ellipsis?: boolean;
      ellipsisMaxWidth?: number;
    };

    const headers = visibleColumns.map((col) =>
      ((col.columnDef.meta as ColMeta | undefined)?.label) || col.id
    );

    const rows = table.getRowModel().rows.map((row) =>
      visibleColumns.map((col) => {
        const raw = row.getValue(col.id); // <- accessorFn ya aplicado
        const toCSV = (col.columnDef.meta as ColMeta | undefined)?.toCSV;

        const val = toCSV ? toCSV(raw, row.original as TData) : raw;

        if (val == null) return '';
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      })
    );

    const csv = Papa.unparse({ fields: headers, data: rows });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'oportunidades.csv';
    link.click();
  };


  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)

  if (loading) {
    return <CircularProgress />
  }

  const visibleCols = table.getVisibleLeafColumns()

  return (
    <TableContainer
      component={Paper}
      sx={{
        overflowX: 'auto',
        transform: meta?.zoom ? `scale(${meta.zoom}) translateZ(0)` : 'none',
        transformOrigin: 'top left',
        width: meta?.zoom ? `${100 / meta.zoom}%` : '100%',
      }}
    >
      <Table
        size="small"
        sx={{
          width: '100%',
          tableLayout: 'auto', // <- clave: dejamos que el layout estire
          '& th, & td': { whiteSpace: 'nowrap' } // opcional: evita saltos
        }}
      >
        <colgroup>
          {visibleCols.map((column) => (
            <col
              key={column.id}
              style={{
                // sin width -> el layout reparte y estira
                minWidth: column.columnDef.meta?.minWidth
                  ? `${column.columnDef.meta.minWidth}px`
                  : undefined,
              }}
            />
          ))}
          {onRowClick && <col style={{ width: '50px' }} />}
        </colgroup>

        <TableHead>
          <TableRow>
            <TableCell colSpan={visibleCols.length + (onRowClick ? 1 : 0)}>
              <Box display="flex" justifyContent="right" alignItems="center">
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton onClick={handleOpen}>
                    <ViewColumnIcon />
                  </IconButton>
                  <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
                    <Box display="flex" flexDirection="column">
                      {table.getAllLeafColumns().map((col) => {
                        const plainLabel = col.columnDef.meta?.label || col.id
                        return (
                          <MenuItem
                            key={col.id}
                            disableRipple
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleColumna(col.id)
                            }}
                          >
                            <Checkbox checked={!!table.getColumn(col.id)?.getIsVisible()} size="small" sx={{ p: 0 }} />
                            <Box fontSize={14}>{plainLabel}</Box>
                          </MenuItem>
                        )
                      })}
                      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 1 }} />
                      <Box display="flex" justifyContent="space-between" px={1}>
                        <Button
                          size="small"
                          onClick={() => {
                            const allVisible = table.getAllLeafColumns().every(c => c.getIsVisible())
                            const updated: VisibilityState = Object.fromEntries(
                              table.getAllLeafColumns().map(col => [col.id, !allVisible])
                            )
                            setColumnVisibility(updated)
                          }}
                        >
                          Mostrar/Ocultar todos
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            const reset: VisibilityState = Object.fromEntries(
                              table.getAllLeafColumns().map(c => [c.id, true])
                            )
                            setColumnVisibility(reset)
                          }}
                        >
                          Reset
                        </Button>
                      </Box>
                    </Box>
                  </Menu>
                </Box>

                <IconButton onClick={exportToCSV} size="small" title="Exportar CSV">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Box>
            </TableCell>
          </TableRow>

          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableCell
                  key={header.id}
                  
                  align={header.column.columnDef.meta?.alignHeader || 'center'}
                  sx={{
                    minWidth: header.column.columnDef.meta?.minWidth,
                    maxWidth:
                      header.column.columnDef.meta?.maxWidth ??
                      header.column.columnDef.meta?.headerMaxWidth,
                    width: header.column.columnDef.meta?.maxWidth,
                    whiteSpace: (header.column.columnDef.meta as any)?.nowrapHeader
                      ? 'nowrap'
                      : (header.column.columnDef.meta as any)?.headerWrap
                        ? 'normal'
                        : 'normal',
                    overflow: (header.column.columnDef.meta as any)?.nowrapHeader
                      ? 'hidden'
                      : undefined,
                    textOverflow: (header.column.columnDef.meta as any)?.nowrapHeader ? 'ellipsis' : undefined,
                    wordBreak: (header.column.columnDef.meta as any)?.nowrapHeader
                      ? 'normal'
                      : 'break-word',
                    display: 'table-cell',
                  }}
                >
                  {!header.isPlaceholder && (
                    <TableSortLabel
                      active={header.column.getIsSorted() !== false}
                      direction={(header.column.getIsSorted() || 'asc') as 'asc' | 'desc'}
                      onClick={header.column.getToggleSortingHandler()}
                      sx={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems:
                          (header.column.columnDef.meta?.alignHeader || 'left') === 'center'
                            ? 'center'
                            : (header.column.columnDef.meta?.alignHeader || 'left') === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                        gap: 0.25,
                        textAlign:
                          header.column.columnDef.meta?.alignHeader === 'center' ? 'center' : undefined,
                        lineHeight: 1.1,
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
              {onRowClick && <TableCell />}
            </TableRow>
          ))}
        </TableHead>

        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} hover>
              {row.getVisibleCells().map((cell) => {
                const meta =
                  (cell.column.columnDef.meta as {
                    minWidth?: number
                    maxWidth?: number
                    align?: 'left' | 'center' | 'right'
                    ellipsis?: boolean
                    ellipsisMaxWidth?: number | string
                  } | undefined) || {}
                const rawValue = cell.getValue(); // lo que devuelve el accessor
                let content = flexRender(cell.column.columnDef.cell, cell.getContext());

                // Si no hay cell custom, usamos el valor "crudo" de forma segura
                if (content == null || content === false) {
                  if (
                    React.isValidElement(rawValue) ||
                    typeof rawValue === 'string' ||
                    typeof rawValue === 'number'
                  ) {
                    content = rawValue as React.ReactNode;
                  } else if (rawValue == null) {
                    content = '';
                  } else {
                    content = String(rawValue);
                  }
                }

                // Si la columna pide ellipsis+tooltip
                if (meta.ellipsis) {
                  // convierte a string de forma robusta
                  const text =
                    typeof rawValue === "string"
                      ? rawValue
                      : rawValue == null
                      ? ""
                      : String(rawValue);

                  content = (
                    <Box
                      sx={{
                        minWidth: 0,
                        maxWidth:
                          meta.ellipsisMaxWidth ??
                          meta.maxWidth ??
                          meta.minWidth ??
                          240,
                        overflow: 'hidden',
                      }}
                    >
                      <EllipsisTooltip text={text} maxWidth="100%" />
                    </Box>
                  );
                }

                return (
                  <TableCell
                    key={cell.id}
                    style={{
                      minWidth: cell.column.columnDef.meta?.minWidth,
                      maxWidth: cell.column.columnDef.meta?.maxWidth,
                      width: cell.column.columnDef.meta?.maxWidth,
                    }}
                    align={meta.align || 'left'}
                  >
                    {content}
                  </TableCell>
                );
              })}
              {onRowClick && (
                <TableCell>
                  <IconButton size="small" onClick={() => onRowClick(row.original)}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Box display="flex" justifyContent="right" p={2} gap={2}>
        <Select
          size="small"
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
        >
          {[10, 25, 50].map((pageSize) => (
            <MenuItem key={pageSize} value={pageSize}>
              {pageSize} por página
            </MenuItem>
          ))}
        </Select>

        <Button
          size="small"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Anterior
        </Button>
        <Button
          size="small"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Siguiente
        </Button>
        <Box display="flex" alignItems="center" fontSize={14}>
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </Box>
      </Box>
    </TableContainer>
  )
}
