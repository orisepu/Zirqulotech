'use client'
import { Card, CardHeader, CardContent, Box } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function EvolucionChart({ data }: { data: { periodo: string; valor: number }[] }) {
  const theme = useTheme()
  const tooltipBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.95)
    : alpha('#FFFFFF', 0.95)
  const tooltipBorder = theme.palette.mode === 'dark'
    ? '1px solid rgba(255,255,255,0.08)'
    : `1px solid ${alpha(theme.palette.primary.main, 0.1)}`

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, boxShadow: '0 8px 26px rgba(0, 0, 0, 0.3)', height: '100%' }}>
      <CardHeader title="Evolución del valor de recompra" sx={{ p: 1.5, '& .MuiCardHeader-title': { fontSize: 16 } }} />
      <CardContent sx={{ height: { xs: 260, md: 320 }, pt: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ width: '100%', height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data || []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderRadius: 12,
                  border: tooltipBorder,
                  boxShadow: theme.palette.mode === 'dark'
                    ? '0 12px 32px rgba(0,0,0,0.35)'
                    : '0 10px 28px rgba(31,41,55,0.1)',
                  color: theme.palette.text.primary,
                }}
                labelStyle={{ color: theme.palette.text.secondary, fontWeight: 600 }}
                itemStyle={{ color: theme.palette.text.primary, fontWeight: 600 }}
                cursor={{ stroke: alpha(theme.palette.primary.main, 0.2), strokeWidth: 2 }}
              />
              <Line type="monotone" dataKey="valor" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  )
}
