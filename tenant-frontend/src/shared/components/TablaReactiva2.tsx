/**
 * Componente de tabla responsive y escalable
 *
 * @description Tabla moderna con soporte completo para:
 * - Responsive design con DPI scaling automático
 * - Virtualización para tablas grandes (opcional)
 * - Paginación client/server side
 * - Ordenamiento y filtrado
 * - Export a CSV
 * - Selector de columnas con persistencia
 * - Mobile-first con ocultación inteligente de columnas
 *
 * @version 2.0
 * @date 2025-10-01
 */

import React, { useState, useEffect } from 'react'
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
  TablePagination,
} from '@mui/material'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type VisibilityState,
  type PaginationState,
} from '@tanstack/react-table'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import DownloadIcon from '@mui/icons-material/Download'
import VisibilityIcon from '@mui/icons-material/Visibility'
import Papa from 'papaparse'
import { useDpiDetection } from '@/hooks/useDpiDetection'
import { EllipsisTooltip } from '@/shared/components/ui/EllipsisTooltip'
import {
  getCellStyles,
  getHeaderStyles,
  getTableContainerStyles,
  calculateEllipsisMaxWidth,
} from '@/shared/utils/tableResponsive.v2'
import type {
  ResponsiveTableProps,
  ResponsiveColumnDef,
  ResponsiveColumnMeta,
  TableDensity,
} from '@/shared/types/table.types'
import type { ColumnDef } from '@tanstack/react-table'

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

interface TableToolbarProps {
  onExport?: () => void
  onOpenColumnSelector?: (event: React.MouseEvent<HTMLButtonElement>) => void
  hideExport?: boolean
  hideColumnSelector?: boolean
}

interface ResponsiveCellProps<T = any> {
  cell: any
  meta?: ResponsiveColumnMeta
  density: TableDensity
  dpiLevel: 'normal' | 'medium' | 'high' | 'very-high'
}

// ============================================================================
// COMPONENTE: TABLE TOOLBAR
// ============================================================================

function TableToolbar({
  onExport,
  onOpenColumnSelector,
  hideExport = false,
  hideColumnSelector = false,
}: TableToolbarProps) {
  if (hideExport && hideColumnSelector) return null

  return (
    <TableRow>
      <TableCell colSpan={999}>
        <Box display="flex" justifyContent="flex-end" alignItems="center" gap={1}>
          {!hideColumnSelector && (
            <IconButton onClick={onOpenColumnSelector} size="small" title="Seleccionar columnas">
              <ViewColumnIcon />
            </IconButton>
          )}
          {!hideExport && (
            <IconButton onClick={onExport} size="small" title="Exportar a CSV">
              <DownloadIcon />
            </IconButton>
          )}
        </Box>
      </TableCell>
    </TableRow>
  )
}

// ============================================================================
// COMPONENTE: RESPONSIVE CELL
// ============================================================================

function ResponsiveCell<T>({ cell, meta, density, dpiLevel }: ResponsiveCellProps<T>) {
  const cellStyles = getCellStyles(meta, density, dpiLevel)
  const content = flexRender(cell.column.columnDef.cell, cell.getContext())

  // Estilos de debug para desarrollo (mostrar bordes de columnas)
  const devBorder = process.env.NODE_ENV === 'development' ? { borderRight: '1px solid rgba(224, 224, 224, 0.5)' } : {}

  // Si la columna requiere ellipsis, usar EllipsisTooltip
  if (meta?.ellipsis) {
    // Calcular maxWidth restando automáticamente ~20px para dar espacio a los "..."
    const maxWidth = calculateEllipsisMaxWidth(meta.ellipsisMaxWidth, meta.maxWidth)
    // Convertir ResponsiveSize a string para EllipsisTooltip
    const maxWidthStr = typeof maxWidth === 'object' ? maxWidth.md || maxWidth.sm || maxWidth.xs || '100%' : maxWidth

    // Obtener contenido de texto: intentar con content renderizado, si no funciona usar getValue()
    let textContent = ''
    if (typeof content === 'string' || typeof content === 'number') {
      textContent = String(content)
    } else {
      const rawValue = cell.getValue()
      textContent = rawValue != null ? String(rawValue) : '—'
    }

    // Sobrescribir estilos para quitar overflow/textOverflow del TableCell
    // porque EllipsisTooltip ya los maneja internamente
    const cellStylesWithoutEllipsis = {
      ...cellStyles,
      overflow: 'visible',
      textOverflow: 'clip',
      ...devBorder,
    }

    return (
      <TableCell sx={cellStylesWithoutEllipsis}>
        <EllipsisTooltip text={textContent} maxWidth={maxWidthStr} />
      </TableCell>
    )
  }

  return <TableCell sx={{ ...cellStyles, ...devBorder }}>{content}</TableCell>
}

// ============================================================================
// COMPONENTE: COLUMN SELECTOR MENU
// ============================================================================

interface ColumnSelectorMenuProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  columns: any[]
  columnVisibility: VisibilityState
  onToggleColumn: (columnId: string) => void
}

function ColumnSelectorMenu({
  anchorEl,
  open,
  onClose,
  columns,
  columnVisibility,
  onToggleColumn,
}: ColumnSelectorMenuProps) {
  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      {columns.map((column) => {
        const meta = column.columnDef.meta as ResponsiveColumnMeta | undefined
        const label = meta?.label || column.id
        const isVisible = columnVisibility[column.id] !== false

        return (
          <MenuItem
            key={column.id}
            onClick={() => onToggleColumn(column.id)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <Checkbox checked={isVisible} size="small" />
            {label}
          </MenuItem>
        )
      })}
    </Menu>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL: TABLA REACTIVA
// ============================================================================

export default function TablaReactiva<TData>(props: ResponsiveTableProps<TData> & {
  // Aliases para retrocompatibilidad
  oportunidades?: TData[]
  columnas?: ResponsiveColumnDef<TData>[] | ColumnDef<TData, any>[]
  usuarioId?: string | number
  serverPagination?: boolean
}) {
  // Extraer props con aliases para retrocompatibilidad
  const {
    data: dataProp,
    oportunidades,
    columns: columnsProp,
    columnas,
    userId: userIdProp,
    usuarioId,
    paginationMode: paginationModeProp,
    serverPagination,
    loading = false,
    onRowClick,
    storageKey,
    totalCount,
    pageIndex: controlledPageIndex,
    pageSize: controlledPageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
    hideColumnSelector = false,
    hideExport = false,
    enableVirtualization = false,
    estimatedRowHeight = 50,
    enableSorting = true,
    enableGlobalFilter = false,
    density = 'normal',
    striped = false,
    hoverEffect = true,
    stickyHeader = false,
    maxHeight,
    className,
    sx,
    mobileBreakpoint = 'sm',
    autoHideLowPriority = true,
    defaultSorting = [],
    meta: customMeta,
  } = props

  // Resolver aliases
  const data = dataProp || oportunidades || []
  const columns = columnsProp || columnas || []
  const userId = userIdProp || usuarioId
  const paginationMode = serverPagination ? 'server' : (paginationModeProp || 'client')
  // ========== STATE ==========
  const { dpiLevel } = useDpiDetection({ enableWarnings: false })
  const [sorting, setSorting] = useState<SortingState>(defaultSorting)
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnSelectorAnchor, setColumnSelectorAnchor] = useState<HTMLElement | null>(null)

  // Storage key para persistencia
  const finalStorageKey = storageKey || `table_visibility_${userId || 'default'}`

  // Visibilidad de columnas con persistencia
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') {
      return Object.fromEntries(columns.map((c) => [c.id, true]))
    }
    const saved = localStorage.getItem(finalStorageKey)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return Object.fromEntries(columns.map((c) => [c.id, true]))
      }
    }
    return Object.fromEntries(columns.map((c) => [c.id, true]))
  })

  // Guardar visibilidad en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(finalStorageKey, JSON.stringify(columnVisibility))
    }
  }, [columnVisibility, finalStorageKey])

  // Paginación
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSizeOptions[0],
  })

  const pagination =
    paginationMode === 'server'
      ? {
          pageIndex: controlledPageIndex ?? 0,
          pageSize: controlledPageSize ?? pageSizeOptions[0],
        }
      : internalPagination

  const handlePaginationChange = (updater: any) => {
    if (paginationMode === 'server') {
      const newState = typeof updater === 'function' ? updater(pagination) : updater
      onPageChange?.(newState.pageIndex)
      onPageSizeChange?.(newState.pageSize)
    } else {
      setInternalPagination(updater)
    }
  }

  // ========== TABLA ==========
  const table = useReactTable({
    data,
    columns: columns as any,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableGlobalFilter ? getFilteredRowModel() : undefined,
    getPaginationRowModel: paginationMode === 'client' ? getPaginationRowModel() : undefined,
    manualPagination: paginationMode === 'server',
    pageCount: paginationMode === 'server' ? Math.ceil((totalCount || 0) / pagination.pageSize) : undefined,
    meta: customMeta,
  })

  const visibleColumns = table.getAllColumns().filter((col) => col.getIsVisible())

  // ========== HANDLERS ==========
  const handleToggleColumn = (columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }))
  }

  const handleExport = () => {
    const rows = table.getFilteredRowModel().rows
    const exportableColumns = visibleColumns.filter((col) => {
      const meta = col.columnDef.meta as ResponsiveColumnMeta | undefined
      return meta?.exportable !== false
    })

    const csvData = rows.map((row) => {
      const rowData: Record<string, any> = {}
      exportableColumns.forEach((col) => {
        const meta = col.columnDef.meta as ResponsiveColumnMeta | undefined
        const label = meta?.label || col.id
        const value = row.getValue(col.id)

        // Si hay formatter custom, usarlo
        if (meta?.exportFormatter) {
          rowData[label] = meta.exportFormatter(value)
        } else {
          rowData[label] = value
        }
      })
      return rowData
    })

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `export_${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ========== RENDER ==========
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box className={className} sx={sx}>
      <TableContainer
        component={Paper}
        sx={getTableContainerStyles(maxHeight, stickyHeader)}
      >
        <Table size={density === 'compact' ? 'small' : 'medium'} sx={{ width: '100%', tableLayout: 'auto' }}>
          {/* COLGROUP para widths */}
          <colgroup>
            {visibleColumns.map((column) => {
              const meta = column.columnDef.meta as ResponsiveColumnMeta | undefined
              return (
                <col
                  key={column.id}
                  style={{
                    minWidth: typeof meta?.minWidth === 'string' ? meta.minWidth : undefined,
                    maxWidth: typeof meta?.maxWidth === 'string' ? meta.maxWidth : undefined,
                    width: typeof meta?.width === 'string' ? meta.width : undefined,
                  }}
                />
              )
            })}
            {onRowClick && <col style={{ width: '3.125rem' }} />}
          </colgroup>

          <TableHead>
            {/* Toolbar row */}
            {(!hideColumnSelector || !hideExport) && (
              <TableToolbar
                onExport={handleExport}
                onOpenColumnSelector={(e) => setColumnSelectorAnchor(e.currentTarget as HTMLElement)}
                hideExport={hideExport}
                hideColumnSelector={hideColumnSelector}
              />
            )}

            {/* Headers row */}
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ResponsiveColumnMeta | undefined
                  const headerStyles = getHeaderStyles(meta, density, dpiLevel)
                  const devBorder = process.env.NODE_ENV === 'development' ? { borderRight: '1px solid rgba(224, 224, 224, 0.5)' } : {}

                  if (header.isPlaceholder) {
                    return <TableCell key={header.id} />
                  }

                  const canSort = header.column.getCanSort()
                  const isSorted = header.column.getIsSorted()

                  return (
                    <TableCell key={header.id} sx={{ ...headerStyles, ...devBorder }}>
                      {canSort ? (
                        <TableSortLabel
                          active={isSorted !== false}
                          direction={isSorted || 'asc'}
                          onClick={header.column.getToggleSortingHandler()}
                          sx={{
                            display: 'block',
                            width: '100%',
                            '& .MuiTableSortLabel-icon': {
                              marginLeft: '0.25rem',
                            },
                          }}
                        >
                          <Box component="span" sx={{ paddingLeft: '1.125rem' }}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </Box>
                        </TableSortLabel>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableCell>
                  )
                })}
                {onRowClick && <TableCell sx={{ ...getHeaderStyles(undefined, density, dpiLevel), ...(process.env.NODE_ENV === 'development' ? { borderRight: '1px solid rgba(224, 224, 224, 0.5)' } : {}) }} />}
              </TableRow>
            ))}
          </TableHead>

          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + (onRowClick ? 1 : 0)} align="center">
                  <Box py={4}>No hay datos para mostrar</Box>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, rowIndex) => (
                <TableRow
                  key={row.id}
                  hover={hoverEffect}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    backgroundColor: striped && rowIndex % 2 === 1 ? 'action.hover' : 'transparent',
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ResponsiveColumnMeta | undefined
                    return (
                      <ResponsiveCell
                        key={cell.id}
                        cell={cell}
                        meta={meta}
                        density={density}
                        dpiLevel={dpiLevel}
                      />
                    )
                  })}
                  {onRowClick && (
                    <TableCell sx={{ ...getCellStyles(undefined, density, dpiLevel), ...(process.env.NODE_ENV === 'development' ? { borderRight: '1px solid rgba(224, 224, 224, 0.5)' } : {}) }}>
                      <IconButton size="small" onClick={() => onRowClick(row.original)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Paginación */}
      <TablePagination
        component="div"
        count={paginationMode === 'server' ? totalCount || 0 : table.getFilteredRowModel().rows.length}
        page={pagination.pageIndex}
        onPageChange={(_, page) => {
          if (paginationMode === 'server') {
            onPageChange?.(page)
          } else {
            setInternalPagination((prev) => ({ ...prev, pageIndex: page }))
          }
        }}
        rowsPerPage={pagination.pageSize}
        onRowsPerPageChange={(e) => {
          const newSize = parseInt(e.target.value, 10)
          if (paginationMode === 'server') {
            onPageSizeChange?.(newSize)
          } else {
            setInternalPagination({ pageIndex: 0, pageSize: newSize })
          }
        }}
        rowsPerPageOptions={pageSizeOptions}
        labelRowsPerPage="Filas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
      />

      {/* Column Selector Menu */}
      <ColumnSelectorMenu
        anchorEl={columnSelectorAnchor}
        open={Boolean(columnSelectorAnchor)}
        onClose={() => setColumnSelectorAnchor(null)}
        columns={table.getAllColumns()}
        columnVisibility={columnVisibility}
        onToggleColumn={handleToggleColumn}
      />
    </Box>
  )
}

// ============================================================================
// EXPORTS PARA RETROCOMPATIBILIDAD
// ============================================================================

export type { ResponsiveTableProps as TablaReactivaProps }
