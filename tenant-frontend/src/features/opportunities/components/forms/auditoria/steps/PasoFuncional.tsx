'use client'

import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material'
import PhoneIcon from '@mui/icons-material/Phone'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import MicIcon from '@mui/icons-material/Mic'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import FingerprintIcon from '@mui/icons-material/Fingerprint'
import WifiIcon from '@mui/icons-material/Wifi'
import BluetoothIcon from '@mui/icons-material/Bluetooth'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import NfcIcon from '@mui/icons-material/Nfc'
import SensorsIcon from '@mui/icons-material/Sensors'
import VibrationIcon from '@mui/icons-material/Vibration'
import TouchAppIcon from '@mui/icons-material/TouchApp'

interface PasoFuncionalProps {
  funcTelefoniaOK: boolean | null
  setFuncTelefoniaOK: (val: boolean | null) => void
  funcAudioOK: boolean | null
  setFuncAudioOK: (val: boolean | null) => void
  funcMicOK: boolean | null
  setFuncMicOK: (val: boolean | null) => void
  funcCamarasOK: boolean | null
  setFuncCamarasOK: (val: boolean | null) => void
  funcBiometriaOK: boolean | null
  setFuncBiometriaOK: (val: boolean | null) => void
  funcWiFiOK: boolean | null
  setFuncWiFiOK: (val: boolean | null) => void
  funcBTOK: boolean | null
  setFuncBTOK: (val: boolean | null) => void
  funcPCOK: boolean | null
  setFuncPCOK: (val: boolean | null) => void
  funcGPSOK: boolean | null
  setFuncGPSOK: (val: boolean | null) => void
  funcNFCOK: boolean | null
  setFuncNFCOK: (val: boolean | null) => void
  funcSensoresOK: boolean | null
  setFuncSensoresOK: (val: boolean | null) => void
  funcVibracionOK: boolean | null
  setFuncVibracionOK: (val: boolean | null) => void
  funcTactilOK: boolean | null
  setFuncTactilOK: (val: boolean | null) => void
}

/**
 * Paso 4: Pruebas funcionales
 * Telefonía, audio, sensores, biometría, conectividad
 */
export default function PasoFuncional(props: PasoFuncionalProps) {
  const funciones = [
    {
      label: 'Telefonía (llamadas)',
      icon: <PhoneIcon fontSize="small" />,
      value: props.funcTelefoniaOK,
      setter: props.setFuncTelefoniaOK,
    },
    {
      label: 'Audio (altavoces)',
      icon: <VolumeUpIcon fontSize="small" />,
      value: props.funcAudioOK,
      setter: props.setFuncAudioOK,
    },
    {
      label: 'Micrófono',
      icon: <MicIcon fontSize="small" />,
      value: props.funcMicOK,
      setter: props.setFuncMicOK,
    },
    {
      label: 'Cámaras',
      icon: <CameraAltIcon fontSize="small" />,
      value: props.funcCamarasOK,
      setter: props.setFuncCamarasOK,
    },
    {
      label: 'Biometría (Face ID / Touch ID)',
      icon: <FingerprintIcon fontSize="small" />,
      value: props.funcBiometriaOK,
      setter: props.setFuncBiometriaOK,
    },
    {
      label: 'WiFi',
      icon: <WifiIcon fontSize="small" />,
      value: props.funcWiFiOK,
      setter: props.setFuncWiFiOK,
    },
    {
      label: 'Bluetooth',
      icon: <BluetoothIcon fontSize="small" />,
      value: props.funcBTOK,
      setter: props.setFuncBTOK,
    },
    {
      label: 'Portada de carga (Lightning / USB-C)',
      icon: <BluetoothIcon fontSize="small" />,
      value: props.funcPCOK,
      setter: props.setFuncPCOK,
    },
    {
      label: 'GPS / Localización',
      icon: <LocationOnIcon fontSize="small" />,
      value: props.funcGPSOK,
      setter: props.setFuncGPSOK,
    },
    {
      label: 'NFC',
      icon: <NfcIcon fontSize="small" />,
      value: props.funcNFCOK,
      setter: props.setFuncNFCOK,
    },
    {
      label: 'Sensores (proximidad, giroscopio, etc.)',
      icon: <SensorsIcon fontSize="small" />,
      value: props.funcSensoresOK,
      setter: props.setFuncSensoresOK,
    },
    {
      label: 'Vibración',
      icon: <VibrationIcon fontSize="small" />,
      value: props.funcVibracionOK,
      setter: props.setFuncVibracionOK,
    },
    {
      label: 'Táctil (touchscreen)',
      icon: <TouchAppIcon fontSize="small" />,
      value: props.funcTactilOK,
      setter: props.setFuncTactilOK,
    },
  ]

  const handleToggle = (currentValue: boolean | null, setter: (val: boolean | null) => void) => {
    if (currentValue === null) setter(true)
    else if (currentValue === true) setter(false)
    else setter(null)
  }

  const allOK = funciones.every((f) => f.value === true)
  const anyKO = funciones.some((f) => f.value === false)

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderLeft: 4,
        borderColor: anyKO ? 'error.main' : allOK ? 'success.main' : 'primary.light',
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Paso 4: Pruebas funcionales
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Marque cada función como OK (✓) o con fallo (✗). Sin marcar = no evaluado.
      </Typography>

      <FormGroup>
        <Grid container spacing={2}>
          {funciones.map((func, idx) => (
            <Grid key={idx} size={{ xs: 12, sm: 6, md: 4 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={func.value === true}
                    indeterminate={func.value === null}
                    onChange={() => handleToggle(func.value, func.setter)}
                    sx={{
                      color: func.value === false ? 'error.main' : undefined,
                      '&.Mui-checked': {
                        color: 'success.main',
                      },
                    }}
                  />
                }
                label={
                  <Box display="flex" alignItems="center" gap={0.5}>
                    {func.icon}
                    <Typography
                      variant="body2"
                      sx={{
                        color: func.value === false ? 'error.main' : 'text.primary',
                        fontWeight: func.value === false ? 600 : 400,
                      }}
                    >
                      {func.label}
                    </Typography>
                  </Box>
                }
              />
            </Grid>
          ))}
        </Grid>
      </FormGroup>

      {anyKO && (
        <Typography variant="caption" color="error" sx={{ mt: 2, display: 'block' }}>
          ⚠️ Uno o más componentes con fallo → puede afectar valoración
        </Typography>
      )}

      {allOK && (
        <Typography variant="caption" color="success.main" sx={{ mt: 2, display: 'block' }}>
          ✅ Todas las funciones verificadas OK
        </Typography>
      )}
    </Paper>
  )
}
