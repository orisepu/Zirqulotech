"use client";

import { Box, TextField, Grid } from "@mui/material";
import ValidatingTextField from "@/shared/components/forms/inputs/ValidatingTextField";

type NuevoFinLike = Record<string, unknown> & {
  contacto_financiero?: string;
  telefono_financiero?: string;
  correo_financiero?: string;
}

export default function FinancieroStep({ nuevo, setNuevo }: { nuevo: NuevoFinLike; setNuevo: (v: Record<string, unknown>) => void }) {
  return (
    <Box component="form" noValidate autoComplete="off">
      <Grid container spacing={2}>
        <Grid size={{xs:12,sm:6}}>
          <TextField
            label="Contacto financiero"
            fullWidth
            value={nuevo.contacto_financiero || ""}
            onChange={(e) => setNuevo({ ...nuevo, contacto_financiero: e.target.value })}
          />
        </Grid>
        <Grid size={{xs:12,sm:6}}>
          <ValidatingTextField
            label="Teléfono financiero"
            fullWidth
            value={nuevo.telefono_financiero || ""}
            onChange={(e) => setNuevo({ ...nuevo, telefono_financiero: e.target.value })}
            kind="telefono"
          />
        </Grid>
        <Grid size={{xs:12,sm:6}}>
          <ValidatingTextField
            label="Correo financiero"
            fullWidth
            value={nuevo.correo_financiero || ""}
            onChange={(e) => setNuevo({ ...nuevo, correo_financiero: e.target.value })}
            kind="email"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
