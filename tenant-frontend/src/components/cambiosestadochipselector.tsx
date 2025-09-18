// [código nuevo]
import React from 'react';
import {
  Chip, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip, Divider,
  Box, Grid, Button, TextField, FormControl, InputLabel, Select, MenuItem as SelectItem
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckIcon from '@mui/icons-material/Check';
import { ESTADOS_META } from '@/context/estados';

type Extras = { plazo_pago_dias: number } | { numero_seguimiento: string; url_seguimiento: string } | undefined;

function EstadoChipSelector({
  estadoActual,
  anteriores,
  siguientes,
  onSelect,
  disabledItem,
  getTooltip: _getTooltip,
}: {
  estadoActual: string;
  anteriores: string[];
  siguientes: string[];
  onSelect: (nuevoEstado: string, extras?: Extras) => void; // ← admite extras opcionales
  disabledItem?: (estado: string) => boolean;
  getTooltip?: (estado: string) => React.ReactNode;
}) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Estado tentativo seleccionado desde el menú (no confirmado)
  const [tentativo, setTentativo] = React.useState<string>('');
  // Datos extra inline
  const [plazo, setPlazo] = React.useState<number>(30);
  const [segNum, setSegNum] = React.useState<string>('');
  const [segUrl, setSegUrl] = React.useState<string>('');

  const IconoActual = ESTADOS_META[estadoActual]?.icon;
  const colorActual = ESTADOS_META[estadoActual]?.color || 'default';

  const handleClose = () => {
    setAnchorEl(null);
    setTentativo('');
    setSegNum('');
    setSegUrl('');
    setPlazo(30);
  };

  const requiereExtras = (estado: string) =>
    estado === 'Pendiente de pago' || estado === 'Recogida generada';

  const confirmar = () => {
    if (!tentativo) return;

    // Validaciones mínimas
    if (tentativo === 'Recogida generada' && (!segNum.trim() || !segUrl.trim())) {
      // console.debug('Faltan datos de seguimiento'); // quitar en producción
      return;
    }

    const extras =
      tentativo === 'Pendiente de pago'
        ? { plazo_pago_dias: plazo }
        : tentativo === 'Recogida generada'
        ? { numero_seguimiento: segNum, url_seguimiento: segUrl }
        : undefined;

    onSelect(tentativo, extras); // ← devolvemos extras al padre
    handleClose();
  };

  // Construir lista de items
  const buildItem = (estado: string, tipo: 'anterior' | 'siguiente') => {
    const Icono = ESTADOS_META[estado]?.icon;
    const disabled = disabledItem?.(estado) ?? false;
    const title = _getTooltip ? _getTooltip(estado) : (tipo === 'anterior' ? 'Estado anterior' : 'Estado siguiente');

    return (
      <Tooltip key={`${tipo}-${estado}`} title={title as React.ReactNode} placement="left">
        <MenuItem
          disabled={disabled}
          onClick={() => {
            if (requiereExtras(estado)) {
              // Abrimos UI inline sin cerrar el menú
              setTentativo(estado);
              // console.debug('Seleccion tentativo', estado); // quitar en producción
            } else {
              onSelect(estado);
              handleClose();
            }
          }}
        >
          {Icono && (
            <ListItemIcon>
              <Icono fontSize="small" />
            </ListItemIcon>
          )}
          <ListItemText primary={estado} />
        </MenuItem>
      </Tooltip>
    );
  };

  return (
    <>
      {/** Share handler to avoid any cast */}
      {/**/}
      
      <Chip
        icon={IconoActual ? <IconoActual /> : undefined}
        label={estadoActual}
        color={colorActual}
        onClick={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
        onDelete={(e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
        deleteIcon={<ArrowDropDownIcon />}
        sx={{
          fontWeight: 'bold',
          height: 40,
          '& .MuiChip-label': { fontSize: '0.95rem', fontWeight: 600 },
        }}
      />

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {/* Anteriores */}
        {anteriores.map((e) => buildItem(e, 'anterior'))}
        {anteriores.length > 0 && <Divider />}

        {/* Actual */}
        <MenuItem disabled>
          <ListItemIcon>
            <CheckIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={estadoActual} secondary="Actual" />
        </MenuItem>

        <Divider />

        {/* Siguientes */}
        {siguientes.map((e) => buildItem(e, 'siguiente'))}

        {/* —— UI inline de extras —— */}
        {tentativo &&
                  [
                    // 👇 Importante: array con keys, NO Fragment
                    <Divider key="div-extras" />,
                    <Box key="box-extras" sx={{ p: 2, width: 340 }}>
                      {tentativo === 'Pendiente de pago' && (
                        <FormControl fullWidth>
                          <InputLabel>Plazo de pago (días)</InputLabel>
                          <Select
                            label="Plazo de pago (días)"
                            value={plazo}
                            onChange={(e) => setPlazo(Number(e.target.value))}
                          >
                            {[7, 15, 30, 60, 90].map((d) => (
                              <SelectItem key={d} value={d}>
                                {d} días
                              </SelectItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
        
                      {tentativo === 'Recogida generada' && (
                        <Grid container spacing={1}>
                          <Grid size={{xs:12 ,sm:5}} >
                            <TextField
                              fullWidth
                              label="Nº seguimiento"
                              value={segNum}
                              onChange={(e) => setSegNum(e.target.value)}
                            />
                          </Grid>
                          <Grid size={{xs:12 ,sm:7}}>
                            <TextField
                              fullWidth
                              label="URL seguimiento"
                              value={segUrl}
                              onChange={(e) => setSegUrl(e.target.value)}
                            />
                          </Grid>
                        </Grid>
                      )}
        
                      <Box sx={{ mt: 2, display: 'flex,', gap: 1, justifyContent: 'flex-end' }}>
                        <Button variant="text" onClick={handleClose}>
                          Cancelar
                        </Button>
                        <Button
                          variant="contained"
                          onClick={confirmar}
                          disabled={
                            tentativo === 'Recogida generada' &&
                            (!segNum.trim() || !segUrl.trim())
                          }
                        >
                          Guardar
                        </Button>
                      </Box>
                    </Box>,
                  ]}
              </Menu>
            </>
          );
        }

export default EstadoChipSelector;
// [código nuevo]
