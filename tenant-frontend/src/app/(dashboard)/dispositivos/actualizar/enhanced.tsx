'use client'

import { useState } from 'react'
import { Box, Stack, Card, CardHeader, Tabs, Tab, Alert, Button, Switch, FormControlLabel } from '@mui/material'
import { Settings as SettingsIcon, Speed as SpeedIcon } from '@mui/icons-material'

// Import the enhanced components
import MappingMetrics from '@/features/opportunities/components/devices/MappingMetrics'
import IncrementalUpdateControls from '@/features/opportunities/components/devices/IncrementalUpdateControls'
import EnhancedLikewizePage from '@/features/opportunities/components/devices/EnhancedLikewizePage'

// Import the original page component
import LikewizeB2BPageOriginal from './page'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`enhanced-tabpanel-${index}`}
      aria-labelledby={`enhanced-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  )
}

export default function EnhancedLikewizePageWrapper() {
  const [useEnhancedInterface, setUseEnhancedInterface] = useState(true)
  const [tabValue, setTabValue] = useState(0)
  const [tareaId, setTareaId] = useState<string | null>(null)

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleUpdateComplete = (result: { tarea_id: string }) => {
    if (result?.tarea_id) {
      setTareaId(result.tarea_id)
      // Automatically switch to the price changes tab to show results
      setTabValue(0) // This will show the EnhancedLikewizePage with the new data
    }
  }

  if (!useEnhancedInterface) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardHeader
              title="Actualizar precios B2B (Modo Clásico)"
              action={
                <FormControlLabel
                  control={
                    <Switch
                      checked={useEnhancedInterface}
                      onChange={(e) => setUseEnhancedInterface(e.target.checked)}
                      icon={<SettingsIcon />}
                      checkedIcon={<SpeedIcon />}
                    />
                  }
                  label="Modo Mejorado"
                />
              }
            />
          </Card>

          <Alert severity="info">
            Estás usando la interfaz clásica. Activa el "Modo Mejorado" para acceder al sistema
            de mapeo inteligente con procesamiento incremental y métricas avanzadas.
          </Alert>

          <LikewizeB2BPageOriginal />
        </Stack>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header with mode toggle */}
        <Card variant="outlined">
          <CardHeader
            title="Actualización Inteligente de Dispositivos"
            subheader="Sistema mejorado con mapeo automático, procesamiento incremental y monitoreo en tiempo real"
            action={
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={useEnhancedInterface}
                      onChange={(e) => setUseEnhancedInterface(e.target.checked)}
                      icon={<SettingsIcon />}
                      checkedIcon={<SpeedIcon />}
                    />
                  }
                  label="Modo Mejorado"
                />
              </Stack>
            }
          />
        </Card>

        {/* Alert for new system */}
        <Alert severity="success" variant="outlined">
          <Stack spacing={1}>
            <Box>
              <strong>🚀 Sistema Mejorado Activo</strong>
            </Box>
            <Box>
              Ahora con mapeo inteligente en 4 fases, procesamiento incremental (70-80% más rápido),
              caché persistente y monitoreo en tiempo real.
            </Box>
          </Stack>
        </Alert>

        {/* Enhanced interface with tabs */}
        <Card variant="outlined">
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="enhanced likewize tabs"
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab label="Actualización Inteligente" />
            <Tab label="Métricas del Sistema" />
            <Tab label="Interface Clásica" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 2 }}>
              <EnhancedLikewizePage
                tareaId={tareaId || undefined}
                onUpdateComplete={handleUpdateComplete}
              />
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 2 }}>
              <Stack spacing={3}>
                <MappingMetrics />

                <Alert severity="info">
                  <strong>Métricas en Tiempo Real:</strong> El sistema monitorea continuamente
                  la calidad del mapeo y proporciona alertas proactivas.
                </Alert>
              </Stack>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Alert severity="info">
                  <strong>Interface Clásica:</strong> Mantiene toda la funcionalidad original
                  con las mejoras de análisis de mapeo integradas.
                </Alert>

                <LikewizeB2BPageOriginal />
              </Stack>
            </Box>
          </TabPanel>
        </Card>
      </Stack>
    </Box>
  )
}