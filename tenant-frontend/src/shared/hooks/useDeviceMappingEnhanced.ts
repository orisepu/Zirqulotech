'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import { MappingConfidence, MappingFeedbackData } from '@/features/opportunities/components/devices/MappingConfidenceEnhanced'

type DeviceMappingReviewItem = {
  id: string
  device_signature: string
  source_type: string
  extracted_model_name: string
  extracted_a_number: string | null
  extracted_capacity_gb: number | null
  mapped_capacity_id: number
  mapped_description: string
  confidence_score: number
  mapping_algorithm: string
  review_reason: string | null
  created_at: string
  source_data: Record<string, any> | null
}

type MappingStatistics = {
  total_mappings: number
  successful_mappings: number
  avg_confidence: number
  by_device_type: Record<string, number>
  by_algorithm: Record<string, number>
  quality_distribution: {
    high: number
    medium: number
    low: number
  }
  needs_review: number
  user_validated: number
}

type AlgorithmComparisonEntry = {
  total_mappings: number
  avg_confidence: number
  high_confidence_count: number
  needs_review_count: number
  avg_processing_time: number
}

type AlgorithmComparison = Record<string, AlgorithmComparisonEntry>

type MappingSessionReport = {
  tarea_id: string
  total_devices_processed: number
  successfully_mapped: number
  failed_mappings: number
  success_rate: number
  high_confidence_mappings: number
  medium_confidence_mappings: number
  low_confidence_mappings: number
  devices_by_type: Record<string, number>
  algorithms_used: Record<string, number>
  total_processing_time_ms: number
  avg_processing_time_ms: number
  mappings_needing_review: number
  new_knowledge_discovered: Array<Record<string, any>>
  recommendations: string[]
  created_at: string
}

type KnowledgeBaseEntry = {
  id: number
  device_family: string
  model_name: string
  a_number: string
  release_date: string
  cpu_family: string
  available_capacities: number[]
  likewize_model_names: string[]
  confidence_level: string
  source: string
}

export function useDeviceMappingEnhanced() {
  const queryClient = useQueryClient()

  // Review queue
  const useMappingsForReview = (filters?: {
    limit?: number
    device_type?: string
    min_confidence?: number
  }) => {
    return useQuery<DeviceMappingReviewItem[]>({
      queryKey: ['device-mapping-v2-review', filters],
      queryFn: async () => {
        const params = new URLSearchParams()
        if (filters?.limit) params.append('limit', filters.limit.toString())
        if (filters?.device_type) params.append('device_type', filters.device_type)
        if (filters?.min_confidence !== undefined) {
          params.append('min_confidence', filters.min_confidence.toString())
        }

        const { data } = await api.get('/api/device-mapping/v2/review/', {
          params: Object.fromEntries(params.entries())
        })

        return (data?.mappings ?? []) as DeviceMappingReviewItem[]
      },
      staleTime: 30_000
    })
  }

  // Aggregated statistics
  const useMappingStatistics = (daysBack: number = 7) => {
    return useQuery<MappingStatistics>({
      queryKey: ['device-mapping-v2-statistics', daysBack],
      queryFn: async () => {
        const { data } = await api.get('/api/device-mapping/v2/statistics/', {
          params: { days: daysBack }
        })
        return data?.statistics as MappingStatistics
      },
      refetchInterval: 60_000,
      staleTime: 45_000
    })
  }

  // Algorithm comparison report
  const useAlgorithmComparison = (daysBack: number = 30) => {
    return useQuery<AlgorithmComparison>({
      queryKey: ['device-mapping-v2-algorithm-comparison', daysBack],
      queryFn: async () => {
        const { data } = await api.get('/api/device-mapping/v2/algorithm-comparison/', {
          params: { days: daysBack }
        })
        return data?.algorithm_comparison as AlgorithmComparison
      },
      staleTime: 120_000
    })
  }

  // Knowledge base search
  const useKnowledgeBaseSearch = (q?: string, deviceFamily?: string) => {
    return useQuery<KnowledgeBaseEntry[]>({
      queryKey: ['device-mapping-v2-knowledge-base', q, deviceFamily],
      queryFn: async () => {
        const { data } = await api.get('/api/device-mapping/v2/knowledge-base/search/', {
          params: {
            q: q || undefined,
            device_family: deviceFamily || undefined
          }
        })
        return (data?.results ?? []) as KnowledgeBaseEntry[]
      },
      enabled: Boolean(q || deviceFamily)
    })
  }

  // Mapping validation / feedback
  const useMappingValidation = () => {
    return useMutation({
      mutationFn: async (feedback: MappingFeedbackData) => {
        const { data } = await api.post('/api/device-mapping/v2/validate/', feedback)
        return data
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['device-mapping-v2-review'] })
        queryClient.invalidateQueries({ queryKey: ['device-mapping-v2-statistics'] })
      }
    })
  }

  // Manual test of a single device
  const useTestMapping = () => {
    return useMutation({
      mutationFn: async (deviceData: Record<string, any>) => {
        const { data } = await api.post('/api/device-mapping/v2/test/', {
          device_data: deviceData
        })
        return data
      }
    })
  }

  // Fetch session report for a given task
  const useSessionReportFetcher = () => {
    return useMutation({
      mutationFn: async (tareaId: string) => {
        const { data } = await api.get(`/api/device-mapping/v2/session-report/${tareaId}/`)
        return data?.report as MappingSessionReport
      }
    })
  }

  // Trigger Likewize update (existing endpoint)
  const useEnhancedLikewizeUpdate = () => {
    return useMutation({
      mutationFn: async (options: {
        mode: 'apple' | 'others'
        brands?: string[]
        incremental?: boolean
        force_full?: boolean
      }) => {
        const { data } = await api.post('/api/precios/likewize/actualizar/', {
          mode: options.mode,
          brands: options.brands,
          mapping_system: 'v2',
          incremental: options.incremental ?? false,
          force_full: options.force_full ?? false
        })
        return data as { tarea_id: string }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['device-mapping-v2-statistics'] })
        queryClient.invalidateQueries({ queryKey: ['device-mapping-v2-review'] })
      }
    })
  }

  const normalizeAlgorithm = (algorithm?: string): 'cached' | 'exact' | 'fuzzy' | 'heuristic' | 'failed' => {
    if (!algorithm) return 'heuristic'
    const value = algorithm.toLowerCase()
    if (value.includes('cache')) return 'cached'
    if (value.includes('exact') || value.includes('a_number')) return 'exact'
    if (value.includes('fuzzy') || value.includes('similar')) return 'fuzzy'
    if (value.includes('heur') || value.includes('rule') || value.includes('enrich')) return 'heuristic'
    return 'heuristic'
  }

  // Build confidence payload from mapping
  const getMappingConfidence = (item: {
    confidence_score?: number | null
    mapping_algorithm?: string | null
    needs_review?: boolean | null
    times_confirmed?: number | null
  }): MappingConfidence | null => {
    if (item.confidence_score === undefined || item.confidence_score === null) {
      return null
    }

    return {
      score: item.confidence_score,
      algorithm: normalizeAlgorithm(item.mapping_algorithm ?? undefined),
      needs_review: Boolean(item.needs_review),
      times_confirmed: item.times_confirmed || 0
    } as unknown as MappingConfidence
  }

  // Heuristic analyzer reused for both legacy and v2 payloads
  const analyzeMapping = (mapping: Partial<DeviceMappingReviewItem> & {
    nombre_likewize_original?: string
    nombre_normalizado?: string
    modelo_norm?: string
    confidence_score?: number
  }) => {
    const sourceData = mapping.source_data ?? {}
    const original = mapping.nombre_likewize_original || sourceData?.ModelName || sourceData?.FullName || ''
    const normalized =
      mapping.nombre_normalizado ||
      mapping.extracted_model_name ||
      mapping.modelo_norm ||
      sourceData?.NormalizedModel ||
      ''

    const extractYear = (text: string): number | null => {
      const match = text.match(/\b(20\d{2})\b/)
      return match ? parseInt(match[1], 10) : null
    }

    const extractProcessor = (text: string): string | null => {
      const patterns = [
        /\b(M[1-4](?:\s+(?:Max|Pro|Ultra))?)\b/i,
        /\b(Intel\s+Core\s+i[3-9])\b/i,
        /\b(Apple\s+Silicon)\b/i
      ]

      for (const pattern of patterns) {
        const match = text.match(pattern)
        if (match) return match[1].trim()
      }
      return null
    }

    const originalYear = extractYear(original)
    const normalizedYear = extractYear(normalized)
    const originalProcessor = extractProcessor(original)
    const normalizedProcessor = extractProcessor(normalized)

    const issues: string[] = []
    const warnings: string[] = []

    if (originalYear && normalizedYear) {
      const diff = Math.abs(originalYear - normalizedYear)
      if (diff >= 2) {
        issues.push(`Diferencia de año significativa: ${normalizedYear} vs ${originalYear}`)
      } else if (diff > 0) {
        warnings.push(`Posible diferencia de año: ${normalizedYear} vs ${originalYear}`)
      }
    }

    if (
      originalProcessor &&
      normalizedProcessor &&
      originalProcessor.toLowerCase() !== normalizedProcessor.toLowerCase()
    ) {
      issues.push(`Procesador diferente: ${normalizedProcessor} vs ${originalProcessor}`)
    }

    let confidenceLevel: 'alta' | 'media' | 'baja' = 'media'
    if (mapping.confidence_score !== undefined) {
      if (mapping.confidence_score >= 80) confidenceLevel = 'alta'
      else if (mapping.confidence_score < 50) confidenceLevel = 'baja'
    } else {
      const problemCount = issues.length * 2 + warnings.length
      if (problemCount >= 3) confidenceLevel = 'baja'
      else if (problemCount === 0) confidenceLevel = 'alta'
    }

    return {
      issues,
      warnings,
      confidence: confidenceLevel,
      hasProblems: issues.length > 0 || warnings.length > 0,
      originalYear,
      normalizedYear,
      originalProcessor,
      normalizedProcessor,
      textSimilarity:
        original.toLowerCase().includes(normalized.toLowerCase()) ||
        normalized.toLowerCase().includes(original.toLowerCase())
    }
  }

  return {
    // Queries
    useMappingsForReview,
    useMappingStatistics,
    useAlgorithmComparison,
    useKnowledgeBaseSearch,

    // Mutations / actions
    useMappingValidation,
    useTestMapping,
    useSessionReportFetcher,
    useEnhancedLikewizeUpdate,

    // Utilities
    getMappingConfidence,
    analyzeMapping
  }
}
