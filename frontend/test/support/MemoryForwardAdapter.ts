import type { IKubeForwardHandler } from '@/infrastructure/channel/types/IKubeForwardHandler'
import type { TKubeForwardHandle } from '@/infrastructure/channel/types/TKubeForwardHandle'
import type { TKubeForwardSpec } from '@/infrastructure/channel/types/TKubeForwardSpec'
import type { TKubeForwardTarget } from '@/infrastructure/channel/types/TKubeForwardTarget'

export class MemoryForward {
    public stopped = false

    public readonly targets: TKubeForwardTarget[] = []

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

    public readonly takenPorts = new Set<number>()

    public readonly forwards: MemoryForward[] = []

    public readonly attempts: TKubeForwardSpec[] = []

    private sequence = 0

    public get isAvailable(): boolean {
        return this.available
    }

    public async start(spec: TKubeForwardSpec, handler: IKubeForwardHandler): Promise<TKubeForwardHandle> {
        this.attempts.push(spec)
        if (this.refusal) {
            throw this.refusal
        }
        if (spec.localPort && this.takenPorts.has(spec.localPort)) {
            throw new Error(`listen tcp 127.0.0.1:${spec.localPort}: address already in use`)
        }

        this.sequence += 1
        const localPort = spec.localPort && spec.localPort > 0 ? spec.localPort : this.assignedPort
        const forward = new MemoryForward(`forward-${this.sequence}`, spec, localPort, handler)
        this.forwards.push(forward)

        return { forwardId: forward.id, localPort }
    }

    public async retarget(forwardId: string, target: TKubeForwardTarget): Promise<void> {
        const forward = this.forwards.find(open => open.id === forwardId && !open.stopped)
        if (!forward) {
            throw new Error(`unknown forward: ${forwardId}`)
        }

        forward.targets.push(target)
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
        this.attempts.length = 0
        this.takenPorts.clear()
        this.refusal = null
        this.available = true
        this.assignedPort = 34567
        this.sequence = 0
    }
}
