"use client"

import { Box, TextField } from "@mui/material"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import { esES } from "@mui/x-date-pickers/locales"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import dayjs, { Dayjs } from "dayjs"
import "dayjs/locale/es"

interface Props {
  fromDate: Dayjs
  toDate: Dayjs
  onChange: (from: Dayjs, to: Dayjs) => void
}

export default function DateRangeFilter({ fromDate, toDate, onChange }: Props) {
  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale="es"
      localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}
    >
      <Box display="flex" gap={1}>
        <DatePicker
          label="Desde"
          value={fromDate}
          onChange={(newValue) => {
            if (newValue) onChange(newValue, toDate)
          }}
          format="DD/MM/YYYY"
          slotProps={{ textField: { size: "small" } }}
        />
        <DatePicker
          label="Hasta"
          value={toDate}
          onChange={(newValue) => {
            if (newValue) onChange(fromDate, newValue)
          }}
          format="DD/MM/YYYY"
          slotProps={{ textField: { size: "small" } }}
        />
      </Box>
    </LocalizationProvider>
  )
}
