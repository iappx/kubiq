import type { TPortForwardRuntime } from '@/application/services/portForward/types/TPortForwardRuntime'

export interface IPortForwardSink {
    onForwardChanged(id: string, runtime: TPortForwardRuntime): void
}
