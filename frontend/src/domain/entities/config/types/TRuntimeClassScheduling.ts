import type { TKubeLabels } from '@/domain/entities/kube/types/TKubeLabels'
import type { TKubeToleration } from '@/domain/entities/config/types/TKubeToleration'

export type TRuntimeClassScheduling = {
    nodeSelector?: TKubeLabels
    tolerations?: TKubeToleration[]
}
