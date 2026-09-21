import type { TKubeContainer } from '@/domain/entities/workloads/types/TKubeContainer'

export type TPodSpec = {
    nodeName?: string
    restartPolicy?: string
    serviceAccountName?: string
    priorityClassName?: string
    schedulerName?: string
    hostNetwork?: boolean
    containers?: TKubeContainer[]
    initContainers?: TKubeContainer[]
}
