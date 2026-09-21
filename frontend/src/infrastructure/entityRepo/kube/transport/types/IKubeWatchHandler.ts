import type { TKubeWatchEvent } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchEvent'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export interface IKubeWatchHandler {
    onEvent(event: TKubeWatchEvent): void

    onClose(status: TKubeWatchStatus): void
}
