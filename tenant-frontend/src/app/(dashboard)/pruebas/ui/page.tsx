"use client";

import * as React from "react";
import Link from "next/link";
import {
  AppBar,
  Toolbar,
  Container,
  Box,
  Stack,
  Grid,
  Typography,
  IconButton,
  Button,
  ButtonGroup,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  Chip,
  Tabs,
  Tab,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Avatar,
  Divider,
  Tooltip,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Breadcrumbs,
  Link as MUILink,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/Info";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CloseIcon from "@mui/icons-material/Close";
import { useColorMode } from "@/context/ThemeContext";// ajusta la ruta si cambia

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Stack spacing={1} mb={2}>
        <Typography variant="h6">{title}</Typography>
        {desc && (
          <Typography variant="body2" color="text.secondary">
            {desc}
          </Typography>
        )}
      </Stack>
      {children}
    </Paper>
  );
}

export default function StyleguidePage() {
  const theme = useTheme();
  const { mode, toggleColorMode } = useColorMode();

  // demo state
  const [tab, setTab] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [snack, setSnack] = React.useState<{ open: boolean; msg: string; type: "success" | "info" | "warning" | "error" }>({ open: false, msg: "", type: "success" });
  const [radio, setRadio] = React.useState("a");
  const [checked, setChecked] = React.useState(true);
  const [select, setSelect] = React.useState(10);
  const [slider, setSlider] = React.useState<number>(30);

  return (
    <Box>
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            UI Styleguide
          </Typography>
          <Breadcrumbs separator="/" sx={{ display: { xs: "none", md: "flex" } }}>
            <MUILink component={Link} href="/" underline="hover" color="inherit">
              Inicio
            </MUILink>
            <Typography color="text.primary">Styleguide</Typography>
          </Breadcrumbs>
          <Tooltip title={`Cambiar a modo ${mode === "light" ? "oscuro" : "claro"}`}> 
            <IconButton onClick={toggleColorMode} aria-label="toggle color mode">
              {mode === "light" ? <Brightness4Icon /> : <Brightness7Icon />}
            </IconButton>
          </Tooltip>
          <Badge color="secondary" badgeContent={3}>
            <IconButton aria-label="notificaciones">
              <InfoIcon />
            </IconButton>
          </Badge>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          {/* Tipografía y colores */}
          <Grid size={{xs:12,md:6}}>
            <Section title="Tipografía" desc="Jerarquía de títulos y textos.">
              <Stack spacing={1}>
                <Typography variant="h3">Título H3</Typography>
                <Typography variant="h5">Título H5</Typography>
                <Typography variant="subtitle1">Subtítulo</Typography>
                <Typography variant="body1">
                  Body1: Texto de ejemplo. El quick brown fox jumps over the lazy dog.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Body2: color secundario y espaciado de línea cómodo.
                </Typography>
              </Stack>
            </Section>
          </Grid>
          <Grid size={{xs:12,md:6}}>
            <Section title="Colores" desc="Primario, secundario y estados.">
              <Stack direction="row" spacing={2} flexWrap="wrap">
                {["primary", "secondary", "success", "warning", "error", "info"].map((c) => (
                  <Chip key={c} label={c} color={c as any} />
                ))}
                <Box sx={{ flexBasis: "100%", height: 8 }} />
                <Button variant="contained" color="primary" startIcon={<SaveIcon />}>Primary</Button>
                <Button variant="outlined" color="secondary">Secondary</Button>
                <Button color="inherit">Inherit</Button>
              </Stack>
            </Section>
          </Grid>

          {/* Controles */}
          <Grid size={{xs:12,md:6}}>
            <Section title="Controles" desc="Inputs, selects, radio, switches y sliders.">
              <Grid container spacing={2}>
                <Grid size={{xs:12,md:6}}>
                  <TextField fullWidth label="Buscar" placeholder="Escribe algo" InputProps={{ endAdornment: (
                    <InputAdornment position="end"><SearchIcon /></InputAdornment>
                  ) }} />
                </Grid>
                <Grid size={{xs:12,md:6}}>
                  <FormControl fullWidth>
                    <InputLabel>Opción</InputLabel>
                    <Select label="Opción" value={select} onChange={(e) => setSelect(Number(e.target.value))}>
                      <MenuItem value={10}>Diez</MenuItem>
                      <MenuItem value={20}>Veinte</MenuItem>
                      <MenuItem value={30}>Treinta</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{xs:12,md:6}}>
                  <FormGroup>
                    <FormControlLabel control={<Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />} label="Checkbox" />
                    <FormControlLabel control={<Switch checked={checked} onChange={(e) => setChecked(e.target.checked)} />} label="Switch" />
                  </FormGroup>
                </Grid>
                <Grid size={{xs:12,md:6}}>
                  <RadioGroup row value={radio} onChange={(e) => setRadio(e.target.value)}>
                    <FormControlLabel value="a" control={<Radio />} label="A" />
                    <FormControlLabel value="b" control={<Radio />} label="B" />
                    <FormControlLabel value="c" control={<Radio />} label="C" />
                  </RadioGroup>
                  <Box px={1} pt={2}>
                    <Slider value={slider} onChange={(_, v) => setSlider(v as number)} />
                  </Box>
                </Grid>
              </Grid>
            </Section>
          </Grid>

          {/* Tabs y chips */}
          <Grid size={{xs:12,md:6}}>
            <Section title="Tabs & Chips" desc="Navegación y etiquetas.">
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab label="General" />
                <Tab label="Detalles" />
                <Tab label="Ajustes" />
              </Tabs>
              <Stack direction="row" spacing={1}>
                <Chip label="Activo" color="success" icon={<CheckCircleIcon />} />
                <Chip label="Pendiente" color="warning" icon={<WarningAmberIcon />} variant="outlined" />
                <Chip label="Info" icon={<InfoIcon />} />
              </Stack>
            </Section>
          </Grid>

          {/* Cards */}
          <Grid size={{xs:12,md:6}}>
            <Section title="Cards" desc="Composición de tarjeta con header, contenido y acciones.">
              <Grid container spacing={2}>
                {[1, 2, 3].map((i) => (
                  <Grid size={{xs:12,md:6}} key={i}>
                    <Card>
                      <CardHeader avatar={<Avatar>{i}</Avatar>} title={`Card #${i}`} subheader="Subtítulo" />
                      <CardContent>
                        <Typography variant="body2" color="text.secondary">
                          Esta es una tarjeta de demostración para comprobar colores, sombras y bordes.
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button size="small" startIcon={<InfoIcon />}>Detalles</Button>
                        <Button size="small" color="error" startIcon={<DeleteIcon />}>Borrar</Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Section>
          </Grid>

          {/* Tabla */}
          <Grid size={{xs:12,md:6}}>
            <Section title="Tabla" desc="Cabeceras, filas y estilos de celda.">
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nombre</TableCell>
                      <TableCell align="right">Edad</TableCell>
                      <TableCell>Rol</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[{ n: "Ana", e: 30, r: "Manager" }, { n: "Luis", e: 24, r: "Empleado" }, { n: "Sara", e: 28, r: "Ventas" }].map((row, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>{row.n}</TableCell>
                        <TableCell align="right">{row.e}</TableCell>
                        <TableCell>{row.r}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Section>
          </Grid>

          {/* Feedback y diálogos */}
          <Grid size={{xs:12,md:6}}>
            <Section title="Feedback" desc="Alertas, snackbars y tooltips.">
              <Stack spacing={2}>
                <Alert icon={<InfoIcon fontSize="inherit" />} severity="info">
                  Información general del sistema.
                </Alert>
                <Alert severity="success">Operación completada correctamente.</Alert>
                <Alert severity="warning">Atención con esta acción.</Alert>
                <Alert severity="error">Ha ocurrido un error.</Alert>
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Guardar cambios">
                    <Button startIcon={<SaveIcon />} variant="contained" onClick={() => setSnack({ open: true, msg: "Guardado", type: "success" })}>
                      Guardar
                    </Button>
                  </Tooltip>
                  <Tooltip title="Abrir diálogo">
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
                      Abrir diálogo
                    </Button>
                  </Tooltip>
                </Stack>
              </Stack>
            </Section>
          </Grid>
          <Grid size={{xs:12,md:6}}>
            <Section title="Grupos de botones" desc="Variantes y tamaños.">
              <Stack spacing={2}>
                <ButtonGroup>
                  <Button>Izq</Button>
                  <Button>Centro</Button>
                  <Button>Der</Button>
                </ButtonGroup>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button size="small" variant="text">Text</Button>
                  <Button size="small" variant="outlined">Outlined</Button>
                  <Button size="small" variant="contained">Contained</Button>
                </Stack>
              </Stack>
            </Section>
          </Grid>
                  {/* Accent / Acento cálido */}
          <Grid size={{xs:12,md:6}}>
            <Section title="Acento (accent)" desc="Elementos usando el color accent (terracota) junto al verde principal.">
              <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
                <Button color="accent" variant="contained">Botón Accent</Button>
                <Button color="accent" variant="outlined">Outlined Accent</Button>
                <Button color="primary" variant="contained">Primario</Button>
              </Stack>
              <Box mt={2}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip color="accent" label="Chip Accent" />
                  <Chip color="primary" label="Chip Primario" />
                  <Chip label="Chip por defecto" />
                </Stack>
              </Box>
              <Box mt={2}>
                <Alert color="accent" variant="filled">Alerta con acento</Alert>
              </Box>
            </Section>
          </Grid>
        </Grid>
      </Container>

      {/* Diálogo de ejemplo */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Diálogo de ejemplo</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            Usa este modal para revisar estilos de cabecera, separadores y acciones.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} startIcon={<CloseIcon />}>Cerrar</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={() => setSnack({ open: true, msg: "Acción confirmada", type: "success" })}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.type}
          variant="filled"
          iconMapping={{ success: <CheckCircleIcon />, warning: <WarningAmberIcon />, error: <WarningAmberIcon />, info: <InfoIcon /> }}
          sx={{ minWidth: 240 }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
