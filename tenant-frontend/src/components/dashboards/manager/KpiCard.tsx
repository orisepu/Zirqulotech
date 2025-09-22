'use client'
import { Card, CardContent, Typography, Stack } from '@mui/material'

export default function KpiCard({
  title,
  value,
  suffix,
  helper,
}: {
  title: string
  value: number | string | null | undefined
  suffix?: string
  helper?: string
}) {
  const show = value ?? '—'
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)'}}>
      <CardContent sx={{ px: 2.5, py: 2 }}>
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.3, textTransform: 'uppercase' }}>{title}</Typography>
          <Typography variant="h5" fontWeight={600}>
            {typeof show === 'number'
              ? Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(show) + (suffix || '')
              : show}
          </Typography>
          {helper ? (
            <Typography variant="caption" color="text.secondary">
              {helper}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}
