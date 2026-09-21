import type { TKubeLabelSelector } from '@/domain/entities/kube/types/TKubeLabelSelector'

export type TJobSpec = {
    completions?: number
    parallelism?: number
    backoffLimit?: number
    activeDeadlineSeconds?: number
    suspend?: boolean
    selector?: TKubeLabelSelector
}
