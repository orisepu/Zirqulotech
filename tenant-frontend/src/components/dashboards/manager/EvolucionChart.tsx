'use client'
import { Card, CardHeader, CardContent, Box } from '@mui/material'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function EvolucionChart({ data }: { data: { periodo: string; valor: number }[] }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardHeader title="Evolución del valor de recompra" sx={{ p: 1.5, '& .MuiCardHeader-title': { fontSize: 16 } }} />
      <CardContent sx={{ height: 300 }}>
        <Box sx={{ width: '100%', height: '100%' }}>
          <ResponsiveContainer>
            <LineChart data={data || []}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="valor" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  )
}
