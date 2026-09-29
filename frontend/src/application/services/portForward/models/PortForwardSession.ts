import { PortForwardRecord } from '@/application/services/portForward/models/PortForwardRecord'
import type { IPortForwardSessionOwner } from '@/application/services/portForward/types/IPortForwardSessionOwner'
import type { IPortForwardSink } from '@/application/services/portForward/types/IPortForwardSink'
import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { TPortForwardBackend } from '@/application/services/portForward/types/TPortForwardBackend'
import type { TPortForwardRuntime } from '@/application/services/portForward/types/TPortForwardRuntime'
import type { KubeForwardAdapter } from '@/infrastructure/channel/KubeForwardAdapter'
import type { IKubeForwardHandler } from '@/infrastructure/channel/types/IKubeForwardHandler'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'

export class PortForwardSession implements IClusterStream, IKubeForwardHandler {
    public forwardId: string = ''

    public runtime: TPortForwardRuntime = PortForwardRecord.idle('starting')

    public lastError: string = ''

    private stopped: boolean = false

    private checking: boolean = false

    private forget: (() => void) | null = null

    private timer: ReturnType<typeof setInterval> | null = null

    constructor(
        public readonly forward: TPortForward,
        private readonly forwards: KubeForwardAdapter,
        private readonly sink: IPortForwardSink,
        private readonly owner: IPortForwardSessionOwner,
    ) {}

    public get id(): string {
        return this.forward.id
    }

    public get clusterId(): string {
        return this.forward.clusterId
    }

    public get isStopped(): boolean {
        return this.stopped
    }

    public attach(forwardId: string, localPort: number, backend: TPortForwardBackend): void {
        this.forwardId = forwardId
        this.runtime = {
            status: 'active',
            error: '',
            boundPort: localPort,
            podName: backend.podName,
            targetPort: backend.targetPort,
        }
    }

    public hold(forget: () => void): void {
        this.forget = forget
    }

    public watch(intervalMs: number, tick: () => void): void {
        if (this.stopped || this.timer !== null) {
            return
        }

        this.timer = setInterval(tick, intervalMs)
    }

    public claimCheck(): boolean {
        if (this.stopped || this.checking) {
            return false
        }

        this.checking = true

        return true
    }

    public releaseCheck(): void {
        this.checking = false
    }

    public update(change: Partial<TPortForwardRuntime>): void {
        if (this.stopped) {
            return
        }

        this.runtime = { ...this.runtime, ...change }
        this.sink.onForwardChanged(this.id, { ...this.runtime })
    }

    public report(runtime: TPortForwardRuntime): void {
        this.sink.onForwardChanged(this.id, runtime)
    }

    public onError(details: string): void {
        if (this.stopped) {
            return
        }

        this.lastError = details
        this.owner.onSessionError(this, details)
    }

    public onClose(status: string): void {
        if (this.stopped) {
            return
        }

        this.stopped = true
        this.release()
        this.owner.onSessionClosed(this, status)
    }

    public async stop(): Promise<void> {
        if (this.stopped) {
            this.release()
            return
        }

        this.stopped = true
        this.release()

        await this.forwards.stop(this.forwardId)
    }

    private release(): void {
        this.forget?.()
        this.forget = null

        if (this.timer !== null) {
            clearInterval(this.timer)
            this.timer = null
        }
    }
}
