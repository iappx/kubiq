import type { TKubeObjectState } from '@/domain/entities/kube'

export type TWorkloadPodChoice = {
    name: string
    namespace: string
    phase: string
    tone: TKubeObjectState
    nodeName: string
    containers: string[]
}
