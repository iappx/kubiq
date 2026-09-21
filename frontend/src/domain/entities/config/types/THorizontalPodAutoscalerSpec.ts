import type { THpaScaleTargetRef } from '@/domain/entities/config/types/THpaScaleTargetRef'

export type THorizontalPodAutoscalerSpec = {
    scaleTargetRef?: THpaScaleTargetRef
    minReplicas?: number
    maxReplicas?: number
    metrics?: Record<string, unknown>[]
    targetCPUUtilizationPercentage?: number
}
