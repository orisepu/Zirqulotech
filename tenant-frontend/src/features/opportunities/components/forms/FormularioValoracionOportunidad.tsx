'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DialogTitle, DialogContent, DialogActions, Button, Tooltip, Chip, Stack, IconButton, Typography, Alert } from '@mui/material'
import api from '@/services/api'
import { getPrecioFinal, formatoBonito } from '@/context/precios'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import PasoDatosBasicos from './PasoDatosBasicos'
import PasoEstadoDispositivo from './PasoEstadoDispositivo'
import PasoEstetica from './PasoEstetica'
import PasoValoracion from './PasoValoracion'
import DemoViewer from './DemoViewer'
import { postValoracionIphoneComercial, postValoracionComercial, ValoracionComercialResponse } from '@/services/valoraciones'
import { getDeviceCapabilities } from '@/shared/utils/gradingCalcs'

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

type ModelOpt = { id: number | string; tipo?: string; descripcion: string; marca?: string }
type ModeloObj = ModelOpt
type CapOpt = { id: number | string }
type ItemDraft = {
  id?: number | string
  modelo?: ModelOpt
  capacidad?: CapOpt
  cantidad?: number
  tipo?: string
  salud_bateria_pct?: number
  ciclos_bateria?: number
  funcionalidad_basica?: 'ok' | 'parcial' | ''
  pantalla_funcional_puntos_bril?: boolean
  pantalla_funcional_pixeles_muertos?: boolean
  pantalla_funcional_lineas_quemaduras?: boolean
  estado_pantalla?: EsteticaKey
  estado_lados?: EsteticaKey
  estado_espalda?: EsteticaKey
}

type DebugDecision = {
  modo: 'completo' | 'rapido'
  fuente: string
  razones: string[]
  dispositivoId?: number | string
  dispositivoDescripcion?: string
}

type OportunidadLigera = {
  cliente?: { canal?: string | null; tipo_cliente?: string | null }
  dispositivos?: any[]
}

interface Props {
  oportunidadId: number
  oportunidadUuid?: string
  oportunidad?: OportunidadLigera | null
  onClose: () => void
  onSuccess: () => void
  item?: ItemDraft
}

export default function FormularioValoracionOportunidad({
  item, onClose, onSuccess, oportunidadId, oportunidadUuid, oportunidad,
}: Props) {
  const [activeStep, setActiveStep] = useState<number>(0)
  const [marca, setMarca] = useState<string>('')
  const [tipo, setTipo] = useState<string>('')
  const [precioBase, setPrecioBase] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState<number | string>(1)
  const [modelo, setModelo] = useState<number | string>('')
  const [capacidad, setCapacidad] = useState<number | string>('')
  const [modeloInicial, setModeloInicial] = useState<ModelOpt | null>(null)

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
  const [debugDecision, setDebugDecision] = useState<DebugDecision | null>(null)

  const { tenant } = useParams()
  const queryClient = useQueryClient()

  const oppKey = String(oportunidadUuid ?? oportunidadId)
  type OppCache = { cliente?: { canal?: string; tipo_cliente?: string }; dispositivos?: any[] }
  const oppCache = (oportunidad ??
    (queryClient.getQueryData(['oportunidad', oppKey]) as OppCache | undefined) ??
    (queryClient.getQueryData(['oportunidad', String(oportunidadId)]) as OppCache | undefined)
  )
  const dispositivosExistentes: any[] | undefined = useMemo(() => {
    if (Array.isArray(oportunidad?.dispositivos)) return oportunidad!.dispositivos!
    if (Array.isArray((oppCache as any)?.dispositivos)) return (oppCache as any).dispositivos as any[]
    return undefined
  }, [oportunidad?.dispositivos, oppCache])
  const prevDispositivosCountRef = useRef<number>(dispositivosExistentes?.length ?? 0)

  const canalRaw = (oppCache?.cliente?.canal ?? '').toString().toUpperCase()
  const tipoClienteRaw = (oppCache?.cliente?.tipo_cliente ?? '').toString().toLowerCase()
  const canalInferido = tipoClienteRaw === 'particular' ? 'B2C' : 'B2B'
  const tipoCliente = (canalRaw === 'B2B' || canalRaw === 'B2C') ? canalRaw : canalInferido
  const esEmpresaAutonomo = tipoClienteRaw === 'empresa' || tipoClienteRaw === 'autonomo' || tipoCliente === 'B2B'
  const esEmpresaB2B = tipoClienteRaw === 'empresa'

  const oppCfgKey = ['oportunidad-config', String(oppKey)]
  const cfg = queryClient.getQueryData(oppCfgKey) as { modo?: 'completo' | 'rapido' } | undefined
  const cfgModo = cfg?.modo

  // Configuración por oportunidad: cuestionario completo
  const [forzarCompleto, setForzarCompleto] = useState<boolean>(() => {
    if (esEmpresaB2B) return false
    if (!esEmpresaAutonomo) return true
    if (cfgModo === 'completo') return true
    if (cfgModo === 'rapido') return false
    return false
  })
  // null => no elegido aún (solo aplica para B2B). Para B2C: siempre completo => true
  const [cfgElegida, setCfgElegida] = useState<boolean | null>(() => {
    if (esEmpresaB2B) return false
    if (!esEmpresaAutonomo) return true
    if (cfgModo === 'completo') return true
    if (cfgModo === 'rapido') return false
    return null
  })
  const saltarsePreguntas = esEmpresaAutonomo && !forzarCompleto
  const modoCompleto = !saltarsePreguntas

  const analizarDispositivo = useCallback((disp: any): { modo: 'completo' | 'rapido'; razones: string[] } => {
    const razonesRapido: string[] = []
    const razonesCompleto: string[] = []

    if (!disp || typeof disp !== 'object') {
      return { modo: 'rapido', razones: ['Sin datos del dispositivo; se asume cuestionario rápido.'] }
    }

    const precios = disp?.precios_por_estado ?? disp?.precio_por_estado
    if (precios && typeof precios === 'object') {
      const valores = Object.values(precios as Record<string, unknown>).filter((v) => v !== null && v !== undefined)
      if (valores.length > 0) razonesRapido.push('La API devuelve precios por estado (excelente / muy bueno / bueno).')
    }
    const cantidadNum = Number((disp as Record<string, unknown>)?.cantidad)
    if (Number.isFinite(cantidadNum) && cantidadNum > 1) razonesRapido.push(`Cantidad declarada mayor a 1 (x${cantidadNum}).`)

    const salud = disp?.salud_bateria_pct
    const ciclos = disp?.ciclos_bateria
    const funcBas = disp?.funcionalidad_basica
    const pantallaIssues = [
      disp?.pantalla_funcional_puntos_bril,
      disp?.pantalla_funcional_pixeles_muertos,
      disp?.pantalla_funcional_lineas_quemaduras,
    ]
    const estetica = [disp?.estado_pantalla, disp?.estado_lados, disp?.estado_espalda]

    if (typeof salud === 'number') razonesCompleto.push(`Salud de batería informada (${salud}%).`)
    if (typeof ciclos === 'number') razonesCompleto.push(`Ciclos de batería informados (${ciclos}).`)
    if (funcBas && funcBas !== '' && funcBas !== 'ok') razonesCompleto.push(`Funcionalidad básica marcada como "${funcBas}".`)
    if (pantallaIssues[0] === true) razonesCompleto.push('Pantalla con puntos de brillo.')
    if (pantallaIssues[1] === true) razonesCompleto.push('Pantalla con píxeles muertos.')
    if (pantallaIssues[2] === true) razonesCompleto.push('Pantalla con líneas/quemaduras.')
    const partesEstetica = ['pantalla', 'laterales', 'espalda']
    estetica.forEach((val, idx) => {
      if (val && val !== 'sin_signos') {
        razonesCompleto.push(`Estética ${partesEstetica[idx]} marcada como "${formatoBonito(String(val))}".`)
      }
    })

    if (razonesCompleto.length > 0) {
      return { modo: 'completo', razones: razonesCompleto }
    }
    if (razonesRapido.length > 0) {
      return { modo: 'rapido', razones: razonesRapido }
    }
    return { modo: 'rapido', razones: ['Sin datos detallados; se mantiene cuestionario rápido.'] }
  }, [])

  const decisionDesdeDispositivos = useMemo(() => {
    if (!dispositivosExistentes?.length) return null
    let fallback: ({ modo: 'completo' | 'rapido'; razones: string[]; dispositivo: any }) | null = null
    for (const disp of dispositivosExistentes) {
      const resultado = analizarDispositivo(disp)
      const decision = { ...resultado, dispositivo: disp }
      if (resultado.modo === 'completo') return decision
      if (!fallback) fallback = decision
    }
    return fallback
  }, [dispositivosExistentes, analizarDispositivo])

  const sinDispositivosResetHecho = useRef(false)
  useEffect(() => {
    if (sinDispositivosResetHecho.current) return
    if (!esEmpresaAutonomo) return
    if (item?.id) return
    if (!Array.isArray(dispositivosExistentes)) return

    const cantidad = dispositivosExistentes.length
    if (cantidad > 0) {
      sinDispositivosResetHecho.current = true
      return
    }

    if (cfgModo === undefined && cfgElegida === null) {
      sinDispositivosResetHecho.current = true
      return
    }

    sinDispositivosResetHecho.current = true
    setCfgElegida(null)
    setForzarCompleto(false)
    queryClient.removeQueries({ queryKey: oppCfgKey, exact: true })
    setDebugDecision(null)
  }, [cfgModo, cfgElegida, dispositivosExistentes, esEmpresaAutonomo, item?.id, oppCfgKey, queryClient])

  const { data: marcas = [], isLoading: loadingMarcas } = useQuery({
    queryKey: ['marcas-modelo'],
    queryFn: async () => (await api.get('/api/marcas-modelo/')).data,
    staleTime: 5 * 60 * 1000,
  })

  const { data: modelos = [], isLoading: loadingModelos } = useQuery({
    queryKey: ['modelos', marca],
    enabled: !!marca,
    queryFn: async () => {
      const { data } = await api.get('/api/modelos/', { params: { marca, page_size: 500 } })
      return Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : [])
    },
    staleTime: 2 * 60 * 1000,
  })

  const { data: capacidades = [], isLoading: loadingCaps } = useQuery({
    queryKey: ['capacidades-por-modelo', modelo, oportunidadId],
    enabled: !!modelo,
    queryFn: async () => {
      // Solo incluir oportunidad si es un número válido
      const oppParam = (typeof oportunidadId === 'number' && !Number.isNaN(oportunidadId))
        ? `&oportunidad=${oportunidadId}`
        : ''
      return (await api.get(`/api/capacidades-por-modelo/?modelo=${modelo}${oppParam}`)).data
    },
    staleTime: 2 * 60 * 1000,
  })

  const handleMarcaChange = useCallback((value: string) => {
    setMarca((prev) => {
      if (prev === value) return prev
      setTipo('')
      setModelo('')
      setModeloInicial(null)
      setCapacidad('')
      return value
    })
  }, [])

  const handleTipoChange = useCallback((value: string) => {
    setTipo((prev) => {
      if (prev === value) return prev
      setModelo('')
      setModeloInicial(null)
      setCapacidad('')
      return value
    })
  }, [])

  const modelosArr = useMemo<ModeloObj[]>(() => {
    const raw: unknown[] = Array.isArray(modelos)
      ? (modelos as unknown[])
      : (Array.isArray((modelos as { results?: unknown[] })?.results)
          ? ((modelos as { results?: unknown[] }).results as unknown[])
          : [])
    const getField = (o: unknown, key: string): unknown => (o && typeof o === 'object') ? (o as Record<string, unknown>)[key] : undefined
    return raw
      .map((m): ModeloObj | null => {
        const id = getField(m, 'id')
        const descripcion = getField(m, 'descripcion')
        const tipoVal = getField(m, 'tipo')
        const marcaVal = getField(m, 'marca')
        const idOk = (typeof id === 'number' || typeof id === 'string') ? id : null
        const tipoOk = typeof tipoVal === 'string' ? tipoVal : undefined
        if (idOk === null) return null
        return {
          id: idOk,
          descripcion: String(descripcion ?? ''),
          tipo: tipoOk,
          marca: typeof marcaVal === 'string' ? marcaVal : undefined,
        }
      })
      .filter((m): m is ModeloObj => !!m && m.id != null && m.descripcion.length > 0)
  }, [modelos])

  const modelosFiltrados = useMemo<ModeloObj[]>(() => {
    return modelosArr.filter((m) => {
      const matchesMarca = marca ? (m.marca ? m.marca === marca : true) : true
      const matchesTipo = tipo ? (m.tipo ? m.tipo === tipo : false) : true
      return matchesMarca && matchesTipo
    })
  }, [modelosArr, marca, tipo])

  const tipos = useMemo(() => {
    const set = new Set<string>()
    modelosArr.forEach((m) => {
      if (marca && m.marca && m.marca !== marca) return
      if (m.tipo) set.add(m.tipo)
    })
    return Array.from(set)
  }, [modelosArr, marca])

  const loadingTipos = loadingModelos && !!marca && modelosArr.length === 0

  useEffect(() => {
    if (!marca) {
      setTipo('')
      return
    }
    if (!tipos.length) {
      setTipo('')
      return
    }
    if (!tipos.includes(tipo)) {
      setTipo(tipos[0])
    }
  }, [tipos, marca]) // eslint-disable-line

  useEffect(() => {
    if (item?.modelo) {
      setModeloInicial(item.modelo)
      if (item.modelo?.marca) setMarca(item.modelo.marca)
      setModelo(item.modelo.id)
      setTipo(item.tipo ?? item.modelo?.tipo ?? '')
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

  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : (typeof v === 'number' ? v : NaN)
    return Number.isFinite(n) ? Number(n) : null
  }

  const isLaptop = /\b(mac|macbook|laptop|portátil)\b/i.test(tipo || '')
  const capacidadesArr = useMemo(
    () => Array.isArray(capacidades)
      ? capacidades
      : (Array.isArray((capacidades as Record<string, unknown>)?.results as unknown[])
          ? ((capacidades as Record<string, unknown>).results as unknown[])
          : []),
    [capacidades]
  )
  const modeloObj = (modelosArr as Array<Record<string, unknown>>).find((m) => Number(m.id as number | string) === Number(modelo)) || modeloInicial
  const capacidadObj = (capacidadesArr as Array<Record<string, unknown>>).find((c) => Number(c.id as number | string) === Number(capacidad))

  // ---- costes de reparación por modelo/capacidad (fallbacks) ----
  // nota: pickNum ya no se usa

  useEffect(() => {
    if (!capacidadObj) { setPrecioBase(null); return }
    const getField = (o: unknown, key: string): unknown => (o && typeof o === 'object') ? (o as Record<string, unknown>)[key] : undefined
    const b2b = toNum(getField(capacidadObj, 'precio_b2b'))
    const b2c = toNum(getField(capacidadObj, 'precio_b2c'))
    const estimado = toNum(getField(capacidadObj, 'precio_estimado'))
    const legacy = toNum(getField(capacidadObj, 'precio'))
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
    if (saltarsePreguntas) {
      return ['Datos básicos', 'Valoración']
    }
    const filtered = [...STEPS].filter((s) => {
      if (!hasBattery && s === 'Batería') return false
      if (!hasScreen && (s === 'Pantalla (funcional)' || s === 'Estética pantalla')) return false
      return true
    })
    // Si solo queda un paso (p.ej. valoraciones simplificadas), duplicamos para mantener layout sin stepper
    return filtered.length >= 2 ? filtered : ['Datos básicos', 'Valoración']
  }, [hasScreen, hasBattery, saltarsePreguntas])

  const ocultarStepper =
    visibleSteps.length === 2 &&
    visibleSteps[0] === 'Datos básicos' &&
    visibleSteps[1] === 'Valoración'
  const mostrarStepper = !ocultarStepper

  // Clamp de activeStep si cambia la visibilidad
  useEffect(() => {
    if (activeStep > visibleSteps.length - 1) setActiveStep(visibleSteps.length - 1)
  }, [visibleSteps.length]) // eslint-disable-line

  // Elegir modo en esta sesión
  const persistirModo = useCallback((modoCompletoNuevo: boolean) => {
    if (esEmpresaB2B) {
      queryClient.setQueryData(oppCfgKey, { modo: 'rapido' })
      return
    }
    queryClient.setQueryData(oppCfgKey, { modo: modoCompletoNuevo ? 'completo' : 'rapido' })
  }, [esEmpresaB2B, oppCfgKey, queryClient])

  const aplicarModoOportunidad = useCallback((modoCompletoNuevo: boolean) => {
    if (esEmpresaB2B) {
      setCfgElegida(false)
      setForzarCompleto(false)
      persistirModo(false)
      setDebugDecision({
        modo: 'rapido',
        fuente: 'Tipo de cliente',
        razones: ['Cliente empresa: cuestionario rápido forzado.'],
      })
      return
    }
    setCfgElegida(modoCompletoNuevo)
    setForzarCompleto(modoCompletoNuevo)
    persistirModo(modoCompletoNuevo)
    setDebugDecision({
      modo: modoCompletoNuevo ? 'completo' : 'rapido',
      fuente: 'Selección manual',
      razones: [
        modoCompletoNuevo
          ? 'Selección manual: responder todas las preguntas del cuestionario.'
          : 'Selección manual: cuestionario rápido con estado "excelente" por defecto.',
      ],
    })
  }, [esEmpresaB2B, persistirModo])

  const elegirModoOportunidad = (modoCompleto: boolean) => {
    if (esEmpresaB2B) return
    aplicarModoOportunidad(modoCompleto)
  }

  useEffect(() => {
    if (esEmpresaB2B) {
      if (forzarCompleto !== false) setForzarCompleto(false)
      if (cfgElegida !== false) setCfgElegida(false)
      persistirModo(false)
      setDebugDecision((prev) => prev ?? {
        modo: 'rapido',
        fuente: 'Tipo de cliente',
        razones: ['Cliente empresa: cuestionario rápido forzado.'],
      })
    }
  }, [esEmpresaB2B, forzarCompleto, cfgElegida, persistirModo, setDebugDecision])

  useEffect(() => {
    const currentCount = dispositivosExistentes?.length ?? 0
    const prevCount = prevDispositivosCountRef.current
    prevDispositivosCountRef.current = currentCount

    if (!esEmpresaAutonomo) {
      if (cfgElegida !== true) setCfgElegida(true)
      if (!forzarCompleto) setForzarCompleto(true)
      persistirModo(true)
      setDebugDecision({
        modo: 'completo',
        fuente: 'Tipo de cliente',
        razones: ['El cliente es B2C/particular, se exige cuestionario completo.'],
      })
      return
    }

    const debeInferir = cfgElegida === null

    if (currentCount > 0) {
      const decision = decisionDesdeDispositivos
      if (debeInferir && decision) {
        const modoDetectado = decision.modo === 'completo'
        if (cfgElegida !== modoDetectado) setCfgElegida(modoDetectado)
        if (forzarCompleto !== modoDetectado) setForzarCompleto(modoDetectado)
        persistirModo(modoDetectado)
        setDebugDecision({
          modo: decision.modo,
          fuente: 'Dispositivos existentes',
          razones: decision.razones,
          dispositivoId: decision.dispositivo?.id,
          dispositivoDescripcion: decision.dispositivo?.modelo?.descripcion,
        })
      } else {
        persistirModo(forzarCompleto)
        setDebugDecision((prev) =>
          prev ?? {
            modo: forzarCompleto ? 'completo' : 'rapido',
            fuente: 'Preferencia actual',
            razones: ['Se mantiene el modo seleccionado anteriormente.'],
          }
        )
      }
      return
    }

    if (item?.id) {
      const decision = analizarDispositivo(item)
      if (debeInferir) {
        const modoDetectado = decision.modo === 'completo'
        if (cfgElegida !== modoDetectado) setCfgElegida(modoDetectado)
        if (forzarCompleto !== modoDetectado) setForzarCompleto(modoDetectado)
        persistirModo(modoDetectado)
        setDebugDecision({
          modo: decision.modo,
          fuente: 'Dispositivo en edición',
          razones: decision.razones,
          dispositivoId: item.id,
          dispositivoDescripcion: item?.modelo?.descripcion,
        })
      }
      return
    }

    if (prevCount > 0 && currentCount === 0) {
      setCfgElegida(null)
      setForzarCompleto(false)
      queryClient.removeQueries({ queryKey: oppCfgKey, exact: true })
      setDebugDecision(null)
    }
  }, [analizarDispositivo, cfgElegida, decisionDesdeDispositivos, dispositivosExistentes, esEmpresaAutonomo, forzarCompleto, item, persistirModo, queryClient, oppCfgKey])

  // En modo completo, fijar cantidad = 1
  useEffect(() => {
    if (modoCompleto) setCantidad(1)
  }, [modoCompleto])

  function derivarValoracion(): ValoracionDerivada {
    const hasLineas = pantallaIssues.includes('lineas')
    const incidenciasFunc = funcBasica === 'parcial' || pantallaIssues.length > 0
    const hayDanioGrave = estadoPantalla === 'agrietado_roto' || estadoLados === 'agrietado_roto' || estadoEspalda === 'agrietado_roto' || hasLineas

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
  const esIpad = /\bipad\b/i.test(tipo || '')
  const esComercial = true
  const isProd = typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
  const modoInformativo = oportunidadId === -1

  const puedeAvanzarStrict = () => {
    switch (current) {
      case 'Datos básicos':
        return !!marca && !!tipo && !!modelo && !!capacidad && (!item ? Number(cantidad) > 0 : true)
      case 'Batería':
        // iPhone/iPad: obligamos a responder encendido/carga; otros: libre
        return !esComercial || (enciende !== null && cargaOk !== null)
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
  const puedeAvanzar = () => (isProd ? puedeAvanzarStrict() : true)

  const handleSiguiente = () => {
    if (activeStep < visibleSteps.length - 1) setActiveStep(s => s + 1)
  }
  const handleAnterior = () => {
    if (activeStep > 0) setActiveStep(s => s - 1)
  }

  const blockingHint = (): string | null => {
    if (puedeAvanzar()) return null
    switch (current) {
      case 'Datos básicos':
        return 'Selecciona marca, tipo, modelo y capacidad.'
      case 'Batería':
        return 'Indica si enciende y si carga por cable.'
      case 'Funcionalidad':
        return 'Selecciona el estado de funcionalidad.'
      case 'Estética pantalla':
        return 'Selecciona el estado de la pantalla.'
      case 'Estética laterales/trasera':
        return 'Selecciona laterales y trasera.'
      default:
        return null
    }
  }

  const fmtEUR = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)

  const { estado_valoracion: estadoTexto, estado_fisico, estado_funcional } = derivarValoracion()

  // Si se saltan preguntas, fijar valores por defecto de mejor estado
  useEffect(() => {
    if (saltarsePreguntas) {
      setEnciende(true)
      setCargaOk(true)
      setFuncBasica('ok')
      setPantallaIssues([])
      setEstadoPantalla('sin_signos')
      setEstadoLados('sin_signos')
      setEstadoEspalda('sin_signos')
    }
  }, [saltarsePreguntas])

  /** Mapeos a enums del endpoint **/
  const toDisplayImageStatusApi = (issues: FuncPantallaValue[]) =>
    issues.includes('lineas') ? 'LINES' : (issues.includes('pixeles') || issues.includes('puntos')) ? 'PIX' : 'OK'

  const toGlassStatusApi = (k: EsteticaKey | '') => {
    switch (k) {
      case 'sin_signos': return 'NONE'
      case 'minimos': return 'MICRO'
      case 'algunos': return 'VISIBLE'
      case 'desgaste_visible': return 'DEEP'
      case 'agrietado_roto': return 'CRACK'
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
    if (!esComercial || !modelo || !capacidad) return null

    // Determinar capacidades del dispositivo
    const capabilities = getDeviceCapabilities(tipo)

    // Base payload (común para todos los dispositivos)
    const basePayload: Record<string, unknown> = {
      tenant,
      canal: tipoCliente,                 // 'B2B' | 'B2C'
      modelo_id: Number(modelo),
      capacidad_id: Number(capacidad),
      enciende,                           // true/false/null
      funcional_basico_ok: funcBasica === '' ? null : (funcBasica === 'ok'),
      housing_status: worstHousingApi(estToHousingApi(estadoLados), estToHousingApi(estadoEspalda)),
    }

    // Agregar campos de batería solo si el dispositivo tiene batería
    if (capabilities.hasBattery) {
      basePayload.carga = cargaOk
      basePayload.battery_health_pct = saludBateria === '' ? null : Number(saludBateria)
    }

    // Agregar campos de pantalla solo si el dispositivo tiene pantalla integrada
    if (capabilities.hasDisplay) {
      basePayload.display_image_status = toDisplayImageStatusApi(pantallaIssues)
      basePayload.glass_status = toGlassStatusApi(estadoPantalla)
    }

    return basePayload
  }, [esComercial, modelo, capacidad, tenant, tipoCliente, enciende, cargaOk, funcBasica, saludBateria, pantallaIssues, estadoPantalla, estadoLados, estadoEspalda, tipo])

  const readyForValoracion = useMemo(() => {
    if (!esComercial || !payloadIphone || !modelo || !capacidad) return false

    const capabilities = getDeviceCapabilities(tipo)

    // Enciende es requerido para todos
    if (enciende === null) return false

    // Carga es requerido solo si tiene batería
    if (capabilities.hasBattery && cargaOk === null) return false

    return true
  }, [esComercial, payloadIphone, modelo, capacidad, enciende, cargaOk, tipo])

  const {
    data: valoracionServer,
    isFetching: _fetchingValoracion,
    refetch: _refetchValoracion,
  } = useQuery<ValoracionComercialResponse>({
    queryKey: ['comercial-valoracion', tipo, payloadIphone] as const,
    queryFn: () => {
      // Usar endpoint genérico para todos los dispositivos
      // Fallback a iPhone para compatibilidad con tipos legacy
      const tipoDispositivo = tipo || 'iPhone'
      return postValoracionComercial(tipoDispositivo, payloadIphone!)
    },
    enabled: !!readyForValoracion,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  const precioCalculado = esComercial
    ? (valoracionServer?.oferta ?? null)
    : ((estadoTexto === 'a_revision' || !precioBase) ? null : getPrecioFinal(estadoTexto, precioBase))

  const precioMaximo = useMemo(() => {
    if (esComercial) {
      if (!valoracionServer) return null
      const maxCandidates = [valoracionServer.V_tope, valoracionServer.V_Aplus, valoracionServer.V_A]
      const max = maxCandidates.find((v) => typeof v === 'number' && !Number.isNaN(v))
      return (typeof max === 'number' ? max : null)
    }
    if (!precioBase) return null
    return getPrecioFinal('excelente', precioBase)
  }, [esComercial, valoracionServer, precioBase])

  const preciosComparativos = useMemo(() => {
    const maxValue = esComercial
      ? (valoracionServer?.V_tope ?? valoracionServer?.V_Aplus ?? null)
      : (precioBase ? getPrecioFinal('excelente', precioBase) : null)
    if (esComercial) {
      if (!valoracionServer) return []
      const items = [
        { etiqueta: 'A+', valor: valoracionServer.V_Aplus },
        { etiqueta: 'A', valor: valoracionServer.V_A },
        { etiqueta: 'B', valor: valoracionServer.V_B },
        { etiqueta: 'C', valor: valoracionServer.V_C },
      ]
      return items.filter((p) => {
        const isNumber = typeof p.valor === 'number' && !Number.isNaN(p.valor)
        return isNumber && (maxValue == null || p.valor !== maxValue)
      })
    }
    if (!precioBase) return []
    return [
      { etiqueta: 'Muy bueno', valor: getPrecioFinal('muy_bueno', precioBase) },
      { etiqueta: 'Bueno', valor: getPrecioFinal('bueno', precioBase) },
    ].filter((p) => maxValue == null || p.valor !== maxValue)
  }, [esComercial, valoracionServer, precioBase])

  const openDemo = (demo: { src: string; title: string }) => { setDemo(demo); setDemoOpen(true) }
  const closeDemo = () => setDemoOpen(false)

  const handleSubmit = async (continuar = false) => {
    const cantidadNumRaw = typeof cantidad === 'string' ? parseInt(cantidad) || 1 : cantidad
    const cantidadNum = modoCompleto ? 1 : cantidadNumRaw

    // Debug: mostrar valores para diagnosticar
    console.log('[FormularioValoracion] handleSubmit:', {
      oportunidadId,
      tipo: typeof oportunidadId,
      isNaN: Number.isNaN(Number(oportunidadId)),
      esNumerico: oportunidadId !== -1 && oportunidadId <= 0,
      modoInformativo,
    })

    // Validar que tengamos un ID válido (número > 0 o -1 para modo informativo)
    if (!oportunidadId || Number.isNaN(Number(oportunidadId)) || (oportunidadId !== -1 && oportunidadId <= 0)) {
      toast.error(`Falta el ID numérico de la oportunidad. (recibido: ${oportunidadId})`)
      return
    }

    // En modo informativo no se puede guardar
    if (modoInformativo) {
      toast.warning('No se puede guardar en modo informativo.')
      return
    }

    if (!modelo || !capacidad) {
      toast.error('Selecciona modelo y capacidad.')
      return
    }

    // Recalculamos en backend para guardar oferta más reciente (todos los dispositivos)
    let ofertaToSave: number | null = precioCalculado
    if (esComercial) {
      try {
        if (payloadIphone) {
          const tipoDispositivo = tipo || 'iPhone'
          const latest = await postValoracionComercial(tipoDispositivo, payloadIphone)
          ofertaToSave = latest?.oferta ?? valoracionServer?.oferta ?? null
        } else {
          ofertaToSave = valoracionServer?.oferta ?? null
        }
      } catch (e) {
        console.error(e)
        alert('No se pudo calcular la oferta del dispositivo (endpoint comercial).')
        return
      }
    }

    const data: Record<string, unknown> = {
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
        // Limpia todos los campos para un nuevo dispositivo
        setTipo('')
        setModeloInicial(null)
        setModelo('')
        setCapacidad('')
        setPrecioBase(null)
        setCantidad(1)
        setSaludBateria('')
        setCiclosBateria('')
        setFuncBasica('')
        setPantallaIssues([])
        setEstadoPantalla('')
        setEstadoLados('')
        setEstadoEspalda('')
        setEnciende(null)
        setCargaOk(null)
        setActiveStep(0)

        // En modo rápido (saltarsePreguntas), vuelve a fijar los defaults de mejor estado
        if (saltarsePreguntas) {
          setEnciende(true)
          setCargaOk(true)
          setFuncBasica('ok')
          setPantallaIssues([])
          setEstadoPantalla('sin_signos')
          setEstadoLados('sin_signos')
          setEstadoEspalda('sin_signos')
        }
      } else {
        onSuccess()
      }
    } catch (err) {
      console.error('Error al guardar:', err)
      alert('❌ Error al guardar el dispositivo.')
    }
  }

  // Paso previo: pregunta única por oportunidad (solo B2B)
  if (esEmpresaAutonomo && cfgElegida === null) {
    return (
      <>
        <DialogTitle>Modo de cuestionario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5, textAlign: 'center' }}>
            Elige cómo valorar los dispositivos de esta oportunidad. Esta selección se recordará y se aplicará a todos los dispositivos.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ justifyContent: 'center', alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
            <Box sx={{ flex: 1, minWidth: 280, maxWidth: 420, mx: 'auto', textAlign: 'center' }}>
              <Button fullWidth color="primary" variant="contained" onClick={() => elegirModoOportunidad(true)}>Cuestionario completo</Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, textAlign: 'center' }}>
                Responderás batería, funcionalidad y estética para ajustar mejor el precio.
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 280, maxWidth: 420, mx: 'auto', textAlign: 'center' }}>
              <Button fullWidth color="primary" variant="contained" onClick={() => elegirModoOportunidad(false)}>Cuestionario rápido</Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, textAlign: 'center' }}>
                Se saltan preguntas y se valora como "excelente" por defecto. Precio más orientativo.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancelar</Button>
        </DialogActions>
      </>
    )
  }

  return (
    <>
      

      <DialogContent>
        {/* Notas previas (comercial) — solo en Datos básicos */}
        {current === 'Datos básicos' && (
          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Notas importantes</Typography>
            <Typography variant="caption" display="block">• No hace falta IMEI/SN para calcular la valoración estimada.</Typography>
            <Typography variant="caption" display="block">• Si hay FMI/Activation Lock ON, MDM ON, el equipo no se aceptará.</Typography>
            <Typography variant="caption" display="block">• La recompra queda supeditada a la auditoría técnica y de autenticidad (bloqueos, piezas, diagnóstico completo).</Typography>
            <Typography variant="caption" display="block">• Si el cliente acepta la valoración resultante tras la auditoría, deberá emitir una factura a Zirqulo SL por valor de la misma.</Typography>
          </Alert>
        )}


        {mostrarStepper && (
          <>
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
          </>
        )}
        
        {current === 'Datos básicos' && (
          <PasoDatosBasicos
            marcas={Array.isArray(marcas) ? marcas : []}
            loadingMarcas={loadingMarcas}
            tipos={tipos}
            loadingTipos={loadingTipos}
            modelos={modelosFiltrados}
            loadingModelos={loadingModelos}
            capacidades={capacidadesArr}
            loadingCaps={loadingCaps}
            marca={marca} setMarca={handleMarcaChange}
            tipo={tipo} setTipo={handleTipoChange}
            modelo={modelo} setModelo={setModelo}
            modeloInicial={modeloInicial}
            capacidad={capacidad} setCapacidad={setCapacidad}
            cantidad={cantidad} setCantidad={setCantidad}
            isB2C={tipoCliente === 'B2C' || modoCompleto}
          />
        )}

        {current === 'Datos básicos' && esEmpresaAutonomo && (
          <Box sx={{ mt: 2 }}>
            
            {!forzarCompleto && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Se usará el estado &quot;excelente&quot; para calcular el precio.
              </Typography>
            )}
          </Box>
        )}

        {!saltarsePreguntas && current === 'Batería' && hasBattery && (
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

        {!saltarsePreguntas && current === 'Funcionalidad' && (
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

        {!saltarsePreguntas && current === 'Pantalla (funcional)' && hasScreen && (
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

        {!saltarsePreguntas && current === 'Estética pantalla' && hasScreen && (
          <PasoEstetica
            catalog={catalog}
            estadoPantalla={estadoPantalla} setEstadoPantalla={setEstadoPantalla}
            estadoLados={estadoLados} setEstadoLados={setEstadoLados}
            estadoEspalda={estadoEspalda} setEstadoEspalda={setEstadoEspalda}
            openDemo={openDemo}
            mode="screen"
          />
        )}

        {!saltarsePreguntas && current === 'Estética laterales/trasera' && (
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
          modeloObj && capacidadObj ? (
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
              precioMaximo={precioMaximo}
              fmtEUR={fmtEUR}
              formatoBonito={formatoBonito}
              catalog={catalog}
              mostrarDetalles={!(esEmpresaAutonomo && saltarsePreguntas)}
              otrosPrecios={preciosComparativos}
            />
          ) : (
            <Alert severity="warning" variant="outlined">
              Falta seleccionar <b>modelo</b> y <b>capacidad</b> para calcular la valoración.
            </Alert>
          )
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
          <Button onClick={onClose}>{modoInformativo ? 'Cerrar' : 'Cancelar'}</Button>
          {activeStep > 0 && <Button onClick={handleAnterior}>Anterior</Button>}
          {activeStep < visibleSteps.length - 1 && (
            <Button
              variant="contained"
              onClick={() => {
                if (isProd) {
                  if (puedeAvanzarStrict()) handleSiguiente()
                } else {
                  if (!puedeAvanzarStrict()) {
                    const msg = blockingHint() || 'Avanzas sin completar este paso.'
                    toast.warn(msg)
                  }
                  handleSiguiente()
                }
              }}
              disabled={isProd && !puedeAvanzarStrict()}
            >
              Siguiente
            </Button>
          )}
          {activeStep === visibleSteps.length - 1 && !modoInformativo && (
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

        {/* Mensaje de ayuda si el siguiente está deshabilitado */}
        {isProd && activeStep < visibleSteps.length - 1 && !puedeAvanzarStrict() && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {blockingHint()}
          </Typography>
        )}

        {/* Telemetría (debajo) — sólo en no-producción y con respuesta del backend */}
        {process.env.NODE_ENV !== 'production' && esComercial && valoracionServer && (() => {
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
                    const V2 = r.calculo?.aplica_pp_func ? Math.round(V1 * (1 - r.deducciones.pp_func)) : V1
                    const redondeo5 = Math.round(V2 / 5) * 5
                    const ofertaFinal = Math.max(redondeo5, r.params?.V_suelo ?? 0, 0)

                    const jsonDebug = {
                      input: payloadIphone, // enciende/carga/estética/etc. enviado al backend
                      topes: { Aplus: r.V_Aplus, A: r.V_A, B: r.V_B, C: r.V_C, V_suelo: r.params?.V_suelo ?? 0 },
                      deducciones: r.deducciones,
                      costes: {
                        bateria: r.params?.pr_bateria ?? 0,
                        pantalla: r.params?.pr_pantalla ?? 0,
                        chasis: r.params?.pr_chasis ?? 0,
                      },
                      suelo_regla: r.params?.v_suelo_regla,
                      calculo: {
                        V_tope: r.V_tope,
                        sum_deducciones: sumD,
                        V1,
                        aplica_pp_func: r.calculo?.aplica_pp_func ?? false,
                        V2,
                        redondeo5,
                        suelo: r.params?.V_suelo ?? 0,
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
                        <Box>V_suelo: <b>{fmtEUR(r.params?.V_suelo ?? 0)}</b> · <span style={{ opacity: .8 }}>{r.params?.v_suelo_regla?.label ?? 'N/A'}</span></Box>
                        <Box>V_tope usado: <b>{fmtEUR(r.V_tope)}</b></Box>

                        <Box sx={{ mt: .5 }}>
                          Deducciones: bat <b>{fmtEUR(r.deducciones.pr_bat)}</b> · pant <b>{fmtEUR(r.deducciones.pr_pant)}</b> · chas <b>{fmtEUR(r.deducciones.pr_chas)}</b>
                        </Box>

                        <Box>V1 = V_tope − (bat + pant + chas) = <b>{fmtEUR(V1)}</b></Box>
                        {r.calculo?.aplica_pp_func
                          ? <Box>V2 = V1 × (1 − pp_func <b>{Math.round(r.deducciones.pp_func * 100)}%</b>) ⇒ <b>{fmtEUR(V2)}</b></Box>
                          : <Box>V2 = V1 (sin penalización funcional) ⇒ <b>{fmtEUR(V1)}</b></Box>
                        }
                        <Box>Redondeo: round(V2 / 5) × 5 ⇒ <b>{fmtEUR(redondeo5)}</b></Box>
                        <Box>Suelo: max(Redondeo, V_suelo <b>{fmtEUR(r.params?.V_suelo ?? 0)}</b>, 0) ⇒ <b>{fmtEUR(ofertaFinal)}</b></Box>

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
