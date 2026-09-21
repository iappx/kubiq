import { ChannelExitReason } from '@/application/services/terminal/models/ChannelExitReason'
import { TerminalSession } from '@/application/services/terminal/models/TerminalSession'
import type { ITerminalSink } from '@/application/services/terminal/types/ITerminalSink'
import type { TTerminalKind } from '@/domain/models/terminal'
import type { KubeChannelAdapter } from '@/infrastructure/channel/KubeChannelAdapter'
import type { IKubeChannelHandler } from '@/infrastructure/channel/types/IKubeChannelHandler'
import type { TKubeChannelStatus } from '@/infrastructure/channel/types/TKubeChannelStatus'

export class ChannelTerminalSession extends TerminalSession implements IKubeChannelHandler {
    public static readonly dropped: string = 'The cluster closed this session'

    private channelId: string = ''

    private transportFailure: string = ''

    private cleanup: (() => Promise<void>) | null = null

    constructor(
        key: string,
        clusterId: string,
        kind: TTerminalKind,
        sink: ITerminalSink,
        private readonly channels: KubeChannelAdapter,
    ) {
        super(key, clusterId, kind, sink)
    }

    public attach(channelId: string): void {
        if (this.disposed) {
            void this.channels.close(channelId)
            return
        }

        this.channelId = channelId
        this.enter('running')
    }

    public onCleanup(cleanup: () => Promise<void>): void {
        this.cleanup = cleanup
    }

    public onData(_stream: string, data: Uint8Array): void {
        this.enter('running')
        this.publish(data)
    }

    public onError(details: string): void {
        this.transportFailure = details
    }

    public onClose(status: TKubeChannelStatus, reason: string): void {
        if (this.disposed) {
            return
        }

        const explained = ChannelExitReason.text(reason)

        if (status === 'error') {
            this.enter('failed', explained || this.transportFailure || ChannelTerminalSession.dropped)
            return
        }

        this.enter('ended', explained)
    }

    public write(data: Uint8Array): Promise<void> {
        return this.isWritable ? this.channels.write(this.channelId, data) : Promise.resolve()
    }

    public resize(cols: number, rows: number): Promise<void> {
        return this.channels.resize(this.channelId, cols, rows)
    }

    public async stop(): Promise<void> {
        const channelId = this.channelId
        const cleanup = this.cleanup

        this.channelId = ''
        this.cleanup = null
        this.dispose()

        await this.channels.close(channelId)
        await cleanup?.()
    }
}
