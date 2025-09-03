'use client'
import { Card, CardContent, Typography, Stack } from '@mui/material'

export default function KpiCard({
  title,
  value,
  suffix,
}: {
  title: string
  value: number | string | null | undefined
  suffix?: string
}) {
  const show = value ?? '—'
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">{title}</Typography>
          <Typography variant="h5" fontWeight={600}>
            {typeof show === 'number'
              ? Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(show) + (suffix || '')
              : show}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
