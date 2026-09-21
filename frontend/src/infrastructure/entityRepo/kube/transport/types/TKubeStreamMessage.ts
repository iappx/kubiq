import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export type TKubeStreamMessage = {
    streamId: string
    chunk?: string
    error?: string
    status?: TKubeWatchStatus
}
