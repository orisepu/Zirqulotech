'use client'

// Debug helper (activable también en producción):
// - En consola: localStorage.setItem('AUD_DEBUG','1') o window.__AUD_DEBUG__ = true
const __AUD_DEBUG__ = typeof window !== 'undefined'
  && (((window as any).__AUD_DEBUG__ === true)
    || (typeof window.localStorage !== 'undefined' && window.localStorage.getItem('AUD_DEBUG') === '1')
    || process.env.NODE_ENV !== 'production'
    || process.env.NEXT_PUBLIC_AUD_DEBUG === '1')
const audLog = (...args: any[]) => { if (__AUD_DEBUG__) console.log('[AUD V2]', ...args) }

import React, { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepButton,
  Box,
  TextField,
} from '@mui/material'
import { getDeviceCapabilities } from '@/shared/utils/gradingCalcs'
import type { Grade } from '@/shared/types/grading'
import {
  buildCatalogByTipo,
  buildTituloAuditoria,
  inferTipoFromDispositivo,
  pickIdsFromDispositivo,
  type ValoresAuditoria,
} from './utils'
import { useGradingEngine, useValoracionTecnica } from './hooks'
import {
  PasoSeguridad,
  PasoBateria,
  PasoPantalla,
  PasoFuncional,
  PasoChasisEstetica,
  PasoDeducciones,
  PasoPrecioNotas,
  type FMIStatus,
  type SIMLockStatus,
  type MDMStatus,
  type BlacklistStatus,
} from './steps'
import type { DeduccionesManuales } from './utils/auditoriaTypes'
import { BannerEstadoPrecio, PanelDebugBackend } from './components'
import type { FuncPantallaValue, EsteticaKey, EsteticaPantallaKey } from '../tipos'

interface FormularioAuditoriaDispositivoV2Props {
  open: boolean
  dispositivo: Partial<ValoresAuditoria> | null
  onClose: () => void
  onSubmit: (val: ValoresAuditoria, opts?: { siguiente?: boolean }) => void
  titulo?: string
  modeloId?: number
  capacidadId?: number
  tenant?: string
  canal?: 'B2B' | 'B2C'
}

export default function FormularioAuditoriaDispositivoV2({
  open,
  dispositivo,
  onClose,
  onSubmit,
  titulo,
  modeloId,
  capacidadId,
  tenant,
  canal = 'B2B',
}: FormularioAuditoriaDispositivoV2Props) {
  // Estado de seguridad (Paso 1)
  const [fmiStatus, setFmiStatus] = useState<FMIStatus>('')
  const [simLock, setSimLock] = useState<SIMLockStatus>('')
  const [mdm, setMdm] = useState<MDMStatus>('')
  const [blacklist, setBlacklist] = useState<BlacklistStatus>('')
  const isSecurityKO = useMemo(
    () => fmiStatus === 'ON' || simLock === 'BLOQUEADO' || mdm === 'SI' || blacklist === 'REPORTADO',
    [fmiStatus, simLock, mdm, blacklist]
  )

  // Estado de energía (Paso 2)
  const [enciende, setEnciende] = useState<boolean | null>(null)
  const [cargaOk, setCargaOk] = useState<boolean | null>(null)
  const [cargaInalambrica, setCargaInalambrica] = useState<boolean | null>(null)

  // Estado de batería (Paso 3)
  const [saludBateria, setSaludBateria] = useState<number | ''>('')
  const [ciclosBateria, setCiclosBateria] = useState<number | ''>('')

  // Estado funcional (Paso 4)
  const [funcTelefoniaOK, setFuncTelefoniaOK] = useState<boolean | null>(null)
  const [funcAudioOK, setFuncAudioOK] = useState<boolean | null>(null)
  const [funcMicOK, setFuncMicOK] = useState<boolean | null>(null)
  const [funcCamarasOK, setFuncCamarasOK] = useState<boolean | null>(null)
  const [funcBiometriaOK, setFuncBiometriaOK] = useState<boolean | null>(null)
  const [funcWiFiOK, setFuncWiFiOK] = useState<boolean | null>(null)
  const [funcBTOK, setFuncBTOK] = useState<boolean | null>(null)
  const [funcPCOK, setFuncPCOK] = useState<boolean | null>(null)
  const [funcGPSOK, setFuncGPSOK] = useState<boolean | null>(null)
  const [funcNFCOK, setFuncNFCOK] = useState<boolean | null>(null)
  const [funcSensoresOK, setFuncSensoresOK] = useState<boolean | null>(null)
  const [funcVibracionOK, setFuncVibracionOK] = useState<boolean | null>(null)
  const [funcTactilOK, setFuncTactilOK] = useState<boolean | null>(null)

  const funcChecks = useMemo(
    () => [
      funcTelefoniaOK,
      funcAudioOK,
      funcMicOK,
      funcCamarasOK,
      funcBiometriaOK,
      funcWiFiOK,
      funcBTOK,
      funcPCOK,
      funcGPSOK,
      funcNFCOK,
      funcSensoresOK,
      funcVibracionOK,
      funcTactilOK,
    ],
    [
      funcTelefoniaOK,
      funcAudioOK,
      funcMicOK,
      funcCamarasOK,
      funcBiometriaOK,
      funcWiFiOK,
      funcBTOK,
      funcPCOK,
      funcGPSOK,
      funcNFCOK,
      funcSensoresOK,
      funcVibracionOK,
      funcTactilOK,
    ]
  )

  // Estado pantalla (Paso 5)
  const [pantallaIssues, setPantallaIssues] = useState<FuncPantallaValue[]>([])

  // Estado estética (Pasos 6 y 7)
  // Pantalla usa EsteticaPantallaKey para incluir 'astillado'
  const [estadoPantalla, setEstadoPantalla] = useState<EsteticaPantallaKey | ''>('')
  const [estadoLados, setEstadoLados] = useState<EsteticaKey | ''>('')
  const [estadoEspalda, setEstadoEspalda] = useState<EsteticaKey | ''>('')

  // Precio y observaciones
  const [observaciones, setObservaciones] = useState('')
  const [editadoPorUsuario, setEditadoPorUsuario] = useState(false)
  const [precioFinalManual, setPrecioFinalManual] = useState<number | null>(null)
  const [gradoManual, setGradoManual] = useState<Grade | null>(null)

  // Deducciones manuales
  const [deduccionesManuales, setDeduccionesManuales] = useState<DeduccionesManuales>({
    bateria: null,
    pantalla: null,
    chasis: null,
    costoReparacion: 0,
  })

  // Determinar tipo de dispositivo y capacidades
  const tipo = useMemo(() => inferTipoFromDispositivo(dispositivo), [dispositivo])
  const capabilities = useMemo(() => getDeviceCapabilities(tipo), [tipo])
  const catalog = useMemo(() => buildCatalogByTipo(tipo), [tipo])
  const ids = useMemo(() => pickIdsFromDispositivo(dispositivo), [dispositivo])

  // Integración backend
  const { valoracionTecnica } = useValoracionTecnica({
    enciende,
    cargaOk,
    cargaInalambrica,
    funcChecks,
    saludBateria,
    pantallaIssues,
    estadoPantalla,
    estadoLados,
    estadoEspalda,
    dispositivo,
    modeloId,
    capacidadId,
    tenant,
    canal,
    isSecurityKO,
  })

  // Motor de grading
  const { grado, precioFinal, deducciones, estadoDetallado, precioBase } = useGradingEngine({
    saludBateria,
    ciclosBateria,
    pantallaIssues,
    estadoPantalla,
    estadoLados,
    estadoEspalda,
    enciende,
    cargaOk,
    funcChecks,
    precio_por_estado: dispositivo?.precio_por_estado,
    valoracionTecnica,
    costoReparacion: deduccionesManuales.costoReparacion,
    deduccionBateriaManual: deduccionesManuales.bateria,
    deduccionPantallaManual: deduccionesManuales.pantalla,
    deduccionChasisManual: deduccionesManuales.chasis,
    isSecurityKO,
    editadoPorUsuario,
    gradoManual,
  })

  // Grado final: manual si existe, sino el calculado
  const gradoFinal = gradoManual ?? grado

  // Pasos visibles según capacidades del dispositivo (V1 style: 6 pasos)
  const pasos = useMemo(() => {
    if (isSecurityKO) return ['Seguridad', 'Precio y notas'] as const

    const steps = ['Seguridad']
    if (capabilities.hasBattery) steps.push('Batería')
    if (capabilities.hasDisplay) steps.push('Pantalla')
    steps.push('Funcionalidad', 'Exterior', 'Deducciones', 'Precio y notas')
    return steps as string[]
  }, [isSecurityKO, capabilities])

  const [step, setStep] = useState(0)
  const current = pasos[step]

  // Reset al abrir
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Sincronizar precioFinalManual con precioFinal calculado (solo si no editado manualmente)
  useEffect(() => {
    if (!editadoPorUsuario && precioFinal !== null) {
      setPrecioFinalManual(precioFinal)
    }
  }, [precioFinal, editadoPorUsuario])

  // Debug logging
  useEffect(() => {
    if (valoracionTecnica) {
      audLog('valoracionTecnica recibida', valoracionTecnica)
    }
  }, [valoracionTecnica])

  useEffect(() => {
    audLog('Estado grading', { grado, precioFinal, precioBase, deducciones, editadoPorUsuario, precioFinalManual })
  }, [grado, precioFinal, precioBase, deducciones, editadoPorUsuario, precioFinalManual])

  const handleNext = () => {
    if (step < pasos.length - 1) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleSubmit = () => {
    const finalPrecio = precioFinalManual ?? precioFinal
    const result: ValoresAuditoria = {
      id: dispositivo?.id as number,
      estado_valoracion: gradoFinal,
      ...estadoDetallado,
      precio_final: finalPrecio,
      precio_por_estado: dispositivo?.precio_por_estado,
      observaciones,
      editado_por_usuario: editadoPorUsuario,
    }
    audLog('Submitting auditoría', result)
    onSubmit(result)
  }

  const handleGuardarYSiguiente = () => {
    const finalPrecio = precioFinalManual ?? precioFinal
    const result: ValoresAuditoria = {
      id: dispositivo?.id as number,
      estado_valoracion: gradoFinal,
      ...estadoDetallado,
      precio_final: finalPrecio,
      precio_por_estado: dispositivo?.precio_por_estado,
      observaciones,
      editado_por_usuario: editadoPorUsuario,
    }
    audLog('Submitting auditoría (guardar y siguiente)', result)
    onSubmit(result, { siguiente: true })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{titulo || buildTituloAuditoria(dispositivo)}</DialogTitle>

      <DialogContent>
        {/* Banner global: siempre visible */}
        <BannerEstadoPrecio
          grado={gradoFinal}
          precioSugerido={precioFinalManual ?? precioFinal}
          precio_por_estado={dispositivo?.precio_por_estado}
        />

        <Stepper activeStep={step} nonLinear sx={{ mb: 3 }}>
          {pasos.map((label, index) => (
            <Step key={label}>
              <StepButton onClick={() => setStep(index)}>
                {label}
              </StepButton>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: 300 }}>
          {current === 'Seguridad' && (
            <PasoSeguridad
              fmiStatus={fmiStatus}
              setFmiStatus={setFmiStatus}
              simLock={simLock}
              setSimLock={setSimLock}
              mdm={mdm}
              setMdm={setMdm}
              blacklist={blacklist}
              setBlacklist={setBlacklist}
            />
          )}

          {current === 'Batería' && (
            <PasoBateria
              enciende={enciende}
              setEnciende={setEnciende}
              cargaOk={cargaOk}
              setCargaOk={setCargaOk}
              cargaInalambrica={cargaInalambrica}
              setCargaInalambrica={setCargaInalambrica}
              saludBateria={saludBateria}
              setSaludBateria={setSaludBateria}
              ciclosBateria={ciclosBateria}
              setCiclosBateria={setCiclosBateria}
            />
          )}

          {current === 'Funcionalidad' && (
            <PasoFuncional
              funcTelefoniaOK={funcTelefoniaOK}
              setFuncTelefoniaOK={setFuncTelefoniaOK}
              funcAudioOK={funcAudioOK}
              setFuncAudioOK={setFuncAudioOK}
              funcMicOK={funcMicOK}
              setFuncMicOK={setFuncMicOK}
              funcCamarasOK={funcCamarasOK}
              setFuncCamarasOK={setFuncCamarasOK}
              funcBiometriaOK={funcBiometriaOK}
              setFuncBiometriaOK={setFuncBiometriaOK}
              funcWiFiOK={funcWiFiOK}
              setFuncWiFiOK={setFuncWiFiOK}
              funcBTOK={funcBTOK}
              setFuncBTOK={setFuncBTOK}
              funcPCOK={funcPCOK}
              setFuncPCOK={setFuncPCOK}
              funcGPSOK={funcGPSOK}
              setFuncGPSOK={setFuncGPSOK}
              funcNFCOK={funcNFCOK}
              setFuncNFCOK={setFuncNFCOK}
              funcSensoresOK={funcSensoresOK}
              setFuncSensoresOK={setFuncSensoresOK}
              funcVibracionOK={funcVibracionOK}
              setFuncVibracionOK={setFuncVibracionOK}
              funcTactilOK={funcTactilOK}
              setFuncTactilOK={setFuncTactilOK}
            />
          )}

          {current === 'Pantalla' && (
            <PasoPantalla
              pantallaIssues={pantallaIssues}
              setPantallaIssues={setPantallaIssues}
              estadoPantalla={estadoPantalla}
              setEstadoPantalla={setEstadoPantalla}
              catalog={catalog}
            />
          )}

          {current === 'Exterior' && (
            <PasoChasisEstetica
              catalog={catalog}
              estadoLados={estadoLados}
              setEstadoLados={setEstadoLados}
              estadoEspalda={estadoEspalda}
              setEstadoEspalda={setEstadoEspalda}
            />
          )}

          {current === 'Deducciones' && (
            <PasoDeducciones
              deduccionesAutomaticas={{
                bateria: deducciones.bateria,
                pantalla: deducciones.pantalla,
                chasis: deducciones.chasis,
              }}
              deduccionesManuales={deduccionesManuales}
              setDeduccionesManuales={setDeduccionesManuales}
              precioBase={precioBase}
              precioFinal={precioFinal}
              saludBateria={saludBateria}
              tienePantallaIssues={
                Boolean(pantallaIssues.length) ||
                estadoPantalla === 'agrietado_roto' ||
                estadoPantalla === 'astillado'
              }
              tieneChasisDesgaste={
                estadoLados === 'desgaste_visible' ||
                estadoLados === 'agrietado_roto' ||
                estadoEspalda === 'desgaste_visible' ||
                estadoEspalda === 'agrietado_roto'
              }
            />
          )}

          {current === 'Precio y notas' && (
            <PasoPrecioNotas
              precioFinal={precioFinalManual ?? precioFinal}
              setPrecioFinal={setPrecioFinalManual}
              observaciones={observaciones}
              setObservaciones={setObservaciones}
              setEditadoPorUsuario={setEditadoPorUsuario}
              grado={gradoFinal}
              precioBase={precioBase}
              gradoCalculado={grado}
              gradoManual={gradoManual}
              setGradoManual={setGradoManual}
              deducciones={deducciones}
              costoReparacion={deduccionesManuales.costoReparacion}
              precioCalculado={precioFinal}
              precioSuelo={
                dispositivo?.precio_por_estado?.v_suelo ??
                dispositivo?.precio_por_estado?.V_suelo ??
                (dispositivo?.precio_por_estado as any)?.params?.V_suelo ??
                (dispositivo?.precio_por_estado as any)?.params?.v_suelo ??
                (dispositivo?.precio_por_estado as any)?.calculo?.suelo ??
                0
              }
            />
          )}

        </Box>
      </DialogContent>

      <DialogActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Box display="flex" gap={1}>
            <Button onClick={handleBack} disabled={step === 0}>
              Atrás
            </Button>
            {step < pasos.length - 1 ? (
              <Button onClick={handleNext} variant="contained">
                Siguiente
              </Button>
            ) : (
              <>
                <Button onClick={handleGuardarYSiguiente} variant="outlined">
                  Guardar y siguiente
                </Button>
                <Button onClick={handleSubmit} variant="contained" color="primary">
                  Guardar
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Panel debug (solo visible con __AUD_DEBUG__) */}
        {__AUD_DEBUG__ && (
          <PanelDebugBackend
            valoracionTecnica={valoracionTecnica ?? null}
            payload={undefined}
            isSecurityKO={isSecurityKO}
          />
        )}
      </DialogActions>
    </Dialog>
  )
}
