// src/types/tanstack-table.d.ts
import type {} from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    minWidth?: number
    headerMaxWidth?: number
    maxWidth?: number
    align?: 'left' | 'center' | 'right'
    alignHeader?: 'left' | 'center' | 'right'
    label?: string
    toCSV?: (value: TValue, row: TData) => unknown
    ellipsis?: boolean
    ellipsisMaxWidth?: number | string
    persist?: boolean
    nowrapHeader?: boolean
    headerWrap?: number | boolean
  }

  // TData = TIPO DE FILA (no array)
  interface TableMeta<TData> {
    data: TData[]
    setData: (val: TData[] | ((old: TData[]) => TData[])) => void
    zoom?: number
  }
}
