import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { postValoracionIphoneAuditoria, type ValoracionTecnicaResponse } from '@/services/valoraciones'
import type { EsteticaKey, EsteticaPantallaKey, FuncPantallaValue } from '../../tipos'
import { getModeloSerieCapacidad, pickIdsFromDispositivo } from '../utils/auditoriaHelpers'

interface UseValoracionTecnicaParams {
  // Estado funcional
  enciende: boolean | null
  cargaOk: boolean | null
  cargaInalambrica: boolean | null
  funcChecks: Array<boolean | null>

  // Estado batería
  saludBateria: number | ''

  // Estado pantalla
  pantallaIssues: FuncPantallaValue[]
  estadoPantalla: EsteticaPantallaKey | ''

  // Estado exterior
  estadoLados: EsteticaKey | ''
  estadoEspalda: EsteticaKey | ''

  // Contexto
  dispositivo: unknown
  modeloId?: number
  capacidadId?: number
  tenant?: string
  canal?: 'B2B' | 'B2C'

  // Gates
  isSecurityKO?: boolean
}

// Mapeos a enums del endpoint técnico
const toDisplayImageStatusApi = (issues: FuncPantallaValue[]) =>
  issues.includes('lineas_quemaduras')
    ? 'LINES'
    : issues.includes('pixeles_muertos') || issues.includes('puntos_brillantes')
      ? 'PIX'
      : 'OK'

const toGlassStatusApi = (k: string) => {
  switch (k) {
    case 'sin_signos':
      return 'NONE'
    case 'minimos':
      return 'MICRO'
    case 'algunos':
      return 'VISIBLE'
    case 'desgaste_visible':
      return 'VISIBLE'  // Corregido: era DEEP, ahora VISIBLE (arañazos visibles no profundos)
    case 'astillado':
      return 'CHIP'     // Añadido: pequeñas muescas/bordes saltados
    case 'agrietado_roto':
      return 'CRACK'
    default:
      return 'NONE'
  }
}

const estToHousingApi = (k: EsteticaKey | '') => {
  switch (k) {
    case 'sin_signos':
      return 'SIN_SIGNOS'
    case 'minimos':
      return 'MINIMOS'
    case 'algunos':
      return 'ALGUNOS'
    case 'desgaste_visible':
      return 'DESGASTE_VISIBLE'
    case 'agrietado_roto':
      return 'DOBLADO'
    default:
      return 'SIN_SIGNOS'
  }
}

const worstHousingApi = (a: string, b: string) => {
  const rank: Record<string, number> = {
    SIN_SIGNOS: 0,
    MINIMOS: 1,
    ALGUNOS: 2,
    DESGASTE_VISIBLE: 3,
    DOBLADO: 4,
  }
  return rank[a] >= rank[b] ? a : b
}

/**
 * Hook para integración con backend de valoración técnica
 */
export function useValoracionTecnica(params: UseValoracionTecnicaParams) {
  const {
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
    canal = 'B2B',
    isSecurityKO = false,
  } = params

  // Construir payload
  const payloadAuditoria = useMemo(() => {
    const anyKO = funcChecks.some((v) => v === false)
    const allOK = funcChecks.every((v) => v === true)
    const funcional_basico_ok = anyKO ? false : allOK ? true : null

    const display_image_status = toDisplayImageStatusApi(pantallaIssues)
    const glass_status = toGlassStatusApi(estadoPantalla)
    const housing_status = worstHousingApi(
      estToHousingApi(estadoLados || 'sin_signos'),
      estToHousingApi(estadoEspalda || 'sin_signos')
    )

    const idsDetected = pickIdsFromDispositivo(dispositivo)
    const { modelo: modelo_nombre, capacidad: capacidad_texto } = getModeloSerieCapacidad(
      dispositivo || {}
    )
    const ids = {
      modelo_id:
        typeof modeloId === 'number' && Number.isFinite(modeloId) ? modeloId : idsDetected.modelo_id,
      capacidad_id:
        typeof capacidadId === 'number' && Number.isFinite(capacidadId)
          ? capacidadId
          : idsDetected.capacidad_id,
    }

    const payload = {
      dispositivo_id:
        dispositivo && (dispositivo as any).id ? Number((dispositivo as any).id) : undefined,
      enciende,
      carga: cargaOk,
      carga_inalambrica: cargaInalambrica,
      funcional_basico_ok,
      battery_health_pct: typeof saludBateria === 'number' ? saludBateria : null,
      display_image_status,
      glass_status,
      housing_status,
      tenant: tenant || undefined,
      canal: canal || 'B2B',
      modelo_id: ids.modelo_id ?? undefined,
      capacidad_id: ids.capacidad_id ?? undefined,
      modelo_nombre: modelo_nombre || undefined,
      capacidad_texto: capacidad_texto || undefined,
    } as Record<string, unknown>

    return payload
  }, [
    dispositivo,
    modeloId,
    capacidadId,
    enciende,
    cargaOk,
    cargaInalambrica,
    saludBateria,
    pantallaIssues,
    estadoPantalla,
    estadoLados,
    estadoEspalda,
    funcChecks,
    tenant,
    canal,
  ])

  // Determinar IDs para query key
  const idsForAuditoria = useMemo(() => {
    const detected = pickIdsFromDispositivo(dispositivo)
    return {
      modelo_id:
        typeof modeloId === 'number' && Number.isFinite(modeloId) ? modeloId : detected.modelo_id,
      capacidad_id:
        typeof capacidadId === 'number' && Number.isFinite(capacidadId)
          ? capacidadId
          : detected.capacidad_id,
    }
  }, [dispositivo, modeloId, capacidadId])

  // Query key que invalida al cambiar parámetros
  const auditoriaKey = useMemo(() => {
    const names = getModeloSerieCapacidad(dispositivo || {})
    const anyKO = funcChecks.some((v) => v === false)
    const allOK = funcChecks.every((v) => v === true)
    const funcional_basico_ok = anyKO ? false : allOK ? true : null

    return [
      'auditoria-valoracion',
      tenant || null,
      canal || 'B2B',
      dispositivo && (dispositivo as any).id ? Number((dispositivo as any).id) : null,
      idsForAuditoria.modelo_id ?? null,
      idsForAuditoria.capacidad_id ?? null,
      names.modelo || null,
      names.capacidad || null,
      enciende,
      cargaOk,
      cargaInalambrica,
      typeof saludBateria === 'number' ? saludBateria : null,
      toDisplayImageStatusApi(pantallaIssues),
      toGlassStatusApi(estadoPantalla),
      worstHousingApi(
        estToHousingApi(estadoLados || 'sin_signos'),
        estToHousingApi(estadoEspalda || 'sin_signos')
      ),
      funcional_basico_ok,
    ] as const
  }, [
    tenant,
    canal,
    dispositivo,
    idsForAuditoria.modelo_id,
    idsForAuditoria.capacidad_id,
    enciende,
    cargaOk,
    cargaInalambrica,
    saludBateria,
    pantallaIssues,
    estadoPantalla,
    estadoLados,
    estadoEspalda,
    funcChecks,
  ])

  // Determinar si se puede hacer la query
  const namesForQuery = getModeloSerieCapacidad(dispositivo || {})
  const dispositivoIdForQuery =
    dispositivo && (dispositivo as any).id ? Number((dispositivo as any).id) : null

  const canQueryAuditoria =
    Boolean(
      (idsForAuditoria.modelo_id && idsForAuditoria.capacidad_id) ||
        (namesForQuery.modelo && namesForQuery.capacidad) ||
        dispositivoIdForQuery
    ) && !isSecurityKO

  // Query
  const { data: valoracionTecnica, isLoading, error } = useQuery<ValoracionTecnicaResponse>({
    queryKey: auditoriaKey,
    queryFn: () => postValoracionIphoneAuditoria(payloadAuditoria, tenant || undefined),
    enabled: canQueryAuditoria,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  return {
    valoracionTecnica,
    isLoading,
    error,
    canQuery: canQueryAuditoria,
  }
}
