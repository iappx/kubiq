import { Events } from '@wailsio/runtime'
import { KubeService } from '../../../../../bindings/iappx_k8s_admin/core/services/kube'
import { ApiError } from '@/domain/errors/ApiError'
import type { TKubeStreamMessage } from '@/infrastructure/entityRepo/kube/transport/types/TKubeStreamMessage'
import type { TKubeWatchStatus } from '@/infrastructure/entityRepo/kube/transport/types/TKubeWatchStatus'

export abstract class KubeStreamSubscriptionBase {
    public static readonly chunkEvent: string = 'kube:stream:chunk'

    public static readonly errorEvent: string = 'kube:stream:error'

    public static readonly closeEvent: string = 'kube:stream:close'

    private readonly listeners: (() => void)[] = []

    private readonly pending: TKubeStreamMessage[] = []

    private streamId: string = ''

    private closed: boolean = false

    public get id(): string {
        return this.streamId
    }

    public get isClosed(): boolean {
        return this.closed
    }

    public listen(): void {
        this.listeners.push(
            Events.On(KubeStreamSubscriptionBase.chunkEvent, (event: { data: { streamId?: string, data?: string } }) => {
                this.accept({ streamId: event.data?.streamId ?? '', chunk: event.data?.data ?? '' })
            }),
            Events.On(KubeStreamSubscriptionBase.errorEvent, (event: { data: { streamId?: string, error?: string } }) => {
                this.accept({ streamId: event.data?.streamId ?? '', error: event.data?.error ?? '' })
            }),
            Events.On(KubeStreamSubscriptionBase.closeEvent, (event: { data: { streamId?: string, status?: string } }) => {
                this.accept({ streamId: event.data?.streamId ?? '', status: KubeStreamSubscriptionBase.status(event.data?.status) })
            }),
        )
    }

    // The Go side reads the response before StartStream answers, so chunks buffer
    // while the stream id is still unknown.
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
            await KubeService.StopStream(this.streamId)
        } catch (err) {
            throw new ApiError(this.stopFailure, err instanceof Error ? err.message : String(err))
        } finally {
            this.close('stopped')
        }
    }

    protected abstract get stopFailure(): string

    protected abstract onChunk(chunk: string): void

    protected abstract onFailure(details: string): void

    protected abstract onClosed(status: TKubeWatchStatus): void

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
            this.onChunk(message.chunk)
            return
        }
        if (message.error !== undefined) {
            this.onFailure(message.error)
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
        this.onClosed(status)
    }

    protected release(): void {
        this.listeners.splice(0, this.listeners.length).forEach(unsubscribe => unsubscribe())
    }

    protected static status(status?: string): TKubeWatchStatus {
        return status === 'eof' || status === 'stopped' ? status : 'error'
    }
}
