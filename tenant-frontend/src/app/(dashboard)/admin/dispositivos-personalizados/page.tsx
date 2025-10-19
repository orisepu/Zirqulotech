'use client'

import React, { useState } from 'react'
import { Box, Typography } from '@mui/material'
import DispositivosPersonalizadosTable from '@/features/admin/components/DispositivosPersonalizadosTable'
import DispositivoPersonalizadoModal from '@/features/admin/components/DispositivoPersonalizadoModal'
import type { DispositivoPersonalizado } from '@/shared/types/dispositivos'

export default function DispositivosPersonalizadosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDispositivo, setSelectedDispositivo] = useState<DispositivoPersonalizado | null>(null)

  const handleCreate = () => {
    setSelectedDispositivo(null)
    setModalOpen(true)
  }

  const handleEdit = (dispositivo: DispositivoPersonalizado) => {
    setSelectedDispositivo(dispositivo)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedDispositivo(null)
  }

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4">Dispositivos personalizados</Typography>
      </Box>

      <DispositivosPersonalizadosTable
        onCreate={handleCreate}
        onEdit={handleEdit}
      />

      <DispositivoPersonalizadoModal
        open={modalOpen}
        onClose={handleCloseModal}
        dispositivo={selectedDispositivo}
      />
    </Box>
  )
}
