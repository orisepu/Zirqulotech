'use client'

import { Box, Stack, Chip, Tooltip, IconButton, Typography } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { fmtEUR } from '../utils'
import type { ValoracionTecnicaResponse } from '@/services/valoraciones'

export interface PanelDebugBackendProps {
  valoracionTecnica: ValoracionTecnicaResponse | null
  payload?: Record<string, unknown>
  isSecurityKO?: boolean
}

/**
 * Panel de debug que muestra métricas del backend en DialogActions.
 * Solo visible cuando __AUD_DEBUG__ está activo.
 */
export default function PanelDebugBackend({
  valoracionTecnica,
  payload,
  isSecurityKO = false,
}: PanelDebugBackendProps) {

  if (isSecurityKO) {
    return (
      <Stack
        direction="row"
        spacing={0.75}
        justifyContent="center"
        alignItems="center"
        sx={{ flexWrap: 'wrap', width: '100%', mt: 1 }}
      >
        <Chip size="small" color="error" label="Rechazado por seguridad" />
        <Chip size="small" color="default" label={`Oferta ${fmtEUR(0)}`} />
      </Stack>
    )
  }

  if (!valoracionTecnica) return null

  const handleCopyPayload = () => {
    if (payload) {
      navigator.clipboard?.writeText(JSON.stringify(payload, null, 2))
    }
  }

  return (
    <Stack
      direction="row"
      spacing={0.75}
      justifyContent="center"
      alignItems="center"
      sx={{ flexWrap: 'wrap', width: '100%', mt: 1 }}
    >
      <Chip size="small" label={`Gate ${valoracionTecnica.gate}`} />
      <Chip size="small" label={`Grado ${valoracionTecnica.grado_estetico}`} />
      <Chip size="small" label={`V_tope ${fmtEUR(valoracionTecnica.V_tope)}`} />
      <Chip size="small" color="primary" label={`Oferta ${fmtEUR(valoracionTecnica.oferta)}`} />

      <Tooltip
        arrow
        placement="top"
        title={
          <Box sx={{ fontSize: 12, lineHeight: 1.35, maxWidth: 520 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
              Resumen backend (técnica)
            </Typography>
            <Box>
              Topes — A+: <b>{fmtEUR(valoracionTecnica.V_Aplus)}</b> ·
              A: <b>{fmtEUR(valoracionTecnica.V_A)}</b> ·
              B: <b>{fmtEUR(valoracionTecnica.V_B)}</b> ·
              C: <b>{fmtEUR(valoracionTecnica.V_C)}</b>
            </Box>
            <Box>
              V_suelo: <b>{fmtEUR(valoracionTecnica.params?.V_suelo ?? 0)}</b> ·
              <span style={{ opacity: 0.8 }}>{valoracionTecnica.params?.v_suelo_regla?.label}</span>
            </Box>
            <Box>
              Deducciones: bat <b>{fmtEUR(valoracionTecnica.deducciones.pr_bat)}</b> ·
              pant <b>{fmtEUR(valoracionTecnica.deducciones.pr_pant)}</b> ·
              chas <b>{fmtEUR(valoracionTecnica.deducciones.pr_chas)}</b>
            </Box>
            <Box>
              Oferta backend: <b>{fmtEUR(valoracionTecnica.oferta)}</b>
            </Box>
            <Box sx={{ my: 1, borderTop: 1, borderColor: 'divider' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
              Payload enviado
            </Typography>
            <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 10 }}>
              {JSON.stringify(payload, null, 2)}
            </Box>
          </Box>
        }
      >
        <IconButton size="small" sx={{ ml: 0.25 }} onClick={handleCopyPayload}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}
