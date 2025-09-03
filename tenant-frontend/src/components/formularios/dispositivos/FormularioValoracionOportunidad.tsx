'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient,keepPreviousData } from '@tanstack/react-query'
import { DialogTitle, DialogContent, DialogActions, Button, Tooltip, Chip, Stack, IconButton, Typography } from '@mui/material'
import api from '@/services/api'
import { getPrecioFinal, formatoBonito } from '@/context/precios'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PasoDatosBasicos from './PasoDatosBasicos'
import PasoEstadoDispositivo from './PasoEstadoDispositivo'
import PasoEstetica from './PasoEstetica'
import PasoValoracion from './PasoValoracion'
import DemoViewer from './DemoViewer'
import { postValoracionIphoneComercial, ValoracionComercialResponse } from '@/services/valoraciones'

import { buildCatalogFor } from './catalogos'
import { buildIPadCatalog } from './catalogos-ipad'
import {
  buildMacProCatalog,
  buildMacStudioCatalog,
  buildMacMiniCatalog,
  buildMacBookAirCatalog,
  buildMacBookProCatalog,
  buildIMacCatalog,
} from './catalogos-mac'
import { STEPS, FormStep, ValoracionDerivada, CatalogoValoracion, FuncPantallaValue, EsteticaKey } from './tipos'
import { Stepper, Step, StepLabel, Box } from '@mui/material'
import SmartphoneIcon from '@mui/icons-material/Smartphone'
import BoltIcon from '@mui/icons-material/Bolt'
import PsychologyIcon from '@mui/icons-material/Psychology'
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor'
import BrushIcon from '@mui/icons-material/Brush'
import DevicesIcon from '@mui/icons-material/Devices'
import EuroIcon from '@mui/icons-material/Euro'

interface Props {
  oportunidadId: number
  oportunidadUuid?: string
  onClose: () => void
  onSuccess: () => void
  item?: any
}

export default function FormularioValoracionOportunidad({
  item, onClose, onSuccess, oportunidadId, oportunidadUuid,
}: Props) {
  const [activeStep, setActiveStep] = useState<number>(0)
  const [tipo, setTipo] = useState<string>('')
  const [precioBase, setPrecioBase] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState<number | string>(1)
  const [modelo, setModelo] = useState<any>('')
  const [capacidad, setCapacidad] = useState<any>('')
  const [modeloInicial, setModeloInicial] = useState<any | null>(null)

  const [saludBateria, setSaludBateria] = useState<number | ''>('') // 0–100
  const [ciclosBateria, setCiclosBateria] = useState<number | ''>('') // opcional
  const [funcBasica, setFuncBasica] = useState<'ok' | 'parcial' | ''>('')
  const [enciende, setEnciende] = useState<boolean | null>(null)
  const [cargaOk, setCargaOk] = useState<boolean | null>(null)
  const [pantallaIssues, setPantallaIssues] = useState<FuncPantallaValue[]>([])

  const [estadoPantalla, setEstadoPantalla] = useState<'' | EsteticaKey>('')
  const [estadoLados, setEstadoLados] = useState<'' | EsteticaKey>('')
  const [estadoEspalda, setEstadoEspalda] = useState<'' | EsteticaKey>('')

  const [demoOpen, setDemoOpen] = useState(false)
  const [demo, setDemo] = useState<{ src: string; title: string } | null>(null)

  const { tenant } = useParams()
  const queryClient = useQueryClient()

  const oppKey = String(oportunidadUuid ?? oportunidadId)
  const oppCache: any =
    queryClient.getQueryData(['oportunidad', oppKey]) ??
    queryClient.getQueryData(['oportunidad', String(oportunidadId)])

  const canalRaw = (oppCache?.cliente?.canal ?? '').toString().toUpperCase()
  const tipoCliente = canalRaw === 'B2B' || canalRaw === 'B2C'
    ? canalRaw
    : (oppCache?.cliente?.tipo_cliente ?? '').toString().toLowerCase() === 'empresa' ? 'B2B' : 'B2C'

  const { data: tipos = [], isLoading: loadingTipos } = useQuery({
    queryKey: ['tipos-modelo'],
    queryFn: async () => (await api.get('/api/tipos-modelo/')).data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: modelos = [], isLoading: loadingModelos } = useQuery({
    queryKey: ['modelos', tipo],
    enabled: !!tipo,
    queryFn: async () => {
      const { data } = await api.get(`/api/modelos/?tipo=${tipo}`)
      return Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
    },
    staleTime: 2 * 60 * 1000,
  })

  const { data: capacidades = [], isLoading: loadingCaps } = useQuery({
    queryKey: ['capacidades-por-modelo', modelo],
    enabled: !!modelo,
    queryFn: async () => (await api.get(`/api/capacidades-por-modelo/?modelo=${modelo}&oportunidad=${oportunidadId}`)).data,
    staleTime: 2 * 60 * 1000,
  })

  useEffect(() => {
    if (tipos.length && !tipos.includes(tipo)) setTipo(tipos[0])
  }, [tipos]) // eslint-disable-line

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

    const issues: FuncPantallaValue[] = []
    if (item?.pantalla_funcional_puntos_bril) issues.push('puntos')
    if (item?.pantalla_funcional_pixeles_muertos) issues.push('pixeles')
    if (item?.pantalla_funcional_lineas_quemaduras) issues.push('lineas')
    setPantallaIssues(issues)

    if (item?.estado_pantalla) setEstadoPantalla(item.estado_pantalla)
    if (item?.estado_lados) setEstadoLados(item.estado_lados)
    if (item?.estado_espalda) setEstadoEspalda(item.estado_espalda)
  }, [item])

  const toNum = (v: any): number | null => {
    if (v === null || v === undefined) return null
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
    return Number.isFinite(n) ? Number(n) : null
  }

  const isLaptop = /\b(mac|macbook|laptop|portátil)\b/i.test(tipo || '')
  const modelosArr = useMemo(
    () => Array.isArray(modelos)
      ? modelos
      : (Array.isArray((modelos as any)?.results) ? (modelos as any).results : []),
    [modelos]
  )
  const capacidadesArr = useMemo(
    () => Array.isArray(capacidades)
      ? capacidades
      : (Array.isArray((capacidades as any)?.results) ? (capacidades as any).results : []),
    [capacidades]
  )
  const modeloObj = modelosArr.find((m: any) => Number(m.id) === Number(modelo)) || modeloInicial
  const capacidadObj = capacidadesArr.find((c: any) => Number(c.id) === Number(capacidad))

  // ---- costes de reparación por modelo/capacidad (fallbacks) ----
  const pickNum = (o: any, keys: string[]): number | null => {
    if (!o) return null
    for (const k of keys) {
      const n = toNum((o as any)[k])
      if (n !== null) return n
    }
    return null
  }
  const prBateriaModelo =
    pickNum(capacidadObj, ['pr_bateria','precio_reparacion_bateria','repair_battery','precio_bateria','costo_bateria']) ??
    pickNum(modeloObj,    ['pr_bateria','precio_reparacion_bateria','repair_battery','precio_bateria','costo_bateria']) ??
    60

  const prPantallaModelo =
    pickNum(capacidadObj, ['pr_pantalla','precio_reparacion_pantalla','repair_display','precio_pantalla','precio_modulo_pantalla']) ??
    pickNum(modeloObj,    ['pr_pantalla','precio_reparacion_pantalla','repair_display','precio_pantalla','precio_modulo_pantalla']) ??
    120

  const prChasisModelo =
    pickNum(capacidadObj, ['pr_chasis','precio_reparacion_chasis','repair_housing','precio_carcasas','precio_back','precio_back_glass']) ??
    pickNum(modeloObj,    ['pr_chasis','precio_reparacion_chasis','repair_housing','precio_carcasas','precio_back','precio_back_glass']) ??
    140

  useEffect(() => {
    if (!capacidadObj) { setPrecioBase(null); return }
    const b2b = toNum((capacidadObj as any).precio_b2b)
    const b2c = toNum((capacidadObj as any).precio_b2c)
    const estimado = toNum((capacidadObj as any).precio_estimado)
    const legacy = toNum((capacidadObj as any).precio)
    const base = tipoCliente === 'B2C' ? (b2c ?? legacy ?? estimado ?? b2b) : (b2b ?? estimado ?? legacy ?? b2c)
    setPrecioBase(base ?? null)
  }, [capacidadObj, tipoCliente, oppKey, capacidades])

  const catalog: CatalogoValoracion = useMemo(() => {
    const t = (tipo || 'iPhone').toLowerCase()
    if (t.includes('ipad')) return buildIPadCatalog()
    if (t.includes('mac pro')) return buildMacProCatalog()
    if (t.includes('mac studio')) return buildMacStudioCatalog()
    if (t.includes('mac mini')) return buildMacMiniCatalog()
    if (t.includes('macbook air')) return buildMacBookAirCatalog()
    if (t.includes('macbook pro')) return buildMacBookProCatalog()
    if (t.includes('imac')) return buildIMacCatalog()
    return buildCatalogFor(tipo || 'iPhone')
  }, [tipo])

  // Flags de características
  const hasScreen = /\b(iphone|ipad|macbook|imac)\b/i.test(tipo || '')
  const hasBattery = /\b(iphone|ipad|macbook)\b/i.test(tipo || '')

  // Pasos visibles dinámicos
  const visibleSteps: FormStep[] = useMemo(() => {
    return [...STEPS].filter(s => {
      if (!hasBattery && s === 'Batería') return false
      if (!hasScreen && (s === 'Pantalla (funcional)' || s === 'Estética pantalla')) return false
      return true
    })
  }, [tipo, hasScreen, hasBattery])

  // Clamp de activeStep si cambia la visibilidad
  useEffect(() => {
    if (activeStep > visibleSteps.length - 1) setActiveStep(visibleSteps.length - 1)
  }, [visibleSteps.length]) // eslint-disable-line

  function derivarValoracion(): ValoracionDerivada {
    const hasLineas = pantallaIssues.includes('lineas')
    const incidenciasFunc = funcBasica === 'parcial' || pantallaIssues.length > 0
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

  const current = visibleSteps[activeStep]

  const esIphone = /\biphone\b/i.test(tipo || '')

  const puedeAvanzar = () => {
    switch (current) {
      case 'Datos básicos':
        return !!tipo && !!modelo && !!capacidad && (!item ? Number(cantidad) > 0 : true)
      case 'Batería':
        // iPhone: obligamos a responder encendido/carga; otros: libre
        return !esIphone || (enciende !== null && cargaOk !== null)
      case 'Funcionalidad':
        return !!funcBasica
      case 'Pantalla (funcional)':
        return true
      case 'Estética pantalla':
        return !!estadoPantalla
      case 'Estética laterales/trasera':
        return !!estadoLados && !!estadoEspalda
      case 'Valoración':
      default:
        return true
    }
  }

  const handleSiguiente = () => { if (activeStep < visibleSteps.length - 1) setActiveStep(s => s + 1) }
  const handleAnterior = () => { if (activeStep > 0) setActiveStep(s => s - 1) }

  const fmtEUR = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)

  const { estado_valoracion: estadoTexto, estado_fisico, estado_funcional } = derivarValoracion()

  /** Mapeos a enums del endpoint **/
  const toDisplayImageStatusApi = (issues: FuncPantallaValue[]) =>
    issues.includes('lineas') ? 'LINES' : (issues.includes('pixeles') || issues.includes('puntos')) ? 'PIX' : 'OK'

  const toGlassStatusApi = (k: EsteticaKey | '') => {
    switch (k) {
      case 'sin_signos': return 'NONE'
      case 'minimos': return 'MICRO'
      case 'algunos': return 'VISIBLE'
      case 'desgaste_visible': return 'DEEP'
      default: return 'NONE'
    }
  }
  const estToHousingApi = (k: EsteticaKey | '') => {
    switch (k) {
      case 'sin_signos': return 'SIN_SIGNOS'
      case 'minimos': return 'MINIMOS'
      case 'algunos': return 'ALGUNOS'
      case 'desgaste_visible': return 'DESGASTE_VISIBLE'
      case 'agrietado_roto': return 'DOBLADO'
      default: return 'SIN_SIGNOS'
    }
  }
  const worstHousingApi = (a: string, b: string) => {
    const rank: Record<string, number> = {
      SIN_SIGNOS: 0, MINIMOS: 1, ALGUNOS: 2, DESGASTE_VISIBLE: 3, DOBLADO: 4
    }
    return (rank[a] >= rank[b]) ? a : b
  }

  const payloadIphone = useMemo(() => {
    if (!esIphone || !modelo || !capacidad) return null
    return {
      tenant,
      canal: tipoCliente,                 // 'B2B' | 'B2C'
      modelo_id: Number(modelo),
      capacidad_id: Number(capacidad),
      enciende,                           // true/false/null
      carga: cargaOk,                     // true/false/null
      funcional_basico_ok: funcBasica === '' ? null : (funcBasica === 'ok'),
      battery_health_pct: saludBateria === '' ? null : Number(saludBateria),
      display_image_status: toDisplayImageStatusApi(pantallaIssues),
      glass_status: toGlassStatusApi(estadoPantalla),
      housing_status: worstHousingApi(estToHousingApi(estadoLados), estToHousingApi(estadoEspalda)),
    }
  }, [esIphone, modelo, capacidad, tenant, tipoCliente, enciende, cargaOk, funcBasica, saludBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda])

  const readyForValoracion =
    esIphone && !!payloadIphone &&
    enciende !== null && cargaOk !== null &&
    !!modelo && !!capacidad

  const {
    data: valoracionServer,
    isFetching: fetchingValoracion,
    refetch: refetchValoracion,
  } = useQuery<ValoracionComercialResponse>({
    queryKey: ['iphone-comercial-valoracion', payloadIphone] as const,
    queryFn: () => postValoracionIphoneComercial(payloadIphone!),
    enabled: !!readyForValoracion,
    placeholderData: keepPreviousData,   // ✅ reemplaza a keepPreviousData: true
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  const precioCalculado = esIphone
    ? (valoracionServer?.oferta ?? null)
    : ((estadoTexto === 'a_revision' || !precioBase) ? null : getPrecioFinal(estadoTexto, precioBase))

  const openDemo = (demo: { src: string; title: string }) => { setDemo(demo); setDemoOpen(true) }
  const closeDemo = () => setDemoOpen(false)

  const handleSubmit = async (continuar = false) => {
    const cantidadNum = typeof cantidad === 'string' ? parseInt(cantidad) || 1 : cantidad

    if (!oportunidadId || Number.isNaN(Number(oportunidadId))) { alert('Falta el ID numérico de la oportunidad.'); return }
    if (!modelo || !capacidad) { alert('Selecciona modelo y capacidad.'); return }

    // Si es iPhone, recalculamos en backend para guardar oferta más reciente
    let ofertaToSave: number | null = precioCalculado
    if (esIphone) {
      try {
        const latest = payloadIphone ? await postValoracionIphoneComercial(payloadIphone) : null
        ofertaToSave = latest?.oferta ?? valoracionServer?.oferta ?? null
      } catch (e) {
        console.error(e)
        alert('No se pudo calcular la oferta del dispositivo (endpoint comercial).')
        return
      }
    }

    const data: any = {
      modelo_id: modelo,
      capacidad_id: capacidad,
      estado_fisico,
      estado_funcional,
      estado_valoracion: estadoTexto,
      tipo,
      precio_orientativo: ofertaToSave, // ✅ oferta del backend si iPhone
      cantidad: cantidadNum,
      salud_bateria_pct: hasBattery ? (saludBateria === '' ? null : Number(saludBateria)) : null,
      ciclos_bateria: hasBattery ? (ciclosBateria === '' ? null : Number(ciclosBateria)) : null,
      funcionalidad_basica: funcBasica || null,
      pantalla_funcional_puntos_bril: hasScreen && pantallaIssues.includes('puntos'),
      pantalla_funcional_pixeles_muertos: hasScreen && pantallaIssues.includes('pixeles'),
      pantalla_funcional_lineas_quemaduras: hasScreen && pantallaIssues.includes('lineas'),
      estado_pantalla: hasScreen ? (estadoPantalla || null) : null,
      estado_lados: estadoLados || null,
      estado_espalda: estadoEspalda || null,
      oportunidad: Number(oportunidadId),
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
        setEnciende(null); setCargaOk(null)
        setActiveStep(0)
      } else {
        onSuccess()
      }
    } catch (err) {
      console.error('Error al guardar:', err)
      alert('❌ Error al guardar el dispositivo.')
    }
  }

  return (
    <>
      <DialogTitle>{item ? 'Editar dispositivo' : 'Nuevo dispositivo'}</DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Chip size="small" label={`Paso ${activeStep + 1} de ${visibleSteps.length}`} />
        </Box>

        <Stepper
          activeStep={activeStep}
          alternativeLabel
          sx={{
            mb: 3,
            '& .MuiStepIcon-root': { color: 'divider' },
            '& .MuiStepIcon-root.Mui-active': { color: 'primary.main' },
            '& .MuiStepIcon-root.Mui-completed': { color: 'success.main' },
            '& .MuiStepLabel-label': { color: 'text.secondary' },
            '& .MuiStepLabel-label.Mui-active': { color: 'primary.main', fontWeight: 700 },
            '& .MuiStepLabel-label.Mui-completed': { color: 'success.main' },
          }}
        >
          {visibleSteps.map((label) => {
            const icon =
              label === 'Datos básicos' ? <SmartphoneIcon /> :
                label === 'Batería' ? <BoltIcon /> :
                  label === 'Funcionalidad' ? <PsychologyIcon /> :
                    label === 'Pantalla (funcional)' ? <ScreenshotMonitorIcon /> :
                      label === 'Estética pantalla' ? <BrushIcon /> :
                        label === 'Estética laterales/trasera' ? <DevicesIcon /> :
                          /* Valoración */ <EuroIcon />
            return (
              <Step key={label}><StepLabel icon={icon}>{label}</StepLabel></Step>
            )
          })}
        </Stepper>

        {current === 'Datos básicos' && (
          <PasoDatosBasicos
            tipos={tipos}
            loadingTipos={loadingTipos}
            modelos={modelosArr}
            loadingModelos={loadingModelos}
            capacidades={capacidadesArr}
            loadingCaps={loadingCaps}
            tipo={tipo} setTipo={setTipo}
            modelo={modelo} setModelo={setModelo}
            modeloInicial={modeloInicial}
            capacidad={capacidad} setCapacidad={setCapacidad}
            cantidad={cantidad} setCantidad={setCantidad}
          />
        )}

        {current === 'Batería' && hasBattery && (
          <PasoEstadoDispositivo
            catalog={catalog}
            isLaptop={isLaptop}
            saludBateria={saludBateria} setSaludBateria={setSaludBateria}
            ciclosBateria={ciclosBateria} setCiclosBateria={setCiclosBateria}
            funcBasica={funcBasica} setFuncBasica={setFuncBasica}
            pantallaIssues={pantallaIssues} setPantallaIssues={setPantallaIssues}
            enciende={enciende} setEnciende={setEnciende}
            cargaOk={cargaOk} setCargaOk={setCargaOk}
            openDemo={openDemo}
            mode="battery"
          />
        )}

        {current === 'Funcionalidad' && (
          <PasoEstadoDispositivo
            catalog={catalog}
            isLaptop={isLaptop}
            saludBateria={saludBateria} setSaludBateria={setSaludBateria}
            ciclosBateria={ciclosBateria} setCiclosBateria={setCiclosBateria}
            funcBasica={funcBasica} setFuncBasica={setFuncBasica}
            pantallaIssues={pantallaIssues} setPantallaIssues={setPantallaIssues}
            openDemo={openDemo}
            mode="basic"
          />
        )}

        {current === 'Pantalla (funcional)' && hasScreen && (
          <PasoEstadoDispositivo
            catalog={catalog}
            isLaptop={isLaptop}
            saludBateria={saludBateria} setSaludBateria={setSaludBateria}
            ciclosBateria={ciclosBateria} setCiclosBateria={setCiclosBateria}
            funcBasica={funcBasica} setFuncBasica={setFuncBasica}
            pantallaIssues={pantallaIssues} setPantallaIssues={setPantallaIssues}
            openDemo={openDemo}
            mode="screen"
          />
        )}

        {current === 'Estética pantalla' && hasScreen && (
          <PasoEstetica
            catalog={catalog}
            estadoPantalla={estadoPantalla} setEstadoPantalla={setEstadoPantalla}
            estadoLados={estadoLados} setEstadoLados={setEstadoLados}
            estadoEspalda={estadoEspalda} setEstadoEspalda={setEstadoEspalda}
            openDemo={openDemo}
            mode="screen"
          />
        )}

        {current === 'Estética laterales/trasera' && (
          <PasoEstetica
            catalog={catalog}
            estadoPantalla={estadoPantalla} setEstadoPantalla={setEstadoPantalla}
            estadoLados={estadoLados} setEstadoLados={setEstadoLados}
            estadoEspalda={estadoEspalda} setEstadoEspalda={setEstadoEspalda}
            openDemo={openDemo}
            mode="body"
          />
        )}

        {current === 'Valoración' && (
          <PasoValoracion
            tipo={tipo}
            modeloObj={modeloObj}
            capacidadObj={capacidadObj}
            cantidad={cantidad}
            funcBasica={funcBasica}
            pantallaIssues={pantallaIssues}
            estadoPantalla={estadoPantalla}
            estadoLados={estadoLados}
            estadoEspalda={estadoEspalda}
            saludBateria={saludBateria}
            ciclosBateria={ciclosBateria}
            estadoTexto={estadoTexto}
            precioCalculado={precioCalculado}
            fmtEUR={fmtEUR}
            formatoBonito={formatoBonito}
            catalog={catalog}
          />
        )}
      </DialogContent>

      <DialogActions
        sx={{
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          zIndex: 1,
          flexDirection: 'column',
          gap: 1,
          py: 1.25,
        }}
      >
        {/* Fila de botones */}
        <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" sx={{ flexWrap: 'wrap', width: '100%' }}>
          <Button onClick={onClose}>Cancelar</Button>
          {activeStep > 0 && <Button onClick={handleAnterior}>Anterior</Button>}
          {activeStep < visibleSteps.length - 1 && (
            <Button variant="contained" onClick={() => { if (puedeAvanzar()) handleSiguiente() }} disabled={!puedeAvanzar()}>
              Siguiente
            </Button>
          )}
          {activeStep === visibleSteps.length - 1 && (
            <>
              <Tooltip title="Ctrl + Shift + Enter">
                <Button variant="outlined" onClick={() => handleSubmit(true)}>Guardar y añadir otro</Button>
              </Tooltip>
              <Tooltip title="Ctrl + Enter">
                <Button variant="contained" onClick={() => handleSubmit(false)}>Guardar</Button>
              </Tooltip>
            </>
          )}
        </Stack>

        {/* Telemetría (debajo) — sólo en no-producción y con respuesta del backend */}
        {process.env.NODE_ENV !== 'production' && esIphone && valoracionServer && (() => {
          const r = valoracionServer as ValoracionComercialResponse  // 👈 cast para que TS conozca el shape

          return (
            <Stack
              direction="row"
              spacing={0.75}
              justifyContent="center"
              alignItems="center"
              sx={{ flexWrap: 'wrap', width: '100%', mt: 0.5 }}
            >
              <Chip size="small" label={`Gate: ${r.gate}`} />
              <Chip size="small" label={`Grado: ${r.grado_estetico}`} />
              <Chip size="small" label={`V+ ${fmtEUR(r.V_Aplus)}`} />
              <Chip size="small" label={`V_tope ${fmtEUR(r.V_tope)}`} />
              <Chip size="small" color="primary" label={`Oferta ${fmtEUR(r.oferta)}`} />
              {r.deducciones.pr_bat > 0 && <Chip size="small" label={`-bat ${fmtEUR(r.deducciones.pr_bat)}`} />}
              {r.deducciones.pr_pant > 0 && <Chip size="small" label={`-pant ${fmtEUR(r.deducciones.pr_pant)}`} />}
              {r.deducciones.pr_chas > 0 && <Chip size="small" label={`-chas ${fmtEUR(r.deducciones.pr_chas)}`} />}

              <Tooltip
                arrow
                placement="top"
                title={
                  (() => {
                    const sumD = r.deducciones.pr_bat + r.deducciones.pr_pant + r.deducciones.pr_chas
                    const V1 = r.V_tope - sumD
                    const V2 = r.calculo.aplica_pp_func ? Math.round(V1 * (1 - r.deducciones.pp_func)) : V1
                    const redondeo5 = Math.round(V2 / 5) * 5
                    const ofertaFinal = Math.max(redondeo5, r.params.V_suelo, 0)

                    const jsonDebug = {
                      input: payloadIphone, // enciende/carga/estética/etc. enviado al backend
                      topes: { Aplus: r.V_Aplus, A: r.V_A, B: r.V_B, C: r.V_C, V_suelo: r.params.V_suelo },
                      deducciones: r.deducciones,
                      costes: {
                        bateria: r.params.pr_bateria,
                        pantalla: r.params.pr_pantalla,
                        chasis: r.params.pr_chasis,
                      },
                      suelo_regla: r.params.v_suelo_regla,
                      calculo: {
                        V_tope: r.V_tope,
                        sum_deducciones: sumD,
                        V1,
                        aplica_pp_func: r.calculo.aplica_pp_func,
                        V2,
                        redondeo5,
                        suelo: r.params.V_suelo,
                        oferta_final: ofertaFinal
                      },
                    }

                    return (
                      <Box sx={{ fontSize: 12, lineHeight: 1.35, maxWidth: 520 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: .5 }}>
                          Cálculo exacto de la oferta (backend)
                        </Typography>

                        <Box>Gate: <b>{r.gate}</b> · Grado estético: <b>{r.grado_estetico}</b></Box>
                        <Box>Topes — A+: <b>{fmtEUR(r.V_Aplus)}</b> · A: <b>{fmtEUR(r.V_A)}</b> · B: <b>{fmtEUR(r.V_B)}</b> · C: <b>{fmtEUR(r.V_C)}</b></Box>
                        <Box>V_suelo: <b>{fmtEUR(r.params.V_suelo)}</b> · <span style={{ opacity: .8 }}>{r.params.v_suelo_regla?.label}</span></Box>
                        <Box>V_tope usado: <b>{fmtEUR(r.V_tope)}</b></Box>

                        <Box sx={{ mt: .5 }}>
                          Deducciones: bat <b>{fmtEUR(r.deducciones.pr_bat)}</b> · pant <b>{fmtEUR(r.deducciones.pr_pant)}</b> · chas <b>{fmtEUR(r.deducciones.pr_chas)}</b>
                        </Box>

                        <Box>V1 = V_tope − (bat + pant + chas) = <b>{fmtEUR(V1)}</b></Box>
                        {r.calculo.aplica_pp_func
                          ? <Box>V2 = V1 × (1 − pp_func <b>{Math.round(r.deducciones.pp_func * 100)}%</b>) ⇒ <b>{fmtEUR(V2)}</b></Box>
                          : <Box>V2 = V1 (sin penalización funcional) ⇒ <b>{fmtEUR(V1)}</b></Box>
                        }
                        <Box>Redondeo: round(V2 / 5) × 5 ⇒ <b>{fmtEUR(redondeo5)}</b></Box>
                        <Box>Suelo: max(Redondeo, V_suelo <b>{fmtEUR(r.params.V_suelo)}</b>, 0) ⇒ <b>{fmtEUR(ofertaFinal)}</b></Box>

                        <Box sx={{ my: 1, borderTop: 1, borderColor: 'divider' }} />

                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: .25 }}>
                          JSON de depuración
                        </Typography>
                        <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(jsonDebug, null, 2)}
                        </Box>
                      </Box>
                    )
                  })()
                }
              >
                <IconButton size="small" sx={{ ml: 0.25 }}>
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )
        })()}

      </DialogActions>

      <DemoViewer open={demoOpen} demo={demo} onClose={closeDemo} />
    </>
  )
}
