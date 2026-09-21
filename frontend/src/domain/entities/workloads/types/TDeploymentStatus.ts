import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TDeploymentStatus = {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
    unavailableReplicas?: number
    updatedReplicas?: number
    observedGeneration?: number
    conditions?: TKubeCondition[]
}
