import type { TKubeResourceList } from '@/domain/entities/kube/types/TKubeResourceList'
import type { TKubeContainerPort } from '@/domain/entities/workloads/types/TKubeContainerPort'
import type { TKubeEnvFromSource } from '@/domain/entities/workloads/types/TKubeEnvFromSource'
import type { TKubeEnvVar } from '@/domain/entities/workloads/types/TKubeEnvVar'

export type TKubeContainer = {
    name: string
    image?: string
    imagePullPolicy?: string
    command?: string[]
    args?: string[]
    ports?: TKubeContainerPort[]
    env?: TKubeEnvVar[]
    envFrom?: TKubeEnvFromSource[]
    resources?: {
        requests?: TKubeResourceList
        limits?: TKubeResourceList
    }
}
