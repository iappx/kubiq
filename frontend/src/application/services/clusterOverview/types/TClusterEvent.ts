import type { TKubeObjectState } from '@/domain/entities/kube'

export type TClusterEvent = {
    key: string
    reason: string
    message: string
    object: string
    namespace: string
    lastSeen: string
    count: number
    state: TKubeObjectState
}
