'use client'

import { FormControl, InputLabel, MenuItem, Select } from "@mui/material"

const estadosOrdenados = [
  "Pendiente",
  "Aceptado",
  "Cancelado",
  "Recogida generada",
  "En tránsito",
  "Recibido",
  "En revisión",
  "Oferta confirmada",
  "Pendiente factura",
  "Factura recibida",
  "Pendiente de pago",
  "Pagado",
  "Nueva oferta enviada",
  "Rechazada",
  "Devolución iniciada",
  "Equipo enviado",
  "Recibido por el cliente",
  "Nueva oferta confirmada",
  "Nuevo contrato",
  "Contrato",
]

export default function EstadoMinimoFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (estado: string) => void
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel>Estado mínimo</InputLabel>
      <Select
        value={value}
        label="Estado mínimo"
        onChange={(e) => onChange(e.target.value)}
      >
        {estadosOrdenados.map((estado) => (
          <MenuItem key={estado} value={estado}>
            {estado}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
