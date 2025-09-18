// src/components/formularios/Clientes/TipoClienteStep.tsx
"use client";
import { useEffect } from "react";
import { Box, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, Tooltip } from "@mui/material";

type Tipo = "empresa" | "autonomo" | "particular";

type NuevoTipo = {
  tipo_cliente?: Tipo;
  razon_social?: string; cif?: string;
  nombre?: string; apellidos?: string; dni_nie?: string; nif?: string;
  nombre_comercial?: string;
}

export default function TipoClienteStep({ nuevo, setNuevo, soloEmpresas = false }: { nuevo: NuevoTipo; setNuevo: (v: Record<string, unknown>) => void; soloEmpresas?: boolean }) {
  const tipo: Tipo = (nuevo.tipo_cliente as Tipo) ?? "";

  const onChange = (val: Tipo) => {
    if (soloEmpresas && val === "particular") return;
    const base: Record<string, unknown> = { ...nuevo, tipo_cliente: val };
    // Limpia campos que no aplican al cambiar tipo
    if (val === "empresa") { delete base.nombre; delete base.apellidos; delete base.dni_nie; delete base.nif; }
    if (val === "autonomo") { delete base.razon_social; delete base.cif; delete base.dni_nie; }
    if (val === "particular"){ delete base.razon_social; delete base.cif; delete base.nif; delete base.nombre_comercial; }
    setNuevo(base);
  };

  useEffect(() => {
    if (soloEmpresas && tipo === "particular") {
      onChange("empresa");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloEmpresas]);

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
          {!soloEmpresas && (
            <FormControlLabel value="particular" control={<Radio />} label="Particular" />
          )}
        </RadioGroup>
      </FormControl>
    </Box>
  );
}
