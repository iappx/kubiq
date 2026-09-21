import { Events } from '@wailsio/runtime'
import { TerminalBytes } from '@/domain/models/terminal'
import type { IKubeChannelHandler } from '@/infrastructure/channel/types/IKubeChannelHandler'
import type { TKubeChannelMessage } from '@/infrastructure/channel/types/TKubeChannelMessage'
import type { TKubeChannelStatus } from '@/infrastructure/channel/types/TKubeChannelStatus'

export class KubeChannelSubscription {
    public static readonly dataEvent: string = 'kube:channel:data'

    public static readonly errorEvent: string = 'kube:channel:error'

    public static readonly closeEvent: string = 'kube:channel:close'

    private readonly listeners: (() => void)[] = []

    private readonly pending: TKubeChannelMessage[] = []

    private channel: string = ''

    private closed: boolean = false

    constructor(private readonly handler: IKubeChannelHandler) {}

    public get id(): string {
        return this.channel
    }

    public get isClosed(): boolean {
        return this.closed
    }

    public listen(): void {
        this.listeners.push(
            Events.On(KubeChannelSubscription.dataEvent, (event: { data: { channelId?: string, stream?: string, data?: string } }) => {
                this.accept({
                    channelId: event.data?.channelId ?? '',
                    stream: event.data?.stream ?? 'stdout',
                    data: event.data?.data ?? '',
                })
            }),
            Events.On(KubeChannelSubscription.errorEvent, (event: { data: { channelId?: string, error?: string } }) => {
                this.accept({ channelId: event.data?.channelId ?? '', error: event.data?.error ?? '' })
            }),
            Events.On(KubeChannelSubscription.closeEvent, (event: { data: { channelId?: string, status?: string, reason?: string } }) => {
                this.accept({
                    channelId: event.data?.channelId ?? '',
                    status: KubeChannelSubscription.status(event.data?.status),
                    reason: event.data?.reason ?? '',
                })
            }),
        )
    }

    // The first frames are emitted while Open's answer is still crossing the bridge,
    // so everything before the id is known is held rather than dropped.
    public attach(channelId: string): void {
        this.channel = channelId
        const buffered = this.pending.splice(0, this.pending.length)
        buffered.forEach(message => this.accept(message))
    }

    public cancel(): void {
        this.closed = true
        this.release()
    }

    public release(): void {
        this.listeners.splice(0, this.listeners.length).forEach(unsubscribe => unsubscribe())
    }

    protected accept(message: TKubeChannelMessage): void {
        if (this.closed) {
            return
        }
        if (this.channel === '') {
            this.pending.push(message)
            return
        }
        if (message.channelId !== this.channel) {
            return
        }

        this.dispatch(message)
    }

    protected dispatch(message: TKubeChannelMessage): void {
        if (message.data !== undefined) {
            this.handler.onData(message.stream ?? 'stdout', TerminalBytes.decode(message.data))
            return
        }
        if (message.error !== undefined) {
            this.handler.onError(message.error)
            return
        }
        if (message.status !== undefined) {
            this.closed = true
            this.release()
            this.handler.onClose(message.status, message.reason ?? '')
        }
    }

    protected static status(status?: string): TKubeChannelStatus {
        return status === 'eof' || status === 'closed' ? status : 'error'
    }
}
