"use client";

import { Box, Grid, TextField } from "@mui/material";
import ValidatingTextField from "@/components/inputs/ValidatingTextField";

type Tipo = "empresa" | "autonomo" | "particular";

type BaseCliente = {
  tipo_cliente?: Tipo
  razon_social?: string
  cif?: string
  contacto?: string
  posicion?: string
  nombre?: string
  apellidos?: string
  nif?: string
  nombre_comercial?: string
  dni_nie?: string
  correo?: string
  telefono?: string
  direccion_calle?: string
  direccion_numero?: string
  direccion_piso?: string
  direccion_puerta?: string
  direccion_cp?: string
  direccion_poblacion?: string
  direccion_provincia?: string
}

type NuevoCom = BaseCliente & Record<string, unknown>

export default function ComercialStepCliente({ nuevo, setNuevo }: { nuevo: NuevoCom; setNuevo: (v: NuevoCom) => void }) {
  const tipo: Tipo = (nuevo?.tipo_cliente as Tipo) ?? "empresa";

  // Validación gestionada por ValidatingTextField

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
              <ValidatingTextField
                label="CIF"
                fullWidth
                value={nuevo?.cif ?? ""}
                onChange={(e) => setNuevo({ ...nuevo, cif: up(e.target.value) })}
                inputProps={{ style: { textTransform: "uppercase" } }}
                kind="cif"
                required
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
              <ValidatingTextField
                label="NIF"
                fullWidth
                value={nuevo?.nif ?? ""}
                onChange={(e) => setNuevo({ ...nuevo, nif: up(e.target.value) })}
                inputProps={{ style: { textTransform: "uppercase" } }}
                kind="dni"
                required
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
              <ValidatingTextField
                label="DNI/NIE"
                fullWidth
                value={nuevo?.dni_nie ?? ""}
                onChange={(e) =>
                  setNuevo({ ...nuevo, dni_nie: up(e.target.value) })
                }
                inputProps={{ style: { textTransform: "uppercase" } }}
                kind="dni_or_nie"
                required
                autoComplete="off"
              />
            </Grid>
          </>
        )}
                {/* Campos COMUNES */}
        <Grid size={{xs:12,sm:6}}>
          <ValidatingTextField
            label="Correo electrónico"
            fullWidth
            value={nuevo?.correo ?? ""}
            onChange={(e) => setNuevo({ ...nuevo, correo: e.target.value })}
            kind="email"
            autoComplete="email"
          />
        </Grid>
        <Grid size={{xs:12,sm:6}}>
          <ValidatingTextField
            label="Teléfono"
            fullWidth
            value={nuevo?.telefono ?? ""}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                telefono: e.target.value.replace(/[^\d\s]/g, ""),
              })
            }
            kind="telefono"
            required
            autoComplete="tel"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
