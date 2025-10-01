'use client'

import React from 'react'
import { Dialog } from '@mui/material'
import FormularioValoracionOportunidad from '@/features/opportunities/components/forms/FormularioValoracionOportunidad'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Modal de valoración rápida informativa
 * - No requiere oportunidad real
 * - Modo empresa B2B (cuestionario rápido sin estados)
 * - Solo muestra precio orientativo, no guarda nada
 */
export default function ModalValoracionRapida({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <FormularioValoracionOportunidad
        oportunidadId={-1}  // ID especial para modo informativo
        oportunidad={{
          cliente: {
            canal: 'B2B',
            tipo_cliente: 'empresa'
          },
          dispositivos: []
        }}
        onClose={onClose}
        onSuccess={onClose}
      />
    </Dialog>
  )
}
