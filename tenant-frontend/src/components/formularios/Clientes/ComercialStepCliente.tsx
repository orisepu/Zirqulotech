"use client";

import { Box, Grid, TextField } from "@mui/material";
import { useEffect, useState } from "react";

type Tipo = "empresa" | "autonomo" | "particular";

export default function ComercialStepCliente({ nuevo, setNuevo }: any) {
  const tipo: Tipo = (nuevo?.tipo_cliente as Tipo) ?? "empresa";

  const [errores, setErrores] = useState({ correo: false, telefono: false });

  useEffect(() => {
    setErrores({
      correo:
        !!nuevo?.correo &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(nuevo.correo)),
      telefono:
        !!nuevo?.telefono &&
        !/^[0-9]{9}$/.test(String(nuevo.telefono).replace(/\s+/g, "")),
    });
  }, [nuevo?.correo, nuevo?.telefono]);

  const up = (v: string) => (v ? v.toUpperCase() : v);

  return (
    <Box component="form" noValidate autoComplete="off">
      <Grid container spacing={2}>


        {/* EMPRESA */}
        {tipo === "empresa" && (
          <>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="Razón social"
                fullWidth
                value={nuevo?.razon_social ?? ""}
                onChange={(e) =>
                  setNuevo({ ...nuevo, razon_social: e.target.value })
                }
                autoComplete="organization"
              />
            </Grid>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="CIF"
                fullWidth
                value={nuevo?.cif ?? ""}
                onChange={(e) => setNuevo({ ...nuevo, cif: up(e.target.value) })}
                inputProps={{ style: { textTransform: "uppercase" } }}
                autoComplete="off"
              />
            </Grid>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="Persona de contacto"
                fullWidth
                value={nuevo?.contacto ?? ""}
                onChange={(e) => setNuevo({ ...nuevo, contacto: e.target.value })}
                autoComplete="name"
              />
            </Grid>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="Posición"
                fullWidth
                value={nuevo?.posicion ?? ""}
                onChange={(e) => setNuevo({ ...nuevo, posicion: e.target.value })}
                autoComplete="organization-title"
              />
            </Grid>
          </>
        )}

        {/* AUTÓNOMO */}
        {tipo === "autonomo" && (
          <>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="Nombre"
                fullWidth
                value={nuevo?.nombre ?? ""}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                autoComplete="given-name"
              />
            </Grid>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="Apellidos"
                fullWidth
                value={nuevo?.apellidos ?? ""}
                onChange={(e) =>
                  setNuevo({ ...nuevo, apellidos: e.target.value })
                }
                autoComplete="family-name"
              />
            </Grid>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="NIF"
                fullWidth
                value={nuevo?.nif ?? ""}
                onChange={(e) => setNuevo({ ...nuevo, nif: up(e.target.value) })}
                inputProps={{ style: { textTransform: "uppercase" } }}
                autoComplete="off"
              />
            </Grid>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="Nombre comercial (opcional)"
                fullWidth
                value={nuevo?.nombre_comercial ?? ""}
                onChange={(e) =>
                  setNuevo({ ...nuevo, nombre_comercial: e.target.value })
                }
                autoComplete="organization"
              />
            </Grid>
          </>
        )}

        {/* PARTICULAR */}
        {tipo === "particular" && (
          <>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="Nombre"
                fullWidth
                value={nuevo?.nombre ?? ""}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                autoComplete="given-name"
              />
            </Grid>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="Apellidos"
                fullWidth
                value={nuevo?.apellidos ?? ""}
                onChange={(e) =>
                  setNuevo({ ...nuevo, apellidos: e.target.value })
                }
                autoComplete="family-name"
              />
            </Grid>
            <Grid size={{xs:12,sm:6}}>
              <TextField
                label="DNI/NIE"
                fullWidth
                value={nuevo?.dni_nie ?? ""}
                onChange={(e) =>
                  setNuevo({ ...nuevo, dni_nie: up(e.target.value) })
                }
                inputProps={{ style: { textTransform: "uppercase" } }}
                autoComplete="off"
              />
            </Grid>
          </>
        )}
                {/* Campos COMUNES */}
        <Grid size={{xs:12,sm:6}}>
          <TextField
            label="Correo electrónico"
            fullWidth
            value={nuevo?.correo ?? ""}
            onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })}
            error={errores.correo}
            helperText={errores.correo ? "Formato de correo no válido" : ""}
            autoComplete="email"
          />
        </Grid>
        <Grid size={{xs:12,sm:6}}>
          <TextField
            label="Teléfono"
            fullWidth
            value={nuevo?.telefono ?? ""}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                telefono: e.target.value.replace(/[^\d\s]/g, ""),
              })
            }
            error={errores.telefono}
            helperText={errores.telefono ? "9 dígitos" : ""}
            autoComplete="tel"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
