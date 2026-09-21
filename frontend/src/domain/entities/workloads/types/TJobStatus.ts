import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TJobStatus = {
    active?: number
    succeeded?: number
    failed?: number
    startTime?: string
    completionTime?: string
    conditions?: TKubeCondition[]
}
