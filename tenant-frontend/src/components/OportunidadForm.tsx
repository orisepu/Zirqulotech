'use client'

import { useState } from 'react'
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material'
import api from '@/services/api'
import { useRouter } from 'next/navigation'

interface Props {
  clienteId: number
  onSuccess?: () => void
  onClose?: () => void
}

export default function OportunidadForm({ clienteId, onSuccess, onClose }: Props) {
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('api/oportunidades/', {
        cliente: clienteId,
        nombre,
      })
      if (onSuccess) onSuccess()
      if (onClose) onClose()
      router.push(`oportunidades/${res.data.id}`)
    } catch (err) {
      console.error('Error al crear oportunidad', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>

      <TextField
        fullWidth
        label="Nombre de la oportunidad"
        margin="normal"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <Button
        type="submit"
        variant="contained"
        disabled={loading}
        fullWidth
      >
        {loading ? <CircularProgress size={24} /> : 'Crear'}
      </Button>
    </Box>
  )
}
