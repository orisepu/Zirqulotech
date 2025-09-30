import {
  TextField,
  Grid,
  Button,
  Card,
  CardContent,
  Typography,
  Divider,
  Box,
} from "@mui/material";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import api from '@/services/api';

export default function DatosRecogidaForm({
  id,
  datos,
  onChange,
  generarOrden,
  rellenarDesdeOportunidad,
  oportunidad: oportunidadProp,
}: any) {
  const queryClient = useQueryClient();
  const oportunidad =
    oportunidadProp ?? queryClient.getQueryData(['oportunidad', id]);

  const searchParams = useSearchParams();
  const schemaParam =
    oportunidad?.schema ||
    searchParams?.get('tenant') ||
    searchParams?.get('schema') ||
    undefined;

  const esB2C = oportunidad?.cliente?.tipo_cliente === 'particular';
  const tiendaId =
    oportunidad?.tienda_id || oportunidad?.tienda || oportunidad?.tiendaId;

  const {
    data: tienda,
    refetch: refetchTienda,
    isFetching: cargandoTienda,
  } = useQuery({
    queryKey: ['tienda', tiendaId, schemaParam],
    queryFn: async () => {
      const url = schemaParam
        ? `/api/tiendas/${tiendaId}/?schema=${encodeURIComponent(schemaParam)}`
        : `/api/tiendas/${tiendaId}/`;
      const res = await api.get(url);
      return res.data;
    },
    enabled: !!tiendaId,
  });

  const aplicarDatosTienda = (t: any) => {
    if (!t) return;
    onChange('calle', t.direccion_calle || '');
    onChange('piso', t.direccion_piso || '');
    onChange('puerta', t.direccion_puerta || '');
    onChange('codigo_postal', t.direccion_cp || '');
    onChange('poblacion', t.direccion_poblacion || '');
    onChange('provincia', t.direccion_provincia || '');
    onChange('pais', t.direccion_pais || '');
    // opcional: si faltan contactos, intenta completar desde responsable
    if (!datos.correo_recogida && t.responsable_email) {
      onChange('correo_recogida', t.responsable_email);
    }
  };

    return (
      <Card elevation={3}>
        <CardContent>
        

          <Typography variant="subtitle1" gutterBottom>
            Dirección
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{xs:12, sm:6}}>
              <TextField
                label="Calle y número"
                fullWidth
                value={datos.calle || ""}
                onChange={(e) => onChange("calle", e.target.value)}
              />
            </Grid>
            
            <Grid size={{xs:4, sm:2}}>
              <TextField
                label="Piso"
                fullWidth
                value={datos.piso || ""}
                onChange={(e) => onChange("piso", e.target.value)}
              />
            </Grid>
            <Grid size={{xs:4, sm:2}}>
              <TextField
                label="Puerta"
                fullWidth
                value={datos.puerta || ""}
                onChange={(e) => onChange("puerta", e.target.value)}
              />
            </Grid>

            <Grid size={{xs:6, sm:4}}>
              <TextField
                label="Código Postal"
                fullWidth
                value={datos.codigo_postal || ""}
                onChange={(e) => onChange("codigo_postal", e.target.value)}
              />
            </Grid>
            <Grid size={{xs:6, sm:4}}>
              <TextField
                label="Población"
                fullWidth
                value={datos.poblacion || ""}
                onChange={(e) => onChange("poblacion", e.target.value)}
              />
            </Grid>
            <Grid size={{xs:12, sm:4}}>
              <TextField
                label="Provincia"
                fullWidth
                value={datos.provincia || ""}
                onChange={(e) => onChange("provincia", e.target.value)}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" gutterBottom>
            Contacto
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{xs:12, sm:6}}>
              <TextField
                label="Persona de contacto"
                fullWidth
                value={datos.persona_contacto || ""}
                onChange={(e) => onChange("persona_contacto", e.target.value)}
              />
            </Grid>
            <Grid size={{xs:12, sm:6}}>
              <TextField
                label="Teléfono"
                fullWidth
                value={datos.telefono_contacto || ""}
                onChange={(e) => onChange("telefono_contacto", e.target.value)}
              />
            </Grid>
            <Grid size={{xs:12, sm:6}}>
              <TextField
                label="Correo"
                fullWidth
                value={datos.correo_recogida || ""}
                onChange={(e) => onChange("correo_recogida", e.target.value)}
              />
            </Grid>
          </Grid>
            <Divider sx={{ my: 3 }} />
          <Grid container spacing={2}>
            <Grid size={{xs:12}}>
              <TextField
                label="Instrucciones adicionales"
                fullWidth
                multiline
                minRows={3}
                sx={{ width: '100%', minWidth: 745 }}
                value={datos.instrucciones || ""}
                onChange={(e) => onChange("instrucciones", e.target.value)}
                placeholder="Horario de recogida, contacto secundario, etc."
              />
            </Grid>
        </Grid>

          <Grid container justifyContent="flex-end" mt={3}>
            <Grid >
              {!datos.calle && !datos.codigo_postal && (
                <Box display="flex" justifyContent="flex-end" mb={2} gap={1} flexWrap="wrap">
                  <Button
                    variant="outlined"
                    onClick={() => {
                      if (!oportunidad) return;
                      // En B2C interpretamos esto como “datos del cliente”.
                      // En B2B sigue siendo “datos fiscales”.
                      rellenarDesdeOportunidad?.(oportunidad);
                    }}
                  >
                    {esB2C ? 'Usar datos del cliente' : 'Usar datos fiscales'}
                  </Button>

                  {esB2C && (
                    <Button
                      variant="outlined"
                      disabled={!tiendaId || cargandoTienda}
                      onClick={async () => {
                        if (!tiendaId) return;
                        const t = tienda ?? (await refetchTienda()).data;
                        aplicarDatosTienda(t);
                      }}
                    >
                      {cargandoTienda ? 'Cargando tienda…' : 'Usar datos de la tienda'}
                    </Button>
                  )}
                </Box>
              )}

              {generarOrden && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={generarOrden}
                  disabled={
                    !datos.calle ||
                    !datos.codigo_postal ||
                    !datos.poblacion ||
                    !datos.provincia
                  }
                >
                  Generar orden de recogida
                </Button>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
}
