import type { TKubeLabelSelector } from '@/domain/entities/kube/types/TKubeLabelSelector'

export type TDeploymentSpec = {
    replicas?: number
    paused?: boolean
    revisionHistoryLimit?: number
    selector?: TKubeLabelSelector
    strategy?: {
        type?: string
    }
}
