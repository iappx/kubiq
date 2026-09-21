import type { TKubeContainer } from '@/domain/entities/workloads/types/TKubeContainer'
import type { TKubePodVolume } from '@/domain/entities/workloads/types/TKubePodVolume'

export type TPodSpec = {
    nodeName?: string
    restartPolicy?: string
    serviceAccountName?: string
    priorityClassName?: string
    schedulerName?: string
    hostNetwork?: boolean
    containers?: TKubeContainer[]
    initContainers?: TKubeContainer[]
    volumes?: TKubePodVolume[]
}
