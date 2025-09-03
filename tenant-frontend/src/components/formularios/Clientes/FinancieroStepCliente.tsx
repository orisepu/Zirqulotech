"use client";

import { Box, TextField, Grid } from "@mui/material";
import { useState, useEffect } from 'react';
export default function FinancieroStep({ nuevo, setNuevo }: any) {
  const [errores, setErrores] = useState({ correo: false, telefono: false });

  useEffect(() => {
    setErrores({
      correo: !!nuevo.correo_financiero && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo.correo_financiero),
      telefono: !!nuevo.telefono_financiero && !/^[0-9]{9}$/.test(nuevo.telefono_financiero.replace(/\s+/g, '')),
    });
  }, [nuevo.correo, nuevo.telefono]);
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
          <TextField
            label="Teléfono financiero"
            fullWidth
            value={nuevo.telefono_financiero || ""}
            onChange={(e) => setNuevo({ ...nuevo, telefono_financiero: e.target.value })}
          />
        </Grid>
        <Grid size={{xs:12,sm:6}}>
          <TextField
            label="Correo financiero"
            fullWidth
            value={nuevo.correo_financiero || ""}
            onChange={(e) => setNuevo({ ...nuevo, correo_financiero: e.target.value })}
            error={errores.correo}
            helperText={errores.correo ? 'Correo inválido' : ''}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
