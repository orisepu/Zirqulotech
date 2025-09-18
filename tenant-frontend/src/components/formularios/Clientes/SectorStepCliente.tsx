"use client";

import { Box, Grid, TextField } from "@mui/material";

type NuevoSectorLike = Record<string, unknown> & {
  vertical?: string;
  vertical_secundaria?: string;
  numero_empleados?: number | "";
}

export default function SectorStep({ nuevo, setNuevo }: { nuevo: NuevoSectorLike; setNuevo: (v: Record<string, unknown>) => void }) {
  return (
    <Box component="form" noValidate autoComplete="off">
      <Grid container spacing={2}>
        <Grid size={{xs:12}}>
          <TextField
            label="Vertical principal"
            fullWidth
            value={nuevo.vertical || ""}
            onChange={(e) => setNuevo({ ...nuevo, vertical: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12}}>
          <TextField
            label="Vertical secundaria"
            fullWidth
            value={nuevo.vertical_secundaria || ""}
            onChange={(e) => setNuevo({ ...nuevo, vertical_secundaria: e.target.value })}
          />
        </Grid>

        <Grid size={{xs:12}}>
          <TextField
            label="Número de empleados"
            type="number"
            fullWidth
            value={nuevo.numero_empleados ?? ""}
            onChange={(e) =>
              setNuevo({ ...nuevo, numero_empleados: parseInt(e.target.value, 10) || "" })
            }
            inputProps={{ min: 0 }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
