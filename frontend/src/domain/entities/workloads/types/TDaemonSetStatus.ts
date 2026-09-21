import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TDaemonSetStatus = {
    desiredNumberScheduled?: number
    currentNumberScheduled?: number
    numberReady?: number
    numberAvailable?: number
    numberUnavailable?: number
    numberMisscheduled?: number
    updatedNumberScheduled?: number
    observedGeneration?: number
    conditions?: TKubeCondition[]
}
