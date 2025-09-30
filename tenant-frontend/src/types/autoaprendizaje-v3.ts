// Types for Auto-learning V3 System

export interface ProviderKnowledgeBase {
  id: number
  provider_model_name: string
  provider_m_model: string
  provider_capacity: string
  provider_phone_model_id?: number
  provider_full_name?: string
  confidence_score: number
  times_used: number
  success_rate: number
  last_used: string
  user_validated: boolean
  auto_learned: boolean
  created_by_correction: boolean
  features: Record<string, any>
  created_at: string
  updated_at: string
  local_modelo: {
    id: number
    descripcion: string
    marca: string
    tipo: string
  }
  local_capacidad: {
    id: number
    tamaño: string
  }
}

export interface MappingCorrection {
  id: number
  provider_data: Record<string, any>
  correction_reason?: string
  original_confidence?: number
  correction_confidence: number
  created_at: string
  corrected_by?: {
    id: number
    username: string
  }
  corrected_mapping: {
    id: number
    tamaño: string
  }
  original_mapping?: {
    id: number
    tamaño: string
  }
  kb_entry?: ProviderKnowledgeBase
}

export interface LearningSession {
  id: number
  total_items_processed: number
  items_learned: number
  items_predicted: number
  items_corrected: number
  prediction_accuracy?: number
  avg_confidence?: number
  processing_time_seconds?: number
  session_metadata: Record<string, any>
  created_at: string
  completed_at?: string
  tarea: {
    id: string
    estado: string
  }
}

export interface FeaturePattern {
  id: number
  pattern_name: string
  pattern_type: 'regex' | 'keyword' | 'similarity' | 'ml'
  pattern_value: string
  confidence_threshold: number
  times_applied: number
  success_count: number
  is_active: boolean
  created_at: string
  updated_at: string
  success_rate?: number
}

export interface LearningMetrics {
  // Global metrics
  knowledge_base_metrics?: {
    total_entries: number
    high_confidence_entries: number
    user_validated_entries: number
    auto_learned_entries: number
    avg_confidence: number
    avg_success_rate: number
    most_used_entry_uses: number
  }
  correction_metrics?: {
    total_corrections: number
    avg_original_confidence: number
  }
  learning_trend?: Array<{
    week: string
    entries_created: number
    avg_confidence: number
  }>
  most_corrected_models?: Array<{
    provider_data__ModelName: string
    correction_count: number
  }>
  performance_by_brand?: Array<{
    local_modelo__marca: string
    total_mappings: number
    avg_confidence: number
    avg_success_rate: number
    user_validated_count: number
  }>
  system_health?: {
    score: number
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'no_data'
    confidence_score: number
    validation_rate: number
    high_confidence_rate: number
    recommendations: string[]
  }

  // Task-specific metrics
  tarea_id?: string
  tarea_estado?: string
  staging_metrics?: {
    total_items: number
    mapped_items: number
    high_confidence: number
    medium_confidence: number
    low_confidence: number
    avg_confidence: number
  }
  learning_metrics?: {
    total_learned: number
    total_predicted: number
    avg_accuracy: number
    total_processing_time: number
  }
  device_distribution?: Array<{
    tipo: string
    count: number
  }>
  confidence_by_type?: Array<{
    tipo: string
    avg_confidence: number
    count: number
  }>
  mapping_rate?: number
}

export interface KnowledgeBaseStats {
  confidence_distribution: Array<{
    range: string
    label: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
    count: number
  }>
  most_used_entries: Array<{
    provider_model_name: string
    local_modelo__descripcion: string
    local_capacidad__tamaño: string
    times_used: number
    confidence_score: number
    user_validated: boolean
  }>
  device_statistics: Array<{
    local_modelo__tipo: string
    count: number
    avg_confidence: number
    avg_success_rate: number
  }>
  successful_patterns: Array<{
    pattern_name: string
    pattern_type: string
    times_applied: number
    success_count: number
    success_rate: number
  }>
  summary: {
    total_kb_entries: number
    total_patterns: number
    avg_system_confidence: number
  }
}

export interface ReviewMappingRequest {
  corrections: Array<{
    kb_entry_id: number
    capacidad_id: number
    reason?: string
  }>
}

export interface ReviewMappingResponse {
  applied_corrections: Array<{
    id?: number
    kb_entry_id: number
    success: boolean
    error?: string
  }>
  total_applied: number
  total_failed: number
}

export interface ItemForReview {
  id: number
  provider_model_name: string
  provider_capacity: string
  current_mapping: {
    modelo: string
    capacidad: string
    capacidad_id: number
  }
  confidence_score: number
  times_used: number
  success_rate: number
  features: Record<string, any>
}

export interface ReviewMappingData {
  items_for_review: ItemForReview[]
  total_count: number
  confidence_threshold: number
}

export interface CleanupRequest {
  confidence_threshold?: number
  min_uses?: number
  dry_run?: boolean
}

export interface CleanupResponse {
  dry_run: boolean
  entries_to_delete?: number
  deleted_entries?: number
  threshold: number
  min_uses: number
}

export interface ExportLearningData {
  export_timestamp: string
  data: {
    knowledge_base_entries: ProviderKnowledgeBase[]
    corrections: MappingCorrection[]
    feature_patterns: FeaturePattern[]
  }
  summary: {
    knowledge_base_entries: number
    corrections: number
    feature_patterns: number
  }
}

// Confidence level types for UI
export type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high'

export interface ConfidenceThresholds {
  very_high: number // >= 0.9
  high: number      // >= 0.7
  medium: number    // >= 0.5
  low: number       // >= 0.3
  very_low: number  // < 0.3
}

// Feature extraction types
export interface DeviceFeatures {
  year?: number
  processor?: string
  storage_gb?: number
  ram_gb?: number
  screen_size?: number
  has_variants?: boolean
  generation?: number
  model_suffix?: string
  color_variants?: string[]
  connectivity?: string[]
  camera_specs?: string
  battery_capacity?: number
  [key: string]: any
}

// Learning engine response types
export interface MappingPrediction {
  capacidad_id: number
  confidence_score: number
  reasoning: string
  features_matched: string[]
  similar_entries: ProviderKnowledgeBase[]
}

export interface LearningEngineResponse {
  predictions: MappingPrediction[]
  overall_confidence: number
  processing_time_ms: number
  strategy_used: 'exact_match' | 'feature_similarity' | 'ml_prediction' | 'fallback'
}