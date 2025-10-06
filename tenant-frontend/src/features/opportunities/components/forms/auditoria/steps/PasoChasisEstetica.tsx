'use client'

import React from 'react'
import { Paper, Typography, Box } from '@mui/material'
import TabletAndroidIcon from '@mui/icons-material/TabletAndroid'
import PasoEstetica from '../../PasoEstetica'
import type { CatalogoValoracion, EsteticaKey } from '../../tipos'

interface PasoChasisEsteticaProps {
  catalog: CatalogoValoracion
  estadoLados: EsteticaKey | ''
  setEstadoLados: React.Dispatch<React.SetStateAction<EsteticaKey | ''>>
  estadoEspalda: EsteticaKey | ''
  setEstadoEspalda: React.Dispatch<React.SetStateAction<EsteticaKey | ''>>
}

/**
 * Paso 7: Estética del chasis (laterales y trasera)
 * Evalúa arañazos, abolladuras en marco y parte trasera
 */
export default function PasoChasisEstetica({
  catalog,
  estadoLados,
  setEstadoLados,
  estadoEspalda,
  setEstadoEspalda,
}: PasoChasisEsteticaProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: 4,
        borderColor: 'primary.light',
        bgcolor: 'action.hover',
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <TabletAndroidIcon color="primary" />
        <Typography variant="subtitle2">Paso 7: Estética del chasis (laterales y trasera)</Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Evalúe el estado estético del marco (laterales) y parte trasera del dispositivo
      </Typography>

      <PasoEstetica
        catalog={catalog}
        mode="body"
        estadoPantalla=""
        setEstadoPantalla={() => {}}
        estadoLados={estadoLados}
        setEstadoLados={setEstadoLados}
        estadoEspalda={estadoEspalda}
        setEstadoEspalda={setEstadoEspalda}
        openDemo={() => {}}
      />
    </Paper>
  )
}
