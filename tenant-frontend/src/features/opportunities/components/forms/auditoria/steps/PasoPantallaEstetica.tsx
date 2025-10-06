'use client'

import React from 'react'
import { Paper, Typography, Box } from '@mui/material'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import PasoEstetica from '../../PasoEstetica'
import type { CatalogoValoracion, EsteticaPantallaKey } from '../../tipos'

interface PasoPantallaEsteticaProps {
  catalog: CatalogoValoracion
  estadoPantalla: EsteticaPantallaKey | ''
  setEstadoPantalla: React.Dispatch<React.SetStateAction<EsteticaPantallaKey | ''>>
}

/**
 * Paso 6: Estética de la pantalla (cristal)
 * Evalúa arañazos, marcas en el cristal frontal
 */
export default function PasoPantallaEstetica({
  catalog,
  estadoPantalla,
  setEstadoPantalla,
}: PasoPantallaEsteticaProps) {
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
        <PhoneIphoneIcon color="primary" />
        <Typography variant="subtitle2">Paso 6: Estética de la pantalla (cristal)</Typography>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Evalúe el estado estético del cristal frontal (arañazos, marcas visibles)
      </Typography>

      <PasoEstetica
        catalog={catalog}
        mode="screen"
        estadoPantalla={estadoPantalla}
        setEstadoPantalla={setEstadoPantalla}
        estadoLados=""
        setEstadoLados={() => {}}
        estadoEspalda=""
        setEstadoEspalda={() => {}}
        openDemo={() => {}}
      />
    </Paper>
  )
}
