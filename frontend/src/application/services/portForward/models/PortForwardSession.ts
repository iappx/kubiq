import type { TPortForward } from '@/application/services/portForward/types/TPortForward'
import type { KubeForwardAdapter } from '@/infrastructure/channel/KubeForwardAdapter'
import type { IKubeForwardHandler } from '@/infrastructure/channel/types/IKubeForwardHandler'
import type { IClusterStream } from '@/infrastructure/kube/types/IClusterStream'

export class PortForwardSession implements IClusterStream, IKubeForwardHandler {
    public static readonly dropped: string = 'The forward was closed by the cluster'

    private stopped: boolean = false

    private forget: (() => void) | null = null

    constructor(
        public readonly forward: TPortForward,
        private readonly forwards: KubeForwardAdapter,
        private readonly onChanged: (forward: TPortForward) => void,
        private readonly onClosed: (forwardId: string) => void,
    ) {}

    public get id(): string {
        return this.forward.forwardId
    }

    public get clusterId(): string {
        return this.forward.clusterId
    }

    public hold(forget: () => void): void {
        this.forget = forget
    }

    public onError(details: string): void {
        if (this.stopped) {
            return
        }

        this.forward.state = 'failed'
        this.forward.failure = details === '' ? PortForwardSession.dropped : details
        this.onChanged(this.forward)
    }

    // A listener that dies on its own leaves the row in place with its reason; one we
    // closed ourselves is gone, because the user already knows why.
    public onClose(status: string): void {
        if (this.stopped) {
            return
        }

        this.stopped = true
        this.release()

        if (status === 'error' || this.forward.state === 'failed') {
            this.forward.state = 'failed'
            this.forward.failure = this.forward.failure === '' ? PortForwardSession.dropped : this.forward.failure
            this.onChanged(this.forward)
            return
        }

        this.onClosed(this.forward.forwardId)
    }

    public async stop(): Promise<void> {
        if (this.stopped) {
            this.release()
            return
        }

        this.stopped = true
        this.release()

        await this.forwards.stop(this.forward.forwardId)
    }

    private release(): void {
        this.forget?.()
        this.forget = null
    }
}
