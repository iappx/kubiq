import type { TKubeLabelSelector } from '@/domain/entities/kube/types/TKubeLabelSelector'

export type TPodDisruptionBudgetSpec = {
    minAvailable?: number | string
    maxUnavailable?: number | string
    selector?: TKubeLabelSelector
    unhealthyPodEvictionPolicy?: string
}
