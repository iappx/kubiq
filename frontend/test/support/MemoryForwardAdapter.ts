import type { IKubeForwardHandler } from '@/infrastructure/channel/types/IKubeForwardHandler'
import type { TKubeForwardHandle } from '@/infrastructure/channel/types/TKubeForwardHandle'
import type { TKubeForwardSpec } from '@/infrastructure/channel/types/TKubeForwardSpec'

export class MemoryForward {
    public stopped = false

    constructor(
        public readonly id: string,
        public readonly spec: TKubeForwardSpec,
        public readonly localPort: number,
        private readonly handler: IKubeForwardHandler,
    ) {}

    public fail(details: string): void {
        this.handler.onError(details)
    }

    public end(status: string): void {
        this.handler.onClose(status)
    }
}

export class MemoryForwardAdapter {
    public static readonly loopback: string = '127.0.0.1'

    public available = true

    public refusal: Error | null = null

    public assignedPort = 34567

    public readonly forwards: MemoryForward[] = []

    private sequence = 0

    public get isAvailable(): boolean {
        return this.available
    }

    public async start(spec: TKubeForwardSpec, handler: IKubeForwardHandler): Promise<TKubeForwardHandle> {
        if (this.refusal) {
            throw this.refusal
        }

        this.sequence += 1
        const localPort = spec.localPort && spec.localPort > 0 ? spec.localPort : this.assignedPort
        const forward = new MemoryForward(`forward-${this.sequence}`, spec, localPort, handler)
        this.forwards.push(forward)

        return { forwardId: forward.id, localPort }
    }

    public async stop(forwardId: string): Promise<void> {
        const forward = this.forwards.find(open => open.id === forwardId)
        if (forward) {
            forward.stopped = true
        }
    }

    public get last(): MemoryForward {
        return this.forwards[this.forwards.length - 1]
    }

    public reset(): void {
        this.forwards.length = 0
        this.refusal = null
        this.available = true
        this.sequence = 0
    }
}
