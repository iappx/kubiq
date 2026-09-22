import type { TKubeObjectState } from '@/domain/entities/kube/types/TKubeObjectState'

export type TPodContainerHealth = {
    name: string
    isInit: boolean
    state: TKubeObjectState
    statusTitle: string
}
