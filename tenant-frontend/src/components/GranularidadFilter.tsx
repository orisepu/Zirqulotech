'use client'

import { FormControl, InputLabel, MenuItem, Select } from "@mui/material"

export default function GranularidadFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 150 }}>
      <InputLabel>Agrupar por</InputLabel>
      <Select
        value={value}
        label="Granularidad"
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="dia">Día</MenuItem>
        <MenuItem value="semana">Semana</MenuItem>
        <MenuItem value="mes">Mes</MenuItem>
      </Select>
    </FormControl>
  )
}
