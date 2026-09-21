import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'

export type TReplicationControllerSpec = {
    replicas?: number
    selector?: TKubeLabels
}
