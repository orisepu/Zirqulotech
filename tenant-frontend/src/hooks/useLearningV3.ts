import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LearningMetrics,
  KnowledgeBaseStats,
  ReviewMappingData,
  ReviewMappingRequest,
  ReviewMappingResponse,
  CleanupRequest,
  CleanupResponse,
  ExportLearningData
} from '@/types/autoaprendizaje-v3'
import api from '@/services/api'

// API Keys
const LEARNING_KEYS = {
  metrics: 'learning-metrics',
  taskMetrics: (tareaId: string) => ['learning-metrics', tareaId],
  kbStats: 'knowledge-base-stats',
  reviewMappings: 'review-mappings',
  capacidades: 'capacidades'
} as const

// Learning Metrics Hook
export function useLearningMetrics(refreshKey?: number) {
  return useQuery({
    queryKey: [LEARNING_KEYS.metrics, refreshKey],
    queryFn: async (): Promise<LearningMetrics> => {
      const response = await api.get('/api/likewize/v3/metrics/')
      return response.data
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  })
}

// Task-specific Learning Metrics Hook
export function useTaskLearningMetrics(tareaId: string, refreshKey?: number) {
  return useQuery({
    queryKey: [LEARNING_KEYS.taskMetrics(tareaId), refreshKey],
    queryFn: async (): Promise<LearningMetrics> => {
      const response = await api.get(`/api/likewize/v3/metrics/${tareaId}/`)
      return response.data
    },
    enabled: !!tareaId,
    staleTime: 15000, // 15 seconds for task-specific data
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

// Knowledge Base Stats Hook
export function useKnowledgeBaseStats(refreshKey?: number) {
  return useQuery({
    queryKey: [LEARNING_KEYS.kbStats, refreshKey],
    queryFn: async (): Promise<KnowledgeBaseStats> => {
      const response = await api.get('/api/likewize/v3/knowledge-base/stats/')
      return response.data
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // Refresh every 5 minutes
  })
}

// Review Mappings Hook
export function useReviewMappings(params: { confidence?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: [LEARNING_KEYS.reviewMappings, params],
    queryFn: async (): Promise<ReviewMappingData> => {
      const searchParams = new URLSearchParams()
      if (params.confidence !== undefined) {
        searchParams.append('confidence', params.confidence.toString())
      }
      if (params.limit !== undefined) {
        searchParams.append('limit', params.limit.toString())
      }

      const response = await api.get(`/api/likewize/v3/review/?${searchParams.toString()}`)
      return response.data
    },
    staleTime: 30000, // 30 seconds
  })
}

// Capacidades Hook (for correction form)
export function useCapacidades() {
  return useQuery({
    queryKey: [LEARNING_KEYS.capacidades],
    queryFn: async () => {
      const response = await api.get('/api/capacidades/')
      return response.data
    },
    staleTime: 300000, // 5 minutes - capacidades don't change often
  })
}

// Apply Corrections Mutation
export function useApplyCorrections() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (corrections: ReviewMappingRequest): Promise<ReviewMappingResponse> => {
      const response = await api.post('/api/likewize/v3/review/', corrections)
      return response.data
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [LEARNING_KEYS.metrics] })
      queryClient.invalidateQueries({ queryKey: [LEARNING_KEYS.kbStats] })
      queryClient.invalidateQueries({ queryKey: [LEARNING_KEYS.reviewMappings] })
    },
  })
}

// Cleanup Knowledge Base Mutation
export function useCleanupKnowledgeBase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: CleanupRequest): Promise<CleanupResponse> => {
      const response = await api.post('/api/likewize/v3/knowledge-base/cleanup/', params)
      return response.data
    },
    onSuccess: () => {
      // Invalidate relevant queries after cleanup
      queryClient.invalidateQueries({ queryKey: [LEARNING_KEYS.metrics] })
      queryClient.invalidateQueries({ queryKey: [LEARNING_KEYS.kbStats] })
      queryClient.invalidateQueries({ queryKey: [LEARNING_KEYS.reviewMappings] })
    },
  })
}

// Export Learning Data Hook
export function useExportLearningData() {
  return useQuery({
    queryKey: ['export-learning-data'],
    queryFn: async (): Promise<ExportLearningData> => {
      const response = await api.get('/api/likewize/v3/export/')
      return response.data
    },
    enabled: false, // Only run when explicitly triggered
  })
}

// Manual Export Learning Data
export function useManualExportLearningData() {
  return useMutation({
    mutationFn: async (): Promise<ExportLearningData> => {
      const response = await api.get('/api/likewize/v3/export/')
      return response.data
    },
  })
}

// Launch V3 Update Task Mutation
export function useLaunchV3UpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      categories?: string[]
      enable_learning?: boolean
      confidence_threshold?: number
      parallel_requests?: number
    } = {}) => {
      const response = await api.post('/api/likewize/v3/actualizar/', params)
      return response.data
    },
    onSuccess: () => {
      // Invalidate task-related queries
      queryClient.invalidateQueries({ queryKey: ['likewize-tasks'] })
      queryClient.invalidateQueries({ queryKey: [LEARNING_KEYS.metrics] })
    },
  })
}

// Custom hook for real-time metrics updates
export function useRealTimeLearningMetrics(enabled: boolean = false) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['real-time-learning-metrics'],
    queryFn: async () => {
      const response = await api.get('/api/likewize/v3/metrics/')
      return response.data
    },
    enabled,
    refetchInterval: 5000, // Every 5 seconds when enabled
    refetchIntervalInBackground: true,
  })
}

// Hook for confidence threshold analysis
export function useConfidenceAnalysis() {
  return useQuery({
    queryKey: ['confidence-analysis'],
    queryFn: async () => {
      const [metricsResponse, statsResponse] = await Promise.all([
        api.get('/api/likewize/v3/metrics/'),
        api.get('/api/likewize/v3/knowledge-base/stats/')
      ])

      const metrics: LearningMetrics = metricsResponse.data
      const stats: KnowledgeBaseStats = statsResponse.data

      // Calculate optimal confidence threshold
      const distribution = stats.confidence_distribution
      const totalEntries = distribution.reduce((sum, range) => sum + range.count, 0)

      let optimalThreshold = 0.7 // Default
      if (totalEntries > 0) {
        const highConfidenceCount = distribution
          .filter(range => range.label === 'high' || range.label === 'very_high')
          .reduce((sum, range) => sum + range.count, 0)

        const highConfidenceRatio = highConfidenceCount / totalEntries

        if (highConfidenceRatio < 0.6) {
          optimalThreshold = 0.6 // Lower threshold if we don't have enough high-confidence entries
        } else if (highConfidenceRatio > 0.8) {
          optimalThreshold = 0.8 // Higher threshold if we have many high-confidence entries
        }
      }

      return {
        metrics,
        stats,
        optimalThreshold,
        analysis: {
          totalEntries,
          healthScore: metrics.system_health?.score || 0,
          avgConfidence: metrics.knowledge_base_metrics?.avg_confidence || 0,
          recommendedActions: metrics.system_health?.recommendations || []
        }
      }
    },
    staleTime: 120000, // 2 minutes
  })
}

// Hook for learning performance tracking
export function useLearningPerformanceTracking(tareaId?: string) {
  return useQuery({
    queryKey: ['learning-performance', tareaId],
    queryFn: async () => {
      const endpoint = tareaId
        ? `/api/likewize/v3/metrics/${tareaId}/`
        : '/api/likewize/v3/metrics/'

      const response = await api.get(endpoint)
      const data: LearningMetrics = response.data

      // Calculate performance metrics
      const performanceMetrics = {
        mappingEfficiency: data.mapping_rate || 0,
        learningVelocity: data.learning_metrics?.total_learned || 0,
        predictionAccuracy: data.learning_metrics?.avg_accuracy || 0,
        processingSpeed: data.learning_metrics?.total_processing_time || 0,
        confidenceDistribution: data.staging_metrics ? {
          high: data.staging_metrics.high_confidence || 0,
          medium: data.staging_metrics.medium_confidence || 0,
          low: data.staging_metrics.low_confidence || 0,
          total: data.staging_metrics.total_items || 0
        } : null
      }

      return {
        ...data,
        performance: performanceMetrics
      }
    },
    enabled: true,
    staleTime: 30000,
    refetchInterval: 45000,
  })
}

// Hook for V3 task logs
export function useTaskLogs(tareaId: string, options: { lines?: number; offset?: number; enabled?: boolean } = {}) {
  const { lines = 100, offset = 0, enabled = true } = options

  return useQuery({
    queryKey: ['task-logs-v3', tareaId, lines, offset],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (lines > 0) params.append('lines', lines.toString())
      if (offset > 0) params.append('offset', offset.toString())

      const response = await api.get(`/api/likewize/v3/tareas/${tareaId}/log/?${params.toString()}`)
      return response.data
    },
    enabled: enabled && !!tareaId,
    staleTime: 5000, // Short stale time for real-time logs
    refetchInterval: 10000, // Refresh every 10 seconds
  })
}

// Hook for V3 task status
export function useTaskStatus(tareaId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['task-status-v3', tareaId],
    queryFn: async () => {
      const response = await api.get(`/api/likewize/v3/tareas/${tareaId}/estado/`)
      return response.data
    },
    enabled: enabled && !!tareaId,
    staleTime: 15000, // 15 seconds
    refetchInterval: 20000, // Refresh every 20 seconds
  })
}

// Hook for active V3 tasks
export function useActiveV3Tasks() {
  return useQuery({
    queryKey: ['active-tasks-v3'],
    queryFn: async () => {
      const response = await api.get('/api/likewize/v3/tareas/activas/')
      return response.data
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  })
}

// Hook for real-time task monitoring
export function useTaskMonitoring(tareaId: string, enabled: boolean = true) {
  const taskStatus = useTaskStatus(tareaId, enabled)
  const taskLogs = useTaskLogs(tareaId, {
    lines: 50, // Last 50 lines
    enabled: enabled && taskStatus.data?.task?.estado === 'RUNNING'
  })

  return {
    status: taskStatus,
    logs: taskLogs,
    isRunning: taskStatus.data?.task?.estado === 'RUNNING',
    isCompleted: taskStatus.data?.task?.estado === 'SUCCESS' || taskStatus.data?.task?.estado === 'COMPLETED',
    hasError: taskStatus.data?.task?.estado === 'ERROR',
    errorMessage: taskStatus.data?.task?.error_message,
    refetchAll: () => {
      taskStatus.refetch()
      taskLogs.refetch()
    }
  }
}