// src/components/formularios/Clientes/TipoClienteStep.tsx
"use client";
import { Box, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio } from "@mui/material";

type Tipo = "empresa" | "autonomo" | "particular";

export default function TipoClienteStep({ nuevo, setNuevo }: any) {
  const tipo: Tipo = nuevo.tipo_cliente ?? "";

  const onChange = (val: Tipo) => {
    const base: any = { ...nuevo, tipo_cliente: val };
    // Limpia campos que no aplican al cambiar tipo
    if (val === "empresa") { delete base.nombre; delete base.apellidos; delete base.dni_nie; delete base.nif; }
    if (val === "autonomo") { delete base.razon_social; delete base.cif; delete base.dni_nie; }
    if (val === "particular"){ delete base.razon_social; delete base.cif; delete base.nif; delete base.nombre_comercial; }
    setNuevo(base);
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <FormControl sx={{ alignItems: "center" }}>
        <FormLabel sx={{ width: "100%", textAlign: "center", mb: 1 }}>Tipo de cliente</FormLabel>
        <RadioGroup
          row
          value={tipo}
          onChange={(e) => onChange(e.target.value as Tipo)}
        >
          <FormControlLabel value="empresa" control={<Radio />} label="Empresa" />
          <FormControlLabel value="autonomo" control={<Radio />} label="Autónomo" />
          <FormControlLabel value="particular" control={<Radio />} label="Particular" />
        </RadioGroup>
      </FormControl>
    </Box>
  );
}
