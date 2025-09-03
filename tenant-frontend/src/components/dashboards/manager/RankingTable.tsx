'use client'
import { Card, CardHeader, CardContent, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material'

export default function RankingTable({
  title,
  rows,
  valueKey = 'valor',
  nameKey = 'nombre',
  valueIsOps = false,
}: {
  title: string
  rows: any[]
  valueKey?: string
  nameKey?: string
  valueIsOps?: boolean
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardHeader title={title} sx={{ p: 1.5, '& .MuiCardHeader-title': { fontSize: 16 } }} />
      <CardContent sx={{ pt: 0 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell align="right">{valueIsOps ? 'Ops' : '€'}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows?.map((r, i) => (
              <TableRow key={i}>
                <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r[nameKey] ?? '—'}
                </TableCell>
                <TableCell align="right">
                  {valueIsOps
                    ? r[valueKey]
                    : Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(r[valueKey] ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
