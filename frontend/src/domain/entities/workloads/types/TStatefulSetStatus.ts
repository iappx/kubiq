import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TStatefulSetStatus = {
    replicas?: number
    readyReplicas?: number
    currentReplicas?: number
    updatedReplicas?: number
    availableReplicas?: number
    observedGeneration?: number
    conditions?: TKubeCondition[]
}
