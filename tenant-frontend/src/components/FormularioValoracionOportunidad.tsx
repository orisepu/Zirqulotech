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
  Chip,
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

import {
  getPrecioFinal,
  calcularEstadoValoracion,
  estadosFisicos,
  estadosFuncionales,
  formatoBonito,
} from '@/context/precios'

interface Props {
  oportunidadId: number           // PK numérico para el backend
  oportunidadUuid?: string        // UUID para keys de React Query (si lo tienes)
  onClose: () => void
  onSuccess: () => void
  item?: any
}

const pasos = ['Datos básicos', 'Estado del dispositivo', 'Valoración']

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
  const [modelo, setModelo] = useState<any>('')       // id numérico
  const [capacidad, setCapacidad] = useState<any>('') // id numérico
  const [estadoFisico, setEstadoFisico] = useState('')
  const [estadoFuncional, setEstadoFuncional] = useState('')
  const [modeloInicial, setModeloInicial] = useState<any | null>(null)

  const { tenant } = useParams()
  const queryClient = useQueryClient()

  // Key de oportunidad consistente con la página (UUID si lo tienes; si no, ID)
  const oppKey = String(oportunidadUuid ?? oportunidadId)

  // Oportunidad desde el caché (NO refetch aquí)
  const oppCache: any =
    queryClient.getQueryData(['oportunidad', oppKey]) ??
    queryClient.getQueryData(['oportunidad', String(oportunidadId)])

  // Canal prioritario; fallback a tipo_cliente (empresa/autonomo→B2B, particular→B2C)
  const canalRaw = (oppCache?.cliente?.canal ?? '').toString().toUpperCase()
  const tipoClienteRaw = (oppCache?.cliente?.tipo_cliente ?? '').toString().toLowerCase()
  const canalInferido = tipoClienteRaw === 'particular' ? 'B2C' : 'B2B'
  const tipoCliente = canalRaw === 'B2B' || canalRaw === 'B2C' ? canalRaw : canalInferido
  const esEmpresaAutonomo = tipoClienteRaw === 'empresa' || tipoClienteRaw === 'autonomo' || tipoCliente === 'B2B'

  // Configuración por oportunidad: cuestionario completo (solo se pregunta una vez)
  const oppCfgKey = ['oportunidad-config', String(oppKey)]
  const cfg = (queryClient.getQueryData(oppCfgKey) as { forzarCompleto?: boolean } | undefined)
  const [forzarCompleto, setForzarCompleto] = useState<boolean>(cfg?.forzarCompleto ?? false)
  const [cfgElegida, setCfgElegida] = useState<boolean | null>(
    typeof cfg?.forzarCompleto === 'boolean' ? cfg!.forzarCompleto! : (esEmpresaAutonomo ? null : true)
  )
  const saltarsePreguntas = esEmpresaAutonomo && !forzarCompleto
  const modoCompleto = !saltarsePreguntas

  // -------- Catálogos con React Query --------

  // Tipos (catálogo)
  const { data: tipos = [], isLoading: loadingTipos } = useQuery({
    queryKey: ['tipos-modelo'],
    queryFn: async () => (await api.get('/api/tipos-modelo/')).data,
    staleTime: 5 * 60 * 1000,
  })

  // Modelos por tipo
  const {
    data: modelos = [],
    isLoading: loadingModelos,
  } = useQuery({
    queryKey: ['modelos', tipo],
    enabled: !!tipo,
    queryFn: async () => (await api.get(`/api/modelos/?tipo=${tipo}`)).data,
    staleTime: 2 * 60 * 1000,
  })

  // Capacidades por modelo
  const {
    data: capacidades = [],
    isLoading: loadingCaps,
  } = useQuery({
    queryKey: ['capacidades-por-modelo', modelo],
    enabled: !!modelo,
    queryFn: async () => (await api.get(`/api/capacidades-por-modelo/?modelo=${modelo}&oportunidad=${oportunidadId}`)).data,
    staleTime: 2 * 60 * 1000,
  })

  // Inicializar "tipo" cuando llegan los tipos
  useEffect(() => {
    if (tipos.length && !tipos.includes(tipo)) {
      setTipo(tipos[0])
    }
  }, [tipos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Si editamos, precargar estados
  useEffect(() => {
    if (item?.modelo) {
      setModeloInicial(item.modelo)
      setModelo(item.modelo.id)
      setTipo(item.tipo || item.modelo.tipo)
    }
    if (item?.capacidad) setCapacidad(item.capacidad.id)
    setEstadoFisico(item?.estado_fisico || '')
    setEstadoFuncional(item?.estado_funcional || '')
    setCantidad(item?.cantidad || 1)
  }, [item])

  // Para B2B (empresa/autónomo) sin forzar, poner el mejor estado por defecto
  useEffect(() => {
    if (saltarsePreguntas) {
      setEstadoFisico('perfecto')
      setEstadoFuncional('funciona')
    }
  }, [saltarsePreguntas])

  // Objetos seleccionados
  const toNum = (v: any): number | null => {
    if (v === null || v === undefined) return null
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) ? Number(n) : null
  }

  // Objetos seleccionados
  const modeloObj = modelos.find((m: any) => m.id === modelo) || modeloInicial
  const capacidadObj = capacidades.find((c: any) => c.id === capacidad)

  // Precio base según canal (B2B/B2C) con TODOS los fallbacks y parseo
  useEffect(() => {
    if (!capacidadObj) {
      setPrecioBase(null)
      return
    }

    const b2b = toNum((capacidadObj as any).precio_b2b)
    const b2c = toNum((capacidadObj as any).precio_b2c)
    const estimado = toNum((capacidadObj as any).precio_estimado)
    const legacy = toNum((capacidadObj as any).precio) // por si el backend usa 'precio'

    // canal: B2C prioriza su precio; B2B prioriza el suyo; luego estimado/legacy
    const base =
      tipoCliente === 'B2C'
        ? (b2c ?? legacy ?? estimado ?? b2b)
        : (b2b ?? estimado ?? legacy ?? b2c)

    setPrecioBase(base ?? null)
  }, [capacidadObj, tipoCliente, oppKey, capacidades])

  const puedeAvanzar = () => {
    if (activeStep === 0) return !!tipo && !!modelo && !!capacidad && (!item ? Number(cantidad) > 0 : true)
    if (activeStep === 1) return !!estadoFisico && !!estadoFuncional
    return true
  }

  const handleSiguiente = () => {
    if (activeStep === 0 && saltarsePreguntas) {
      setActiveStep(2) // saltar preguntas y pasar a valoración
      return
    }
    if (activeStep < pasos.length - 1) setActiveStep((prev) => prev + 1)
  }

  const handleAnterior = () => {
    if (activeStep === 2 && saltarsePreguntas) {
      setActiveStep(0) // volver a datos básicos si se saltó el paso 2
      return
    }
    if (activeStep > 0) setActiveStep((prev) => prev - 1)
  }

  const handleSubmit = async (continuar = false) => {
    const cantidadNumRaw = typeof cantidad === 'string' ? parseInt(cantidad) || 1 : cantidad
    const cantidadNum = modoCompleto ? 1 : cantidadNumRaw
    const estado_valoracion = calcularEstadoValoracion(estadoFisico, estadoFuncional)

    let precio_orientativo: number | null = null
    if (estado_valoracion !== 'a_revision' && precioBase) {
      precio_orientativo = getPrecioFinal(estado_valoracion, precioBase)
    }

    // Validaciones mínimas
    if (!oportunidadId || Number.isNaN(Number(oportunidadId))) {
      alert('Falta el ID numérico de la oportunidad.')
      return
    }
    if (!modelo || !capacidad) {
      alert('Selecciona modelo y capacidad.')
      return
    }

    const data: any = {
      modelo_id: modelo,
      capacidad_id: capacidad,
      estado_fisico: estadoFisico,
      estado_funcional: estadoFuncional,
      estado_valoracion,
      tipo,
      precio_orientativo,
      cantidad: cantidadNum,
      oportunidad: Number(oportunidadId), // SIEMPRE PK numérico al backend
    }

    try {
      // Guardar / actualizar
      if (item) {
        if (tenant) {
          await api.put(`/api/global/dispositivo/${tenant}/${item.id}/`, data)
        } else {
          await api.put(`/api/dispositivos/${item.id}/`, data)
        }
      } else {
        if (tenant) {
          await api.post(`/api/global/dispositivos/${tenant}/${oportunidadId}/`, data)
        } else {
          await api.post('/api/dispositivos/', data)
        }
      }

      // Invalidate + refetch por la misma key que observa la página (UUID/ID)
      await queryClient.invalidateQueries({ queryKey: ['oportunidad', oppKey] })
      await queryClient.refetchQueries({ queryKey: ['oportunidad', oppKey], exact: true })

      await queryClient.invalidateQueries({ queryKey: ['dispositivos-reales', oppKey] })
      await queryClient.refetchQueries({ queryKey: ['dispositivos-reales', oppKey], exact: true })

      if (continuar) {
        setModelo('')
        setCapacidad('')
        setEstadoFisico('')
        setEstadoFuncional('')
        setPrecioBase(null)
        setCantidad(1)
        setActiveStep(0)
      } else {
        onSuccess() // cierra el modal cuando los datos ya están frescos
      }
    } catch (err) {
      console.error('Error al guardar:', err)
      alert('❌ Error al guardar el dispositivo.')
    }
  }

  const estadoTexto = calcularEstadoValoracion(estadoFisico, estadoFuncional)

  // Elegir modo una única vez por oportunidad y guardarlo en cache local
  const elegirModoOportunidad = (modoCompleto: boolean) => {
    setCfgElegida(modoCompleto)
    setForzarCompleto(modoCompleto)
    queryClient.setQueryData(oppCfgKey, (prev: any) => ({ ...(prev || {}), forzarCompleto: modoCompleto }))
  }

  // En modo completo, la cantidad debe ser siempre 1
  useEffect(() => {
    if (modoCompleto) setCantidad(1)
  }, [modoCompleto])

  if (esEmpresaAutonomo && cfgElegida === null) {
    return (
      <>
        <DialogTitle sx={{ textAlign: 'center' }}>Modo de cuestionario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5, textAlign: 'center' }}>
            Elige cómo valorar los dispositivos de esta oportunidad. Esta elección se recordará y aplicará al resto de dispositivos.
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Box sx={{ flex: 1, minWidth: 280, maxWidth: 420, mx: 'auto', textAlign: 'center' }}>
              <Button fullWidth color="primary" variant="contained" onClick={() => elegirModoOportunidad(true)}>Cuestionario completo</Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, textAlign: 'center' }}>
                Responderás estética y funcionalidad para ajustar mejor el precio.
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 280, maxWidth: 420, mx: 'auto', textAlign: 'center' }}>
              <Button fullWidth color="primary" variant="contained" onClick={() => elegirModoOportunidad(false)}>Rápido (usar "excelente")</Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, textAlign: 'center' }}>
                Se saltan preguntas y se valora como "excelente" por defecto. Precio más orientativo.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
        </DialogActions>
      </>
    )
  }

  return (
    <>
      <DialogTitle sx={{ textAlign: 'center' }}>{item ? 'Editar dispositivo' : 'Nuevo dispositivo'}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
          {pasos.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Paso 1 */}
        {activeStep === 0 && (
          <>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Tipo de producto</InputLabel>
              <Select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                label="Tipo de producto"
                disabled={loadingTipos}
              >
                {tipos.map((t: string) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
              {loadingTipos && <Typography variant="caption">Cargando tipos…</Typography>}
            </FormControl>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <Autocomplete
                options={modelos}
                getOptionLabel={(option: any) => option.descripcion}
                value={
                  modelos.find((m: any) => m.id === modelo) ||
                  (modeloInicial && { ...modeloInicial, id: modeloInicial.id }) ||
                  null
                }
                onChange={(_, newValue: any) => setModelo(newValue ? newValue.id : '')}
                renderInput={(params) => <TextField {...params} label="Modelo" />}
                disabled={loadingModelos || !tipo}
              />
              {loadingModelos && <Typography variant="caption">Cargando modelos…</Typography>}
            </FormControl>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Capacidad</InputLabel>
              <Select
                value={capacidad}
                onChange={(e) => setCapacidad(Number(e.target.value))}
                label="Capacidad"
                disabled={loadingCaps || !modelo}
              >
                {capacidades.map((c: any) => (
                  <MenuItem key={c.id} value={c.id}>{c.tamaño}</MenuItem>
                ))}
              </Select>
              {loadingCaps && <Typography variant="caption">Cargando capacidades…</Typography>}
            </FormControl>

            <TextField
              label="Cantidad"
              type="number"
              fullWidth
              sx={{ mt: 2 }}
              value={cantidad}
              disabled={modoCompleto}
              helperText={modoCompleto ? 'En modo completo, la cantidad es 1' : undefined}
              onChange={(e) => setCantidad(e.target.value)}
              onBlur={() => {
                if (modoCompleto) return
                const parsed = parseInt(cantidad as string)
                setCantidad(isNaN(parsed) ? 1 : parsed)
              }}
            />

            {esEmpresaAutonomo && (
              <Box sx={{ mt: 2 }}>
                <Chip
                  size="small"
                  color={forzarCompleto ? 'primary' : 'default'}
                  label={forzarCompleto ? 'Modo: Cuestionario completo' : 'Modo: Rápido (estado "excelente" por defecto)'}
                />
                {!forzarCompleto && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Se usará el estado &quot;excelente&quot; para calcular el precio.
                  </Typography>
                )}
              </Box>
            )}
          </>
        )}

        {/* Paso 2 */}
        {activeStep === 1 && !saltarsePreguntas && (
          <>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Estado estético</InputLabel>
              <Select
                value={estadoFisico}
                onChange={(e) => setEstadoFisico(e.target.value)}
                label="Estado estético"
              >
                {estadosFisicos.map((e) => (
                  <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Estado funcional</InputLabel>
              <Select
                value={estadoFuncional}
                onChange={(e) => setEstadoFuncional(e.target.value)}
                label="Estado funcional"
              >
                {estadosFuncionales.map((e) => (
                  <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}

        {/* Paso 3 */}
        {activeStep === 2 && (
          <Box sx={{ mt: 2 }}>
            

            <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
              <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }}>
                {/* Columna izquierda */}
                <Box flex={1} pr={{ sm: 2 }} mb={{ xs: 2, sm: 0 }}>
                  <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
                    <DevicesIcon fontSize="small" sx={{ mt: '4px' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Tipo:</Typography>
                      <Typography variant="body2">{tipo || '-'}</Typography>
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
                    <SmartphoneIcon fontSize="small" sx={{ mt: '4px' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Modelo:</Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'normal',
                          maxWidth: { xs: '100%', sm: 320 },
                        }}
                      >
                        {modeloObj?.descripcion || '-'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
                    <MemoryIcon fontSize="small" sx={{ mt: '4px' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Capacidad:</Typography>
                      <Typography variant="body2">{capacidadObj?.tamaño || '-'}</Typography>
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
                    <NumbersIcon fontSize="small" sx={{ mt: '4px' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Cantidad:</Typography>
                      <Typography variant="body2">
                        {typeof cantidad === 'string' ? parseInt(cantidad) || 1 : cantidad} unidad
                        {(typeof cantidad === 'string' ? (parseInt(cantidad) || 1) : cantidad) > 1 ? 'es' : ''}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Separador */}
                <Box
                  sx={{
                    width: '1px',
                    bgcolor: 'divider',
                    display: { xs: 'none', sm: 'block' },
                    alignSelf: 'stretch',
                  }}
                />

                {/* Columna derecha */}
                <Box flex={1} pl={{ sm: 4 }}>
                  {!(esEmpresaAutonomo && !modoCompleto) && (
                    <>
                      <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
                        <BrushIcon fontSize="small" sx={{ mt: '4px' }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary">Estético:</Typography>
                          <Typography variant="body2">{formatoBonito(estadoFisico)}</Typography>
                        </Box>
                      </Box>

                      <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
                        <PsychologyIcon fontSize="small" sx={{ mt: '4px' }} />
                        <Box>
                          <Typography variant="caption" color="text.secondary">Funcional:</Typography>
                          <Typography variant="body2">{formatoBonito(estadoFuncional)}</Typography>
                        </Box>
                      </Box>
                    </>
                  )}

                  <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
                    <StarIcon fontSize="small" sx={{ mt: '4px' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Valoración:</Typography>
                      <Typography variant="body2">{formatoBonito(estadoTexto)}</Typography>
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="flex-start" gap={1} mb={1}>
                    <EuroIcon fontSize="small" sx={{ mt: '4px' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Precio:</Typography>
                      <Typography variant="body2">
                        {estadoTexto === 'a_revision'
                          ? 'Se valorará tras revisión técnica'
                          : precioBase
                          ? `${getPrecioFinal(estadoTexto, precioBase)} €`
                          : '-'}
                      </Typography>
                      {esEmpresaAutonomo && !modoCompleto && precioBase && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Otros precios: Muy bueno {` ${getPrecioFinal('muy_bueno', precioBase)} €`}, Bueno {` ${getPrecioFinal('bueno', precioBase)} €`}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>

        {activeStep > 0 && <Button onClick={handleAnterior}>Anterior</Button>}

        {activeStep < pasos.length - 1 && (
          <Button variant="contained" onClick={handleSiguiente} disabled={!puedeAvanzar()}>
            Siguiente
          </Button>
        )}

        {activeStep === pasos.length - 1 && (
          <>
            <Button variant="outlined" onClick={() => handleSubmit(true)}>
              Guardar y añadir otro
            </Button>
            <Button variant="contained" onClick={() => handleSubmit(false)}>
              Guardar
            </Button>
          </>
        )}
      </DialogActions>
    </>
  )
}
