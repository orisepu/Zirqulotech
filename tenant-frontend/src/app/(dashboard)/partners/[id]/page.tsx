'use client'

import { useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import api, { fetchTotalPagado } from '@/services/api'
import {
  Typography, Box, Paper, CircularProgress, Grid,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, Avatar,
  TextField, IconButton, LinearProgress, Menu, MenuItem, Chip, Select, InputLabel, FormControl,
  Stack, Card, CardContent, Fab, Alert, alpha
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import StorefrontIcon from '@mui/icons-material/Storefront'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import BusinessIcon from '@mui/icons-material/Business'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import GroupIcon from '@mui/icons-material/Group'
import EuroIcon from '@mui/icons-material/Euro'
import PercentIcon from '@mui/icons-material/Percent'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import WebIcon from '@mui/icons-material/Web'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import SettingsIcon from '@mui/icons-material/Settings'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { toast } from 'react-toastify'
import SecurityIcon from '@mui/icons-material/Security'
import ScienceIcon from '@mui/icons-material/Science'
import { useUsuario } from '@/context/UsuarioContext'
import { Switch, FormControlLabel } from '@mui/material'

function computeEffectiveNamespaces(p: any): string[] {
  const ns: string[] = []
  if (p?.management_mode === 'autoadmin' && p?.uuid) ns.push(`tenant:${p.uuid}`)
  if (p?.legal_namespace) ns.push(p.legal_namespace)
  ns.push('default')
  // únicos manteniendo orden
  const seen = new Set<string>()
  return ns.filter(x => (seen.has(x) ? false : (seen.add(x), true)))
}

function managementLabel(mode?: string) {
  return mode === 'autoadmin' ? 'Autoadministrado' : 'Gestionado'
}
function getCommissionPercent(p: any): number {
  const raw = p?.comision_porcentaje ?? p?.comision_percent ?? p?.comision_pct
  const n = Number(raw)
  return Number.isFinite(n) ? n : 10
}

export default function PartnerDetailPage() {
  const { id } = useParams()
  const idStr = String(id ?? '')
  const isNumericId = /^[0-9]+$/.test(idStr)
  const partnerEndpoint = isNumericId ? `/api/tenants/${idStr}/` : `/api/tenants/by-schema/${idStr}/`

  const [modalOpen, setModalOpen] = useState<string | null>(null)
  const [formData, setFormData] = useState<any>({})

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const openMenu = Boolean(anchorEl)
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const handleCloseMenu = () => setAnchorEl(null)
  const [editMode, setEditMode] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()
  const usuario = useUsuario()
  const acuerdoFileInputRef = useRef<HTMLInputElement | null>(null)
  const [subiendoAcuerdo, setSubiendoAcuerdo] = useState(false)
  const [descargandoAcuerdo, setDescargandoAcuerdo] = useState(false)
  const logoFileInputRef = useRef<HTMLInputElement | null>(null)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [cargandoLogo, setCargandoLogo] = useState(false)

  const { data: partner, isLoading: loading, error } = useQuery({
    queryKey: ['partner', idStr],
    queryFn: () => api.get(partnerEndpoint).then(res => res.data),
    enabled: !!idStr,
  })

  const { data: dashboard } = useQuery({
    queryKey: ['dashboardTotalPagado', partner?.schema],
    queryFn: () =>
      fetchTotalPagado({
        usuario_id: undefined,
        tienda_id: undefined,
        fecha_inicio: '2024-01-01',
        fecha_fin: '2025-12-31',
        schema: partner.schema,
      }),
    enabled: !!partner?.schema,
  })

  const openModal = (section: string) => {
    setFormData(partner)
    setModalOpen(section)
  }

  const closeModal = () => {
    setModalOpen(null)
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const { mutate: updatePartner, isPending: saving } = useMutation({
    mutationFn: (data: any) => {
      // Siempre usar el endpoint con ID numérico para PUT
      const updateEndpoint = `/api/tenants/${data.id}/`
      return api.put(updateEndpoint, data)
    },
    onSuccess: async (response) => {
      // response.data contiene los datos actualizados devueltos por el servidor
      queryClient.setQueryData(['partner', idStr], response.data)
      // Invalidar TODAS las queries relacionadas con este partner
      await queryClient.invalidateQueries({ queryKey: ['partner', idStr] })
      // También invalidar por ID si estamos usando schema
      if (!isNumericId && response.data?.id) {
        await queryClient.invalidateQueries({ queryKey: ['partner', String(response.data.id)] })
      }
      closeModal()
      toast.success('Partner actualizado correctamente')
    },
    onError: (error) => {
      console.error(error)
      toast.error('Error al guardar los cambios')
    },
  })

  const subirAcuerdoPdf = async (file: File) => {
    if (!partner?.id) return
    const formDataUpload = new FormData()
    formDataUpload.append('acuerdo_empresas_pdf', file)
    setSubiendoAcuerdo(true)
    try {
      const { data } = await api.post(`/api/tenants/${partner.id}/agreement/`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      queryClient.setQueryData(['partner', idStr], (prev: any) => (
        prev ? { ...prev, ...data } : prev
      ))
      await queryClient.invalidateQueries({ queryKey: ['partner', idStr] })
      toast.success('PDF del acuerdo actualizado')
    } catch (err) {
      console.error(err)
      toast.error('No se pudo subir el PDF del acuerdo')
    } finally {
      setSubiendoAcuerdo(false)
      if (acuerdoFileInputRef.current) {
        acuerdoFileInputRef.current.value = ''
      }
    }
  }

  const onAgreementFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.type && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('El archivo debe ser un PDF')
      return
    }
    const maxBytes = 10 * 1024 * 1024
    if (file.size > maxBytes) {
      toast.error('El PDF no puede superar los 10 MB')
      return
    }
    void subirAcuerdoPdf(file)
  }

  const descargarAcuerdoPdf = async () => {
    if (!partner?.acuerdo_empresas_pdf_url) {
      toast.info('No hay un PDF del acuerdo disponible')
      return
    }
    setDescargandoAcuerdo(true)
    try {
      const response = await api.get(partner.acuerdo_empresas_pdf_url, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/pdf',
      })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = partner.acuerdo_empresas_pdf_nombre || `acuerdo-${partner.id}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo descargar el PDF del acuerdo')
    } finally {
      setDescargandoAcuerdo(false)
    }
  }

  const subirLogoImagen = async (file: File) => {
    if (!partner?.id) return
    const formDataUpload = new FormData()
    formDataUpload.append('logo', file)
    setSubiendoLogo(true)
    try {
      const { data } = await api.post(`/api/tenants/${partner.id}/logo/`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      queryClient.setQueryData(['partner', idStr], (prev: any) => (
        prev ? { ...prev, ...data } : prev
      ))
      await queryClient.invalidateQueries({ queryKey: ['partner', idStr] })
      toast.success('Logo actualizado')
    } catch (err) {
      console.error(err)
      toast.error('No se pudo subir el logo')
    } finally {
      setSubiendoLogo(false)
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = ''
      }
    }
  }

  const onLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|svg)$/i)) {
      toast.error('El archivo debe ser una imagen (PNG, JPG o SVG)')
      return
    }
    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) {
      toast.error('La imagen no puede superar los 5 MB')
      return
    }
    void subirLogoImagen(file)
  }

  const cargarLogoPreview = async (logoUrl: string) => {
    setCargandoLogo(true)
    try {
      const response = await api.get(logoUrl, {
        responseType: 'blob',
      })
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'image/jpeg',
      })
      const objectUrl = window.URL.createObjectURL(blob)
      setLogoPreviewUrl(objectUrl)
    } catch (err) {
      console.error('Error cargando preview del logo:', err)
      setLogoPreviewUrl(null)
    } finally {
      setCargandoLogo(false)
    }
  }

  // Cargar logo preview cuando cambie partner.logo_url
  React.useEffect(() => {
    const objectUrl: string | null = null

    if (partner?.logo_url) {
      void cargarLogoPreview(partner.logo_url)
    } else {
      setLogoPreviewUrl(null)
    }

    // Cleanup al desmontar o cuando cambie logo_url
    return () => {
      if (logoPreviewUrl) {
        window.URL.revokeObjectURL(logoPreviewUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.logo_url])

  const handleSave = async () => {
    const payload = { ...formData }

    // Mapear 'name' del form al campo del backend (el modelo Company usa 'name')
    // El backend devuelve 'nombre' pero acepta 'name' en el serializer
    if (payload.name !== undefined) {
      // El serializer espera 'name', no 'nombre'
      // No necesitamos hacer nada, ya está correcto
    }

    // Si el usuario ha editado overrides como texto, intentamos parsear a objeto
    if (typeof payload.legal_overrides === 'string') {
      try {
        payload.legal_overrides = payload.legal_overrides.trim()
          ? JSON.parse(payload.legal_overrides)
          : {}
      } catch (e) {
        toast.error('El JSON de overrides no es válido. Revisa el formato.')
        return
      }
    }
    if (!partner?.id) {
      console.error('No partner ID available to actualizar')
      return
    }
    updatePartner({ ...payload, id: partner.id })
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={48} />
      </Box>
    )
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 4, mx: 3 }}>
        Error al cargar el partner. Inténtalo de nuevo.
      </Alert>
    )
  }

  if (!partner) return null

  const acuerdoPdfUrl = partner.acuerdo_empresas_pdf_url ?? null
  const totalPagado = dashboard?.total_pagado || 0;
  const porcentaje = partner.goal
    ? Math.min((totalPagado / partner.goal) * 100, 100)
    : 0;
  const comisionPercent = getCommissionPercent(partner);
  const comisionGenerada = (Number(totalPagado) * (comisionPercent / 100)) || 0;

  return (
    <Box sx={{ py: 3, maxWidth: '100vw' }}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={4} sx={{ px: 3 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton onClick={() => router.back()}>
              <ArrowBackIcon />
            </IconButton>
            <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
              <BusinessIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" gutterBottom>
                {partner.nombre}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  label={managementLabel(partner.management_mode)}
                  color={partner.management_mode === 'autoadmin' ? 'success' : 'default'}
                  variant="outlined"
                />
                <Typography variant="body2" color="text.secondary">
                  Schema: {partner.schema}
                </Typography>
              </Stack>
            </Box>
          </Box>

          <Stack direction="row" spacing={1}>
            {editMode && (
              <Fab
                size="small"
                color="secondary"
                onClick={() => setEditMode(false)}
              >
                <EditIcon />
              </Fab>
            )}
            <IconButton onClick={handleOpenMenu}>
              <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={anchorEl} open={openMenu} onClose={handleCloseMenu}>
              <MenuItem onClick={() => { setEditMode(prev => !prev); handleCloseMenu() }}>
                <EditIcon sx={{ mr: 1 }} />
                {editMode ? "Cancelar edición" : "Editar"}
              </MenuItem>
              <MenuItem onClick={() => { openModal('legales'); handleCloseMenu() }}>
                <SettingsIcon sx={{ mr: 1 }} />
                Gestión
              </MenuItem>
              <MenuItem onClick={() => {
                  router.push(`/partners/${partner.id}/usuarios?schema=${partner.schema}`)
                  handleCloseMenu()
                }}
              >
                <GroupIcon sx={{ mr: 1 }} />
                Usuarios
              </MenuItem>
              <MenuItem onClick={() => {
                  router.push(`/partners/${partner.id}/tiendas?schema=${partner.schema}`)
                  handleCloseMenu()
                }}
              >
                <StorefrontIcon sx={{ mr: 1 }} />
                Tiendas
              </MenuItem>
              {usuario?.es_superadmin && (
                <MenuItem
                  onClick={() => {
                    router.push(`/partners/${partner.id}/permisos?schema=${partner.schema}`)
                    handleCloseMenu()
                  }}
                >
                  <SecurityIcon sx={{ mr: 1 }} />
                  Permisos
                </MenuItem>
              )}
            </Menu>
          </Stack>
        </Box>

        {/* KPI Cards and Agreement */}
        <Grid container spacing={3} sx={{ mb: 4, px: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 1 }}>
                  <EuroIcon />
                </Avatar>
                <Typography variant="h5" color="primary.main">
                  {Number(totalPagado).toLocaleString("es-ES")} €
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Facturado
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1 }}>
                  <PercentIcon />
                </Avatar>
                <Typography variant="h5" color="success.main">
                  {Number(comisionGenerada).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Comisión Generada ({comisionPercent}%)
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <Avatar sx={{ bgcolor: 'info.main', mx: 'auto', mb: 1 }}>
                  <StorefrontIcon />
                </Avatar>
                <Typography variant="h5" color="info.main">
                  {partner.tiendas ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Tiendas Activas
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <Avatar sx={{ bgcolor: 'warning.main', mx: 'auto', mb: 1 }}>
                  <TrendingUpIcon />
                </Avatar>
                <Typography variant="h5" color="warning.main">
                  {Math.round(porcentaje)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Objetivo Alcanzado
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          {/* Acuerdo entre empresas - Moved to KPI row */}
          <Grid size={{ xs: 12, md: 12 }}>
            <ModernSection title="Acuerdo entre Empresas" icon={<PictureAsPdfIcon />} onEdit={() => openModal('acuerdo')} editMode={editMode}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                {acuerdoPdfUrl ? (
                  <Button
                    variant="outlined"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={descargarAcuerdoPdf}
                    disabled={descargandoAcuerdo}
                    size="small"
                  >
                    {descargandoAcuerdo
                      ? 'Descargando...'
                      : partner.acuerdo_empresas_pdf_nombre
                      ? `Descargar PDF (${partner.acuerdo_empresas_pdf_nombre})`
                      : 'Descargar PDF'}
                  </Button>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No hay un PDF del acuerdo subido.
                  </Typography>
                )}
                {editMode && (
                  <>
                    <input
                      ref={acuerdoFileInputRef}
                      hidden
                      type="file"
                      accept="application/pdf"
                      onChange={onAgreementFileChange}
                    />
                    <Button
                      variant="contained"
                      onClick={() => acuerdoFileInputRef.current?.click()}
                      startIcon={<CloudUploadIcon />}
                      disabled={subiendoAcuerdo}
                      size="small"
                    >
                      {subiendoAcuerdo
                        ? 'Subiendo...'
                        : acuerdoPdfUrl
                        ? 'Reemplazar PDF'
                        : 'Subir PDF'}
                    </Button>
                  </>
                )}
              </Stack>
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-line', mt: 2 }}
                color={partner.acuerdo_empresas || acuerdoPdfUrl ? 'text.primary' : 'text.secondary'}
              >
                {partner.acuerdo_empresas?.trim()
                  || (acuerdoPdfUrl ? 'Consulta el PDF del acuerdo.' : 'No hay un acuerdo registrado.')}
              </Typography>
            </ModernSection>
          </Grid>
          {/* Logo del Tenant - Para PDFs */}
          <Grid size={{ xs: 12, md: 6 }}>
            <ModernSection title="Logo del Partner (PDFs)" icon={<BusinessIcon />} onEdit={() => {}} editMode={false}>
              <Box>
                {cargandoLogo ? (
                  <Box sx={{ mb: 2, textAlign: 'center', py: 3 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Cargando logo...
                    </Typography>
                  </Box>
                ) : logoPreviewUrl ? (
                  <Box sx={{ mb: 2, textAlign: 'center' }}>
                    <img
                      src={logoPreviewUrl}
                      alt="Logo del partner"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '120px',
                        objectFit: 'contain',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        padding: '8px',
                        backgroundColor: '#fafafa'
                      }}
                    />
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No hay un logo configurado. Este logo se usará en los PDFs generados.
                  </Typography>
                )}
                {editMode && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                    <input
                      ref={logoFileInputRef}
                      hidden
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={onLogoFileChange}
                    />
                    <Button
                      variant="contained"
                      onClick={() => logoFileInputRef.current?.click()}
                      startIcon={<CloudUploadIcon />}
                      disabled={subiendoLogo}
                      size="small"
                    >
                      {subiendoLogo
                        ? 'Subiendo...'
                        : partner.logo_url
                        ? 'Cambiar logo'
                        : 'Subir logo'}
                    </Button>
                    {partner.logo_nombre && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        Archivo: {partner.logo_nombre}
                      </Typography>
                    )}
                  </Stack>
                )}
              </Box>
            </ModernSection>
          </Grid>
        </Grid>

        {/* Objetivo Progress */}
        {partner.goal && (
          <Paper sx={{ p: 3, mb: 4, mx: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Progreso del Objetivo</Typography>
              {editMode && (
                <IconButton size="small" onClick={() => openModal("goal")}>
                  <EditIcon />
                </IconButton>
              )}
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ flexGrow: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={porcentaje}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    bgcolor: alpha('#000', 0.1),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 6,
                    }
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ minWidth: 'fit-content' }}>
                {Number(totalPagado).toLocaleString("es-ES")} € / {Number(partner.goal).toLocaleString('es-ES')} €
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Detail Sections */}
        <Grid container spacing={3} sx={{ px: 3 }}>
          {/* Datos Fiscales */}
          <Grid size={{ xs: 12, md: 6 }}>
            <ModernSection title="Datos Fiscales" icon={<BusinessIcon />} onEdit={() => openModal('fiscales')} editMode={editMode}>
              <InfoItem label="Razón social" value={partner.nombre} />
              <InfoItem label="CIF" value={partner.cif} />
              <InfoItem
                label="Dirección fiscal"
                value={`${partner.direccion_calle || ''}, ${partner.direccion_piso || ''} ${partner.direccion_puerta || ''}, ${partner.direccion_cp || ''} ${partner.direccion_poblacion || ''}, ${partner.direccion_provincia || ''} (${partner.direccion_pais || ''})`}
                icon={<LocationOnIcon fontSize="small" />}
              />
              <InfoItem
                label="Fecha creación"
                value={new Date(partner.fecha_creacion).toLocaleDateString()}
                icon={<CalendarTodayIcon fontSize="small" />}
              />
            </ModernSection>
          </Grid>

          {/* Contactos */}
          <Grid size={{ xs: 12, md: 6 }}>
            <ModernSection title="Contactos" icon={<GroupIcon />} onEdit={() => openModal('contactos')} editMode={editMode}>
              <Box mb={2}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Contacto Comercial
                </Typography>
                <InfoItem label="Nombre" value={partner.contacto_comercial} />
                <Stack direction="row" spacing={2}>
                  <InfoItem
                    label="Teléfono"
                    value={partner.telefono_comercial}
                    icon={<PhoneIcon fontSize="small" />}
                  />
                  <InfoItem
                    label="Email"
                    value={partner.correo_comercial}
                    icon={<EmailIcon fontSize="small" />}
                  />
                </Stack>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Contacto Financiero
                </Typography>
                <InfoItem label="Nombre" value={partner.contacto_financiero} />
                <Stack direction="row" spacing={2}>
                  <InfoItem
                    label="Teléfono"
                    value={partner.telefono_financiero}
                    icon={<PhoneIcon fontSize="small" />}
                  />
                  <InfoItem
                    label="Email"
                    value={partner.correo_financiero}
                    icon={<EmailIcon fontSize="small" />}
                  />
                </Stack>
              </Box>
            </ModernSection>
          </Grid>

          {/* Información Empresarial */}
          <Grid size={{ xs: 12, md: 6 }}>
            <ModernSection title="Información Empresarial" icon={<BusinessIcon />} onEdit={() => openModal('empresa')} editMode={editMode}>
              <Stack direction="row" spacing={2} mb={1}>
                <InfoItem label="Nº empleados" value={partner.numero_empleados} />
                <InfoItem label="Tiendas oficiales" value={partner.numero_tiendas_oficiales} />
              </Stack>
              <InfoItem label="Vertical" value={partner.vertical} />
              <InfoItem
                label="Web corporativa"
                value={partner.web_corporativa}
                icon={<WebIcon fontSize="small" />}
              />
              <InfoItem
                label="Facturación anual"
                value={
                  partner.facturacion_anual != null
                    ? `${Number(partner.facturacion_anual).toLocaleString('es-ES')} €`
                    : '—'
                }
                icon={<EuroIcon fontSize="small" />}
              />
            </ModernSection>
          </Grid>

          {/* Gestión Legal */}
          <Grid size={{ xs: 12, md: 6 }}>
            <ModernSection title="Gestión Legal" icon={<SettingsIcon />} onEdit={() => openModal('legales')} editMode={editMode}>
              <InfoItem label="Modo de gestión" value={managementLabel(partner.management_mode)} />
              <InfoItem label="Namespace legal" value={partner.legal_namespace || '—'} />
              <InfoItem label="Slug legal" value={partner.legal_slug || '—'} />
              {partner.legal_overrides && (
                <Box mt={1}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Overrides (JSON)
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
                      border: (theme) => theme.palette.mode === 'dark' ? '1px solid' : '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'grey.600' : 'grey.300'
                    }}
                  >
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        m: 0,
                        color: (theme) => theme.palette.mode === 'dark' ? 'grey.200' : 'grey.900'
                      }}
                    >
                      {JSON.stringify(partner.legal_overrides, null, 2)}
                    </Typography>
                  </Paper>
                </Box>
              )}
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Namespaces efectivos
                </Typography>
                <Typography variant="body2">
                  {computeEffectiveNamespaces(partner).join(' → ')}
                </Typography>
              </Box>
            </ModernSection>
          </Grid>

          {/* Configuración */}
          <Grid size={{ xs: 12, md: 6 }}>
            <ModernSection title="Configuración" icon={<SettingsIcon />} onEdit={() => openModal('configuracion')} editMode={editMode}>
              <InfoItem
                label="Porcentaje de comisión"
                value={`${comisionPercent}%`}
                icon={<PercentIcon fontSize="small" />}
              />
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Modo Demo
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <ScienceIcon fontSize="small" />
                  <Chip
                    label={partner.es_demo ? 'ACTIVADO' : 'Desactivado'}
                    color={partner.es_demo ? 'warning' : 'default'}
                    size="small"
                    variant={partner.es_demo ? 'filled' : 'outlined'}
                  />
                </Box>
                {partner.es_demo && (
                  <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                    ⚠️ Las validaciones de DNI/CIF/Email están desactivadas
                  </Typography>
                )}
              </Box>
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Solo empresas
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <BusinessIcon fontSize="small" />
                  <Chip
                    label={partner.solo_empresas ? 'Activado' : 'Desactivado'}
                    color={partner.solo_empresas ? 'info' : 'default'}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>
            </ModernSection>
          </Grid>

        </Grid>

        <EditModal
          section={modalOpen}
          open={Boolean(modalOpen)}
          onClose={closeModal}
          onSave={handleSave}
          saving={saving}
          formData={formData}
          onChange={handleChange}
        />
      </Box>
  )
}

// Modern Section Component
function ModernSection({
  title,
  icon,
  children,
  onEdit,
  editMode = false
}: {
  title: string,
  icon: React.ReactNode,
  children: React.ReactNode,
  onEdit?: () => void,
  editMode?: boolean
}) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              {icon}
            </Avatar>
            <Typography variant="h6">{title}</Typography>
          </Box>
          {editMode && onEdit && (
            <IconButton onClick={onEdit} size="small">
              <EditIcon />
            </IconButton>
          )}
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

// Modern Info Item Component
function InfoItem({
  label,
  value,
  icon
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode
}) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Box display="flex" alignItems="center" gap={1}>
        {icon}
        <Typography variant="body1" fontWeight={500}>
          {value ?? '—'}
        </Typography>
      </Box>
    </Box>
  )
}

// Modal content per section
function EditModal({
  section, open, onClose, onSave, saving, formData, onChange
}: any) {
  const sections: Record<string, {
    label: string,
    fields: {
      name: string,
      label: string,
      multiline?: boolean,
      type?: string,
      options?: { value: string, label: string }[]
    }[]
  }> = {
    contactos: {
      label: 'Editar contactos',
      fields: [
        { name: 'contacto_comercial', label: 'Contacto comercial' },
        { name: 'contacto_financiero', label: 'Contacto financiero' },
        { name: 'correo_comercial', label: 'Correo comercial' },
        { name: 'correo_financiero', label: 'Correo financiero' },
        { name: 'telefono_comercial', label: 'Teléfono comercial' },
        { name: 'telefono_financiero', label: 'Teléfono financiero' }
      ]
    },
    empresa: {
      label: 'Editar empresa',
      fields: [
        { name: 'numero_empleados', label: 'Nº empleados', type: 'number' },
        { name: 'vertical', label: 'Vertical' },
        { name: 'vertical_secundaria', label: 'Vertical secundaria' },
        { name: 'web_corporativa', label: 'Web corporativa' },
        { name: 'facturacion_anual', label: 'Facturación anual', type: 'number' },
        { name: 'numero_tiendas_oficiales', label: 'Tiendas oficiales', type: 'number' }
      ]
    },
    goal: {
      label: 'Editar objetivo',
      fields: [
        { name: 'goal', label: 'Objetivo (€)', type: 'number' }
      ]
    },
    fiscales: {
        label: 'Editar datos fiscales',
        fields: [
            { name: 'name', label: 'Razón social' },
            { name: 'cif', label: 'CIF' },
            { name: 'direccion_calle', label: 'Calle y número' },
            { name: 'direccion_piso', label: 'Piso' },
            { name: 'direccion_puerta', label: 'Puerta' },
            { name: 'direccion_cp', label: 'Código postal' },
            { name: 'direccion_poblacion', label: 'Población' },
            { name: 'direccion_provincia', label: 'Provincia' },
            { name: 'direccion_pais', label: 'País' }
        ]
        },
    legales: {
      label: 'Editar plantillas legales',
      fields: [
        {
          name: 'management_mode',
          label: 'Modo de gestión',
          options: [
            { value: 'default', label: 'Gestionado (plantillas globales)' },
            { value: 'autoadmin', label: 'Autoadministrado (plantillas propias)' },
          ]
        },
        { name: 'legal_namespace', label: 'Namespace legal' },
        { name: 'legal_slug', label: 'Slug de la plantilla' },
        { name: 'legal_overrides', label: 'Overrides (JSON)', multiline: true }
      ]
    },
    configuracion: {
      label: 'Editar configuración',
      fields: [
        { name: 'comision_pct', label: 'Porcentaje de comisión (%)', type: 'number' },
        { name: 'es_demo', label: 'Modo Demo (desactiva validaciones)', type: 'boolean' },
        { name: 'solo_empresas', label: 'Solo empresas/autónomos', type: 'boolean' }
      ]
    },
    comision: {
      label: 'Editar comisión',
      fields: [
        { name: 'comision_pct', label: 'Porcentaje de comisión (%)', type: 'number' }
      ]
    },
    acuerdo: {
      label: 'Editar acuerdo entre empresas',
      fields: [
        { name: 'acuerdo_empresas', label: 'Detalle del acuerdo', multiline: true }
      ]
    }
  }

  const config = section ? sections[section] : null
  if (!config) return null

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ pb: 1 }}>
        {config.label}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {config.fields.map((field: any) => (
            <Grid size={{ xs: 12, md: field.multiline ? 12 : (field.type === 'boolean' ? 12 : 6) }} key={field.name}>
              {field.options ? (
                <FormControl fullWidth>
                  <InputLabel>{field.label}</InputLabel>
                  <Select
                    label={field.label}
                    value={formData[field.name] ?? 'default'}
                    onChange={(e) => onChange(field.name, e.target.value)}
                  >
                    {field.options.map((opt:{ value: string; label: string }) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : field.type === 'boolean' ? (
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(formData[field.name])}
                      onChange={(e) => onChange(field.name, e.target.checked)}
                      color={field.name === 'es_demo' ? 'warning' : 'primary'}
                    />
                  }
                  label={field.label}
                />
              ) : (
                <TextField
                  label={field.label}
                  fullWidth
                  value={
                    field.name === 'legal_overrides' && typeof formData[field.name] === 'object'
                      ? JSON.stringify(formData[field.name], null, 2)
                      : (formData[field.name] || '')
                  }
                  multiline={field.multiline}
                  minRows={field.multiline ? 6 : undefined}
                  type={field.type || 'text'}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  slotProps={{
                    input: field.name === 'legal_overrides' ? { style: { fontFamily: 'monospace', fontSize: 12 } } : undefined
                  }}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={onSave} disabled={saving} variant="contained">
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}