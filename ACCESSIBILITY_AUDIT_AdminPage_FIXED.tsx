'use client'

import React, { useState } from 'react'
import Head from 'next/head'
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
    <>
      <Head>
        <title>Dispositivos Personalizados - Administración | Zirqulotech Partners</title>
        <meta
          name="description"
          content="Gestión de dispositivos personalizados no-Apple para valoraciones B2B y B2C"
        />
      </Head>

      <Box
        sx={{ p: { xs: 1, md: 2 } }}
        component="main"
        role="main"
        aria-labelledby="page-title"
      >
        {/* Encabezado principal de la página */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          mb={3}
          component="header"
        >
          <Typography
            variant="h1"
            id="page-title"
            sx={{
              fontSize: { xs: '1.75rem', md: '2.125rem' },
              fontWeight: 600,
            }}
          >
            Dispositivos personalizados
          </Typography>
        </Box>

        {/* Región de navegación/breadcrumbs (opcional - agregar si existe navegación) */}
        {/* <nav aria-label="Breadcrumb">...</nav> */}

        {/* Contenido principal */}
        <section aria-labelledby="tabla-dispositivos-heading">
          <Typography
            id="tabla-dispositivos-heading"
            variant="h2"
            sx={{
              fontSize: '1rem',
              fontWeight: 500,
              mb: 2,
              color: 'text.secondary',
              position: 'absolute',
              left: '-10000px', // Visually hidden - solo para screen readers
            }}
          >
            Listado de dispositivos personalizados registrados
          </Typography>

          <DispositivosPersonalizadosTable
            onCreate={handleCreate}
            onEdit={handleEdit}
          />
        </section>

        {/* Modal de creación/edición */}
        <DispositivoPersonalizadoModal
          open={modalOpen}
          onClose={handleCloseModal}
          dispositivo={selectedDispositivo}
        />
      </Box>
    </>
  )
}
