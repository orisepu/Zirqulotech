'use client'

import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material'
import {
  PhoneAndroid,
  Computer,
  DesktopWindows,
  Monitor,
  Tablet,
  DevicesOther,
} from '@mui/icons-material'
import type { TipoDispositivo } from '@/shared/types/dispositivos'

interface Paso1TipoProps {
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

const TIPOS_DISPOSITIVO = [
  {
    value: 'movil' as TipoDispositivo,
    label: 'Móvil',
    icon: PhoneAndroid,
    descripcion: 'Smartphones de cualquier marca',
  },
  {
    value: 'tablet' as TipoDispositivo,
    label: 'Tablet',
    icon: Tablet,
    descripcion: 'Tablets y iPads',
  },
  {
    value: 'portatil' as TipoDispositivo,
    label: 'Portátil',
    icon: Computer,
    descripcion: 'Laptops y notebooks',
  },
  {
    value: 'pc' as TipoDispositivo,
    label: 'PC (Desktop/Torre)',
    icon: DesktopWindows,
    descripcion: 'Ordenadores de sobremesa',
  },
  {
    value: 'monitor' as TipoDispositivo,
    label: 'Monitor',
    icon: Monitor,
    descripcion: 'Pantallas y monitores externos',
  },
  {
    value: 'otro' as TipoDispositivo,
    label: 'Otro',
    icon: DevicesOther,
    descripcion: 'Otro tipo de dispositivo',
  },
]

export default function Paso1Tipo({ formData, setFormData }: Paso1TipoProps) {
  const handleTipoChange = (tipo: TipoDispositivo) => {
    setFormData((prev: any) => ({
      ...prev,
      tipo,
      // Limpiar características del tipo anterior
      capacidad: '',
      pulgadas: '',
      herzios: '',
      proporcion: '',
      resolucion: '',
      almacenamiento: '',
      ram: '',
      procesador: '',
      grafica: '',
    }))
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Selecciona el tipo de dispositivo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Elige el tipo de dispositivo que deseas registrar. Los campos de características se
        adaptarán según tu selección.
      </Typography>

      <Grid container spacing={2}>
        {TIPOS_DISPOSITIVO.map((tipo) => {
          const Icon = tipo.icon
          const isSelected = formData.tipo === tipo.value

          return (
            <Grid item xs={12} sm={6} md={4} key={tipo.value}>
              <Card
                sx={{
                  cursor: 'pointer',
                  border: 2,
                  borderColor: isSelected ? 'primary.main' : 'transparent',
                  bgcolor: isSelected ? 'action.selected' : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: isSelected ? 'primary.main' : 'action.hover',
                    bgcolor: isSelected ? 'action.selected' : 'action.hover',
                  },
                }}
                onClick={() => handleTipoChange(tipo.value)}
              >
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Icon
                    sx={{
                      fontSize: 48,
                      color: isSelected ? 'primary.main' : 'text.secondary',
                      mb: 1,
                    }}
                  />
                  <Typography variant="h6" gutterBottom>
                    {tipo.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tipo.descripcion}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {formData.tipo && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
          <Typography variant="body2" color="info.main">
            <strong>Tipo seleccionado:</strong>{' '}
            {TIPOS_DISPOSITIVO.find((t) => t.value === formData.tipo)?.label}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
