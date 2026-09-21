import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TReplicaSetStatus = {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
    fullyLabeledReplicas?: number
    observedGeneration?: number
    conditions?: TKubeCondition[]
}
