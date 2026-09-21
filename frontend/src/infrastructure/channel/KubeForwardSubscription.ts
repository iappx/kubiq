import { Events } from '@wailsio/runtime'
import type { IKubeForwardHandler } from '@/infrastructure/channel/types/IKubeForwardHandler'

type TForwardMessage = {
    forwardId: string
    error?: string
    status?: string
}

export class KubeForwardSubscription {
    public static readonly errorEvent: string = 'kube:forward:error'

    public static readonly closeEvent: string = 'kube:forward:close'

    private readonly listeners: (() => void)[] = []

    private readonly pending: TForwardMessage[] = []

    private forward: string = ''

    private closed: boolean = false

    constructor(private readonly handler: IKubeForwardHandler) {}

    public get id(): string {
        return this.forward
    }

    public listen(): void {
        this.listeners.push(
            Events.On(KubeForwardSubscription.errorEvent, (event: { data: { forwardId?: string, error?: string } }) => {
                this.accept({ forwardId: event.data?.forwardId ?? '', error: event.data?.error ?? '' })
            }),
            Events.On(KubeForwardSubscription.closeEvent, (event: { data: { forwardId?: string, status?: string } }) => {
                this.accept({ forwardId: event.data?.forwardId ?? '', status: event.data?.status ?? 'closed' })
            }),
        )
    }

    public attach(forwardId: string): void {
        this.forward = forwardId
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

    protected accept(message: TForwardMessage): void {
        if (this.closed) {
            return
        }
        if (this.forward === '') {
            this.pending.push(message)
            return
        }
        if (message.forwardId !== this.forward) {
            return
        }

        if (message.error !== undefined) {
            this.handler.onError(message.error)
            return
        }
        if (message.status !== undefined) {
            this.closed = true
            this.release()
            this.handler.onClose(message.status)
        }
    }
}
