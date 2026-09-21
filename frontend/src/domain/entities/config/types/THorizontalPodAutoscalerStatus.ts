import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type THorizontalPodAutoscalerStatus = {
    currentReplicas?: number
    desiredReplicas?: number
    currentCPUUtilizationPercentage?: number
    lastScaleTime?: string
    conditions?: TKubeCondition[]
}
