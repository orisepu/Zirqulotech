import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import { Cliente, ClienteOption } from '@/shared/types/oportunidades'

export function useClienteSearch() {
  const queryClient = useQueryClient()
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOption | null>(null)
  const [crearOportunidadOpen, setCrearOportunidadOpen] = useState(false)

  const crearCliente = useMutation({
    mutationFn: async (nuevoCliente: Partial<Cliente>) => {
      const res = await api.post('/api/clientes/', nuevoCliente)
      return res.data
    },
    onSuccess: (clienteCreado) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      // Selecciona el cliente recién creado
      setClienteSeleccionado({
        id: clienteCreado.id,
        display_name: clienteCreado.display_name,
        razon_social: clienteCreado.razon_social,
        nombre: clienteCreado.nombre,
        apellidos: clienteCreado.apellidos,
        nif: clienteCreado.nif,
        dni_nie: clienteCreado.dni_nie,
        nombre_comercial: clienteCreado.nombre_comercial,
        identificador_fiscal: clienteCreado.identificador_fiscal,
        tipo_cliente: clienteCreado.tipo_cliente,
      })
      setCrearOportunidadOpen(true)
    },
    onError: () => {
      alert('❌ Error al crear cliente')
    },
  })

  return {
    clienteSeleccionado,
    setClienteSeleccionado,
    crearOportunidadOpen,
    setCrearOportunidadOpen,
    crearCliente
  }
}