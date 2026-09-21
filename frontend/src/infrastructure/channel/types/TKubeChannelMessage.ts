import type { TKubeChannelStatus } from '@/infrastructure/channel/types/TKubeChannelStatus'

export type TKubeChannelMessage = {
    channelId: string
    stream?: string
    data?: string
    error?: string
    status?: TKubeChannelStatus
    reason?: string
}
