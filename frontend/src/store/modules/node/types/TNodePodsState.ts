import type { PodEntity } from '@/domain/entities/workloads'

export type TNodePodsState = {
    loading: boolean
    loaded: boolean
    error: string
    errorDetail: string
    forbidden: boolean
    pods: PodEntity[]
}
