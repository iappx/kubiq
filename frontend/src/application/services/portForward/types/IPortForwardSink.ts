import type { TPortForward } from '@/application/services/portForward/types/TPortForward'

export interface IPortForwardSink {
    onForwardChanged(forward: TPortForward): void

    onForwardClosed(forwardId: string): void
}
