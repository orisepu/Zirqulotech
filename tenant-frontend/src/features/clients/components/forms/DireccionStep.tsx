"use client";

import { Box, Grid, TextField } from "@mui/material";
import ValidatingTextField from "@/shared/components/forms/inputs/ValidatingTextField";

type NuevoDirLike = Record<string, unknown> & {
  direccion_calle?: string
  direccion_piso?: string
  direccion_puerta?: string
  direccion_cp?: string
  direccion_poblacion?: string
  direccion_provincia?: string
  direccion_pais?: string
}

export default function DireccionStep({ nuevo, setNuevo }: { nuevo: NuevoDirLike; setNuevo: (v: Record<string, unknown>) => void }) {
  return (
    <Box component="form" noValidate autoComplete="off">
      <Grid container spacing={2}>
        <Grid size={{xs:12}}>
          <TextField
            label="Calle y número"
            fullWidth
            value={nuevo.direccion_calle || ""}
            onChange={(e) => setNuevo({ ...nuevo, direccion_calle: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12,sm:4}}>
          <TextField
            label="Piso"
            fullWidth
            value={nuevo.direccion_piso || ""}
            onChange={(e) => setNuevo({ ...nuevo, direccion_piso: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12,sm:4}}>
          <TextField
            label="Puerta"
            fullWidth
            value={nuevo.direccion_puerta || ""}
            onChange={(e) => setNuevo({ ...nuevo, direccion_puerta: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12,sm:4}}>
          <ValidatingTextField
            label="Código postal"
            fullWidth
            value={nuevo.direccion_cp || ""}
            onChange={(e) => setNuevo({ ...nuevo, direccion_cp: e.target.value })}
            kind="cp_es"
          />
        </Grid>

        <Grid size={{xs:12,sm:6}}>
          <TextField
            label="Población"
            fullWidth
            value={nuevo.direccion_poblacion || ""}
            onChange={(e) => setNuevo({ ...nuevo, direccion_poblacion: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12,sm:6}}>
          <TextField
            label="Provincia"
            fullWidth
            value={nuevo.direccion_provincia || ""}
            onChange={(e) => setNuevo({ ...nuevo, direccion_provincia: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12}}>
          <TextField
            label="País"
            fullWidth
            value={nuevo.direccion_pais || ""}
            onChange={(e) => setNuevo({ ...nuevo, direccion_pais: e.target.value })}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
