import type { TKubeLabelSelector } from '@/domain/entities/kube/types/TKubeLabelSelector'

export type TReplicaSetSpec = {
    replicas?: number
    selector?: TKubeLabelSelector
}
