'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CameraAltIcon from '@mui/icons-material/CameraAlt'

// Carga diferida de face-api (evita SSR/webpack)
let faceapi: any | null = null

export type CaptureMetrics = {
  trigger: 'auto' | 'manual'
  sharp: number           // nitidez (Laplaciano)
  diff: number            // diferencia inter-frame (movimiento)
  edges: number           // densidad de bordes (Sobel normalizado)
  brMean: number          // brillo medio (0..255)
  brStd: number           // desviación estándar de brillo
  mrz: 0 | 1              // heurística MRZ (reverso)
  stable: number          // frames seguidos estables
  side: 'anverso' | 'reverso' | null
  thresholds: {
    minSharpness: number
    minEdgeDensity: number
    brightnessRange: [number, number]
    movementThreshold: number
    stabilityFrames: number
    warmupMs: number
  }
  timestamp: number
}

type Props = {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
  title?: string
  lado: 'anverso' | 'reverso'

  // 🔧 Ajustes clave (todos opcionales)
  autoCapture?: boolean
  stabilityFrames?: number            // nº de frames seguidos cumpliendo calidad
  minSharpness?: number               // nitidez mínima (Laplaciano)
  minEdgeDensity?: number             // bordes mínimos (0..1)
  brightnessRange?: [number, number]  // rango válido de brillo medio
  movementThreshold?: number          // umbral de movimiento (diff inter-frame)
  warmupMs?: number                   // gracia inicial antes de autodisparar
  analysisIntervalMs?: number         // frecuencia de análisis (ms)
  requestTorch?: boolean              // intenta encender flash/torch si está
  faceModelsPath?: string             // ruta a modelos face-api (anverso)
  enforceSideOnManual?: boolean       // exigir lado correcto en captura manual
  jpegQuality?: number                // calidad JPEG de salida (0..1)
  maxOutputSide?: number              // tamaño máximo del lado mayor en px
  expectedAspect?: number             // aspecto del marco (p.ej. 1.586 DNI)

  // Heurísticas MRZ y Face
  mrzDarkBandRatio?: number           // proporción de píxeles oscuros en banda inferior
  mrzEdgeRatio?: number               // proporción de cambios en esa banda
  mrzWindow?: number                  // ventana para media móvil MRZ
  mrzAvgThreshold?: number            // umbral de frames con MRZ (media móvil)
  mrzBottomBandEdgeThreshold?: number // umbral alternativo con bordes en banda inferior

  faceWindow?: number                 // ventana para media móvil de cara
  facePresenceThreshold?: number      // % frames con cara para considerar anverso
  faceScoreThreshold?: number         // scoreThreshold del TinyFaceDetector
  faceInputSize?: number              // inputSize del detector

  // Depuración / callbacks
  debugHUD?: boolean
  onSideDetected?: (lado: 'anverso' | 'reverso' | null) => void
  onAutoMetrics?: (m: CaptureMetrics) => void
  showPreview?: boolean
}

export default function CameraDNI({
  open,
  onClose,
  onCapture,
  title = 'Escanear DNI',
  lado,
  autoCapture = true,

  // Defaults pensados para móviles medios en interior
  stabilityFrames = 3,
  minSharpness = 70,
  minEdgeDensity = 0.2,
  brightnessRange = [75, 250],
  movementThreshold = 10.0,
  warmupMs = 1000,
  analysisIntervalMs = 100,
  requestTorch = false,
  faceModelsPath = '/models',
  enforceSideOnManual = true,
  jpegQuality = 0.85,
  maxOutputSide = 1600,
  expectedAspect = 1.586, // aprox. DNI español (85.6 x 54 mm)

  // MRZ heurísticas
  mrzDarkBandRatio = 0.60,
  mrzEdgeRatio = 0.18,
  mrzWindow = 8,
  mrzAvgThreshold = 0.75,
  mrzBottomBandEdgeThreshold = 0.22,

  // Face heurísticas
  faceWindow = 6,
  facePresenceThreshold = 0.4,
  faceScoreThreshold = 0.4,
  faceInputSize = 224,

  // Debug y callbacks
  debugHUD = false,
  showPreview = false,
  onSideDetected,
  onAutoMetrics,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const frameRef = useRef<HTMLDivElement | null>(null)
  const [borderColor, setBorderColor] = useState<string>('rgba(255,255,255,0.9)')

  const workCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rotateCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null)
  const stableCountRef = useRef(0)
  const startTsRef = useRef<number>(0)

  const [hints, setHints] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showHUD, setShowHUD] = useState<boolean>(debugHUD)
  const [lastReadable, setLastReadable] = useState<{
    sharp: number
    edges: number
    brMean: number
    side: string
    stable: number
  } | null>(null)

  // Historial de MRZ (reverso) y cara (anverso)
  const mrzHistRef = useRef<number[]>([])
  const faceHistRef = useRef<number[]>([])
  const [faceReady, setFaceReady] = useState(false)

  // Timer del análisis
  const timerRef = useRef<number | null>(null)

  // Últimas métricas para callback/captura
  const lastMetricsRef = useRef<Omit<CaptureMetrics, 'trigger' | 'timestamp'>>({
    sharp: 0,
    diff: 0,
    edges: 0,
    brMean: 0,
    brStd: 0,
    mrz: 0,
    stable: 0,
    side: null,
    thresholds: {
      minSharpness,
      minEdgeDensity,
      brightnessRange,
      movementThreshold,
      stabilityFrames,
      warmupMs,
    },
  })

  // ---------- helpers ----------
  function toGray(data: Uint8ClampedArray) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const y = (r * 299 + g * 587 + b * 114) / 1000
      data[i] = data[i + 1] = data[i + 2] = y
    }
  }
  function sharpnessLaplacian(gray: Uint8ClampedArray, w: number, h: number) {
    const lap = [-1, -1, -1, -1, 8, -1, -1, -1, -1]
    const get = (x: number, y: number) => gray[(y * w + x) * 4]
    let sum = 0, sumSq = 0, count = 0
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let acc = 0, k = 0
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++) acc += get(x + kx, y + ky) * lap[k++]
        sum += acc
        sumSq += acc * acc
        count++
      }
    }
    const mean = sum / count, variance = sumSq / count - mean * mean
    return Math.sqrt(Math.max(variance, 0))
  }
  function frameDiff(curr: Uint8ClampedArray, prev: Uint8ClampedArray) {
    let diff = 0, count = 0
    for (let i = 0; i < curr.length; i += 4) {
      diff += Math.abs(curr[i] - prev[i]); count++
    }
    return diff / count
  }
  function edgeDensity(gray: Uint8ClampedArray, w: number, h: number) {
    const gxk = [-1, 0, 1, -2, 0, 2, -1, 0, 1],
          gyk = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
    const get = (x: number, y: number) => gray[(y * w + x) * 4]
    let edges = 0, total = 0
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let gx = 0, gy = 0, k = 0
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++) {
            const v = get(x + kx, y + ky)
            gx += v * gxk[k]; gy += v * gyk[k]; k++
          }
        const mag = Math.abs(gx) + Math.abs(gy)
        if (mag > 120) edges++
        total++
      }
    }
    return edges / Math.max(total, 1)
  }
  function brightnessStats(gray: Uint8ClampedArray) {
    let sum = 0, sumSq = 0, count = 0
    for (let i = 0; i < gray.length; i += 4) {
      const v = gray[i]; sum += v; sumSq += v * v; count++
    }
    const mean = sum / count, variance = sumSq / count - mean * mean
    return { mean, std: Math.sqrt(Math.max(variance, 0)) }
  }
  function hasMRZDarkBand(gray: Uint8ClampedArray, w: number, h: number) {
    const bandH = Math.floor(h * 0.25), y0 = h - bandH
    let dark = 0, tot = 0, edgeCount = 0
    for (let y = y0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = gray[(y * w + x) * 4]
        if (v < 110) dark++
        if (x > 0) {
          const pv = gray[(y * w + x - 1) * 4]
          if (Math.abs(v - pv) > 25) edgeCount++
        }
        tot++
      }
    }
    const darkRatio = dark / Math.max(tot, 1)
    const edgeRatio = edgeCount / Math.max(tot, 1)
    return { darkRatio, edgeRatio }
  }
  function edgeDensityBottomBand(gray: Uint8ClampedArray, w: number, h: number) {
    const bandH = Math.max(8, Math.floor(h * 0.25)), y0 = h - bandH
    const gxk = [-1, 0, 1, -2, 0, 2, -1, 0, 1],
          gyk = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
    const get = (x: number, y: number) => gray[(y * w + x) * 4]
    let edges = 0, total = 0
    for (let y = Math.max(1, y0); y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let gx = 0, gy = 0, k = 0
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++) {
            const v = get(x + kx, y + ky)
            gx += v * gxk[k]; gy += v * gyk[k]; k++
          }
        const mag = Math.abs(gx) + Math.abs(gy)
        if (mag > 120) edges++
        total++
      }
    }
    return edges / Math.max(total, 1)
  }
  function computeRoiOnVideo(video: HTMLVideoElement, frameEl: HTMLDivElement | null) {
    const vw = video.videoWidth, vh = video.videoHeight
    if (!vw || !vh || !frameEl) return null
    const vRect = video.getBoundingClientRect(), fRect = frameEl.getBoundingClientRect()
    const ix = Math.max(vRect.left, fRect.left),  iy = Math.max(vRect.top, fRect.top)
    const ax = Math.min(vRect.right, fRect.right), ay = Math.min(vRect.bottom, fRect.bottom)
    const iW = Math.max(0, ax - ix), iH = Math.max(0, ay - iy)
    if (iW < 10 || iH < 10) return null
    const scaleX = vw / vRect.width, scaleY = vh / vRect.height
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
    const sx = clamp((ix - vRect.left) * scaleX, 0, vw - 1)
    const sy = clamp((iy - vRect.top) * scaleY, 0, vh - 1)
    const sw = clamp(iW * scaleX, 8, vw - sx)
    const sh = clamp(iH * scaleY, 8, vh - sy)
    return { sx, sy, sw, sh }
  }

  // Carga de modelos de cara solo si lado=anverso
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (lado !== 'anverso') {
          setFaceReady(false); return
        }
        if (!faceapi) {
          faceapi = await import('@vladmandic/face-api')
          try { await faceapi.tf.setBackend('webgl') } catch {}
          await faceapi.tf.ready()
        }
        await faceapi.nets.tinyFaceDetector.loadFromUri(faceModelsPath)
        if (!cancelled) {
          setFaceReady(true)
          setHints((prev) => ['✅ Modelos cargados', ...prev])
        }
      } catch {
        if (!cancelled) {
          setFaceReady(false)
          setHints((prev) => ['❌ Faltan modelos de cara', ...prev])
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [lado, faceModelsPath])

  // Toggle HUD con tecla H
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === 'h') setShowHUD((s) => !s)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Abrir cámara
  useEffect(() => {
    if (!open) return
    let mounted = true
    async function start() {
      setError(null); setStarting(true)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (requestTorch) {
          const track = stream.getVideoTracks()[0]
          const caps = (track.getCapabilities?.() ?? {}) as any
          if (caps.torch) {
            try { await track.applyConstraints({ advanced: [{ torch: true }] } as any) } catch {}
          }
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        startTsRef.current = performance.now()
      } catch {
        setError('No se pudo acceder a la cámara. Revisa permisos o usa “Subir archivo”.')
      } finally { setStarting(false) }
    }
    start()
    return () => {
      mounted = false
      try { if (previewUrl) URL.revokeObjectURL(previewUrl) } catch {}
      setReady(false)
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null }
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
      prevFrameRef.current = null
      stableCountRef.current = 0
      mrzHistRef.current = []
      faceHistRef.current = []
      setHints([])
      setBorderColor('rgba(255,255,255,0.9)')
    }
  }, [open, requestTorch, previewUrl])

  // Reset al cambiar de lado
  useEffect(() => {
    prevFrameRef.current = null
    stableCountRef.current = 0
    mrzHistRef.current = []
    faceHistRef.current = []
    setHints([])
    setBorderColor('rgba(255,255,255,0.9)')
  }, [lado])

  // Bucle de análisis (throttled)
  useEffect(() => {
    if (!open || !autoCapture || !ready) return
    const video = videoRef.current
    if (!video) return

    const canvas =
      workCanvasRef.current || (workCanvasRef.current = document.createElement('canvas'))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const targetW = 300 // resolución de muestreo (baja para rendimiento)

    const tick = async () => {
      try {
        if (!video?.videoWidth) return

        // ROI
        const roi = computeRoiOnVideo(video, frameRef.current)
        if (!roi) return
        const { sx, sy, sw, sh } = roi

        // Draw ROI reescalado
        canvas.width = targetW
        canvas.height = Math.round(targetW * (sh / sw))
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = frame.data

        // Métricas base
        toGray(data)
        const sharp = sharpnessLaplacian(data, canvas.width, canvas.height)
        const prev = prevFrameRef.current
        const diffVal = prev ? frameDiff(data, prev) : 999
        prevFrameRef.current = data.slice(0)
        const { mean, std } = brightnessStats(data)
        const eDensity = edgeDensity(data, canvas.width, canvas.height)

        if (lado === 'reverso') {
          // --- SOLO MRZ ---
          const { darkRatio, edgeRatio } = hasMRZDarkBand(data, canvas.width, canvas.height)
          const bandEdge = edgeDensityBottomBand(data, canvas.width, canvas.height)
          const hasMrzFrame = darkRatio > mrzDarkBandRatio && edgeRatio > mrzEdgeRatio

          mrzHistRef.current.push(hasMrzFrame ? 1 : 0)
          if (mrzHistRef.current.length > mrzWindow) mrzHistRef.current.shift()
          const mrzAvg =
            mrzHistRef.current.reduce((a, b) => a + b, 0) / Math.max(1, mrzHistRef.current.length)

          const reversoLikely = mrzAvg >= mrzAvgThreshold || bandEdge >= mrzBottomBandEdgeThreshold
          const matchesExpectedSide = reversoLikely
          const sideForUI: 'anverso' | 'reverso' = reversoLikely ? 'reverso' : 'anverso'

          const sharpOK = sharp >= (minSharpness - 6) // relajamos un poco para MRZ
          const brightOK = mean >= brightnessRange[0] && mean <= brightnessRange[1]
          const edgesOK = eDensity >= Math.min(minEdgeDensity, 0.14)
          const isStable = !!prev && diffVal < movementThreshold
          const qualityOK = sharpOK && brightOK && edgesOK
          const cardPresent = matchesExpectedSide && qualityOK

          if (cardPresent && isStable) stableCountRef.current += 1
          else stableCountRef.current = 0

          const now = performance.now()
          if (cardPresent && isStable) setBorderColor('#22c55e')
          else if (!reversoLikely) setBorderColor('#ef4444')
          else setBorderColor('#f59e0b')

          setHints(() => {
            const tips: string[] = []
            if (!reversoLikely) tips.push('REVERSO requerido: no se aprecian líneas MRZ suficientes.')
            if (!brightOK) tips.push(mean < brightnessRange[0] ? 'Poca luz' : 'Demasiado brillo')
            if (!sharpOK) tips.push('Imagen poco nítida, enfoca mejor')
            if (!edgesOK) tips.push('Acerca o centra el DNI dentro del marco')
            if (!isStable) tips.push('Mantén el móvil más quieto')
            return tips.slice(0, 3)
          })

          const warmupOK = now - startTsRef.current > warmupMs
          if (warmupOK && matchesExpectedSide && qualityOK && isStable &&
              stableCountRef.current >= stabilityFrames) {
            stableCountRef.current = 0
            await handleCapture(true)
          }

          lastMetricsRef.current = {
            sharp: Math.round(sharp),
            diff: Math.round(diffVal * 10) / 10,
            edges: Math.round(eDensity * 100) / 100,
            brMean: Math.round(mean),
            brStd: Math.round(std),
            mrz: reversoLikely ? 1 : 0,
            stable: stableCountRef.current,
            side: sideForUI,
            thresholds: {
              minSharpness, minEdgeDensity, brightnessRange, movementThreshold, stabilityFrames, warmupMs,
            },
          }

          setLastReadable({
            sharp: Math.round(sharp),
            edges: Math.round(eDensity * 100) / 100,
            brMean: Math.round(mean),
            side: sideForUI,
            stable: stableCountRef.current,
          })

          onSideDetected?.(sideForUI)
        } else {
          // --- SOLO CARA (ANVERSO) ---
          let facePresent = false
          if (faceReady && faceapi) {
            try {
              const opts = new (faceapi as any).TinyFaceDetectorOptions({
                inputSize: faceInputSize,
                scoreThreshold: faceScoreThreshold,
              })
              let detections = await faceapi.detectAllFaces(canvas, opts)
              if (!detections || detections.length === 0) {
                // Reintento con 90º por si el móvil rota la textura
                const rot =
                  rotateCanvasRef.current || (rotateCanvasRef.current = document.createElement('canvas'))
                rot.width = canvas.height; rot.height = canvas.width
                const rctx = rot.getContext('2d')!
                rctx.setTransform(1, 0, 0, 1, 0, 0)
                rctx.translate(rot.width / 2, rot.height / 2)
                rctx.rotate(Math.PI / 2)
                rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
                detections = await faceapi.detectAllFaces(rot, opts)
              }
              facePresent = Array.isArray(detections) && detections.length > 0
            } catch {}
          }
          faceHistRef.current.push(facePresent ? 1 : 0)
          if (faceHistRef.current.length > faceWindow) faceHistRef.current.shift()
          const faceAvg =
            faceHistRef.current.reduce((a, b) => a + b, 0) / Math.max(1, faceHistRef.current.length)

          const anversoLikely = faceAvg >= facePresenceThreshold
          const matchesExpectedSide = anversoLikely
          const sideForUI: 'anverso' | 'reverso' = anversoLikely ? 'anverso' : 'reverso'

          const sharpOK = sharp >= minSharpness
          const brightOK = mean >= brightnessRange[0] && mean <= brightnessRange[1]
          const edgesOK = eDensity >= minEdgeDensity
          const isStable = !!prev && diffVal < movementThreshold
          const qualityOK = sharpOK && brightOK && edgesOK
          const cardPresent = matchesExpectedSide && qualityOK

          if (cardPresent && isStable) stableCountRef.current += 1
          else stableCountRef.current = 0

          const now = performance.now()
          if (cardPresent && isStable) setBorderColor('#22c55e')
          else if (!anversoLikely) setBorderColor('#ef4444')
          else setBorderColor('rgba(255,255,255,0.9)')

          setHints(() => {
            const tips: string[] = []
            if (!anversoLikely) tips.push('ANVERSO requerido: no detectamos la cara.')
            if (anversoLikely && facePresent) tips.push('✅ Anverso OK — cara detectada')
            if (!brightOK) tips.push(mean < brightnessRange[0] ? 'Poca luz' : 'Demasiado brillo')
            if (!sharpOK) tips.push('Imagen poco nítida, enfoca mejor')
            if (!edgesOK) tips.push('Acerca o centra el DNI dentro del marco')
            if (!isStable) tips.push('Mantén el móvil más quieto')
            return tips.slice(0, 3)
          })

          const warmupOK = now - startTsRef.current > warmupMs
          if (warmupOK && matchesExpectedSide && qualityOK && isStable &&
              stableCountRef.current >= stabilityFrames) {
            stableCountRef.current = 0
            await handleCapture(true)
          }

          lastMetricsRef.current = {
            sharp: Math.round(sharp),
            diff: Math.round(diffVal * 10) / 10,
            edges: Math.round(eDensity * 100) / 100,
            brMean: Math.round(mean),
            brStd: Math.round(std),
            mrz: anversoLikely ? 0 : 1,
            stable: stableCountRef.current,
            side: sideForUI,
            thresholds: {
              minSharpness, minEdgeDensity, brightnessRange, movementThreshold, stabilityFrames, warmupMs,
            },
          }

          setLastReadable({
            sharp: Math.round(sharp),
            edges: Math.round(eDensity * 100) / 100,
            brMean: Math.round(mean),
            side: sideForUI,
            stable: stableCountRef.current,
          })

          onSideDetected?.(sideForUI)
        }
      } finally {
        timerRef.current = window.setTimeout(tick, Math.max(200, analysisIntervalMs))
      }
    }

    timerRef.current = window.setTimeout(tick, analysisIntervalMs)
    return () => {
      if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null }
    }
  }, [
    open, autoCapture, ready,
    minSharpness, stabilityFrames, minEdgeDensity,
    lado, brightnessRange, analysisIntervalMs,
    movementThreshold, warmupMs,
    mrzDarkBandRatio, mrzEdgeRatio, mrzWindow, mrzAvgThreshold, mrzBottomBandEdgeThreshold,
    faceReady, faceWindow, facePresenceThreshold, faceScoreThreshold, faceInputSize,
  ])

  async function handleCapture(isAuto = false) {
    const v = videoRef.current
    if (!v) return

    // Bloqueo manual coherente por lado
    if (!isAuto && enforceSideOnManual && lado) {
      if (lado === 'reverso') {
        const ok = lastMetricsRef.current.side === 'reverso'
        if (!ok) {
          setBorderColor('#ef4444')
          setHints(['REVERSO requerido: no se aprecian líneas MRZ suficientes.'])
          return
        }
      } else {
        const ok = lastMetricsRef.current.side === 'anverso'
        if (!ok) {
          setBorderColor('#ef4444')
          setHints(['ANVERSO requerido: no detectamos la cara.'])
          return
        }
      }
    }

    // ROI actual
    const roi = computeRoiOnVideo(v, frameRef.current)
    const sx = roi?.sx ?? v.videoWidth * 0.05
    const sy = roi?.sy ?? v.videoHeight * 0.05
    const sw = roi?.sw ?? v.videoWidth * 0.9
    const sh = roi?.sh ?? v.videoHeight * 0.9

    const scale = Math.min(1, maxOutputSide / Math.max(sw, sh))
    const outW = Math.round(sw * scale), outH = Math.round(sh * scale)

    const outCanvas = document.createElement('canvas')
    outCanvas.width = outW; outCanvas.height = outH
    const octx = outCanvas.getContext('2d')!
    octx.drawImage(v, sx, sy, sw, sh, 0, 0, outW, outH)

    if (onAutoMetrics) {
      onAutoMetrics({
        ...lastMetricsRef.current,
        trigger: isAuto ? 'auto' : 'manual',
        timestamp: Date.now(),
      })
    }

    outCanvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `dni_${lado || 'captura'}.jpg`, { type: 'image/jpeg' })
      // Vista previa interna
      try { if (previewUrl) URL.revokeObjectURL(previewUrl) } catch {}
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      onCapture(file)
    }, 'image/jpeg', jpegQuality)
  }

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <DialogTitle sx={{ pr: 6 }}>
        {title}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }} aria-label="Cerrar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {starting && <LinearProgress />}

      <DialogContent sx={{ p: 0, position: 'relative', bgcolor: 'black' }}>
        {error ? (
          <Box p={2}>
            <Typography color="error">{error}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              También puedes usar “Subir archivo” para seleccionar una foto desde la galería.
            </Typography>
          </Box>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              preload="none"
              controls={false}
              onLoadedMetadata={() => setReady(true)}
              onCanPlay={() => setReady(true)}
              onLoadedData={() => setReady(true)}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                objectFit: 'cover',
                position: 'relative',
                zIndex: 0,
              }}
            />

            {/* Overlay ROI (sin bloquear eventos) */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <Box
                ref={frameRef}
                sx={{
                  width: { xs: '90vw', sm: '70vw' },
                  aspectRatio: `${expectedAspect} / 1`,
                  border: `4px solid ${borderColor}`,
                  borderRadius: 2,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                  transition: 'border-color 120ms linear',
                }}
              />

              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  color: 'rgba(255,255,255,0.92)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  px: 1,
                  borderRadius: 1,
                  bgcolor: 'rgba(0,0,0,0.25)',
                }}
              >
                {autoCapture
                  ? 'Alinea el DNI en el marco: se capturará automáticamente cuando esté estable y nítido.'
                  : 'Alinea el DNI en el marco y pulsa Capturar.'}
              </Typography>

              {hints.length > 0 && (
                <Stack spacing={1} sx={{ position: 'absolute', top: 16, left: 16, pointerEvents: 'none' }}>
                  {hints.slice(0, 3).map((h, i) => (
                    <Chip key={i} label={h} size="small" color="warning" />
                  ))}
                </Stack>
              )}

              {/* HUD de métricas (toggle con tecla H) */}
              {showHUD && lastReadable && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    pointerEvents: 'none',
                    bgcolor: 'rgba(0,0,0,0.45)',
                    color: '#fff',
                    p: 1,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="caption">sharp: {lastReadable.sharp}</Typography><br />
                  <Typography variant="caption">edges: {lastReadable.edges}</Typography><br />
                  <Typography variant="caption">br: {lastReadable.brMean}</Typography><br />
                  <Typography variant="caption">lado: {lastReadable.side}</Typography><br />
                  <Typography variant="caption">stable: {lastReadable.stable}</Typography>
                </Box>
              )}
            </Box>

            {/* Botón Capturar manual (fuera del overlay) */}
            <Box sx={{ position: 'absolute', bottom: 24, right: 24, zIndex: 2 }}>
              <Tooltip title="Capturar (manual)">
                <IconButton
                  onClick={() => handleCapture(false)}
                  sx={{
                    width: 64,
                    height: 64,
                    border: '4px solid white',
                    bgcolor: 'rgba(0,0,0,0.35)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                  aria-label="Capturar"
                >
                  <CameraAltIcon sx={{ fontSize: 32, color: 'white' }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Miniatura última captura (fuera del overlay) */}
            {showPreview && previewUrl && (
              <Box sx={{ position: 'absolute', bottom: 24, left: 24, zIndex: 2 }}>
                <Box
                  sx={{
                    width: 96,
                    height: 96,
                    borderRadius: 1,
                    overflow: 'hidden',
                    boxShadow: 3,
                    border: '2px solid rgba(255,255,255,0.8)',
                    bgcolor: 'black',
                  }}
                >
                  <img
                    src={previewUrl}
                    alt="Captura DNI"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <canvas ref={workCanvasRef} style={{ display: 'none' }} />
    </Dialog>
  )
}
