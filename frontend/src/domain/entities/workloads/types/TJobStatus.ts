import type { TKubeCondition } from '@/domain/entities/kube/types/TKubeCondition'

export type TJobStatus = {
    active?: number
    succeeded?: number
    failed?: number
    /** RFC 3339 timestamp. */
    startTime?: string
    /** RFC 3339 timestamp. */
    completionTime?: string
    conditions?: TKubeCondition[]
}
