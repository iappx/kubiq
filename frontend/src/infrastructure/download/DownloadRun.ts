import { Events } from '@wailsio/runtime'
import { DownloadService } from '../../../bindings/iappx_k8s_admin/core/services/download'
import { ApiError } from '@/domain/errors/ApiError'
import type { IDownloadSink } from '@/infrastructure/download/types/IDownloadSink'
import type { TDownloadMessage } from '@/infrastructure/download/types/TDownloadMessage'
import type { TDownloadOutcome } from '@/infrastructure/download/types/TDownloadOutcome'

export class DownloadRun {
    public static readonly progressEvent: string = 'download:progress'

    public static readonly doneEvent: string = 'download:done'

    public static readonly failureMessage: string = 'The download failed'

    public readonly outcome: Promise<TDownloadOutcome>

    private readonly listeners: (() => void)[] = []

    private readonly pending: TDownloadMessage[] = []

    private downloadId: string = ''

    private finished: boolean = false

    private resolveOutcome!: (outcome: TDownloadOutcome) => void

    private rejectOutcome!: (error: ApiError) => void

    constructor(private readonly sink: IDownloadSink) {
        this.outcome = new Promise<TDownloadOutcome>((resolve, reject) => {
            this.resolveOutcome = resolve
            this.rejectOutcome = reject
        })
    }

    public get id(): string {
        return this.downloadId
    }

    public get isFinished(): boolean {
        return this.finished
    }

    public listen(): void {
        this.listeners.push(
            Events.On(DownloadRun.progressEvent, (event: { data: { downloadId?: string, received?: number, total?: number } }) => {
                this.accept({
                    downloadId: event.data?.downloadId ?? '',
                    progress: { received: event.data?.received ?? 0, total: event.data?.total ?? 0 },
                })
            }),
            Events.On(DownloadRun.doneEvent, (event: { data: Record<string, unknown> }) => {
                const data = event.data ?? {}
                this.accept({
                    downloadId: String(data.downloadId ?? ''),
                    done: {
                        success: data.success === true,
                        cancelled: data.cancelled === true,
                        path: String(data.path ?? ''),
                        size: Number(data.size ?? 0),
                        sha256: String(data.sha256 ?? ''),
                        error: String(data.error ?? ''),
                    },
                })
            }),
        )
    }

    // The Go side may finish a short download while Start is still answering.
    public attach(downloadId: string): void {
        this.downloadId = downloadId
        this.pending.splice(0, this.pending.length).forEach(message => this.accept(message))
    }

    public fail(error: ApiError): void {
        if (this.finished) {
            return
        }

        this.finish()
        this.rejectOutcome(error)
    }

    public async cancel(): Promise<void> {
        if (this.finished || this.downloadId === '') {
            return
        }

        try {
            await DownloadService.Cancel(this.downloadId)
        } catch {
            this.finish()
            this.resolveOutcome({ cancelled: true, path: '', size: 0, sha256: '' })
        }
    }

    protected accept(message: TDownloadMessage): void {
        if (this.finished) {
            return
        }
        if (this.downloadId === '') {
            this.pending.push(message)
            return
        }
        if (message.downloadId !== this.downloadId) {
            return
        }

        if (message.progress) {
            this.sink.onProgress(message.progress.received, message.progress.total)
            return
        }
        if (message.done) {
            this.complete(message.done)
        }
    }

    protected complete(done: NonNullable<TDownloadMessage['done']>): void {
        if (done.success || done.cancelled) {
            this.finish()
            this.resolveOutcome({ cancelled: done.cancelled, path: done.path, size: done.size, sha256: done.sha256 })
            return
        }

        this.fail(new ApiError(DownloadRun.failureMessage, done.error))
    }

    protected finish(): void {
        this.finished = true
        this.listeners.splice(0, this.listeners.length).forEach(unsubscribe => unsubscribe())
    }
}
