import { TerminalBytes } from '@/domain/models/terminal'
import type { IKubeChannelHandler } from '@/infrastructure/channel/types/IKubeChannelHandler'
import type { TKubeChannelSpec } from '@/infrastructure/channel/types/TKubeChannelSpec'
import type { TKubeChannelStatus } from '@/infrastructure/channel/types/TKubeChannelStatus'

export class MemoryChannel {
    public readonly writes: Uint8Array[] = []

    public readonly resizes: { cols: number, rows: number }[] = []

    public closed = false

    constructor(
        public readonly id: string,
        public readonly spec: TKubeChannelSpec,
        private readonly handler: IKubeChannelHandler,
    ) {}

    public data(text: string): void {
        this.handler.onData('stdout', TerminalBytes.fromText(text))
    }

    public bytes(data: Uint8Array): void {
        this.handler.onData('stdout', data)
    }

    public fail(details: string): void {
        this.handler.onError(details)
    }

    public end(status: TKubeChannelStatus, reason: string = ''): void {
        this.handler.onClose(status, reason)
    }

    public get written(): string {
        return this.writes.map(chunk => new TextDecoder().decode(chunk)).join('')
    }
}

export class MemoryChannelAdapter {
    public available = true

    public refusal: Error | null = null

    public readonly channels: MemoryChannel[] = []

    private sequence = 0

    public get isAvailable(): boolean {
        return this.available
    }

    public async connect(spec: TKubeChannelSpec, handler: IKubeChannelHandler): Promise<string> {
        if (this.refusal) {
            throw this.refusal
        }

        this.sequence += 1
        const channel = new MemoryChannel(`channel-${this.sequence}`, spec, handler)
        this.channels.push(channel)

        return channel.id
    }

    public async write(channelId: string, data: Uint8Array): Promise<void> {
        this.channel(channelId)?.writes.push(data)
    }

    public async resize(channelId: string, cols: number, rows: number): Promise<void> {
        this.channel(channelId)?.resizes.push({ cols, rows })
    }

    public async close(channelId: string): Promise<void> {
        const channel = this.channel(channelId)
        if (channel) {
            channel.closed = true
        }
    }

    public get last(): MemoryChannel {
        return this.channels[this.channels.length - 1]
    }

    public get paths(): string[] {
        return this.channels.map(channel => decodeURIComponent(channel.spec.path))
    }

    public reset(): void {
        this.channels.length = 0
        this.refusal = null
        this.available = true
        this.sequence = 0
    }

    private channel(channelId: string): MemoryChannel | undefined {
        return this.channels.find(channel => channel.id === channelId)
    }
}
