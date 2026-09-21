import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export interface IKubeChunkHandler {
    onChunk(chunk: string): void

    onFailure(message: string, details: string): void

    onClose(status: TKubeWatchStatus): void
}
