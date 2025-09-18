'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import api, { fetchTotalPagado } from '@/services/api'
import {
  Typography, Box, Paper, CircularProgress, Divider, Grid,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, LinearProgress, Menu, MenuItem, Chip, Tooltip, Select, InputLabel, FormControl,
  Stack
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import StorefrontIcon from '@mui/icons-material/Storefront'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { useRouter } from 'next/navigation'
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { toast } from 'react-toastify'

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
  const acuerdoFileInputRef = useRef<HTMLInputElement | null>(null)
  const [subiendoAcuerdo, setSubiendoAcuerdo] = useState(false)
  const [descargandoAcuerdo, setDescargandoAcuerdo] = useState(false)
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
    mutationFn: (data: any) => api.put(`/api/tenants/${data.id}/`, data),
    onSuccess: (_, data) => {
      queryClient.setQueryData(['partner', idStr], (prev: any) => ({ ...prev, ...data }))
      closeModal()
    },
    onError: (error) => {
      console.error(error)
      alert('Error al guardar')
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
  const handleSave = async () => {
    const payload = { ...formData }
    // Si el usuario ha editado overrides como texto, intentamos parsear a objeto
    if (typeof payload.legal_overrides === 'string') {
      try {
        payload.legal_overrides = payload.legal_overrides.trim()
          ? JSON.parse(payload.legal_overrides)
          : {}
      } catch (e) {
        alert('El JSON de overrides no es válido. Revisa el formato.')
        return
      }
    }
    if (!partner?.id) {
      console.error('No partner ID available to actualizar')
      return
    }
    updatePartner({ ...payload, id: partner.id })
  }

  if (loading) return <CircularProgress />
  if (error) return <Typography>Error al cargar el partner.</Typography>
  if (!partner) return null
  const acuerdoPdfUrl = partner.acuerdo_empresas_pdf_url ?? null
  const totalPagado = dashboard?.total_pagado || 0;
  const porcentaje = partner.goal
    ? Math.min((totalPagado / partner.goal) * 100, 100)
    : 0;
  const comisionPercent = getCommissionPercent(partner);
  const comisionGenerada = (Number(totalPagado) * (comisionPercent / 100)) || 0;
  return (
    <Box>
      <Box sx={{ position: 'relative', zIndex: 10, mt: 2 }}>
        <Box sx={{ position: 'absolute', right: 0 }}>
          <IconButton onClick={handleOpenMenu}>
            <MoreVertIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={openMenu} onClose={handleCloseMenu}>
            <MenuItem onClick={() => { setEditMode(prev => !prev); handleCloseMenu() }}>
              ✏️ {editMode ? "Cancelar edición" : "Editar"}
            </MenuItem>
            <MenuItem onClick={() => { openModal('legales'); handleCloseMenu() }}>
              📄 Gestion
            </MenuItem>
            <MenuItem onClick={() => {
                router.push(`/partners/${partner.id}/usuarios?schema=${partner.schema}`)
                handleCloseMenu()
              }}
            >
              👤 Usuarios
            </MenuItem>
            <MenuItem onClick={() => {
                router.push(`/partners/${partner.id}/tiendas?schema=${partner.schema}`)
                handleCloseMenu()
              }}
            ><StorefrontIcon fontSize="small" sx={{ mr: 1 }} /> Tiendas</MenuItem>
          </Menu>

        </Box>
      </Box>

      <Box sx={{ mb: 4, position: 'relative', minHeight: 80 }}>
        <Box sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', display:'flex', alignItems:'center', gap:1 }}>
          <Typography variant="h5">Partner: {partner.nombre}</Typography>
          <Tooltip title={partner.management_mode === 'autoadmin'
            ? 'El tenant usa su propio espacio de plantillas'
            : 'Usa plantillas globales por defecto'}>
            <Chip
              size="small"
              label={managementLabel(partner.management_mode)}
              color={partner.management_mode === 'autoadmin' ? 'success' : 'default'}
              variant="outlined"
              sx={{ ml: 1 }}
              onClick={editMode ? () => openModal('legales') : undefined}
            />
          </Tooltip>
        </Box>

        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            width: 'max-content',
          }}
        >
          <Typography variant="body2">
            Objetivo: {partner.goal != null ? `${Number(partner.goal).toLocaleString('es-ES')} €` : '—'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Realizado: {Number(totalPagado).toLocaleString("es-ES")} €
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" gap={1} mt={1}>
            <Box sx={{ width: 200 }}>
              <LinearProgress
                variant="determinate"
                value={porcentaje}
                sx={{ height: 8, borderRadius: 5 }}
              />
            </Box>
            <Typography variant="caption">{Math.round(porcentaje)}%</Typography>
            {editMode && (
              <IconButton size="small" onClick={() => openModal("goal")} sx={{ p: 0 }}>
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      </Box>



      <Grid container spacing={2} sx={{ mt: 2 }}>
        {/* Gestion */}
          <Grid size={{xs:12, md:6}}>
            <Section title="Gestion" onEdit={() => openModal('legales')} editMode={editMode}>
              <Box display="flex" gap={1} alignItems="center" mb={1}>
                <Info label="Modo de gestión" value={managementLabel(partner.management_mode)} />
              </Box>
              <Info label="Namespace legal" value={partner.legal_namespace || '—'} />
              <Info label="Slug legal" value={partner.legal_slug || '—'} />
              <Info label="Overrides (JSON)" value={
                partner.legal_overrides ? (
                  <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
                    {JSON.stringify(partner.legal_overrides, null, 2)}
                  </Box>
                ) : '—'
              } />
              <Divider sx={{ my: 1 }} />
              <Info label="Namespaces efectivos" value={
                computeEffectiveNamespaces(partner).join('  →  ')
              } />
            </Section>
          </Grid>
        {/* Comisión */}
          <Grid size={{xs:12, md:6}}>
            <Section title="Comisión" onEdit={() => openModal('comision')} editMode={editMode}>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Info label="Porcentaje" value={`${comisionPercent}%`} />
                <Info
                  label="Comisión generada"
                  value={`${Number(comisionGenerada).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                * Si no está configurado, se usa 10% por defecto.
              </Typography>
            </Section>
          </Grid>
        {/* Datos generales  */}
        <Grid size={{xs:12, md:6}}>
          <Section title="Datos fiscales" onEdit={() => openModal("fiscales")}editMode={editMode}>
            <Info label="Razón social" value={partner.nombre} />
            <Info label="CIF" value={partner.cif} />
            <Info
                label="Dirección fiscal"
                value={`${partner.direccion_calle || ''}, ${partner.direccion_piso || ''} ${partner.direccion_puerta || ''}, ${partner.direccion_cp || ''} ${partner.direccion_poblacion || ''}, ${partner.direccion_provincia || ''} (${partner.direccion_pais || ''})`}
                />
            <Box display="flex" gap={2}>
            <Info label="Tiendas" value={partner.tiendas} inline/></Box>
            <Info label="Fecha creación" value={new Date(partner.fecha_creacion).toLocaleDateString()} />
            
            
          </Section>
        </Grid>

        {/* Contactos */}
        <Grid size={{xs:12, md:6}}>
            <Section title="Contactos" onEdit={() => openModal("contactos")}editMode={editMode}>
            <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom color="text.secondary">Contacto comercial</Typography>
                <Info label="" value={partner.contacto_comercial} />
                <Box display="flex" justifyContent="space-between" gap={2}>
                <Info label="Teléfono" value={partner.telefono_comercial} inline />
                <Info label="Correo" value={partner.correo_comercial} inline />
                </Box>
            </Box>

            <Box>
                <Typography variant="subtitle2" gutterBottom color="text.secondary">Contacto financiero</Typography>
                <Info label="" value={partner.contacto_financiero} />
                <Box display="flex" justifyContent="space-between" gap={2}>
                <Info label="Teléfono" value={partner.telefono_financiero} inline />
                <Info label="Correo" value={partner.correo_financiero} inline />
                </Box>
            </Box>
            </Section>
        </Grid>

        {/* Empresa */} 
        <Grid size={{xs:12, md:6}}>
          <Section title="Empresa" onEdit={() => openModal("empresa")}editMode={editMode}>
            <Box display="flex" justifyContent="space-between" gap={1}>
            <Info label="Nº empleados" value={partner.numero_empleados} inline/>
            <Info label="Tiendas" value={partner.numero_tiendas_oficiales} inline/></Box>
            <Info label="Vertical" value={partner.vertical} />
            <Info label="Web corporativa" value={partner.web_corporativa} />
            <Info
                label="Facturación anual"
                value={
                    partner.facturacion_anual != null
                    ? `${Number(partner.facturacion_anual).toLocaleString('es-ES')} €`
                    : '—'
                }
                />
            
          </Section>
        </Grid>

        {/* Acuerdo entre empresas */}
        <Grid size={{xs:12}}>
          <Section title="Acuerdo entre empresas" onEdit={() => openModal('acuerdo')} editMode={editMode}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start" mb={2}>
              {acuerdoPdfUrl ? (
                <Button
                  variant="outlined"
                  startIcon={<PictureAsPdfIcon />}
                  onClick={descargarAcuerdoPdf}
                  disabled={descargandoAcuerdo}
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
              variant="body1"
              sx={{ whiteSpace: 'pre-line' }}
              color={partner.acuerdo_empresas || acuerdoPdfUrl ? 'text.primary' : 'text.secondary'}
            >
              {partner.acuerdo_empresas?.trim()
                || (acuerdoPdfUrl ? 'Consulta el PDF del acuerdo.' : 'No hay un acuerdo registrado.')}
            </Typography>
          </Section>
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

// Reusable section
function Section({
  title,
  children,
  onEdit,
  editMode = false
}: {
  title: string,
  children: React.ReactNode,
  onEdit?: () => void,
  editMode?: boolean
}) {
  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" justifyContent="space-between">
        <Typography variant="h6">{title}</Typography>
        {editMode && onEdit && (
          <IconButton onClick={onEdit} sx={{ p: 0 }}>
            <EditIcon />
          </IconButton>
        )}
      </Box>
      <Divider sx={{ my: 1 }} />
      {children}
    </Paper>
  )
}

// Display info row
function Info({ label, value, inline = false }: { label: string; value: React.ReactNode; inline?: boolean }) {
  const isElement = React.isValidElement(value)
  return (
    <Box sx={{ mb: 1, minWidth: inline ? 160 : 'auto', flex: inline ? '1 1 160px' : '0 0 auto' }}>
      {label && (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      )}
      <Typography
        variant="body1"
        fontWeight={500}
        component={isElement ? 'div' : 'p'} // evita <p><pre/></p>
        sx={isElement ? { '& pre': { m: 0 } } : undefined}
      >
        {value ?? '—'}
      </Typography>
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
        { name: 'goal', label: 'Objetivo', multiline: true }
      ]
    },
    fiscales: {
        label: 'Editar datos fiscales',
        fields: [
            { name: 'nombre', label: 'Razón social' },
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{config.label}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {config.fields.map((field: any) => (
            <Grid size={{xs:12}} key={field.name}>
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
                  inputProps={field.name === 'legal_overrides' ? { style: { fontFamily: 'monospace', fontSize: 12 } } : undefined}
                />
              )}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={onSave} disabled={saving} variant="contained">
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
