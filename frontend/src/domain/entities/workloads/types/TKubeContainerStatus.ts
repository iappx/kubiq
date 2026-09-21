import type { TKubeContainerState } from '@/domain/entities/workloads/types/TKubeContainerState'

export type TKubeContainerStatus = {
    name: string
    ready?: boolean
    started?: boolean
    restartCount?: number
    image?: string
    imageID?: string
    containerID?: string
    state?: TKubeContainerState
    lastState?: TKubeContainerState
}
