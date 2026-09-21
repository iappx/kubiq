import { Events } from '@wailsio/runtime'
import { KubeService } from '../../../../../bindings/iappx_k8s_admin/core/services/kube'
import { ApiError } from '@/domain/errors/ApiError'
import { KubeWatchEventReader } from '@/infrastructure/entityRepo/kube/transport/KubeWatchEventReader'
import type { IKubeWatchHandler } from '@/infrastructure/entityRepo/kube/transport/types/IKubeWatchHandler'
import type { TKubeStreamMessage } from '@/infrastructure/entityRepo/kube/transport/types/TKubeStreamMessage'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export class KubeWatchSubscription {
    public static readonly chunkEvent: string = 'kube:stream:chunk'

    public static readonly errorEvent: string = 'kube:stream:error'

    public static readonly closeEvent: string = 'kube:stream:close'

    public static readonly interrupted: string = 'The connection to the cluster was interrupted while watching for changes'

    public static readonly unstoppable: string = 'Could not stop watching the cluster for changes'

    private readonly handler: IKubeWatchHandler

    private readonly listeners: (() => void)[] = []

    private readonly pending: TKubeStreamMessage[] = []

    private streamId: string = ''

    private closed: boolean = false

    constructor(handler: IKubeWatchHandler) {
        this.handler = handler
    }

    public get id(): string {
        return this.streamId
    }

    public get isClosed(): boolean {
        return this.closed
    }

    public listen(): void {
        this.listeners.push(
            Events.On(KubeWatchSubscription.chunkEvent, (event: { data: { streamId?: string, data?: string } }) => {
                this.accept({ streamId: event.data?.streamId ?? '', chunk: event.data?.data ?? '' })
            }),
            Events.On(KubeWatchSubscription.errorEvent, (event: { data: { streamId?: string, error?: string } }) => {
                this.accept({ streamId: event.data?.streamId ?? '', error: event.data?.error ?? '' })
            }),
            Events.On(KubeWatchSubscription.closeEvent, (event: { data: { streamId?: string, status?: string } }) => {
                this.accept({ streamId: event.data?.streamId ?? '', status: KubeWatchSubscription.status(event.data?.status) })
            }),
        )
    }

    // The Go side starts reading the response before StartStream answers, so the
    // first lines can arrive while the stream id is still unknown.
    public attach(streamId: string): void {
        this.streamId = streamId
        const buffered = this.pending.splice(0, this.pending.length)
        buffered.forEach(message => this.accept(message))
    }

    public cancel(): void {
        this.closed = true
        this.release()
    }

    public async stop(): Promise<void> {
        if (this.closed) {
            return
        }
        if (this.streamId === '') {
            this.close('stopped')
            return
        }
        try {
            // A stream the Go side no longer knows is already stopped, which is
            // what was asked for — only a broken bridge is worth reporting.
            await KubeService.StopStream(this.streamId)
        } catch (err) {
            throw new ApiError(
                KubeWatchSubscription.unstoppable,
                err instanceof Error ? err.message : String(err),
            )
        } finally {
            this.close('stopped')
        }
    }

    protected accept(message: TKubeStreamMessage): void {
        if (this.closed) {
            return
        }
        if (this.streamId === '') {
            this.pending.push(message)
            return
        }
        if (message.streamId !== this.streamId) {
            return
        }
        this.dispatch(message)
    }

    protected dispatch(message: TKubeStreamMessage): void {
        if (message.chunk !== undefined) {
            const event = KubeWatchEventReader.read(message.chunk)
            if (event) {
                this.handler.onEvent(event)
            }
            return
        }
        if (message.error !== undefined) {
            this.handler.onEvent({
                type: 'error',
                message: KubeWatchSubscription.interrupted,
                details: message.error,
            })
            return
        }
        if (message.status !== undefined) {
            this.close(message.status)
        }
    }

    protected close(status: TKubeWatchStatus): void {
        if (this.closed) {
            return
        }
        this.closed = true
        this.release()
        this.handler.onClose(status)
    }

    protected release(): void {
        this.listeners.splice(0, this.listeners.length).forEach(unsubscribe => unsubscribe())
    }

    protected static status(status?: string): TKubeWatchStatus {
        return status === 'eof' || status === 'stopped' ? status : 'error'
    }
}
