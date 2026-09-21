import type { TKubeLabelSelector } from '@/domain/entities/kube/types/TKubeLabelSelector'

export type TStatefulSetSpec = {
    replicas?: number
    serviceName?: string
    podManagementPolicy?: string
    selector?: TKubeLabelSelector
    updateStrategy?: {
        type?: string
    }
}
