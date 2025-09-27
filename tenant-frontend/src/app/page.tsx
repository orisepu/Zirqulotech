'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AppBar, Toolbar, Typography, Button, Container, Box, Grid, Paper, Stack,
  Chip, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import TimelineIcon from '@mui/icons-material/Timeline'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import StorefrontIcon from '@mui/icons-material/Storefront'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import GppGoodIcon from '@mui/icons-material/GppGood'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'

export default function HomePage() {
  const [open, setOpen] = useState(false)
  const [snack, setSnack] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', mensaje: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = () => {
    console.log('Formulario enviado:', form) // TODO: POST a /api/contacto/
    setOpen(false)
    setSnack(true)
    setForm({ nombre: '', email: '', mensaje: '' })
  }

  return (
    <main>
      {/* NAVBAR */}
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={700}>Zirqulotech</Typography>
          <Box>
            <Button component={Link} href="/login" color="primary">Login</Button>
            <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
              Contáctanos
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* HERO */}
      <Box component="section" sx={{ bgcolor: 'background.default', color: 'text.primary', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid size={{xs:12, md:6}} >
              <Stack spacing={2} mb={2}>
                <Chip label="Impulsa tus ventas con recompra" color="primary" variant="outlined" />
                <Typography component="h1" variant="h3" fontWeight={700}>
                  Recompra para tus clientes, <br />trazabilidad para tu negocio
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  Te ayudamos a cerrar ventas recomprando los equipos de tus clientes. Toda la operación
                  queda registrada: entrada, auditoría, oferta, <strong>firma electrónica</strong> y pago.
                </Typography>
              </Stack>
            </Grid>

            <Grid size={{xs:12, md:6}}>
              <Box sx={{
                position: 'relative', width: '100%', aspectRatio: '16 / 10',
                borderRadius: 3, overflow: 'hidden', boxShadow: 3, bgcolor: 'background.paper'
              }}>
                <Image src="/imagenes/web.webp" alt="Recompra con trazabilidad" fill style={{ objectFit: 'cover' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* PARA QUIÉN */}
      <Box component="section" sx={{ py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={700} gutterBottom>¿Para quién?</Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            Pensado para tiendas, SATs y cadenas que quieren convertir mejor ofreciendo recompra inmediata al cliente.
          </Typography>

          <Grid container spacing={3}>
            {[
              { icon: <StorefrontIcon color="primary" />, title: 'Tiendas y cadenas', desc: 'Integra la recompra en tu venta diaria y aumenta la conversión.' },
              { icon: <PersonAddIcon color="primary" />, title: 'Comerciales', desc: 'Cierra operaciones en el acto con oferta y firma en el mismo flujo.' },
              { icon: <ReceiptLongIcon color="primary" />, title: 'Administración', desc: 'Documentación completa: comprobantes, ofertas y facturas vinculadas.' },
            ].map((b, i) => (
              <Grid key={i} size={{xs:12, md:4}}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Stack spacing={1.5}>
                    {b.icon}
                    <Typography variant="h6" fontWeight={700}>{b.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{b.desc}</Typography>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
      {/* COMISIÓN POR EQUIPO RECOMPRADO */}
      <Box component="section" sx={{ py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="stretch">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={1.5}>
                <Chip label="Modelo de ingresos" color="primary" variant="outlined" sx={{ alignSelf: 'flex-start' }} />
                <Typography variant="h4" fontWeight={700}>Comisión por equipo recomprado</Typography>
                <Typography variant="body1" color="text.secondary">
                  Cada dispositivo que recompramos genera una <strong>comisión</strong> para tu negocio. 
                  La configuramos contigo y queda vinculada a cada operación con total trazabilidad.
                </Typography>

                <Stack spacing={1.25} sx={{ mt: 1 }}>
                  
                    
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <CheckCircleIcon color="primary" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      <strong>Liquidación transparente:</strong> resumen por periodo, reportes y soporte de auditoría.
                    </Typography>
                  </Stack>
                </Stack>

                <Box sx={{ mt: 2 }}>
                  <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
                    Solicitar información
                  </Button>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle1" fontWeight={700}>¿Cómo se refleja?</Typography>
                  <Typography variant="body2" color="text.secondary">
                    La comisión queda registrada en la operación (oferta firmada y cierre), 
                    se incluye en los <em>reports</em> y en la liquidación de periodo.
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
      {/* FIRMA ELECTRÓNICA */}
      <Box id="firma-electronica" component="section" sx={{ py: { xs: 8, md: 10 }, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Stack spacing={1}>
            <Typography variant="h4" fontWeight={700}>Firma electrónica para particulares</Typography>
            <Typography variant="body1" color="text.secondary">
              Evita el papel y formaliza la operación en segundos. El cliente firma digitalmente la aceptación de la oferta
              y las condiciones de recompra, con validación por OTP y registro de evidencias.
            </Typography>
          </Stack>

          <Grid container spacing={3} mt={1}>
            {[
              { n: '01', t: 'Genera la oferta', d: 'Precio final tras auditoría y verificación del dispositivo.' },
              { n: '02', t: 'Envío para firmar', d: 'El particular recibe el enlace seguro y valida por OTP.' },
              { n: '03', t: 'Evidencias y sello', d: 'Queda constancia de identidad, IP, sello temporal y documento.' },
              { n: '04', t: 'Pago y cierre', d: 'Se libera el pago y se anexa la documentación al expediente.' },
            ].map(step => (
              <Grid key={step.n} size={{xs:12, md:3}}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Typography variant="overline" color="primary">{step.n}</Typography>
                  <Typography variant="h6" fontWeight={700}>{step.t}</Typography>
                  <Typography variant="body2" color="text.secondary">{step.d}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <GppGoodIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  Contrato digital y evidencias vinculadas a cada operación
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        </Container>
      </Box>

      {/* TRAZABILIDAD TOTAL */}
      <Box component="section" sx={{ py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={700} gutterBottom>Trazabilidad de punta a punta</Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            Visualiza el estado y las evidencias en cada paso: entrada del equipo, auditoría real (IMEI/SN),
            oferta final, firma, pago y logística.
          </Typography>

          <Grid container spacing={3}>
            {[
              { icon: <TimelineIcon color="primary" />, title: 'Estados y eventos', desc: 'Cada cambio queda registrado con fecha, usuario y comentarios.' },
              { icon: <VerifiedUserIcon color="primary" />, title: 'Documentos anexos', desc: 'Contrato firmado, comprobantes, facturas y evidencias centralizadas.' },
              { icon: <LocalShippingIcon color="primary" />, title: 'Seguimiento', desc: 'Nº de seguimiento, recogidas y entregas visibles para tu equipo.' },
            ].map((b, i) => (
              <Grid key={i} size={{xs:12, md:4}}>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, height: '100%' }}>
                  <Stack spacing={1.5}>
                    {b.icon}
                    <Typography variant="h6" fontWeight={700}>{b.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{b.desc}</Typography>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA FINAL */}
      <Box component="section" sx={{ py: { xs: 8, md: 10 }, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{xs:12, md:8}}>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  ¿Listo para impulsar tus ventas con recompra?
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Accede y configura tu flujo con firma electrónica y trazabilidad total.
                </Typography>
              </Grid>
              <Grid size={{xs:12, md:4}} textAlign={{ xs: 'left', md: 'right' }}>
                <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
              Contáctanos
            </Button>
              </Grid>
            </Grid>
          </Paper>

          <Divider sx={{ my: 6 }} />
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
            © {new Date().getFullYear()} Zirqulo S.L · Todos los derechos reservados
          </Typography>
        </Container>
      </Box>
      {/* DIALOGO DE CONTACTO */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Contáctanos</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" label="Nombre" name="nombre" value={form.nombre} onChange={handleChange} />
          <TextField fullWidth margin="normal" label="Email" type="email" name="email" value={form.email} onChange={handleChange} />
          <TextField fullWidth margin="normal" label="Mensaje" multiline rows={4} name="mensaje" value={form.mensaje} onChange={handleChange} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit}>Enviar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack} autoHideDuration={4000} onClose={() => setSnack(false)} message="¡Gracias! Te contactaremos pronto." />
    </main>
  )
}
