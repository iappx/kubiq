import type { TKubeResourceList } from '@/domain/entities/kube/types/TKubeResourceList'
import type { TKubeContainerPort } from '@/domain/entities/workloads/types/TKubeContainerPort'

export type TKubeContainer = {
    name: string
    image?: string
    imagePullPolicy?: string
    command?: string[]
    args?: string[]
    ports?: TKubeContainerPort[]
    resources?: {
        requests?: TKubeResourceList
        limits?: TKubeResourceList
    }
}
