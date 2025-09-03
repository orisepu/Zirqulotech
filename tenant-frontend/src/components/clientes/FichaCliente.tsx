"use client";

import {
  Box, Grid, Card, CardHeader, CardContent, Divider,
  Typography, Button
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";

type Cliente = {
  id: number;
  canal?: "b2b"|"b2c";
  tipo_cliente: "empresa"|"autonomo"|"particular";
  // Empresa
  razon_social?: string; cif?: string; contacto?: string; posicion?: string;
  // Autónomo / Particular
  nombre?: string; apellidos?: string; dni_nie?: string; nif?: string; nombre_comercial?: string;
  // Comunes
  correo?: string; telefono?: string;
  // Dirección
  direccion_calle?: string; direccion_piso?: string; direccion_puerta?: string;
  direccion_cp?: string; direccion_poblacion?: string; direccion_provincia?: string; direccion_pais?: string;
  // Empresa
  numero_empleados?: number|null;
  vertical?: string; vertical_secundaria?: string;
  contacto_financiero?:string;
  telefono_financiero?:string;
  correo_financiero?:string;
};

export default function FichaCliente({
  cliente,
  onEditar,
}: {
  cliente: Cliente;
  onEditar: () => void;
}) {
  const canal = cliente.canal ?? (cliente.tipo_cliente === "particular" ? "b2c" : "b2b");
  const esB2C = canal === "b2c";
  const telFmt = (t?: string) => {
    const raw = (t || "").replace(/\D/g, "");
    return raw.length === 9 ? `${raw.slice(0,3)} ${raw.slice(3,6)} ${raw.slice(6)}` : (t || "—");
  };

  return (
    <Box component={Card} variant="outlined" sx={{ mb: 1 }}>
      <CardHeader title="Ficha del cliente" sx={{ p: 1 }} avatar={<BusinessIcon />} />
      <CardContent sx={{ px: 1, pt: 1, pb: 0 }}>
            <Grid container direction="row" spacing={1}>
            {cliente.tipo_cliente === "particular" ? (
                <>
                {/* Identidad */}
                <Grid size={{ xs: 12, sm: 4 }} sx={{ display: "flex" }}>
                <Card variant="outlined" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <CardHeader sx={{ p: 1 }} title="Identidad" />
                    <CardContent sx={{ "&:last-child": { pb: 1 } }}>
                        <Typography sx={{ mb: 1 }}>
                        <strong>Nombre:</strong><br />
                        {`${cliente.nombre || "—"} ${cliente.apellidos || ""}`.trim()}
                        </Typography>
                        <Typography>
                        <strong>DNI/NIE:</strong><br />
                        {(cliente.dni_nie || "").toUpperCase() || "—"}
                        </Typography>
                    </CardContent>
                    </Card>
                </Grid>

                {/* Dirección */}
                <Grid size={{ xs: 12, sm: 4 }} sx={{ display: "flex" }}>
                    <Card variant="outlined" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <CardHeader sx={{ p: 1 }} title="Dirección" />
                    <CardContent sx={{ "&:last-child": { pb: 1 } }}>
                        <Typography sx={{ maxWidth: 265 }}>
                        <strong>Calle:</strong><br />
                        {cliente.direccion_calle || "—"}
                        {cliente.direccion_piso && `, Piso ${cliente.direccion_piso}`}
                        {cliente.direccion_puerta && `, Puerta ${cliente.direccion_puerta}`}
                        </Typography>
                        <Typography sx={{ maxWidth: 265 }}>
                        {(cliente.direccion_cp || "—")} {cliente.direccion_poblacion || ""}
                        {cliente.direccion_provincia ? `, ${cliente.direccion_provincia}` : ""}
                        </Typography>
                        <Typography sx={{ maxWidth: 265 }}>
                        {cliente.direccion_pais || "—"}
                        </Typography>
                    </CardContent>
                    </Card>
                </Grid>

                {/* Contacto */}
                <Grid size={{ xs: 12, sm: 4 }}sx={{ display: "flex" }}>
                    <Card variant="outlined"sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <CardHeader sx={{ p: 1 }} title="Contacto" />
                    <CardContent sx={{ "&:last-child": { pb: 1 } }}>
                        <Typography>
                        <PhoneIcon fontSize="small" sx={{ mr: 1 }} />
                        {telFmt(cliente.telefono)}
                        </Typography>
                        <Typography>
                        <EmailIcon fontSize="small" sx={{ mr: 1 }} />
                        {cliente.correo || "—"}
                        </Typography>
                    </CardContent>
                    </Card>
                </Grid>
                </>
            ) : (
                <>
                {/* Empresa / Autónomo: tu layout anterior */}
                <Grid size={{ xs: 12, sm: 3 }} sx={{ display: "flex" }}>
                    <Card variant="outlined" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <CardHeader sx={{ p: 1 }} title={esB2C ? "Identidad" : "Datos fiscales"} />
                    <CardContent sx={{ "&:last-child": { pb: 1 } }}>
                        {cliente.tipo_cliente === "empresa" && (
                        <>
                            <Typography sx={{ mb: 1 }}>
                            <strong>Razón social:</strong><br />{cliente.razon_social || "—"}
                            </Typography>
                            <Typography sx={{ mb: 2 }}>
                            <strong>CIF:</strong><br />{(cliente.cif || "").toUpperCase() || "—"}
                            </Typography>
                        </>
                        )}
                        {cliente.tipo_cliente === "autonomo" && (
                        <>
                            <Typography sx={{ mb: 1 }}>
                            <strong>Nombre:</strong><br />{`${cliente.nombre || "—"} ${cliente.apellidos || ""}`.trim()}
                            </Typography>
                            <Typography sx={{ mb: 2 }}>
                            <strong>NIF:</strong><br />{(cliente.nif || "").toUpperCase() || "—"}
                            </Typography>
                            {cliente.nombre_comercial && (
                            <Typography sx={{ mb: 2 }}>
                                <strong>Nombre comercial:</strong><br />{cliente.nombre_comercial}
                            </Typography>
                            )}
                        </>
                        )}

                        <Divider sx={{ my: 1 }} />
                        <Typography sx={{ maxWidth: 265 }}>
                        <strong>Dirección:</strong><br />
                        {cliente.direccion_calle || "—"}
                        {cliente.direccion_piso && `, Piso ${cliente.direccion_piso}`}
                        {cliente.direccion_puerta && `, Puerta ${cliente.direccion_puerta}`}
                        </Typography>
                        <Typography sx={{ maxWidth: 265 }}>
                        {(cliente.direccion_cp || "—")} {cliente.direccion_poblacion || ""}
                        {cliente.direccion_provincia ? `, ${cliente.direccion_provincia}` : ""}
                        </Typography>
                        <Typography sx={{ maxWidth: 265 }}>
                        {cliente.direccion_pais || "—"}
                        </Typography>
                    </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 3 }} sx={{ display: "flex" }}>
                    <Card variant="outlined" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <CardHeader sx={{ p: 1 }} title="Estructura y sector" />
                    <CardContent sx={{ maxWidth: 265 }}>
                        <Typography><strong>Sector principal:</strong> {cliente.vertical || "—"}</Typography>
                        <Typography><strong>Sector secundario:</strong> {cliente.vertical_secundaria || "—"}</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography><strong>Nº de empleados:</strong> {cliente.numero_empleados ?? "—"}</Typography>
                    </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 3 }} sx={{ display: "flex" }}>
                    <Card variant="outlined" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <CardHeader sx={{ p: 1 }} title="Datos comerciales" />
                    <CardContent sx={{ maxWidth: 265 }}>
                        {cliente.tipo_cliente === "empresa" && (
                        <>
                            <Typography><strong>Contacto:</strong> {cliente.contacto || "—"}</Typography>
                            <Typography><strong>Posición:</strong> {cliente.posicion || "—"}</Typography>
                        </>
                        )}
                        <Typography><PhoneIcon fontSize="small" sx={{ mr: 1 }} />{telFmt(cliente.telefono)}</Typography>
                        <Typography><EmailIcon fontSize="small" sx={{ mr: 1 }} />{cliente.correo || "—"}</Typography>
                    </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 3 }} sx={{ display: "flex" }}>
                    <Card variant="outlined" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <CardHeader sx={{ p: 1 }} title="Contacto financiero" />
                    <CardContent sx={{ maxWidth: 265 }}>
                        <Typography><strong>Persona:</strong> {cliente.contacto_financiero || "—"}</Typography>
                        <Typography><PhoneIcon fontSize="small" sx={{ mr: 1 }} />{telFmt(cliente.telefono_financiero || "")}</Typography>
                        <Typography><EmailIcon fontSize="small" sx={{ mr: 1 }} />{cliente.correo_financiero || "—"}</Typography>
                    </CardContent>
                    </Card>
                </Grid>
                </>
            )}
            </Grid>


        <Box mt={1} display="flex" justifyContent="flex-end">
          <Button variant="outlined" onClick={onEditar}>Editar información</Button>
        </Box>
      </CardContent>
    </Box>
  );
}
