import type { TKubeChannelStatus } from '@/infrastructure/channel/types/TKubeChannelStatus'

export interface IKubeChannelHandler {
    onData(stream: string, data: Uint8Array): void

    onError(details: string): void

    onClose(status: TKubeChannelStatus, reason: string): void
}
