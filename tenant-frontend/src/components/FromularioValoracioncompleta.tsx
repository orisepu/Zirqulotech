'use client'

import React, { useState, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Paper,
  FormHelperText,
  Chip,
  Stack,
  Tooltip,
  Skeleton,
  Divider,
  Slider,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  IconButton,
  Dialog,
} from '@mui/material'
import { Autocomplete } from '@mui/material'
import { useParams } from 'next/navigation'
import api from '@/services/api'

import SmartphoneIcon from '@mui/icons-material/Smartphone'
import MemoryIcon from '@mui/icons-material/Memory'
import NumbersIcon from '@mui/icons-material/Numbers'
import BrushIcon from '@mui/icons-material/Brush'
import PsychologyIcon from '@mui/icons-material/Psychology'
import StarIcon from '@mui/icons-material/Star'
import EuroIcon from '@mui/icons-material/Euro'
import DevicesIcon from '@mui/icons-material/Devices'
import BoltIcon from '@mui/icons-material/Bolt'
import BugReportIcon from '@mui/icons-material/BugReport'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit'
import FlipToBackIcon from '@mui/icons-material/FlipToBack'

import Image from 'next/image'
import { getPrecioFinal, formatoBonito } from '@/context/precios'

interface Props {
  oportunidadId: number
  oportunidadUuid?: string
  onClose: () => void
  onSuccess: () => void
  item?: any
}

type EsteticaKey = 'sin_signos' | 'minimos' | 'algunos' | 'desgaste_visible' | 'agrietado_roto'

const pasos = ['Datos básicos', 'Estado del dispositivo', 'Valoración']

// Catálogos con descripciones cortas
const CAT = {
  funcBasica: [
    { value: 'ok', label: 'Todo funciona', desc: 'Sin incidencias detectadas.' },
    { value: 'parcial', label: 'No totalmente funcional', desc: 'Tiene uno o más problemas.' },
  ],
  funcPantalla: [
    { value: 'puntos', label: 'Puntos brillantes', desc: 'Manchas luminosas, más en fondos oscuros.' },
    { value: 'pixeles', label: 'Píxeles muertos', desc: 'Puntos siempre apagados/encendidos.' },
    { value: 'lineas', label: 'Líneas/quemaduras', desc: 'Bandas, retenciones o decoloración.' },
  ],
  esteticaPantalla: [
    { value: 'sin_signos', label: 'Sin signos de uso', desc: 'Aspecto como nuevo.' },
    { value: 'minimos', label: 'Mínimos signos', desc: 'Microarañazos, visibles solo a la luz.' },
    { value: 'algunos', label: 'Algunos signos', desc: 'Arañazos ligeros, sobre todo en bordes.' },
    { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'Arañazos claros, se notan al tacto.' },
  ],
  esteticaLados: [
    { value: 'sin_signos', label: 'Sin signos', desc: 'Como nuevos.' },
    { value: 'minimos', label: 'Mínimos', desc: 'Los arañazos no son visibles a primera vista pero se pueden ver bajo una fuente de luz.' },
    { value: 'algunos', label: 'Algunos', desc: 'Arañazos/pequeña abolladura.' },
    { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'Arañazos/abolladuras evidentes.' },
    { value: 'agrietado_roto', label: 'Agrietado/roto', desc: 'Grietas o curvatura visible.' },
  ],
  esteticaEspalda: [
    { value: 'sin_signos', label: 'Sin signos', desc: 'Como nueva.' },
    { value: 'minimos', label: 'Mínimos', desc: 'Pequeños microarañazos.' },
    { value: 'algunos', label: 'Algunos', desc: 'Marcas evidentes o cerca de cámara.' },
    { value: 'desgaste_visible', label: 'Desgaste visible', desc: 'Arañazos claros/abolladuras.' },
    { value: 'agrietado_roto', label: 'Agrietado/roto', desc: 'Cristal trasero roto o metal abollado.' },
  ],
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)

export default function FormularioValoracionOportunidad({
  item,
  onClose,
  onSuccess,
  oportunidadId,
  oportunidadUuid,
}: Props) {
  const [activeStep, setActiveStep] = useState(0)
  const [tipo, setTipo] = useState('')
  const [precioBase, setPrecioBase] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState<number | string>(1)
  const [modelo, setModelo] = useState<any>('') // id numérico
  const [capacidad, setCapacidad] = useState<any>('') // id numérico
  const [modeloInicial, setModeloInicial] = useState<any | null>(null)

  // NUEVOS estados
  const [saludBateria, setSaludBateria] = useState<number | ''>('') // 0–100
  const [ciclosBateria, setCiclosBateria] = useState<number | ''>('') // opcional
  const [funcBasica, setFuncBasica] = useState<'ok' | 'parcial' | ''>('')

  // Multiselección para funcionalidad de la pantalla
  const [pantallaIssues, setPantallaIssues] = useState<string[]>([]) // ['puntos','pixeles','lineas']

  // Estética
  const [estadoPantalla, setEstadoPantalla] = useState('')
  const [estadoLados, setEstadoLados] = useState('')
  const [estadoEspalda, setEstadoEspalda] = useState('')

  const { tenant } = useParams()
  const queryClient = useQueryClient()

  // Key de oportunidad consistente con la página
  const oppKey = String(oportunidadUuid ?? oportunidadId)

  // Oportunidad desde el caché
  const oppCache: any =
    queryClient.getQueryData(['oportunidad', oppKey]) ??
    queryClient.getQueryData(['oportunidad', String(oportunidadId)])

  // Canal
  const canalRaw = (oppCache?.cliente?.canal ?? '').toString().toUpperCase()
  const tipoCliente =
    canalRaw === 'B2B' || canalRaw === 'B2C'
      ? canalRaw
      : (oppCache?.cliente?.tipo_cliente ?? '').toString().toLowerCase() === 'empresa'
      ? 'B2B'
      : 'B2C'

  // -------- Catálogos --------
  const { data: tipos = [], isLoading: loadingTipos } = useQuery({
    queryKey: ['tipos-modelo'],
    queryFn: async () => (await api.get('/api/tipos-modelo/')).data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: modelos = [], isLoading: loadingModelos } = useQuery({
    queryKey: ['modelos', tipo],
    enabled: !!tipo,
    queryFn: async () => (await api.get(`/api/modelos/?tipo=${tipo}`)).data,
    staleTime: 2 * 60 * 1000,
  })

  const { data: capacidades = [], isLoading: loadingCaps } = useQuery({
    queryKey: ['capacidades-por-modelo', modelo],
    enabled: !!modelo,
    queryFn: async () => (await api.get(`/api/capacidades-por-modelo/?modelo=${modelo}&oportunidad=${oportunidadId}`)).data,
    staleTime: 2 * 60 * 1000,
  })

  // Inicializar "tipo"
  useEffect(() => {
    if (tipos.length && !tipos.includes(tipo)) setTipo(tipos[0])
  }, [tipos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Precarga en edición
  useEffect(() => {
    if (item?.modelo) {
      setModeloInicial(item.modelo)
      setModelo(item.modelo.id)
      setTipo(item.tipo || item.modelo.tipo)
    }
    if (item?.capacidad) setCapacidad(item.capacidad.id)
    setCantidad(item?.cantidad || 1)

    if (item?.salud_bateria_pct !== undefined) setSaludBateria(item.salud_bateria_pct ?? '')
    if (item?.ciclos_bateria !== undefined) setCiclosBateria(item.ciclos_bateria ?? '')
    if (item?.funcionalidad_basica) setFuncBasica(item.funcionalidad_basica)

    // convertir booleans previos a array de issues
    const issues: string[] = []
    if (item?.pantalla_funcional_puntos_bril) issues.push('puntos')
    if (item?.pantalla_funcional_pixeles_muertos) issues.push('pixeles')
    if (item?.pantalla_funcional_lineas_quemaduras) issues.push('lineas')
    setPantallaIssues(issues)

    if (item?.estado_pantalla) setEstadoPantalla(item.estado_pantalla)
    if (item?.estado_lados) setEstadoLados(item.estado_lados)
    if (item?.estado_espalda) setEstadoEspalda(item.estado_espalda)
  }, [item])

  // Atajos teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) handleSubmit(true)
        else handleSubmit(false)
      }
      if (e.ctrlKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        if (e.key === 'ArrowRight' && activeStep < pasos.length - 1 && puedeAvanzar()) setActiveStep(s => s + 1)
        if (e.key === 'ArrowLeft' && activeStep > 0) setActiveStep(s => s - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, tipo, modelo, capacidad, funcBasica, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda])

  // Helpers
  const toNum = (v: any): number | null => {
    if (v === null || v === undefined) return null
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) ? Number(n) : null
  }

  const isLaptop = /\b(mac|macbook|laptop|portátil)\b/i.test(tipo || '')

  // Seleccionados
  const modeloObj = modelos.find((m: any) => m.id === modelo) || modeloInicial
  const capacidadObj = capacidades.find((c: any) => c.id === capacidad)

  // Precio base
  useEffect(() => {
    if (!capacidadObj) { setPrecioBase(null); return }
    const b2b = toNum((capacidadObj as any).precio_b2b)
    const b2c = toNum((capacidadObj as any).precio_b2c)
    const estimado = toNum((capacidadObj as any).precio_estimado)
    const legacy = toNum((capacidadObj as any).precio)
    const base = tipoCliente === 'B2C' ? (b2c ?? legacy ?? estimado ?? b2b) : (b2b ?? estimado ?? legacy ?? b2c)
    setPrecioBase(base ?? null)
  }, [capacidadObj, tipoCliente, oppKey, capacidades])

  // Valoración derivada
  function derivarValoracion() {
    const hasLineas = pantallaIssues.includes('lineas')
    const hasIncidenciasPantalla = pantallaIssues.length > 0
    const incidenciasFunc = funcBasica === 'parcial' || hasIncidenciasPantalla
    const hayDanioGrave = estadoLados === 'agrietado_roto' || estadoEspalda === 'agrietado_roto' || hasLineas

    const rank: Record<string, number> = { sin_signos: 0, minimos: 1, algunos: 2, desgaste_visible: 3, agrietado_roto: 4 }
    const peorEst = Math.max(
      rank[estadoPantalla || 'sin_signos'] ?? 0,
      rank[estadoLados || 'sin_signos'] ?? 0,
      rank[estadoEspalda || 'sin_signos'] ?? 0
    )

    let estado_valoracion: 'excelente' | 'muy_bueno' | 'bueno' | 'a_revision'
    if (hayDanioGrave) estado_valoracion = 'a_revision'
    else if (incidenciasFunc || peorEst >= 3) estado_valoracion = 'bueno'
    else if (peorEst === 2) estado_valoracion = 'muy_bueno'
    else estado_valoracion = 'excelente'

    const estado_fisico =
      hayDanioGrave ? 'agrietado' :
      peorEst >= 3 ? 'desgaste_visible' :
      peorEst === 2 ? 'algunos' :
      peorEst === 1 ? 'minimos' : 'sin_signos'

    const estado_funcional = incidenciasFunc ? 'con_incidencias' : 'ok'

    return { estado_valoracion, estado_fisico, estado_funcional }
  }

  const puedeAvanzar = () => {
    if (activeStep === 0) return !!tipo && !!modelo && !!capacidad && (!item ? Number(cantidad) > 0 : true)
    if (activeStep === 1) return !!funcBasica && !!estadoPantalla && !!estadoLados && !!estadoEspalda
    return true
  }

  const handleSiguiente = () => { if (activeStep < pasos.length - 1) setActiveStep(p => p + 1) }
  const handleAnterior = () => { if (activeStep > 0) setActiveStep(p => p - 1) }

  const handleSubmit = async (continuar = false) => {
    const cantidadNum = typeof cantidad === 'string' ? parseInt(cantidad) || 1 : cantidad
    const { estado_valoracion, estado_fisico, estado_funcional } = derivarValoracion()

    let precio_orientativo: number | null = null
    if (estado_valoracion !== 'a_revision' && precioBase) {
      precio_orientativo = getPrecioFinal(estado_valoracion, precioBase)
    }

    if (!oportunidadId || Number.isNaN(Number(oportunidadId))) { alert('Falta el ID numérico de la oportunidad.'); return }
    if (!modelo || !capacidad) { alert('Selecciona modelo y capacidad.'); return }

    const data: any = {
      modelo_id: modelo,
      capacidad_id: capacidad,
      estado_fisico,
      estado_funcional,
      estado_valoracion,
      tipo,
      precio_orientativo,
      cantidad: cantidadNum,
      oportunidad: Number(oportunidadId),
      // nuevos campos
      salud_bateria_pct: saludBateria === '' ? null : Number(saludBateria),
      ciclos_bateria: ciclosBateria === '' ? null : Number(ciclosBateria),
      funcionalidad_basica: funcBasica || null,
      pantalla_funcional_puntos_bril: pantallaIssues.includes('puntos'),
      pantalla_funcional_pixeles_muertos: pantallaIssues.includes('pixeles'),
      pantalla_funcional_lineas_quemaduras: pantallaIssues.includes('lineas'),
      estado_pantalla: estadoPantalla || null,
      estado_lados: estadoLados || null,
      estado_espalda: estadoEspalda || null,
    }

    try {
      if (item) {
        if (tenant) await api.put(`/api/global/dispositivo/${tenant}/${item.id}/`, data)
        else await api.put(`/api/dispositivos/${item.id}/`, data)
      } else {
        if (tenant) await api.post(`/api/global/dispositivos/${tenant}/${oportunidadId}/`, data)
        else await api.post('/api/dispositivos/', data)
      }

      await queryClient.invalidateQueries({ queryKey: ['oportunidad', oppKey] })
      await queryClient.refetchQueries({ queryKey: ['oportunidad', oppKey], exact: true })
      await queryClient.invalidateQueries({ queryKey: ['dispositivos-reales', oppKey] })
      await queryClient.refetchQueries({ queryKey: ['dispositivos-reales', oppKey], exact: true })

      if (continuar) {
        setModelo(''); setCapacidad(''); setPrecioBase(null); setCantidad(1)
        setSaludBateria(''); setCiclosBateria(''); setFuncBasica('')
        setPantallaIssues([]); setEstadoPantalla(''); setEstadoLados(''); setEstadoEspalda('')
        setActiveStep(0)
      } else {
        onSuccess()
      }
    } catch (err) {
      console.error('Error al guardar:', err)
      alert('❌ Error al guardar el dispositivo.')
    }
  }

  // IMÁGENES DEMO
  const DEMO_IMG: Record<'puntos' | 'pixeles' | 'lineas', { src: string; title: string }> = {
    puntos:  { src: '/demo/pantalla-puntos-brillantes.webp',  title: 'Puntos brillantes' },
    pixeles: { src: '/demo/pantalla-pixeles-muertos.webp',    title: 'Píxeles muertos' },
    lineas:  { src: '/demo/pantalla-lineas-quemaduras.webp',  title: 'Líneas / quemaduras' },
  }

  const ESTETICA_IMG: Record<'lados' | 'espalda', Record<EsteticaKey, string>> = {
    lados: {
      sin_signos:        '/demo/lados-sin-signos.webp',
      minimos:           '/demo/lados-minimos.webp',
      algunos:           '/demo/lados-algunos.webp',
      desgaste_visible:  '/demo/desgaste-trasero-grande.webp',
      agrietado_roto:    '/demo/cristal-trasero-roto.webp',
    },
    espalda: {
      sin_signos:        '/demo/lados-sin-signos.webp',
      minimos:           '/demo/lados-minimos.webp',
      algunos:           '/demo/lados-algunos.webp',
      desgaste_visible:  '/demo/desgaste-trasero-grande.webp',
      agrietado_roto:    '/demo/cristal-trasero-roto.webp',
    },
  }

  // Claves usadas para estética de pantalla
  const PANT_KEYS = ['sin_signos','minimos','algunos','desgaste_visible'] as const
  type EsteticaPantallaKey = typeof PANT_KEYS[number]

  // Imágenes demo (1024×1024, mismo ángulo)
  const ESTETICA_PANTALLA_IMG: Record<EsteticaPantallaKey, { src: string; title: string }> = {
    sin_signos:       { src: '/demo/pantalla-marcas-perfectas.webp',  title: 'Sin signos de uso' },
    minimos:          { src: '/demo/pantalla-minimos-marcas.webp',    title: 'Mínimos signos' },
    algunos:          { src: '/demo/pantalla-algunas-marcas.webp',    title: 'Algunos signos' },
    desgaste_visible: { src: '/demo/pantalla-marcas-profundas.webp',  title: 'Desgaste visible' },
  }

  // Estado visor demo
  const [demoOpen, setDemoOpen] = useState(false)
  const [demo, setDemo] = useState<{ src: string; title: string } | null>(null)

  const openDemo = (key: 'puntos' | 'pixeles' | 'lineas') => {
    setDemo(DEMO_IMG[key])
    setDemoOpen(true)
  }
  const openDemoImg = (src: string, title: string) => {
    setDemo({ src, title })
    setDemoOpen(true)
  }
  const closeDemo = () => setDemoOpen(false)

  const { estado_valoracion: estadoTexto } = derivarValoracion()
  const precioCalculado = estadoTexto === 'a_revision' || !precioBase ? null : getPrecioFinal(estadoTexto, precioBase)

  // Reutilizamos una sola colección de ejemplos para ambos (laterales y trasera)
  const SHARED_EJEMPLOS: Record<EsteticaKey, string> = ESTETICA_IMG.espalda

  // Mapa de label/desc conjunto
  const LABEL_DESC: Record<EsteticaKey, { label: string; desc: string }> =
    (['sin_signos','minimos','algunos','desgaste_visible','agrietado_roto'] as EsteticaKey[])
      .reduce((acc, k) => {
        const o = CAT.esteticaEspalda.find(x => x.value === k)!
        acc[k] = { label: o.label, desc: o.desc }
        return acc
      }, {} as Record<EsteticaKey, {label: string; desc: string}>)

  return (
    <>
      <DialogTitle>{item ? 'Editar dispositivo' : 'Nuevo dispositivo'}</DialogTitle>

      <DialogContent>
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
          <Stepper
            activeStep={activeStep}
            alternativeLabel
            sx={{
              mb: 2,
              '& .MuiStepIcon-root': { color: 'divider' },
              '& .MuiStepIcon-root.Mui-active': { color: 'primary.main' },
              '& .MuiStepIcon-root.Mui-completed': { color: 'success.main' },
            }}
          >
            <Step><StepLabel icon={<SmartphoneIcon />}>Datos básicos</StepLabel></Step>
            <Step><StepLabel icon={<BugReportIcon />}>Estado del dispositivo</StepLabel></Step>
            <Step><StepLabel icon={<EuroIcon />}>Valoración</StepLabel></Step>
          </Stepper>

          {/* Paso 1 - Datos básicos */}
          {activeStep === 0 && (
            <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <SmartphoneIcon fontSize="small" />
                <Typography variant="subtitle2">Datos básicos</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Selecciona tipo, modelo y capacidad para continuar.
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Tipo de producto</InputLabel>
                    <Select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      label="Tipo de producto"
                      disabled={loadingTipos}
                      error={!tipo}
                    >
                      {tipos.map((t: string) => (<MenuItem key={t} value={t}>{t}</MenuItem>))}
                    </Select>
                    {loadingTipos ? (
                      <Skeleton variant="text" width={120} />
                    ) : (!tipo && <FormHelperText>Requerido</FormHelperText>)}
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    {loadingModelos ? (
                      <Skeleton variant="rounded" height={56} />
                    ) : (
                      <Autocomplete
                        options={modelos}
                        getOptionLabel={(option: any) => option.descripcion}
                        value={
                          modelos.find((m: any) => m.id === modelo) ||
                          (modeloInicial && { ...modeloInicial, id: modeloInicial.id }) ||
                          null
                        }
                        onChange={(_e, newValue: any) => setModelo(newValue ? newValue.id : '')}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Modelo"
                            error={!modelo}
                            helperText={!modelo ? 'Requerido' : ''}
                          />
                        )}
                        disabled={!tipo}
                      />
                    )}
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Capacidad</InputLabel>
                    <Select
                      value={capacidad}
                      onChange={(e) => setCapacidad(Number(e.target.value))}
                      label="Capacidad"
                      disabled={loadingCaps || !modelo}
                      error={!capacidad}
                    >
                      {loadingCaps
                        ? <MenuItem value=""><em>Cargando…</em></MenuItem>
                        : capacidades.map((c: any) => (<MenuItem key={c.id} value={c.id}>{c.tamaño}</MenuItem>))}
                    </Select>
                    {!capacidad && !loadingCaps && <FormHelperText>Requerido</FormHelperText>}
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Cantidad"
                    type="number"
                    fullWidth
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    onBlur={() => {
                      const parsed = parseInt(cantidad as string)
                      setCantidad(isNaN(parsed) ? 1 : parsed)
                    }}
                    inputProps={{ min: 1 }}
                  />
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Paso 2 - Estado del dispositivo */}
          {activeStep === 1 && (
            <Box sx={{ display: 'grid', gap: 2 }}>
              {/* Salud de la batería */}
              <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <BoltIcon fontSize="small" />
                  <Typography variant="subtitle2">Salud de la batería</Typography>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="center">
                  <Box flex={1} px={{ sm: 1 }} sx={{ maxWidth: 520 }}>
                    <Slider
                      value={typeof saludBateria === 'number' ? saludBateria : 0}
                      onChange={(_e, val) => setSaludBateria(val as number)}
                      min={0}
                      max={100}
                      valueLabelDisplay="auto"
                      aria-label="Salud de la batería"
                    />
                  </Box>
                  <TextField
                    label="Salud (%)"
                    type="number"
                    value={saludBateria}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setSaludBateria(Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : '')
                    }}
                    InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment>, inputProps: { min: 0, max: 100 } }}
                    sx={{ width: { xs: '100%', sm: 160 } }}
                  />
                  {isLaptop && (
                    <TextField
                      label="Ciclos (opcional)"
                      type="number"
                      value={ciclosBateria}
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        setCiclosBateria(Number.isFinite(n) ? Math.max(0, n) : '')
                      }}
                      inputProps={{ min: 0 }}
                      sx={{ width: { xs: '100%', sm: 180 } }}
                    />
                  )}
                </Stack>
              </Paper>

              {/* Funcionalidad básica */}
              <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <PsychologyIcon fontSize="small" />
                  <Typography variant="subtitle2">Funcionalidad básica</Typography>
                </Stack>

                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <ToggleButtonGroup
                    exclusive
                    value={funcBasica}
                    onChange={(_e, val: 'ok' | 'parcial' | null) => { if (val) setFuncBasica(val) }}
                    sx={{
                      flexWrap: 'wrap',
                      '& .MuiToggleButton-root.Mui-selected': {
                        bgcolor: 'primary.light',
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        '&:hover': { bgcolor: 'primary.light' },
                      },
                    }}
                  >
                    {CAT.funcBasica.map(o => (
                      <Tooltip key={o.value} title={o.desc} arrow placement="top">
                        <ToggleButton value={o.value} sx={{ px: 2, py: 1.2, textTransform: 'none' }}>
                          {o.value === 'ok' ? <CheckCircleIcon fontSize="small" /> : <BugReportIcon fontSize="small" />}
                          <Box ml={1}>{o.label}</Box>
                        </ToggleButton>
                      </Tooltip>
                    ))}
                  </ToggleButtonGroup>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  {funcBasica
                    ? <FormHelperText sx={{ mt: 1 }}>{CAT.funcBasica.find(o => o.value === funcBasica)?.desc}</FormHelperText>
                    : <FormHelperText sx={{ mt: 1 }}>Selecciona una opción</FormHelperText>
                  }
                </Box>
              </Paper>

              {/* Funcionalidad de la pantalla */}
              <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <ScreenshotMonitorIcon fontSize="small" />
                  <Typography variant="subtitle2">Funcionalidad de la pantalla</Typography>
                  <Button
                    size="small"
                    startIcon={<ClearAllIcon />}
                    onClick={() => setPantallaIssues([])}
                    sx={{ ml: 'auto' }}
                  >
                    Limpiar
                  </Button>
                </Stack>

                <ToggleButtonGroup
                  value={pantallaIssues}
                  onChange={(_e, list: string[]) => setPantallaIssues(list)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 2,
                    justifyItems: 'center',
                    '& .MuiToggleButton-root': {
                      p: 0,
                      m: 0,
                      width: '100%',
                      borderRadius: 2,
                      overflow: 'hidden',
                      textTransform: 'none',
                      alignItems: 'stretch',
                      border: '2px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    },
                    '& .MuiToggleButton-root.Mui-selected': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  {CAT.funcPantalla.map((o) => {
                    const demo = DEMO_IMG[o.value as 'puntos' | 'pixeles' | 'lineas']
                    return (
                      <ToggleButton
                        key={o.value}
                        value={o.value}
                        sx={{
                          p: 0,
                          m: 0,
                          width: '100%',
                          borderRadius: 2,
                          overflow: 'hidden',
                          textTransform: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          border: '2px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                          '&.Mui-selected': {
                            borderColor: 'primary.main',
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            position: 'relative',
                            width: '100%',
                            height: { xs: 120, sm: 140, md: 160 },
                            bgcolor: '#000',
                            flexShrink: 0,
                          }}
                        >
                          <Image
                            src={demo.src}
                            alt={o.label}
                            fill
                            style={{ objectFit: 'cover', objectPosition: 'top center' }}
                            draggable={false}
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); openDemo(o.value as any) }}
                            sx={{
                              position: 'absolute',
                              right: 8,
                              bottom: 8,
                              bgcolor: 'rgba(0,0,0,0.45)',
                              color: '#fff',
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
                            }}
                          >
                            <ZoomInIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <Box px={1.25} py={1} textAlign="center">
                          <Typography variant="body2" fontWeight={600}>{o.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{o.desc}</Typography>
                        </Box>
                      </ToggleButton>
                    )
                  })}
                </ToggleButtonGroup>

                <FormHelperText sx={{ mt: 1, textAlign: 'center' }}>
                  {pantallaIssues.length === 0
                    ? 'Selecciona todas las incidencias que apliquen'
                    : pantallaIssues.map((k) => `• ${CAT.funcPantalla.find(i => i.value === k)?.desc}`).join('   ')
                  }
                </FormHelperText>
              </Paper>

              {/* Estética */}
              <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                  <BrushIcon fontSize="small" />
                  <Typography variant="subtitle2">Estado estético</Typography>
                </Stack>

                {/* Pantalla estética */}
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <SectionLabel text="Pantalla" />
                </Box>
                
                  <ToggleButtonGroup
                    exclusive
                    value={estadoPantalla}
                    onChange={(_e, val: string | null) => { if (val !== null) setEstadoPantalla(val) }}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 1,
                        justifyItems: 'stretch',           // ← antes 'center'
                        '& .MuiToggleButton-root': {
                          justifySelf: 'stretch',          // ← ocupa toda la columna
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          p: 0,
                          m: 0,
                          borderRadius: 2,
                          overflow: 'hidden',
                          textTransform: 'none',
                          border: '2px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                        },
                        '& .MuiToggleButton-root.Mui-selected': {
                          borderColor: 'primary.main',
                          bgcolor: 'action.hover',
                        },
                      }}

                    >
                    {PANT_KEYS.map((k) => {
                      const o = CAT.esteticaPantalla.find(x => x.value === k)!
                      const demo = ESTETICA_PANTALLA_IMG[k]
                      return (
                        <ToggleButton key={k} value={k}>
                          <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
                            <Image
                              src={demo.src}
                              alt={o.label}
                              fill
                              draggable={false}
                              style={{ objectFit: 'cover', objectPosition: 'top center' }}
                            />
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); openDemoImg(demo.src, o.label) }}
                              sx={{
                                position: 'absolute', right: 8, bottom: 8,
                                bgcolor: 'rgba(0,0,0,0.45)', color: '#fff',
                                '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
                              }}
                            >
                              <ZoomInIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          <Box px={1.25} py={1} textAlign="center">
                            <Typography variant="body2" fontWeight={600} sx={{ minHeight: 24 }}>{o.label}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ minHeight: 32, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.desc}</Typography>
                          </Box>
                        </ToggleButton>
                      )
                    })}
                  </ToggleButtonGroup>
                  {/* Acciones + ayuda */}
                  <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'center' }}>
                    <Button size="small" startIcon={<ClearAllIcon />} onClick={() => setEstadoPantalla('')}>
                      Limpiar selección
                    </Button>
                  </Box>

                  <FormHelperText sx={{ textAlign: 'center' }}>
                    {estadoPantalla
                      ? CAT.esteticaPantalla.find(o => o.value === estadoPantalla)?.desc
                      : 'Selecciona un estado'}
                  </FormHelperText>

                  {/* Laterales y trasera: galería única + doble botón por tarjeta */}
                  
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                      <BrushIcon fontSize="small" />
                      <Typography variant="subtitle2">Laterales y trasera</Typography>

                      <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          onClick={() => estadoEspalda && setEstadoLados(estadoEspalda as EsteticaKey)}
                          disabled={!estadoEspalda}
                        >
                          Copiar trasera → laterales
                        </Button>
                        <Button
                          size="small"
                          onClick={() => estadoLados && setEstadoEspalda(estadoLados as EsteticaKey)}
                          disabled={!estadoLados}
                        >
                          Copiar laterales → trasera
                        </Button>
                        <Button size="small" startIcon={<ClearAllIcon />} onClick={() => { setEstadoLados(''); setEstadoEspalda('') }}>
                          Limpiar
                        </Button>
                      </Box>
                    </Stack>

                    {/* Resumen */}
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center" mb={2}>
                      <Chip label={`Laterales: ${LABEL_DESC[estadoLados as EsteticaKey]?.label || '—'}`} variant="outlined" />
                      <Chip label={`Trasera: ${LABEL_DESC[estadoEspalda as EsteticaKey]?.label || '—'}`} variant="outlined" />
                    </Stack>

                    {/* Galería */}
                    <Box
  sx={{
    display: 'grid',
    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' },
    gap: 2,
    justifyItems: 'stretch',   // ⬅️ estira cada celda
    alignItems: 'stretch',     // ⬅️ mismo alto de card por fila
  }}
>
  {(['sin_signos','minimos','algunos','desgaste_visible','agrietado_roto'] as EsteticaKey[]).map((k) => {
    const src = SHARED_EJEMPLOS[k]
    const selectedL = estadoLados === k
    const selectedB = estadoEspalda === k

    return (
      <Paper
        key={k}
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: (t) => (selectedL || selectedB ? t.palette.primary.main : t.palette.divider),
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',                 // ⬅️ llena la celda
        }}
      >
        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', bgcolor: '#000' }}>
          <Image
            src={src}
            alt={LABEL_DESC[k].label}
            fill
            style={{ objectFit: 'cover', objectPosition: 'top center' }}
            draggable={false}
          />
          <IconButton
            size="small"
            onClick={() => openDemoImg(src, LABEL_DESC[k].label)}
            sx={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              bgcolor: 'rgba(0,0,0,0.45)',
              color: '#fff',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Doble botón */}
        <Stack direction="row" spacing={1} sx={{ p: 1, justifyContent: 'center' }}>
          <ToggleButton
            value="lados"
            selected={selectedL}
            onClick={() => setEstadoLados(k)}
            size="small"
            sx={{
              flex: 1, minWidth: 0,                 // ⬅️ mismo ancho
              px: 1.5, py: 0.75, textTransform: 'none', whiteSpace: 'nowrap',
              borderColor: selectedL ? 'primary.main' : 'divider',
              '&.Mui-selected': { bgcolor: 'action.hover', color: 'primary.main' },
            }}
          >
            <VerticalSplitIcon fontSize="small" sx={{ mr: 0.75 }} />
            Laterales
          </ToggleButton>

          <ToggleButton
            value="trasera"
            selected={selectedB}
            onClick={() => setEstadoEspalda(k)}
            size="small"
            sx={{
              flex: 1, minWidth: 0,                 // ⬅️ mismo ancho
              px: 1.5, py: 0.75, textTransform: 'none', whiteSpace: 'nowrap',
              borderColor: selectedB ? 'primary.main' : 'divider',
              '&.Mui-selected': { bgcolor: 'action.hover', color: 'primary.main' },
            }}
          >
            <FlipToBackIcon fontSize="small" sx={{ mr: 0.75 }} />
            Trasera
          </ToggleButton>
        </Stack>

        {/* Texto con altura fija para evitar saltos */}
        <Box sx={{ px: 1.25, pb: 1, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight={600} sx={{ minHeight: 24 }}>
            {LABEL_DESC[k].label}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              minHeight: 32,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {LABEL_DESC[k].desc}
          </Typography>
        </Box>
      </Paper>
    )
  })}
</Box>

<FormHelperText sx={{ mt: 2, textAlign: 'center' }}>
  Elige la opción para <strong>Laterales</strong> o <strong>Trasera</strong> en cada tarjeta. Puedes copiar, limpiar o hacer zoom en los ejemplos.
</FormHelperText>

                  </Paper>
                
              

              {/* Mini resumen */}
              <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderColor: 'primary.light', bgcolor: 'action.hover' }}>
                <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                  <DevicesIcon fontSize="small" />
                  <Typography variant="subtitle2">Resumen rápido</Typography>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center">
                  <Chip label={`Tipo: ${tipo || '—'}`} />
                  <Chip label={`Modelo: ${modeloObj?.descripcion || '—'}`} />
                  <Chip label={`Capacidad: ${capacidadObj?.tamaño || '—'}`} />
                  <Chip
                    label={`Func. básica: ${funcBasica === 'ok' ? 'OK' : funcBasica ? 'Parcial' : '—'}`}
                    color={funcBasica === 'ok' ? 'success' : funcBasica ? 'warning' : 'default'}
                    variant="filled"
                  />
                  <Chip label={`Pantalla: ${pantallaIssues.length ? pantallaIssues.map(v => CAT.funcPantalla.find(i=>i.value===v)?.label).filter(Boolean).join(', ') : '—'}`} />
                  <Chip label={`Pantalla: ${CAT.esteticaPantalla.find(o=>o.value===estadoPantalla)?.label || '—'}`} color="primary" variant="outlined" />
                  <Chip label={`Lados: ${CAT.esteticaLados.find(o=>o.value===estadoLados)?.label || '—'}`} variant="outlined" />
                  <Chip label={`Espalda: ${CAT.esteticaEspalda.find(o=>o.value===estadoEspalda)?.label || '—'}`} variant="outlined" />
                  <Chip label={`Batería: ${saludBateria !== '' ? `${saludBateria}%` : '—'}`} />
                  {isLaptop && typeof ciclosBateria === 'number' && <Chip label={`${ciclosBateria} ciclos`} />}
                </Stack>
              </Paper>
            </Box>
          )}

          {/* Paso 3 - Valoración */}
          {activeStep === 2 && (
            <Box sx={{ mt: 2 }}>
              <Paper elevation={3} sx={{ p: 3, maxWidth: 980, mx: 'auto' }}>
                <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3}>
                  <Box flex={1}>
                    <Stack spacing={1.2}>
                      <Row icon={<DevicesIcon fontSize="small" />} label="Tipo" value={tipo || '-'} />
                      <Row icon={<SmartphoneIcon fontSize="small" />} label="Modelo" value={modeloObj?.descripcion || '-'} clamp />
                      <Row icon={<MemoryIcon fontSize="small" />} label="Capacidad" value={capacidadObj?.tamaño || '-'} />
                      <Row icon={<NumbersIcon fontSize="small" />} label="Cantidad" value={`${typeof cantidad === 'string' ? parseInt(cantidad) || 1 : cantidad}`} />
                      <Row
                        icon={<PsychologyIcon fontSize="small" />}
                        label="Funcionalidad"
                        value={
                          funcBasica === 'ok'
                            ? 'Todo funciona'
                            : funcBasica === 'parcial'
                            ? `No totalmente funcional${pantallaIssues.length ? ' · ' + pantallaIssues.map(v => CAT.funcPantalla.find(i=>i.value===v)?.label).filter(Boolean).join(', ') : ''}`
                            : '—'
                        }
                      />
                      <Row
                        icon={<BrushIcon fontSize="small" />}
                        label="Estética"
                        value={`Pantalla: ${CAT.esteticaPantalla.find(o=>o.value===estadoPantalla)?.label || '—'} · Lados: ${CAT.esteticaLados.find(o=>o.value===estadoLados)?.label || '—'} · Espalda: ${CAT.esteticaEspalda.find(o=>o.value===estadoEspalda)?.label || '—'}`}
                      />
                      <Row
                        icon={<BoltIcon fontSize="small" />}
                        label="Batería"
                        value={`${saludBateria !== '' ? `${saludBateria}%` : '—'}${isLaptop && typeof ciclosBateria === 'number' ? ` · ${ciclosBateria} ciclos` : ''}`}
                      />
                    </Stack>
                  </Box>

                  <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

                  <Box flex={1} display="flex" flexDirection="column" gap={2}>
                    <Box textAlign="center">
                      <Typography variant="overline" color="text.secondary">Valoración</Typography>
                      <Typography variant="h5" fontWeight={600}>{formatoBonito(estadoTexto)}</Typography>
                    </Box>

                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        borderColor: 'primary.light',
                        bgcolor: 'action.hover',
                      }}
                    >
                      <Typography variant="overline" color="text.secondary">Precio orientativo</Typography>
                      <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1 }}>
                        {precioCalculado === null ? '—' : fmtEUR(precioCalculado)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {precioCalculado === null ? 'Se valorará tras revisión técnica' : 'Estimación según estado'}
                      </Typography>
                    </Paper>
                  </Box>
                </Box>
              </Paper>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          zIndex: 1,
          justifyContent: 'center',
          gap: 1.5,
        }}
      >
        {activeStep === 2 && (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mr: 'auto', ml: 1 }}>
            <Chip icon={<StarIcon />} label={formatoBonito(estadoTexto)} color="primary" variant="outlined" />
            <Chip icon={<EuroIcon />} label={precioCalculado === null ? '—' : fmtEUR(precioCalculado)} />
          </Stack>
        )}

        <Button onClick={onClose}>Cancelar</Button>
        {activeStep > 0 && <Button onClick={handleAnterior}>Anterior</Button>}
        {activeStep < pasos.length - 1 && (
          <Button variant="contained" onClick={() => { if (puedeAvanzar()) handleSiguiente() }} disabled={!puedeAvanzar()}>
            Siguiente
          </Button>
        )}
        {activeStep === pasos.length - 1 && (
          <>
            <Tooltip title="Ctrl + Shift + Enter">
              <Button variant="outlined" onClick={() => handleSubmit(true)}>
                Guardar y añadir otro
              </Button>
            </Tooltip>
            <Tooltip title="Ctrl + Enter">
              <Button variant="contained" onClick={() => handleSubmit(false)}>
                Guardar
              </Button>
            </Tooltip>
          </>
        )}
      </DialogActions>

      {/* Visor de demo */}
      <Dialog open={demoOpen} onClose={closeDemo} maxWidth="md" fullWidth>
        <DialogTitle>{demo?.title}</DialogTitle>
        <DialogContent>
          {demo && (
            <Box sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              bgcolor: '#000',
              borderRadius: 1,
              overflow: 'hidden',
            }}>
              <Image
                src={demo.src}
                alt={demo.title}
                fill
                style={{ objectFit: 'contain' }}
                sizes="(max-width: 900px) 100vw, 900px"
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* --------- Helpers visuales --------- */

function Row({ icon, label, value, clamp = false }: { icon: React.ReactNode, label: string, value: React.ReactNode, clamp?: boolean }) {
  return (
    <Box display="flex" alignItems="flex-start" gap={1}>
      <Box mt="4px">{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}:</Typography>
        <Typography
          variant="body2"
          sx={clamp ? {
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'normal',
            maxWidth: { xs: '100%', sm: 360 },
          } : undefined}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  )
}

function SectionLabel({ text }: { text: string }) {
  return <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>{text}</Typography>
}
