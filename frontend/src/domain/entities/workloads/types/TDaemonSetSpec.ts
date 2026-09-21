import type { TKubeLabelSelector } from '@/domain/entities/kube/types/TKubeLabelSelector'

export type TDaemonSetSpec = {
    selector?: TKubeLabelSelector
    updateStrategy?: {
        type?: string
    }
}
