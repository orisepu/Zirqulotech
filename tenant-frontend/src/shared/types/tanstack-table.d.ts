// src/types/tanstack-table.d.ts
import type {} from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // Type helper for responsive values
  type ResponsiveValue = number | string | {
    xs?: number | string
    sm?: number | string
    md?: number | string
    lg?: number | string
    xl?: number | string
    xxl?: number | string
    xxxl?: number | string
  }

  interface ColumnMeta<TData, TValue> {
    minWidth?: ResponsiveValue
    headerMaxWidth?: ResponsiveValue
    maxWidth?: ResponsiveValue
    align?: 'left' | 'center' | 'right'
    alignHeader?: 'left' | 'center' | 'right'
    label?: string
    toCSV?: (value: TValue, row: TData) => unknown
    ellipsis?: boolean
    ellipsisMaxWidth?: ResponsiveValue
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
