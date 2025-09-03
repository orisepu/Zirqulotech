import React, { useEffect, useMemo, useState } from 'react'
import {
  Table, TableHead, TableRow, TableCell, TableBody, Paper, CircularProgress,
  TableSortLabel, Box, Menu, MenuItem, IconButton, TableContainer, Checkbox,
  Button, Select, MenuItem as MUIMenuItem
} from '@mui/material'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
  VisibilityState,
  getPaginationRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import DownloadIcon from '@mui/icons-material/Download'
import VisibilityIcon from '@mui/icons-material/Visibility'
import Papa from 'papaparse'

export interface Column<TData> {
  id: string
  label: string
  render: (row: TData) => React.ReactNode
  accessor?: (row: TData) => unknown
  enableSorting?: boolean
}

export interface TablaReactivaProps<TData> {
  oportunidades: TData[]
  columnas: Column<TData>[]
  loading?: boolean
  onRowClick?: (row: TData) => void
  usuarioId?: string | number
  defaultSorting?: SortingState
}

export default function TablaReactiva<TData>({
  oportunidades,
  columnas,
  loading = false,
  onRowClick,
  usuarioId,
  defaultSorting,
}: TablaReactivaProps<TData>) {
  const datos = Array.isArray(oportunidades) ? oportunidades : []

  // ---- estado tabla ----
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [sorting, setSorting] = useState<SortingState>(defaultSorting ?? [])
  const [globalFilter, setGlobalFilter] = useState('')

  // ---- visibilidad columnas (controlado + persistencia) ----
  const STORAGE_KEY_VISIBILITY = `columnasVisibles_oportunidades_${usuarioId ?? 'anon'}`
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_VISIBILITY)
      if (saved) {
        try { return JSON.parse(saved) as VisibilityState } catch {}
      }
    }
    // por defecto: todo visible
    return Object.fromEntries(columnas.map((c) => [c.id, true]))
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_VISIBILITY, JSON.stringify(columnVisibility))
    }
  }, [columnVisibility, STORAGE_KEY_VISIBILITY])

  // ---- definición de columnas para TanStack ----
  const columnDefs = useMemo<ColumnDef<TData, unknown>[]>(() =>
    columnas.map((col): ColumnDef<TData, unknown> => {
      const def: ColumnDef<TData, unknown> = {
        id: col.id,
        header: () => col.label,
        enableSorting: col.enableSorting,
        cell: (ctx) => col.render(ctx.row.original),
        meta: { label: col.label },
      }
      if (col.accessor) {
        // TanStack espera accessorFn como prop de definición, no es un symbol importable
        ;(def as any).accessorFn = col.accessor
      } else {
        ;(def as any).accessorKey = col.id // habilita orden básico si no hay accessor
      }
      return def
    })
  , [columnas])

  const table = useReactTable({
    data: datos,
    columns: columnDefs,
    state: { sorting, pagination, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    defaultColumn: {
      size: 150,
      minSize: 60,
      maxSize: 500,
    },
    // si quieres un orden inicial por fecha_creacion (si existe la col)
    initialState: {
      sorting: defaultSorting ?? [{ id: 'fecha_creacion', desc: false }],
    },
  })

  const toggleColumna = (id: string) => {
    const col = table.getColumn(id)
    if (!col) return
    col.toggleVisibility()
  }

  // ---- exportación CSV (solo columnas visibles) ----
  const exportToCSV = () => {
    const visibleColumns = table.getVisibleLeafColumns()
    const headers = visibleColumns.map((col) => (col.columnDef.meta as any)?.label || col.id)

    const rows = table.getRowModel().rows.map((row) =>
      visibleColumns.map((col) => {
        // intenta primero con el valor "crudo" del row (si hay accessor)
        const raw = row.getValue(col.id) as any
        if (raw == null) {
          // como fallback, renderizamos la celda (si cell es función)
          const cellTpl = col.columnDef.cell as any
          if (typeof cellTpl === 'function') {
            const rendered = cellTpl({
              row,
              getValue: () => row.getValue(col.id),
              table,
              column: col,
            })
            if (typeof rendered === 'string' || typeof rendered === 'number') return rendered
            // si es un ReactNode, intentar extraer texto simple
            if (React.isValidElement(rendered)) {
              // intento básico
              return (rendered as any)?.props?.children ?? ''
            }
            return ''
          }
          return ''
        }
        if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
          return String(raw)
        }
        // objeto/array -> JSON
        try { return JSON.stringify(raw) } catch { return '' }
      })
    )

    const csv = Papa.unparse({ fields: headers, data: rows })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'oportunidades.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const menuOpen = Boolean(anchorEl)
  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)
  const handleClose = () => setAnchorEl(null)

  if (loading) return <CircularProgress />

  return (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ width: '100%', tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell colSpan={table.getAllLeafColumns().length + (onRowClick ? 1 : 0)}>
              <Box display="flex" justifyContent="right" alignItems="center" gap={1}>
                <IconButton onClick={handleOpen}>
                  <ViewColumnIcon />
                </IconButton>
                <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleClose}>
                  <Box display="flex" flexDirection="column">
                    {table.getAllLeafColumns().map((col) => {
                      const label = (col.columnDef.meta as any)?.label || col.id
                      const checked = !!table.getColumn(col.id)?.getIsVisible()
                      return (
                        <MenuItem
                          key={col.id}
                          disableRipple
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleColumna(col.id)
                          }}
                        >
                          <Checkbox checked={checked} size="small" sx={{ p: 0, mr: 1 }} />
                          <Box fontSize={14}>{label}</Box>
                        </MenuItem>
                      )
                    })}
                    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 1 }} />
                    <Box display="flex" justifyContent="space-between" px={1} pb={1} gap={1}>
                      <Button
                        size="small"
                        onClick={() => {
                          const allVisible = table.getAllLeafColumns().every((c) => c.getIsVisible())
                          const updated = Object.fromEntries(
                            table.getAllLeafColumns().map((c) => [c.id, !allVisible])
                          )
                          setColumnVisibility(updated)
                        }}
                      >
                        Mostrar/Ocultar todos
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          const reset = Object.fromEntries(
                            table.getAllLeafColumns().map((c) => [c.id, true])
                          )
                          setColumnVisibility(reset)
                        }}
                      >
                        Reset
                      </Button>
                    </Box>
                  </Box>
                </Menu>

                <IconButton onClick={exportToCSV} size="small" title="Exportar CSV">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Box>
            </TableCell>
          </TableRow>

          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableCell
                  key={header.id}
                  style={{ width: header.getSize(), position: 'relative' }}
                  align="center"
                >
                  {!header.isPlaceholder && (
                    <TableSortLabel
                      active={header.column.getIsSorted() !== false}
                      direction={(header.column.getIsSorted() || 'asc') as 'asc' | 'desc'}
                      onClick={header.column.getToggleSortingHandler()}
                      sx={{ justifyContent: 'center', display: 'flex' }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
              {onRowClick && <TableCell />} {/* columna de acciones */}
            </TableRow>
          ))}
        </TableHead>

        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} hover>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
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
            <MUIMenuItem key={pageSize} value={pageSize}>
              {pageSize} por página
            </MUIMenuItem>
          ))}
        </Select>

        <Button size="small" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Anterior
        </Button>
        <Button size="small" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Siguiente
        </Button>
        <Box display="flex" alignItems="center" fontSize={14}>
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </Box>
      </Box>
    </TableContainer>
  )
}
